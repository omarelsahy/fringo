-- Play and guess RPCs

-- ---------------------------------------------------------------------------
-- Bingo evaluation helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_line_complete(p_board_id uuid, p_square_ids uuid[])
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1
    FROM public.board_squares bs
    WHERE bs.board_id = p_board_id
      AND bs.id = ANY (p_square_ids)
      AND bs.state NOT IN ('marked', 'free', 'winning')
  ) AND array_length(p_square_ids, 1) > 0;
END;
$$;

CREATE OR REPLACE FUNCTION public.evaluate_bingo(
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
  v_row int;
  v_col int;
BEGIN
  SELECT * INTO v_board FROM public.boards WHERE id = p_board_id;
  SELECT * INTO v_settings FROM public.game_settings WHERE game_id = v_board.game_id;
  SELECT * INTO v_sq FROM public.board_squares WHERE id = p_new_square_id;

  -- Row
  SELECT array_agg(bs.id ORDER BY bs.col_index)
  INTO v_line_ids
  FROM public.board_squares bs
  WHERE bs.board_id = p_board_id AND bs.row_index = v_sq.row_index;

  IF public.is_line_complete(p_board_id, v_line_ids) THEN
    v_completed := v_completed + 1;
  END IF;

  -- Column
  SELECT array_agg(bs.id ORDER BY bs.row_index)
  INTO v_line_ids
  FROM public.board_squares bs
  WHERE bs.board_id = p_board_id AND bs.col_index = v_sq.col_index;

  IF public.is_line_complete(p_board_id, v_line_ids) THEN
    v_completed := v_completed + 1;
  END IF;

  IF v_settings.allow_diagonals THEN
    -- Main diagonal
    IF v_sq.row_index = v_sq.col_index THEN
      SELECT array_agg(bs.id ORDER BY bs.row_index)
      INTO v_line_ids
      FROM public.board_squares bs
      WHERE bs.board_id = p_board_id AND bs.row_index = bs.col_index;

      IF public.is_line_complete(p_board_id, v_line_ids) THEN
        v_completed := v_completed + 1;
      END IF;
    END IF;

    -- Anti diagonal
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

CREATE OR REPLACE FUNCTION public.claim_target_from_bingo(
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
    v_points := v_settings.multi_bingo_points;
    v_reason := 'multi_bingo';
  ELSE
    v_points := v_settings.normal_bingo_points;
    v_reason := 'bingo';
  END IF;

  INSERT INTO public.target_claims (
    game_id, target_player_id, claimed_by_player_id, board_id,
    points_awarded, bingo_line_count
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

-- ---------------------------------------------------------------------------
-- mark_square
-- ---------------------------------------------------------------------------
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

  v_lines := public.evaluate_bingo(v_board.id, p_board_square_id);

  IF v_lines > 0 THEN
    v_claim := public.claim_target_from_bingo(v_board.id, v_lines);
    RETURN jsonb_build_object('marked', true, 'bingo', v_claim);
  END IF;

  RETURN jsonb_build_object('marked', true, 'bingo', null);
END;
$$;

-- ---------------------------------------------------------------------------
-- Guess RPCs
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_guess(
  p_game_id uuid,
  p_guess_text text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player_id uuid;
  v_guess_id uuid;
BEGIN
  v_player_id := public.current_player_id(p_game_id);

  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Not a game member';
  END IF;

  IF (SELECT status FROM public.games WHERE id = p_game_id) <> 'active' THEN
    RAISE EXCEPTION 'Game not active';
  END IF;

  IF coalesce((
    SELECT guesses_remaining FROM public.game_players WHERE id = v_player_id
  ), 0) <= 0 THEN
    RAISE EXCEPTION 'No guesses remaining';
  END IF;

  IF length(trim(p_guess_text)) < 1 THEN
    RAISE EXCEPTION 'Guess text required';
  END IF;

  INSERT INTO public.guesses (game_id, target_player_id, guessed_by_player_id, guess_text)
  VALUES (p_game_id, v_player_id, v_player_id, trim(p_guess_text))
  RETURNING id INTO v_guess_id;

  UPDATE public.game_players
  SET guesses_remaining = guesses_remaining - 1
  WHERE id = v_player_id;

  RETURN v_guess_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.resolve_guess(
  p_guess_id uuid,
  p_result text,
  p_matched_selected_action_id uuid DEFAULT NULL,
  p_giveaway_player_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guess public.guesses%ROWTYPE;
  v_action public.selected_actions%ROWTYPE;
  v_settings public.game_settings%ROWTYPE;
  v_marked_count int;
BEGIN
  SELECT * INTO v_guess FROM public.guesses WHERE id = p_guess_id;

  IF v_guess.id IS NULL OR v_guess.result <> 'pending' THEN
    RAISE EXCEPTION 'Invalid guess';
  END IF;

  IF NOT public.is_admin(v_guess.game_id) THEN
    RAISE EXCEPTION 'Admin/host must resolve guesses';
  END IF;

  SELECT * INTO v_settings FROM public.game_settings WHERE game_id = v_guess.game_id;

  IF p_result = 'incorrect' THEN
    UPDATE public.guesses
    SET result = 'incorrect', resolved_at = now(),
        resolved_by_player_id = public.current_player_id(v_guess.game_id)
    WHERE id = p_guess_id;
    RETURN;
  END IF;

  IF p_matched_selected_action_id IS NULL THEN
    RAISE EXCEPTION 'Matched action required for correct guess';
  END IF;

  SELECT * INTO v_action
  FROM public.selected_actions
  WHERE id = p_matched_selected_action_id
    AND target_player_id = v_guess.target_player_id;

  IF v_action.id IS NULL THEN
    RAISE EXCEPTION 'Action not found for target';
  END IF;

  SELECT count(*) INTO v_marked_count
  FROM public.board_squares bs
  JOIN public.boards b ON b.id = bs.board_id
  WHERE bs.selected_action_id = v_action.id
    AND bs.state IN ('marked', 'winning');

  IF p_result = 'correct_pre_action' THEN
    IF v_marked_count > 0 THEN
      RAISE EXCEPTION 'Action already marked; use correct_post_action';
    END IF;

    UPDATE public.guesses
    SET result = 'correct_pre_action',
        matched_selected_action_id = p_matched_selected_action_id,
        resolved_at = now(),
        resolved_by_player_id = public.current_player_id(v_guess.game_id)
    WHERE id = p_guess_id;

    UPDATE public.selected_actions
    SET global_state = 'locked', locked_reason = 'pre_action_guess', locked_at = now()
    WHERE id = v_action.id;

    UPDATE public.board_squares
    SET state = 'locked', locked_at = now()
    WHERE selected_action_id = v_action.id AND state = 'unmarked';

    PERFORM public.apply_score_event(
      v_guess.game_id, v_guess.target_player_id,
      v_settings.pre_action_guess_points, 'pre_action_guess',
      v_guess.target_player_id, v_action.id, NULL, p_guess_id, NULL
    );

  ELSIF p_result = 'correct_post_action' THEN
    IF v_marked_count = 0 THEN
      RAISE EXCEPTION 'Action not yet marked; use correct_pre_action';
    END IF;

    IF p_giveaway_player_id IS NULL THEN
      RAISE EXCEPTION 'Giveaway player required';
    END IF;

    UPDATE public.guesses
    SET result = 'correct_post_action',
        matched_selected_action_id = p_matched_selected_action_id,
        accused_giveaway_player_id = p_giveaway_player_id,
        resolved_at = now(),
        resolved_by_player_id = public.current_player_id(v_guess.game_id)
    WHERE id = p_guess_id;

    UPDATE public.board_squares
    SET state = 'locked', locked_at = now()
    WHERE selected_action_id = v_action.id AND state = 'unmarked';

    PERFORM public.apply_score_event(
      v_guess.game_id, p_giveaway_player_id,
      v_settings.giveaway_penalty_points, 'giveaway_penalty',
      v_guess.target_player_id, v_action.id, NULL, p_guess_id, NULL
    );
  ELSE
    RAISE EXCEPTION 'Invalid result';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin score adjustment
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_adjust_score(
  p_game_id uuid,
  p_player_id uuid,
  p_points int,
  p_note text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin(p_game_id) THEN
    RAISE EXCEPTION 'Admin only';
  END IF;

  RETURN public.apply_score_event(
    p_game_id, p_player_id, p_points, 'admin_adjustment',
    NULL, NULL, NULL, NULL, p_note
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Fix generate_boards square assignment
-- ---------------------------------------------------------------------------
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
  v_square_ids uuid[];
  v_i int;
  v_required int;
  v_row int;
  v_col int;
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
      RAISE EXCEPTION 'Target % missing selected actions', v_target.id;
    END IF;

    FOR v_owner IN
      SELECT id FROM public.game_players
      WHERE game_id = p_game_id AND status = 'active' AND id <> v_target.id
    LOOP
      INSERT INTO public.boards (game_id, owner_player_id, target_player_id)
      VALUES (p_game_id, v_owner.id, v_target.id)
      RETURNING id INTO v_board_id;

      FOR v_row IN 0..(v_settings.board_rows - 1) LOOP
        FOR v_col IN 0..(v_settings.board_cols - 1) LOOP
          IF v_settings.has_free_space
            AND v_row = v_settings.free_space_row
            AND v_col = v_settings.free_space_col THEN
            INSERT INTO public.board_squares (board_id, row_index, col_index, state)
            VALUES (v_board_id, v_row, v_col, 'free');
          ELSE
            INSERT INTO public.board_squares (board_id, row_index, col_index, state)
            VALUES (v_board_id, v_row, v_col, 'unmarked');
          END IF;
        END LOOP;
      END LOOP;

      SELECT array_agg(bs.id ORDER BY md5(bs.id::text || v_board_id::text))
      INTO v_square_ids
      FROM public.board_squares bs
      WHERE bs.board_id = v_board_id AND bs.state = 'unmarked';

      SELECT array_agg(aid ORDER BY md5(aid::text || v_board_id::text))
      INTO v_action_ids
      FROM unnest(
        (SELECT array_agg(sa.id)
         FROM public.selected_actions sa
         WHERE sa.game_id = p_game_id AND sa.target_player_id = v_target.id)
      ) AS aid;

      FOR v_i IN 1..coalesce(array_length(v_square_ids, 1), 0) LOOP
        UPDATE public.board_squares
        SET selected_action_id = v_action_ids[v_i]
        WHERE id = v_square_ids[v_i];
      END LOOP;
    END LOOP;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
