-- Rename bingo terminology to Fringo across schema and RPCs

-- Column renames
ALTER TABLE public.game_settings
  RENAME COLUMN normal_bingo_points TO normal_fringo_points;

ALTER TABLE public.game_settings
  RENAME COLUMN multi_bingo_points TO multi_fringo_points;

ALTER TABLE public.target_claims
  RENAME COLUMN bingo_line_count TO fringo_line_count;

-- Score event reason values
UPDATE public.score_events SET reason = 'fringo' WHERE reason = 'bingo';
UPDATE public.score_events SET reason = 'multi_fringo' WHERE reason = 'multi_bingo';

ALTER TABLE public.score_events
  DROP CONSTRAINT IF EXISTS score_events_reason_check;

ALTER TABLE public.score_events
  ADD CONSTRAINT score_events_reason_check
  CHECK (reason IN ('fringo', 'multi_fringo', 'pre_action_guess', 'giveaway_penalty', 'admin_adjustment'));

-- Fringo line evaluation (replaces evaluate_bingo)
CREATE OR REPLACE FUNCTION public.evaluate_fringo(
  p_board_id uuid,
  p_new_square_id uuid
)
RETURNS int
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_board public.boards%ROWTYPE;
  v_settings public.game_settings%ROWTYPE;
  v_sq public.board_squares%ROWTYPE;
  v_line_ids uuid[];
  v_completed int := 0;
BEGIN
  SELECT * INTO v_board FROM public.boards WHERE id = p_board_id;
  SELECT * INTO v_settings FROM public.game_settings WHERE game_id = v_board.game_id;
  SELECT * INTO v_sq FROM public.board_squares WHERE id = p_new_square_id;

  SELECT array_agg(bs.id ORDER BY bs.col_index)
  INTO v_line_ids
  FROM public.board_squares bs
  WHERE bs.board_id = p_board_id AND bs.row_index = v_sq.row_index;

  IF public.is_line_complete(p_board_id, v_line_ids) THEN
    v_completed := v_completed + 1;
  END IF;

  SELECT array_agg(bs.id ORDER BY bs.row_index)
  INTO v_line_ids
  FROM public.board_squares bs
  WHERE bs.board_id = p_board_id AND bs.col_index = v_sq.col_index;

  IF public.is_line_complete(p_board_id, v_line_ids) THEN
    v_completed := v_completed + 1;
  END IF;

  IF v_settings.allow_diagonals THEN
    IF v_sq.row_index = v_sq.col_index THEN
      SELECT array_agg(bs.id ORDER BY bs.row_index)
      INTO v_line_ids
      FROM public.board_squares bs
      WHERE bs.board_id = p_board_id AND bs.row_index = bs.col_index;

      IF public.is_line_complete(p_board_id, v_line_ids) THEN
        v_completed := v_completed + 1;
      END IF;
    END IF;

    IF v_sq.row_index + v_sq.col_index = v_settings.board_rows - 1 THEN
      SELECT array_agg(bs.id ORDER BY bs.row_index)
      INTO v_line_ids
      FROM public.board_squares bs
      WHERE bs.board_id = p_board_id
        AND bs.row_index + bs.col_index = v_settings.board_rows - 1;

      IF public.is_line_complete(p_board_id, v_line_ids) THEN
        v_completed := v_completed + 1;
      END IF;
    END IF;
  END IF;

  RETURN v_completed;
END;
$$;

CREATE OR REPLACE FUNCTION public.claim_target_from_fringo(
  p_board_id uuid,
  p_line_count int
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_board public.boards%ROWTYPE;
  v_settings public.game_settings%ROWTYPE;
  v_points int;
  v_reason text;
  v_claim_id uuid;
  v_active_targets int;
  v_total_targets int;
BEGIN
  SELECT * INTO v_board FROM public.boards WHERE id = p_board_id;
  SELECT * INTO v_settings FROM public.game_settings WHERE game_id = v_board.game_id;

  IF EXISTS (
    SELECT 1 FROM public.target_claims
    WHERE game_id = v_board.game_id AND target_player_id = v_board.target_player_id
  ) THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'already_claimed');
  END IF;

  IF p_line_count >= 2 THEN
    v_points := v_settings.multi_fringo_points;
    v_reason := 'multi_fringo';
  ELSE
    v_points := v_settings.normal_fringo_points;
    v_reason := 'fringo';
  END IF;

  INSERT INTO public.target_claims (
    game_id, target_player_id, claimed_by_player_id, board_id,
    points_awarded, fringo_line_count
  )
  VALUES (
    v_board.game_id, v_board.target_player_id, v_board.owner_player_id,
    p_board_id, v_points, p_line_count
  )
  RETURNING id INTO v_claim_id;

  PERFORM public.apply_score_event(
    v_board.game_id, v_board.owner_player_id, v_points, v_reason,
    v_board.target_player_id, NULL, p_board_id, NULL, NULL
  );

  UPDATE public.boards
  SET state = 'target_claimed'
  WHERE game_id = v_board.game_id AND target_player_id = v_board.target_player_id;

  PERFORM public.log_event(
    v_board.game_id,
    v_board.owner_player_id,
    'target_claimed',
    jsonb_build_object(
      'target_player_id', v_board.target_player_id,
      'points', v_points,
      'line_count', p_line_count
    )
  );

  IF v_settings.end_condition = 'all_targets_claimed' THEN
    SELECT count(*) INTO v_total_targets
    FROM public.game_players
    WHERE game_id = v_board.game_id AND status = 'active';

    SELECT count(*) INTO v_active_targets
    FROM public.target_claims
    WHERE game_id = v_board.game_id;

    IF v_active_targets >= v_total_targets THEN
      UPDATE public.games
      SET status = 'ended', ends_at = now(), updated_at = now()
      WHERE id = v_board.game_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'claimed', true,
    'points', v_points,
    'reason', v_reason,
    'claim_id', v_claim_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_square(p_board_square_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sq public.board_squares%ROWTYPE;
  v_board public.boards%ROWTYPE;
  v_game public.games%ROWTYPE;
  v_player_id uuid;
  v_action public.selected_actions%ROWTYPE;
  v_lines int;
  v_claim jsonb;
BEGIN
  SELECT * INTO v_sq FROM public.board_squares WHERE id = p_board_square_id;
  SELECT * INTO v_board FROM public.boards WHERE id = v_sq.board_id;
  SELECT * INTO v_game FROM public.games WHERE id = v_board.game_id;

  v_player_id := public.current_player_id(v_board.game_id);

  IF v_player_id IS NULL OR v_board.owner_player_id <> v_player_id THEN
    RAISE EXCEPTION 'Not your board';
  END IF;

  IF v_game.status <> 'active' THEN
    RAISE EXCEPTION 'Game not active';
  END IF;

  IF v_board.state <> 'active' THEN
    RAISE EXCEPTION 'Board not active';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.target_claims
    WHERE game_id = v_board.game_id AND target_player_id = v_board.target_player_id
  ) THEN
    RAISE EXCEPTION 'Target already claimed';
  END IF;

  IF v_sq.state NOT IN ('unmarked') THEN
    RAISE EXCEPTION 'Square cannot be marked';
  END IF;

  IF v_sq.selected_action_id IS NOT NULL THEN
    SELECT * INTO v_action FROM public.selected_actions WHERE id = v_sq.selected_action_id;
    IF v_action.global_state = 'locked' THEN
      RAISE EXCEPTION 'Action is locked';
    END IF;
  END IF;

  UPDATE public.board_squares
  SET state = 'marked', marked_at = now()
  WHERE id = p_board_square_id;

  v_lines := public.evaluate_fringo(v_board.id, p_board_square_id);

  IF v_lines > 0 THEN
    v_claim := public.claim_target_from_fringo(v_board.id, v_lines);
    RETURN jsonb_build_object('marked', true, 'fringo', v_claim);
  END IF;

  RETURN jsonb_build_object('marked', true, 'fringo', null);
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
    COALESCE((SELECT display_name FROM public.profiles WHERE id = v_user_id), 'Host'),
    'host',
    p_guesses_per_target
  )
  RETURNING id INTO v_player_id;

  PERFORM public.log_event(v_game_id, v_player_id, 'game_created', jsonb_build_object('name', p_name));

  RETURN v_game_id;
END;
$$;

DROP FUNCTION IF EXISTS public.evaluate_bingo(uuid, uuid);
DROP FUNCTION IF EXISTS public.claim_target_from_bingo(uuid, int);

NOTIFY pgrst, 'reload schema';
