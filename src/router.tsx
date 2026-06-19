import {
  Link,
  Outlet,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { AppShell } from '@/components/layout'
import { HomePage } from '@/routes/home'
import { CreateGamePage } from '@/routes/create-game'
import { JoinGamePage } from '@/routes/join-game'
import { GameLayout } from '@/routes/game/layout'
import { LobbyPage } from '@/routes/game/lobby'
import { SetupPage } from '@/routes/game/setup'
import { BoardsPage } from '@/routes/game/boards'
import { BoardDetailPage } from '@/routes/game/board-detail'
import { GuessPage } from '@/routes/game/guess'
import { ScoreboardPage } from '@/routes/game/scoreboard'
import { RevealPage } from '@/routes/game/reveal'

const rootRoute = createRootRoute({
  component: () => (
    <AppShell>
      <Outlet />
    </AppShell>
  ),
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const createRoute_ = createRoute({
  getParentRoute: () => rootRoute,
  path: '/create',
  component: CreateGamePage,
})

const joinRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/join',
  component: JoinGamePage,
  validateSearch: (search: Record<string, unknown>) => ({
    fresh: search.fresh === '1' || search.fresh === true,
    code: typeof search.code === 'string' ? search.code : undefined,
    name: typeof search.name === 'string' ? search.name : undefined,
    auto: search.auto === '1' || search.auto === true,
  }),
})

const gameRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/game/$gameId',
  component: GameLayout,
})

const lobbyRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: '/',
  component: LobbyPage,
})

const setupRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: '/setup',
  component: SetupPage,
})

const boardsRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: '/boards',
  component: BoardsPage,
})

const boardDetailRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: '/boards/$boardId',
  component: BoardDetailPage,
})

const guessRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: '/guess',
  component: GuessPage,
})

const scoreboardRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: '/scoreboard',
  component: ScoreboardPage,
})

const revealRoute = createRoute({
  getParentRoute: () => gameRoute,
  path: '/reveal',
  component: RevealPage,
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  createRoute_,
  joinRoute,
  gameRoute.addChildren([
    lobbyRoute,
    setupRoute,
    boardsRoute,
    boardDetailRoute,
    guessRoute,
    scoreboardRoute,
    revealRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

export function GameNav({ gameId, status }: { gameId: string; status: string }) {
  const links: Array<{
    to: '/game/$gameId' | '/game/$gameId/setup' | '/game/$gameId/boards' | '/game/$gameId/guess' | '/game/$gameId/scoreboard' | '/game/$gameId/reveal'
    label: string
    show: boolean
  }> = [
    { to: '/game/$gameId', label: 'Lobby', show: true },
    { to: '/game/$gameId/setup', label: 'Setup', show: ['setup'].includes(status) },
    { to: '/game/$gameId/boards', label: 'Boards', show: ['active', 'ended', 'revealed'].includes(status) },
    { to: '/game/$gameId/guess', label: 'Guess', show: ['active'].includes(status) },
    { to: '/game/$gameId/scoreboard', label: 'Scores', show: ['active', 'ended', 'revealed'].includes(status) },
    { to: '/game/$gameId/reveal', label: 'Reveal', show: ['revealed'].includes(status) },
  ]

  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-border px-4 py-2">
      {links.filter((l) => l.show).map((l) => (
        <Link
          key={l.to}
          to={l.to}
          params={{ gameId }}
          className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground [&.active]:bg-primary [&.active]:text-primary-foreground"
        >
          {l.label}
        </Link>
      ))}
    </nav>
  )
}
