-- Fringo schema: tables, indexes, triggers

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', 'Player')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- games
-- ---------------------------------------------------------------------------
CREATE TABLE public.games (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text,
  status text NOT NULL DEFAULT 'lobby'
    CHECK (status IN ('lobby', 'setup', 'active', 'ended', 'revealed', 'archived')),
  invite_code text NOT NULL UNIQUE,
  created_by uuid REFERENCES public.profiles(id),
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_games_invite_code ON public.games (invite_code);
CREATE INDEX idx_games_status ON public.games (status);

CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;

-- ---------------------------------------------------------------------------
-- game_settings
-- ---------------------------------------------------------------------------
CREATE TABLE public.game_settings (
  game_id uuid PRIMARY KEY REFERENCES public.games(id) ON DELETE CASCADE,
  board_rows int NOT NULL DEFAULT 5,
  board_cols int NOT NULL DEFAULT 5,
  has_free_space boolean NOT NULL DEFAULT true,
  free_space_row int,
  free_space_col int,
  actions_per_target int NOT NULL DEFAULT 24,
  guesses_per_target int NOT NULL DEFAULT 4,
  normal_bingo_points int NOT NULL DEFAULT 1,
  multi_bingo_points int NOT NULL DEFAULT 3,
  pre_action_guess_points int NOT NULL DEFAULT 1,
  giveaway_penalty_points int NOT NULL DEFAULT -1,
  allow_diagonals boolean NOT NULL DEFAULT true,
  end_condition text NOT NULL DEFAULT 'all_targets_claimed',
  reveal_marks_after_round boolean NOT NULL DEFAULT false,
  allow_self_upvote boolean NOT NULL DEFAULT false,
  allow_submitter_identity_during_game boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- game_players
-- ---------------------------------------------------------------------------
CREATE TABLE public.game_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  display_name text NOT NULL,
  role text NOT NULL DEFAULT 'player'
    CHECK (role IN ('host', 'admin', 'player')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('invited', 'active', 'left', 'removed')),
  score int NOT NULL DEFAULT 0,
  guesses_remaining int,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, user_id)
);

CREATE INDEX idx_game_players_game ON public.game_players (game_id);
CREATE INDEX idx_game_players_user ON public.game_players (user_id);

-- ---------------------------------------------------------------------------
-- action_submissions
-- ---------------------------------------------------------------------------
CREATE TABLE public.action_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  target_player_id uuid NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  submitted_by_player_id uuid NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  text text NOT NULL,
  status text NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'selected', 'rejected', 'removed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (target_player_id <> submitted_by_player_id)
);

CREATE INDEX idx_action_submissions_game_target ON public.action_submissions (game_id, target_player_id);

-- ---------------------------------------------------------------------------
-- action_upvotes
-- ---------------------------------------------------------------------------
CREATE TABLE public.action_upvotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.action_submissions(id) ON DELETE CASCADE,
  voter_player_id uuid NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (submission_id, voter_player_id)
);

CREATE INDEX idx_action_upvotes_submission ON public.action_upvotes (submission_id);

-- ---------------------------------------------------------------------------
-- selected_actions
-- ---------------------------------------------------------------------------
CREATE TABLE public.selected_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  target_player_id uuid NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  submission_id uuid NOT NULL REFERENCES public.action_submissions(id),
  action_text text NOT NULL,
  selected_rank int,
  global_state text NOT NULL DEFAULT 'active'
    CHECK (global_state IN ('active', 'locked', 'revealed')),
  locked_reason text CHECK (
    locked_reason IN ('pre_action_guess', 'post_action_guess', 'admin', 'target_claim', 'other')
    OR locked_reason IS NULL
  ),
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, target_player_id, submission_id)
);

CREATE INDEX idx_selected_actions_target ON public.selected_actions (game_id, target_player_id);

-- ---------------------------------------------------------------------------
-- boards
-- ---------------------------------------------------------------------------
CREATE TABLE public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  owner_player_id uuid NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  target_player_id uuid NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  state text NOT NULL DEFAULT 'active'
    CHECK (state IN ('active', 'target_claimed', 'revealed', 'archived')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, owner_player_id, target_player_id),
  CHECK (owner_player_id <> target_player_id)
);

CREATE INDEX idx_boards_owner ON public.boards (owner_player_id);
CREATE INDEX idx_boards_game ON public.boards (game_id);

-- ---------------------------------------------------------------------------
-- board_squares
-- ---------------------------------------------------------------------------
CREATE TABLE public.board_squares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  selected_action_id uuid REFERENCES public.selected_actions(id) ON DELETE CASCADE,
  row_index int NOT NULL,
  col_index int NOT NULL,
  state text NOT NULL DEFAULT 'unmarked'
    CHECK (state IN ('unmarked', 'marked', 'locked', 'winning', 'free')),
  marked_at timestamptz,
  locked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (board_id, row_index, col_index)
);

CREATE INDEX idx_board_squares_board ON public.board_squares (board_id);

-- ---------------------------------------------------------------------------
-- guesses
-- ---------------------------------------------------------------------------
CREATE TABLE public.guesses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  target_player_id uuid NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  guessed_by_player_id uuid NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  guess_text text NOT NULL,
  matched_selected_action_id uuid REFERENCES public.selected_actions(id),
  result text NOT NULL DEFAULT 'pending'
    CHECK (result IN ('pending', 'correct_pre_action', 'correct_post_action', 'incorrect', 'void')),
  accused_giveaway_player_id uuid REFERENCES public.game_players(id),
  resolved_by_player_id uuid REFERENCES public.game_players(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  CHECK (target_player_id = guessed_by_player_id)
);

CREATE INDEX idx_guesses_game ON public.guesses (game_id);

-- ---------------------------------------------------------------------------
-- target_claims
-- ---------------------------------------------------------------------------
CREATE TABLE public.target_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  target_player_id uuid NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  claimed_by_player_id uuid NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.boards(id),
  points_awarded int NOT NULL,
  bingo_line_count int NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (game_id, target_player_id)
);

-- ---------------------------------------------------------------------------
-- score_events
-- ---------------------------------------------------------------------------
CREATE TABLE public.score_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.game_players(id) ON DELETE CASCADE,
  points int NOT NULL,
  reason text NOT NULL CHECK (
    reason IN ('bingo', 'multi_bingo', 'pre_action_guess', 'giveaway_penalty', 'admin_adjustment')
  ),
  related_target_player_id uuid REFERENCES public.game_players(id),
  related_selected_action_id uuid REFERENCES public.selected_actions(id),
  related_board_id uuid REFERENCES public.boards(id),
  related_guess_id uuid REFERENCES public.guesses(id),
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_score_events_game ON public.score_events (game_id);

-- ---------------------------------------------------------------------------
-- event_log
-- ---------------------------------------------------------------------------
CREATE TABLE public.event_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  actor_player_id uuid REFERENCES public.game_players(id),
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}',
  visibility text NOT NULL DEFAULT 'public'
    CHECK (visibility IN ('public', 'private', 'admin', 'post_reveal')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_event_log_game ON public.event_log (game_id);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER games_updated_at
  BEFORE UPDATE ON public.games
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER game_settings_updated_at
  BEFORE UPDATE ON public.game_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER action_submissions_updated_at
  BEFORE UPDATE ON public.action_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
