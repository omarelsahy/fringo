-- Ensure profiles exist before game_players FK inserts (dev launcher / anonymous auth race)

CREATE OR REPLACE FUNCTION public.ensure_profile(p_user_id uuid, p_display_name text DEFAULT 'Player')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'User id required';
  END IF;

  INSERT INTO public.profiles (id, display_name)
  VALUES (p_user_id, COALESCE(NULLIF(trim(p_display_name), ''), 'Player'))
  ON CONFLICT (id) DO UPDATE
  SET display_name = COALESCE(public.profiles.display_name, EXCLUDED.display_name),
      updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.create_game(
  p_name text,
  p_category text DEFAULT NULL,
  p_board_rows int DEFAULT 5,
  p_board_cols int DEFAULT 5,
  p_has_free_space boolean DEFAULT true,
  p_actions_per_target int DEFAULT 24,
  p_guesses_per_target int DEFAULT 4,
  p_allow_diagonals boolean DEFAULT true,
  p_normal_bingo_points int DEFAULT 1,
  p_multi_bingo_points int DEFAULT 3,
  p_pre_action_guess_points int DEFAULT 1,
  p_giveaway_penalty_points int DEFAULT -1,
  p_end_condition text DEFAULT 'all_targets_claimed'
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
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  PERFORM public.ensure_profile(v_user_id, 'Host');

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
    allow_diagonals, normal_bingo_points, multi_bingo_points,
    pre_action_guess_points, giveaway_penalty_points, end_condition
  )
  VALUES (
    v_game_id, p_board_rows, p_board_cols, p_has_free_space,
    CASE WHEN p_has_free_space THEN v_free_row ELSE NULL END,
    CASE WHEN p_has_free_space THEN v_free_col ELSE NULL END,
    p_actions_per_target, p_guesses_per_target,
    p_allow_diagonals, p_normal_bingo_points, p_multi_bingo_points,
    p_pre_action_guess_points, p_giveaway_penalty_points, p_end_condition
  );

  INSERT INTO public.game_players (game_id, user_id, display_name, role, guesses_remaining)
  VALUES (
    v_game_id,
    v_user_id,
    COALESCE((SELECT display_name FROM public.profiles WHERE id = v_user_id), 'Host'),
    'host',
    p_guesses_per_target
  )
  RETURNING id INTO v_player_id;

  PERFORM public.log_event(v_game_id, v_player_id, 'game_created', jsonb_build_object('name', p_name));

  RETURN v_game_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.join_game(
  p_invite_code text,
  p_display_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_game_id uuid;
  v_player_id uuid;
  v_guesses int;
  v_status text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF length(trim(p_display_name)) < 1 THEN
    RAISE EXCEPTION 'Display name required';
  END IF;

  SELECT g.id, g.status, gs.guesses_per_target
  INTO v_game_id, v_status, v_guesses
  FROM public.games g
  JOIN public.game_settings gs ON gs.game_id = g.id
  WHERE upper(g.invite_code) = upper(trim(p_invite_code));

  IF v_game_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  IF v_status NOT IN ('lobby', 'setup') THEN
    RAISE EXCEPTION 'Game is not joinable';
  END IF;

  PERFORM public.ensure_profile(v_user_id, trim(p_display_name));

  SELECT id INTO v_player_id
  FROM public.game_players
  WHERE game_id = v_game_id AND user_id = v_user_id;

  IF v_player_id IS NOT NULL THEN
    UPDATE public.game_players
    SET display_name = trim(p_display_name), status = 'active'
    WHERE id = v_player_id;
    RETURN v_player_id;
  END IF;

  INSERT INTO public.game_players (game_id, user_id, display_name, role, guesses_remaining)
  VALUES (v_game_id, v_user_id, trim(p_display_name), 'player', v_guesses)
  RETURNING id INTO v_player_id;

  PERFORM public.log_event(v_game_id, v_player_id, 'player_joined', jsonb_build_object('display_name', trim(p_display_name)));

  RETURN v_player_id;
END;
$$;

NOTIFY pgrst, 'reload schema';
