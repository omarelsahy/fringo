-- Allow players to read their own game_players row immediately after join

DROP POLICY IF EXISTS game_players_select ON public.game_players;

CREATE POLICY game_players_select ON public.game_players
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_game_member(game_id)
  );
