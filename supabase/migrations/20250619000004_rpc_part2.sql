-- Fix generate_boards and add remaining RPCs

CREATE OR REPLACE FUNCTION public.generate_boards(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_settings public.game_settings%ROWTYPE;
  v_target record;
  v_owner record;
  v_board_id uuid;
  v_action_ids uuid[];
  v_positions record;
  v_pos_list jsonb := '[]'::jsonb;
  v_action_list uuid[];
  v_i int;
  v_required int;
BEGIN
  SELECT * INTO v_settings FROM public.game_settings WHERE game_id = p_game_id;
  v_required := CASE
    WHEN v_settings.has_free_space
      THEN v_settings.board_rows * v_settings.board_cols - 1
    ELSE v_settings.board_rows * v_settings.board_cols
  END;

  FOR v_target IN
    SELECT id FROM public.game_players
    WHERE game_id = p_game_id AND status = 'active'
  LOOP
    SELECT array_agg(sa.id ORDER BY md5(sa.id::text || v_target.id::text))
    INTO v_action_ids
    FROM public.selected_actions sa
    WHERE sa.game_id = p_game_id AND sa.target_player_id = v_target.id;

    IF coalesce(array_length(v_action_ids, 1), 0) <> v_required THEN
      RAISE EXCEPTION 'Target % missing selected actions (need %, have %)',
        v_target.id, v_required, coalesce(array_length(v_action_ids, 1), 0);
    END IF;

    FOR v_owner IN
      SELECT id FROM public.game_players
      WHERE game_id = p_game_id AND status = 'active' AND id <> v_target.id
    LOOP
      INSERT INTO public.boards (game_id, owner_player_id, target_player_id)
      VALUES (p_game_id, v_owner.id, v_target.id)
      RETURNING id INTO v_board_id;

      -- Create all squares
      FOR v_i IN 0..(v_settings.board_rows - 1) LOOP
        FOR v_positions IN
          SELECT generate_series(0, v_settings.board_cols - 1) AS col_idx
        LOOP
          IF v_settings.has_free_space
            AND v_i = v_settings.free_space_row
            AND v_positions.col_idx = v_settings.free_space_col THEN
            INSERT INTO public.board_squares (board_id, row_index, col_index, state)
            VALUES (v_board_id, v_i, v_positions.col_idx, 'free');
          ELSE
            INSERT INTO public.board_squares (board_id, row_index, col_index, state)
            VALUES (v_board_id, v_i, v_positions.col_idx, 'unmarked');
          END IF;
        END LOOP;
      END LOOP;

      -- Build shuffled position list for non-free cells
      SELECT array_agg(bs.id ORDER BY md5(bs.id::text || v_board_id::text))
      INTO v_action_list
      FROM public.board_squares bs
      WHERE bs.board_id = v_board_id AND bs.state = 'unmarked';

      -- Shuffle actions per board
      SELECT array_agg(aid ORDER BY md5(aid::text || v_board_id::text))
      INTO v_action_ids
      FROM unnest(
        (SELECT array_agg(sa.id)
         FROM public.selected_actions sa
         WHERE sa.game_id = p_game_id AND sa.target_player_id = v_target.id)
      ) AS aid;

      FOR v_i IN 1..coalesce(array_length(v_action_list, 1), 0) LOOP
        UPDATE public.board_squares
        SET selected_action_id = v_action_ids[v_i]
        WHERE id = v_action_list[v_i];
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- finalize_setup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_setup(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target record;
  v_required int;
  v_count int;
BEGIN
  IF NOT public.is_admin(p_game_id) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF (SELECT status FROM public.games WHERE id = p_game_id) <> 'setup' THEN
    RAISE EXCEPTION 'Game must be in setup status';
  END IF;

  SELECT actions_per_target INTO v_required
  FROM public.game_settings WHERE game_id = p_game_id;

  FOR v_target IN
    SELECT id FROM public.game_players
    WHERE game_id = p_game_id AND status = 'active'
  LOOP
    SELECT count(*) INTO v_count
    FROM public.action_submissions
    WHERE game_id = p_game_id
      AND target_player_id = v_target.id
      AND status = 'submitted';

    IF v_count < v_required THEN
      RAISE EXCEPTION 'Target % has only % submissions, need %',
        v_target.id, v_count, v_required;
    END IF;

    PERFORM public.finalize_actions_for_target(p_game_id, v_target.id);
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- start_game
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_game(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guesses int;
BEGIN
  IF NOT public.is_admin(p_game_id) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  IF (SELECT status FROM public.games WHERE id = p_game_id) <> 'setup' THEN
    RAISE EXCEPTION 'Game must be in setup status';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.selected_actions WHERE game_id = p_game_id LIMIT 1
  ) AND NOT EXISTS (
    SELECT 1 FROM public.boards WHERE game_id = p_game_id LIMIT 1
  ) THEN
    PERFORM public.generate_boards(p_game_id);
  ELSIF NOT EXISTS (
    SELECT 1 FROM public.selected_actions WHERE game_id = p_game_id LIMIT 1
  ) THEN
    PERFORM public.finalize_setup(p_game_id);
    PERFORM public.generate_boards(p_game_id);
  END IF;

  SELECT guesses_per_target INTO v_guesses
  FROM public.game_settings WHERE game_id = p_game_id;

  UPDATE public.game_players
  SET guesses_remaining = v_guesses
  WHERE game_id = p_game_id AND status = 'active';

  UPDATE public.games
  SET status = 'active', starts_at = coalesce(starts_at, now()), updated_at = now()
  WHERE id = p_game_id;

  PERFORM public.log_event(p_game_id, public.current_player_id(p_game_id), 'game_started', '{}');
END;
$$;

-- ---------------------------------------------------------------------------
-- end_game / reveal_game
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.end_game(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(p_game_id) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  UPDATE public.games
  SET status = 'ended', ends_at = now(), updated_at = now()
  WHERE id = p_game_id AND status = 'active';
END;
$$;

CREATE OR REPLACE FUNCTION public.reveal_game(p_game_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(p_game_id) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  UPDATE public.games
  SET status = 'revealed', updated_at = now()
  WHERE id = p_game_id AND status IN ('active', 'ended');

  UPDATE public.selected_actions
  SET global_state = 'revealed'
  WHERE game_id = p_game_id;

  UPDATE public.boards
  SET state = 'revealed'
  WHERE game_id = p_game_id;
END;
$$;

-- ---------------------------------------------------------------------------
-- Setup RPCs
-- ---------------------------------------------------------------------------
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
BEGIN
  SELECT game_id, submitted_by_player_id
  INTO v_game_id, v_player_id
  FROM public.action_submissions
  WHERE id = p_submission_id AND status = 'submitted';

  IF v_player_id IS NULL OR v_player_id <> public.current_player_id(v_game_id) THEN
    RAISE EXCEPTION 'Cannot edit this submission';
  END IF;

  UPDATE public.action_submissions
  SET text = trim(p_text), updated_at = now()
  WHERE id = p_submission_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_own_submission(p_submission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid;
  v_game_id uuid;
BEGIN
  SELECT game_id, submitted_by_player_id
  INTO v_game_id, v_player_id
  FROM public.action_submissions
  WHERE id = p_submission_id AND status = 'submitted';

  IF v_player_id IS NULL OR v_player_id <> public.current_player_id(v_game_id) THEN
    RAISE EXCEPTION 'Cannot remove this submission';
  END IF;

  UPDATE public.action_submissions
  SET status = 'removed', updated_at = now()
  WHERE id = p_submission_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.upvote_submission(p_submission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sub public.action_submissions%ROWTYPE;
  v_voter uuid;
  v_allow_self boolean;
BEGIN
  SELECT * INTO v_sub FROM public.action_submissions WHERE id = p_submission_id;

  IF v_sub.id IS NULL OR v_sub.status <> 'submitted' THEN
    RAISE EXCEPTION 'Invalid submission';
  END IF;

  IF (SELECT status FROM public.games WHERE id = v_sub.game_id) <> 'setup' THEN
    RAISE EXCEPTION 'Game not in setup';
  END IF;

  v_voter := public.current_player_id(v_sub.game_id);

  IF v_voter IS NULL THEN
    RAISE EXCEPTION 'Not a game member';
  END IF;

  IF v_voter = v_sub.target_player_id THEN
    RAISE EXCEPTION 'Target cannot vote on their own actions';
  END IF;

  SELECT allow_self_upvote INTO v_allow_self
  FROM public.game_settings WHERE game_id = v_sub.game_id;

  IF NOT v_allow_self AND v_voter = v_sub.submitted_by_player_id THEN
    RAISE EXCEPTION 'Self-upvote not allowed';
  END IF;

  INSERT INTO public.action_upvotes (submission_id, voter_player_id)
  VALUES (p_submission_id, v_voter)
  ON CONFLICT (submission_id, voter_player_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_upvote(p_submission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game_id uuid;
  v_voter uuid;
BEGIN
  SELECT game_id INTO v_game_id FROM public.action_submissions WHERE id = p_submission_id;
  v_voter := public.current_player_id(v_game_id);

  DELETE FROM public.action_upvotes
  WHERE submission_id = p_submission_id AND voter_player_id = v_voter;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_submission(p_submission_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_game_id uuid;
BEGIN
  SELECT game_id INTO v_game_id FROM public.action_submissions WHERE id = p_submission_id;

  IF NOT public.is_admin(v_game_id) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  UPDATE public.action_submissions
  SET status = 'removed', updated_at = now()
  WHERE id = p_submission_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_setup_feed(p_game_id uuid)
RETURNS TABLE (
  id uuid,
  game_id uuid,
  target_player_id uuid,
  target_display_name text,
  text text,
  status text,
  vote_count bigint,
  voted_by_me boolean,
  is_mine boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid;
BEGIN
  v_player_id := public.current_player_id(p_game_id);

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not a game member';
  END IF;

  RETURN QUERY
  SELECT
    s.id,
    s.game_id,
    s.target_player_id,
    tp.display_name AS target_display_name,
    s.text,
    s.status,
    coalesce(vc.cnt, 0) AS vote_count,
    EXISTS (
      SELECT 1 FROM public.action_upvotes u
      WHERE u.submission_id = s.id AND u.voter_player_id = v_player_id
    ) AS voted_by_me,
    s.submitted_by_player_id = v_player_id AS is_mine,
    s.created_at
  FROM public.action_submissions s
  JOIN public.game_players tp ON tp.id = s.target_player_id
  LEFT JOIN (
    SELECT submission_id, count(*) AS cnt
    FROM public.action_upvotes
    GROUP BY submission_id
  ) vc ON vc.submission_id = s.id
  WHERE s.game_id = p_game_id
    AND s.status IN ('submitted', 'selected')
    AND s.target_player_id <> v_player_id
  ORDER BY s.target_player_id, coalesce(vc.cnt, 0) DESC, s.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_setup_progress(p_game_id uuid)
RETURNS TABLE (
  target_player_id uuid,
  target_display_name text,
  submission_count bigint,
  required_count int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required int;
BEGIN
  SELECT actions_per_target INTO v_required
  FROM public.game_settings WHERE game_id = p_game_id;

  RETURN QUERY
  SELECT
    gp.id,
    gp.display_name,
    coalesce(sc.cnt, 0),
    v_required
  FROM public.game_players gp
  LEFT JOIN (
    SELECT target_player_id, count(*) AS cnt
    FROM public.action_submissions
    WHERE game_id = p_game_id AND status = 'submitted'
    GROUP BY target_player_id
  ) sc ON sc.target_player_id = gp.id
  WHERE gp.game_id = p_game_id AND gp.status = 'active'
  ORDER BY gp.display_name;
END;
$$;
