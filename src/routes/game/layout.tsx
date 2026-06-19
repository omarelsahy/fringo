import { Outlet, useParams } from '@tanstack/react-router'
import { LoadingScreen, ErrorBanner } from '@/components/layout'
import { GameNav } from '@/router'
import { useGame, useCurrentPlayer } from '@/lib/api/hooks'
import { useGameRealtime } from '@/lib/realtime'
import { ensureAnonymousAuth } from '@/lib/supabase'
import { useEffect, useState } from 'react'

export function GameLayout() {
  const { gameId } = useParams({ from: '/game/$gameId' })
  const [authError, setAuthError] = useState('')
  const { data: game, isLoading, error } = useGame(gameId)
  const { data: currentPlayer } = useCurrentPlayer(gameId)

  useGameRealtime(gameId, currentPlayer?.id)

  useEffect(() => {
    ensureAnonymousAuth().catch((e) => {
      setAuthError(e instanceof Error ? e.message : 'Auth failed')
    })
  }, [])

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
