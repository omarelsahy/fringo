-- Player-reported guesses: board owners report target guess outcomes per action square

ALTER TABLE public.guesses
  DROP CONSTRAINT IF EXISTS guesses_check;

ALTER TABLE public.guesses
  ADD CONSTRAINT guesses_reporter_not_target
  CHECK (target_player_id <> guessed_by_player_id);

-- ---------------------------------------------------------------------------
-- report_guess: board owner reports how the target guessed an action
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.report_guess(
  p_board_square_id uuid,
  p_result text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_square public.board_squares%ROWTYPE;
  v_board public.boards%ROWTYPE;
  v_reporter_id uuid;
  v_action public.selected_actions%ROWTYPE;
  v_settings public.game_settings%ROWTYPE;
  v_guess_id uuid;
  v_marked_count int;
BEGIN
  SELECT * INTO v_square FROM public.board_squares WHERE id = p_board_square_id;
  IF v_square.id IS NULL THEN
    RAISE EXCEPTION 'Square not found';
  END IF;

  SELECT * INTO v_board FROM public.boards WHERE id = v_square.board_id;
  IF v_board.id IS NULL THEN
    RAISE EXCEPTION 'Board not found';
  END IF;

  v_reporter_id := public.current_player_id(v_board.game_id);
  IF v_reporter_id IS NULL OR v_reporter_id <> v_board.owner_player_id THEN
    RAISE EXCEPTION 'Only board owner can report guesses';
  END IF;

  IF (SELECT status FROM public.games WHERE id = v_board.game_id) <> 'active' THEN
    RAISE EXCEPTION 'Game not active';
  END IF;

  IF v_board.state <> 'active' THEN
    RAISE EXCEPTION 'Board not active';
  END IF;

  IF v_square.state = 'free' THEN
    RAISE EXCEPTION 'Cannot report guess on free space';
  END IF;

  IF v_square.selected_action_id IS NULL THEN
    RAISE EXCEPTION 'No action on this square';
  END IF;

  SELECT * INTO v_action FROM public.selected_actions WHERE id = v_square.selected_action_id;
  IF v_action.id IS NULL THEN
    RAISE EXCEPTION 'Action not found';
  END IF;

  IF v_action.global_state = 'locked' THEN
    RAISE EXCEPTION 'Action already locked';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.guesses
    WHERE game_id = v_board.game_id
      AND matched_selected_action_id = v_action.id
      AND result <> 'pending'
  ) THEN
    RAISE EXCEPTION 'Guess already reported for this action';
  END IF;

  IF coalesce((
    SELECT guesses_remaining FROM public.game_players WHERE id = v_board.target_player_id
  ), 0) <= 0 THEN
    RAISE EXCEPTION 'Target has no guesses remaining';
  END IF;

  IF p_result NOT IN ('correct_pre_action', 'correct_post_action', 'incorrect') THEN
    RAISE EXCEPTION 'Invalid result';
  END IF;

  SELECT * INTO v_settings FROM public.game_settings WHERE game_id = v_board.game_id;

  SELECT count(*) INTO v_marked_count
  FROM public.board_squares bs
  WHERE bs.selected_action_id = v_action.id
    AND bs.state IN ('marked', 'winning');

  IF p_result = 'incorrect' THEN
    INSERT INTO public.guesses (
      game_id, target_player_id, guessed_by_player_id, guess_text,
      matched_selected_action_id, result, resolved_at, resolved_by_player_id
    ) VALUES (
      v_board.game_id, v_board.target_player_id, v_reporter_id, v_action.action_text,
      v_action.id, 'incorrect', now(), v_reporter_id
    )
    RETURNING id INTO v_guess_id;

  ELSIF p_result = 'correct_pre_action' THEN
    IF v_marked_count > 0 THEN
      RAISE EXCEPTION 'Action already marked; use correct_post_action';
    END IF;

    INSERT INTO public.guesses (
      game_id, target_player_id, guessed_by_player_id, guess_text,
      matched_selected_action_id, result, resolved_at, resolved_by_player_id
    ) VALUES (
      v_board.game_id, v_board.target_player_id, v_reporter_id, v_action.action_text,
      v_action.id, 'correct_pre_action', now(), v_reporter_id
    )
    RETURNING id INTO v_guess_id;

    UPDATE public.selected_actions
    SET global_state = 'locked', locked_reason = 'pre_action_guess', locked_at = now()
    WHERE id = v_action.id;

    UPDATE public.board_squares
    SET state = 'locked', locked_at = now()
    WHERE selected_action_id = v_action.id AND state = 'unmarked';

    PERFORM public.apply_score_event(
      v_board.game_id, v_board.target_player_id,
      v_settings.pre_action_guess_points, 'pre_action_guess',
      v_board.target_player_id, v_action.id, NULL, v_guess_id, NULL
    );

  ELSIF p_result = 'correct_post_action' THEN
    IF v_marked_count = 0 THEN
      RAISE EXCEPTION 'Action not yet marked; use correct_pre_action';
    END IF;

    INSERT INTO public.guesses (
      game_id, target_player_id, guessed_by_player_id, guess_text,
      matched_selected_action_id, result, accused_giveaway_player_id,
      resolved_at, resolved_by_player_id
    ) VALUES (
      v_board.game_id, v_board.target_player_id, v_reporter_id, v_action.action_text,
      v_action.id, 'correct_post_action', v_reporter_id,
      now(), v_reporter_id
    )
    RETURNING id INTO v_guess_id;

    UPDATE public.board_squares
    SET state = 'locked', locked_at = now()
    WHERE selected_action_id = v_action.id AND state = 'unmarked';

    PERFORM public.apply_score_event(
      v_board.game_id, v_reporter_id,
      v_settings.giveaway_penalty_points, 'giveaway_penalty',
      v_board.target_player_id, v_action.id, NULL, v_guess_id, NULL
    );
  END IF;

  UPDATE public.game_players
  SET guesses_remaining = guesses_remaining - 1
  WHERE id = v_board.target_player_id;

  RETURN v_guess_id;
END;
$$;
