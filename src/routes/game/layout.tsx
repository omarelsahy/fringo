import { Outlet, useParams, useRouterState } from '@tanstack/react-router'
import { LoadingScreen, ErrorBanner } from '@/components/layout'
import { GameNav } from '@/router'
import { useGame, useCurrentPlayer } from '@/lib/api/hooks'
import { useGameRealtime } from '@/lib/realtime'
import { ensureAnonymousAuth } from '@/lib/supabase'
import { preserveDevSlotUrl } from '@/dev/slot'
import { useEffect, useRef, useState } from 'react'

export function GameLayout() {
  const { gameId } = useParams({ from: '/game/$gameId' })
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const [authError, setAuthError] = useState('')
  const { data: game, isLoading, error } = useGame(gameId)
  const { data: currentPlayer } = useCurrentPlayer(gameId)
  const lastRedirectStatus = useRef<string | null>(null)

  useGameRealtime(gameId, currentPlayer?.id)

  useEffect(() => {
    ensureAnonymousAuth().catch((e) => {
      setAuthError(e instanceof Error ? e.message : 'Auth failed')
    })
  }, [])

  useEffect(() => {
    if (!game) return
    if (!pathname.endsWith('/setup')) return
    if (game.status === 'setup') return
    if (lastRedirectStatus.current === game.status) return
    lastRedirectStatus.current = game.status

    if (game.status === 'active' || game.status === 'ended') {
      window.location.assign(preserveDevSlotUrl(`/game/${gameId}/boards`))
    } else if (game.status === 'revealed') {
      window.location.assign(preserveDevSlotUrl(`/game/${gameId}/reveal`))
    } else if (game.status === 'lobby') {
      window.location.assign(preserveDevSlotUrl(`/game/${gameId}`))
    }
  }, [game, gameId, pathname])

  if (authError) return <ErrorBanner message={authError} />
  if (isLoading) return <LoadingScreen />
  if (error || !game) return <ErrorBanner message={error?.message ?? 'Game not found'} />

  return (
    <div className="flex flex-1 flex-col">
      <GameNav gameId={gameId} status={game.status} />
      <Outlet />
    </div>
  )
}
