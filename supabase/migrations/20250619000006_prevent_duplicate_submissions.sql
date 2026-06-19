-- Prevent duplicate / near-duplicate action submissions per target during setup

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE OR REPLACE FUNCTION public.normalize_action_text(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT regexp_replace(lower(trim(p_text)), '\s+', ' ', 'g');
$$;

CREATE OR REPLACE FUNCTION public.find_similar_submission(
  p_game_id uuid,
  p_target_player_id uuid,
  p_text text,
  p_exclude_submission_id uuid DEFAULT NULL
)
RETURNS TABLE (existing_text text, match_type text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_normalized text := public.normalize_action_text(p_text);
BEGIN
  IF length(v_normalized) < 1 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT s.text, 'exact'::text
  FROM public.action_submissions s
  WHERE s.game_id = p_game_id
    AND s.target_player_id = p_target_player_id
    AND s.status = 'submitted'
    AND (p_exclude_submission_id IS NULL OR s.id <> p_exclude_submission_id)
    AND public.normalize_action_text(s.text) = v_normalized
  LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  -- Fuzzy match for longer phrases (pg_trgm)
  IF length(v_normalized) >= 15 THEN
    RETURN QUERY
    SELECT s.text, 'similar'::text
    FROM public.action_submissions s
    WHERE s.game_id = p_game_id
      AND s.target_player_id = p_target_player_id
      AND s.status = 'submitted'
      AND (p_exclude_submission_id IS NULL OR s.id <> p_exclude_submission_id)
      AND similarity(public.normalize_action_text(s.text), v_normalized) >= 0.6
    ORDER BY similarity(public.normalize_action_text(s.text), v_normalized) DESC
    LIMIT 1;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.assert_action_not_duplicate(
  p_game_id uuid,
  p_target_player_id uuid,
  p_text text,
  p_exclude_submission_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_text text;
BEGIN
  SELECT existing_text INTO v_existing_text
  FROM public.find_similar_submission(
    p_game_id, p_target_player_id, p_text, p_exclude_submission_id
  )
  LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION
      'Too similar to an existing submission for this player: "%"',
      v_existing_text
      USING ERRCODE = 'check_violation';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_action(
  p_game_id uuid,
  p_target_player_id uuid,
  p_text text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid;
  v_submission_id uuid;
BEGIN
  v_player_id := public.current_player_id(p_game_id);

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not a game member';
  END IF;

  IF (SELECT status FROM public.games WHERE id = p_game_id) <> 'setup' THEN
    RAISE EXCEPTION 'Game not in setup';
  END IF;

  IF p_target_player_id = v_player_id THEN
    RAISE EXCEPTION 'Cannot submit actions for yourself';
  END IF;

  IF length(trim(p_text)) < 1 THEN
    RAISE EXCEPTION 'Action text required';
  END IF;

  PERFORM public.assert_action_not_duplicate(p_game_id, p_target_player_id, p_text);

  INSERT INTO public.action_submissions (
    game_id, target_player_id, submitted_by_player_id, text
  )
  VALUES (p_game_id, p_target_player_id, v_player_id, trim(p_text))
  RETURNING id INTO v_submission_id;

  RETURN v_submission_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.edit_own_submission(
  p_submission_id uuid,
  p_text text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid;
  v_game_id uuid;
  v_target_player_id uuid;
BEGIN
  SELECT game_id, submitted_by_player_id, target_player_id
  INTO v_game_id, v_player_id, v_target_player_id
  FROM public.action_submissions
  WHERE id = p_submission_id AND status = 'submitted';

  IF v_player_id IS NULL OR v_player_id <> public.current_player_id(v_game_id) THEN
    RAISE EXCEPTION 'Cannot edit this submission';
  END IF;

  IF length(trim(p_text)) < 1 THEN
    RAISE EXCEPTION 'Action text required';
  END IF;

  PERFORM public.assert_action_not_duplicate(
    v_game_id, v_target_player_id, p_text, p_submission_id
  );

  UPDATE public.action_submissions
  SET text = trim(p_text), updated_at = now()
  WHERE id = p_submission_id;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_action_submissions_trgm_text
  ON public.action_submissions
  USING gin (public.normalize_action_text(text) gin_trgm_ops);
