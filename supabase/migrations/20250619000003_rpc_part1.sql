-- Fringo: RPC functions (game lifecycle, setup, boards, play, guess)

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.log_event(
  p_game_id uuid,
  p_actor_player_id uuid,
  p_event_type text,
  p_payload jsonb DEFAULT '{}',
  p_visibility text DEFAULT 'public'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.event_log (game_id, actor_player_id, event_type, payload, visibility)
  VALUES (p_game_id, p_actor_player_id, p_event_type, p_payload, p_visibility);
END;
$$;

CREATE OR REPLACE FUNCTION public.apply_score_event(
  p_game_id uuid,
  p_player_id uuid,
  p_points int,
  p_reason text,
  p_related_target_player_id uuid DEFAULT NULL,
  p_related_selected_action_id uuid DEFAULT NULL,
  p_related_board_id uuid DEFAULT NULL,
  p_related_guess_id uuid DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  INSERT INTO public.score_events (
    game_id, player_id, points, reason,
    related_target_player_id, related_selected_action_id,
    related_board_id, related_guess_id, note
  )
  VALUES (
    p_game_id, p_player_id, p_points, p_reason,
    p_related_target_player_id, p_related_selected_action_id,
    p_related_board_id, p_related_guess_id, p_note
  )
  RETURNING id INTO v_event_id;

  UPDATE public.game_players
  SET score = score + p_points
  WHERE id = p_player_id;

  RETURN v_event_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.default_free_space_position(
  p_rows int,
  p_cols int
)
RETURNS TABLE (row_idx int, col_idx int)
LANGUAGE plpgsql
AS $$
BEGIN
  row_idx := p_rows / 2;
  col_idx := p_cols / 2;
  RETURN NEXT;
END;
$$;

-- ---------------------------------------------------------------------------
-- create_game
-- ---------------------------------------------------------------------------
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

  INSERT INTO public.profiles (id) VALUES (v_user_id) ON CONFLICT (id) DO NOTHING;

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

-- ---------------------------------------------------------------------------
-- join_game
-- ---------------------------------------------------------------------------
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

  INSERT INTO public.profiles (id) VALUES (v_user_id) ON CONFLICT (id) DO NOTHING;

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

-- ---------------------------------------------------------------------------
-- start_setup
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.start_setup(p_game_id uuid)
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
  SET status = 'setup', updated_at = now()
  WHERE id = p_game_id AND status = 'lobby';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Game must be in lobby status';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- finalize_actions_for_target (internal)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.finalize_actions_for_target(
  p_game_id uuid,
  p_target_player_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_required int;
  v_submission record;
  v_rank int := 1;
BEGIN
  SELECT actions_per_target INTO v_required
  FROM public.game_settings
  WHERE game_id = p_game_id;

  FOR v_submission IN
    SELECT s.id, s.text
    FROM public.action_submissions s
    LEFT JOIN (
      SELECT submission_id, count(*) AS vote_count
      FROM public.action_upvotes
      GROUP BY submission_id
    ) v ON v.submission_id = s.id
    WHERE s.game_id = p_game_id
      AND s.target_player_id = p_target_player_id
      AND s.status = 'submitted'
    ORDER BY COALESCE(v.vote_count, 0) DESC, s.created_at ASC
    LIMIT v_required
  LOOP
    INSERT INTO public.selected_actions (
      game_id, target_player_id, submission_id, action_text, selected_rank
    )
    VALUES (p_game_id, p_target_player_id, v_submission.id, v_submission.text, v_rank);

    UPDATE public.action_submissions
    SET status = 'selected', updated_at = now()
    WHERE id = v_submission.id;

    v_rank := v_rank + 1;
  END LOOP;

  UPDATE public.action_submissions
  SET status = 'rejected', updated_at = now()
  WHERE game_id = p_game_id
    AND target_player_id = p_target_player_id
    AND status = 'submitted';
END;
$$;
