-- Fringo: RLS helpers and policies

-- ---------------------------------------------------------------------------
-- Helper functions
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_player_id(p_game_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gp.id
  FROM public.game_players gp
  WHERE gp.game_id = p_game_id
    AND gp.user_id = auth.uid()
    AND gp.status = 'active'
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_game_member(p_game_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.game_players gp
    WHERE gp.game_id = p_game_id
      AND gp.user_id = auth.uid()
      AND gp.status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_admin(p_game_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.game_players gp
    WHERE gp.game_id = p_game_id
      AND gp.user_id = auth.uid()
      AND gp.status = 'active'
      AND gp.role IN ('host', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_revealed(p_game_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.games g
    WHERE g.id = p_game_id
      AND g.status IN ('revealed', 'archived')
  );
$$;

CREATE OR REPLACE FUNCTION public.can_see_target_data(p_game_id uuid, p_target_player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_revealed(p_game_id)
    OR public.is_admin(p_game_id)
    OR (
      public.is_game_member(p_game_id)
      AND public.current_player_id(p_game_id) IS DISTINCT FROM p_target_player_id
    );
$$;

-- ---------------------------------------------------------------------------
-- Enable RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.games ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.selected_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_squares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.target_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_log ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (true);

CREATE POLICY profiles_insert ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ---------------------------------------------------------------------------
-- games
-- ---------------------------------------------------------------------------
CREATE POLICY games_select ON public.games
  FOR SELECT TO authenticated
  USING (public.is_game_member(id) OR created_by = auth.uid());

CREATE POLICY games_insert ON public.games
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY games_update ON public.games
  FOR UPDATE TO authenticated
  USING (public.is_admin(id))
  WITH CHECK (public.is_admin(id));

-- ---------------------------------------------------------------------------
-- game_settings
-- ---------------------------------------------------------------------------
CREATE POLICY game_settings_select ON public.game_settings
  FOR SELECT TO authenticated
  USING (public.is_game_member(game_id));

CREATE POLICY game_settings_insert ON public.game_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = game_id AND g.created_by = auth.uid()
    )
  );

CREATE POLICY game_settings_update ON public.game_settings
  FOR UPDATE TO authenticated
  USING (public.is_admin(game_id))
  WITH CHECK (public.is_admin(game_id));

-- ---------------------------------------------------------------------------
-- game_players
-- ---------------------------------------------------------------------------
CREATE POLICY game_players_select ON public.game_players
  FOR SELECT TO authenticated
  USING (public.is_game_member(game_id));

CREATE POLICY game_players_update ON public.game_players
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_admin(game_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_admin(game_id)
  );

-- ---------------------------------------------------------------------------
-- action_submissions
-- ---------------------------------------------------------------------------
CREATE POLICY action_submissions_select ON public.action_submissions
  FOR SELECT TO authenticated
  USING (public.can_see_target_data(game_id, target_player_id));

-- Mutations via RPC only (no direct insert/update/delete for authenticated)

-- ---------------------------------------------------------------------------
-- action_upvotes
-- ---------------------------------------------------------------------------
CREATE POLICY action_upvotes_select ON public.action_upvotes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.action_submissions s
      WHERE s.id = submission_id
        AND public.can_see_target_data(s.game_id, s.target_player_id)
    )
  );

-- ---------------------------------------------------------------------------
-- selected_actions
-- ---------------------------------------------------------------------------
CREATE POLICY selected_actions_select ON public.selected_actions
  FOR SELECT TO authenticated
  USING (public.can_see_target_data(game_id, target_player_id));

-- ---------------------------------------------------------------------------
-- boards
-- ---------------------------------------------------------------------------
CREATE POLICY boards_select ON public.boards
  FOR SELECT TO authenticated
  USING (
    public.is_revealed(game_id)
    OR public.is_admin(game_id)
    OR owner_player_id = public.current_player_id(game_id)
  );

-- ---------------------------------------------------------------------------
-- board_squares
-- ---------------------------------------------------------------------------
CREATE POLICY board_squares_select ON public.board_squares
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.boards b
      WHERE b.id = board_id
        AND (
          public.is_revealed(b.game_id)
          OR public.is_admin(b.game_id)
          OR b.owner_player_id = public.current_player_id(b.game_id)
        )
    )
  );

-- ---------------------------------------------------------------------------
-- guesses
-- ---------------------------------------------------------------------------
CREATE POLICY guesses_select ON public.guesses
  FOR SELECT TO authenticated
  USING (public.is_game_member(game_id));

-- ---------------------------------------------------------------------------
-- target_claims
-- ---------------------------------------------------------------------------
CREATE POLICY target_claims_select ON public.target_claims
  FOR SELECT TO authenticated
  USING (public.is_game_member(game_id));

-- ---------------------------------------------------------------------------
-- score_events
-- ---------------------------------------------------------------------------
CREATE POLICY score_events_select ON public.score_events
  FOR SELECT TO authenticated
  USING (public.is_game_member(game_id));

-- ---------------------------------------------------------------------------
-- event_log
-- ---------------------------------------------------------------------------
CREATE POLICY event_log_select ON public.event_log
  FOR SELECT TO authenticated
  USING (
    public.is_game_member(game_id)
    AND (
      visibility = 'public'
      OR (visibility = 'admin' AND public.is_admin(game_id))
      OR (visibility = 'post_reveal' AND public.is_revealed(game_id))
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime publication
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.games;
ALTER PUBLICATION supabase_realtime ADD TABLE public.game_players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.action_submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.action_upvotes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.boards;
ALTER PUBLICATION supabase_realtime ADD TABLE public.board_squares;
ALTER PUBLICATION supabase_realtime ADD TABLE public.target_claims;
ALTER PUBLICATION supabase_realtime ADD TABLE public.score_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guesses;
