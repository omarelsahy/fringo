-- Fix get_setup_progress: RETURNS TABLE output columns shadowed unqualified
-- references inside the subquery (PostgREST 400: ambiguous target_player_id).
-- Also let create_game accept a host display name so launchers/UI can set Alice etc.

CREATE OR REPLACE FUNCTION public.ensure_profile(p_user_id uuid, p_display_name text DEFAULT 'Player')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text := COALESCE(NULLIF(trim(p_display_name), ''), 'Player');
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id required';
  END IF;

  INSERT INTO public.profiles (id, display_name)
  VALUES (p_user_id, v_name)
  ON CONFLICT (id) DO UPDATE
  SET
    -- Prefer an explicit non-default name over the auth-trigger default "Player"
    display_name = CASE
      WHEN public.profiles.display_name IS NULL
        OR public.profiles.display_name IN ('Player', 'Host')
        OR v_name NOT IN ('Player', 'Host')
      THEN v_name
      ELSE public.profiles.display_name
    END,
    updated_at = now();
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
  SELECT gs.actions_per_target INTO v_required
  FROM public.game_settings gs
  WHERE gs.game_id = p_game_id;

  RETURN QUERY
  SELECT
    gp.id AS target_player_id,
    gp.display_name AS target_display_name,
    coalesce(sc.cnt, 0)::bigint AS submission_count,
    v_required AS required_count
  FROM public.game_players gp
  LEFT JOIN (
    SELECT s.target_player_id AS tid, count(*)::bigint AS cnt
    FROM public.action_submissions s
    WHERE s.game_id = p_game_id AND s.status = 'submitted'
    GROUP BY s.target_player_id
  ) sc ON sc.tid = gp.id
  WHERE gp.game_id = p_game_id AND gp.status = 'active'
  ORDER BY gp.display_name;
END;
$$;

DROP FUNCTION IF EXISTS public.create_game(
  text, text, integer, integer, boolean, integer, integer, boolean, integer, integer, integer, integer, text
);

CREATE OR REPLACE FUNCTION public.create_game(
  p_name text,
  p_category text DEFAULT NULL,
  p_board_rows int DEFAULT 5,
  p_board_cols int DEFAULT 5,
  p_has_free_space boolean DEFAULT true,
  p_actions_per_target int DEFAULT 24,
  p_guesses_per_target int DEFAULT 4,
  p_allow_diagonals boolean DEFAULT true,
  p_normal_fringo_points int DEFAULT 1,
  p_multi_fringo_points int DEFAULT 3,
  p_pre_action_guess_points int DEFAULT 1,
  p_giveaway_penalty_points int DEFAULT -1,
  p_end_condition text DEFAULT 'all_targets_claimed',
  p_display_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_game_id uuid;
  v_invite_code text;
  v_player_id uuid;
  v_free_row int;
  v_free_col int;
  v_host_name text := COALESCE(NULLIF(trim(p_display_name), ''), 'Host');
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.ensure_profile(v_user_id, v_host_name);

  LOOP
    v_invite_code := public.generate_invite_code();
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.games WHERE invite_code = v_invite_code);
  END LOOP;

  INSERT INTO public.games (name, category, invite_code, created_by, status)
  VALUES (p_name, p_category, v_invite_code, v_user_id, 'lobby')
  RETURNING id INTO v_game_id;

  SELECT row_idx, col_idx
  INTO v_free_row, v_free_col
  FROM public.default_free_space_position(p_board_rows, p_board_cols);

  INSERT INTO public.game_settings (
    game_id, board_rows, board_cols, has_free_space,
    free_space_row, free_space_col, actions_per_target, guesses_per_target,
    allow_diagonals, normal_fringo_points, multi_fringo_points,
    pre_action_guess_points, giveaway_penalty_points, end_condition
  )
  VALUES (
    v_game_id, p_board_rows, p_board_cols, p_has_free_space,
    CASE WHEN p_has_free_space THEN v_free_row ELSE NULL END,
    CASE WHEN p_has_free_space THEN v_free_col ELSE NULL END,
    p_actions_per_target, p_guesses_per_target,
    p_allow_diagonals, p_normal_fringo_points, p_multi_fringo_points,
    p_pre_action_guess_points, p_giveaway_penalty_points, p_end_condition
  );

  INSERT INTO public.game_players (game_id, user_id, display_name, role, guesses_remaining)
  VALUES (
    v_game_id,
    v_user_id,
    v_host_name,
    'host',
    p_guesses_per_target
  )
  RETURNING id INTO v_player_id;

  PERFORM public.log_event(v_game_id, v_player_id, 'game_created', jsonb_build_object('name', p_name));

  RETURN v_game_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
