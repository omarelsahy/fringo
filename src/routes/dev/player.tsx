import { useEffect, useRef, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { LoadingScreen, ErrorBanner } from '@/components/layout'
import { GAME_PRESETS, type PresetKey } from '@/lib/constants'
import { api } from '@/lib/api'
import { ensureAnonymousAuth, supabase } from '@/lib/supabase'
import { notifyPlayerReady } from '@/dev/notify'
import { useSessionStore } from '@/stores/session'

type DevNavigate = 'lobby' | 'setup' | 'boards' | 'scoreboard' | 'reveal'

export function DevPlayerPage() {
  const search = useSearch({ from: '/dev/player' })
  const setDisplayName = useSessionStore((s) => s.setDisplayName)
  const setLastGameId = useSessionStore((s) => s.setLastGameId)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('Booting player session...')
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    void (async () => {
      try {
        if (search.fresh) {
          setStatus('Clearing previous session...')
          await supabase.auth.signOut({ scope: 'local' })
        }

        setStatus(`Signing in as ${search.name}...`)
        await ensureAnonymousAuth()

        let gameId: string
        let inviteCode: string
        let role: 'host' | 'player' = 'player'

        if (search.action === 'create') {
          setStatus('Creating game...')
          const preset = GAME_PRESETS[search.preset as PresetKey] ?? GAME_PRESETS.game_night
          gameId = await api.createGame({
            name: search.gameName ?? 'Dev Test Game',
            category: 'Dev launcher',
            ...preset,
          })

          const game = await api.getGame(gameId)
          if (!game) throw new Error('Game not found after create')
          inviteCode = game.invite_code
          role = 'host'
        } else {
          if (!search.code) throw new Error('Invite code required for join action')
          setStatus(`Joining game ${search.code}...`)

          const { data: gameRow, error: gameError } = await supabase
            .from('games')
            .select('id, invite_code')
            .ilike('invite_code', search.code.trim())
            .single()

          if (gameError || !gameRow) throw gameError ?? new Error('Game not found for invite code')
          gameId = gameRow.id
          inviteCode = gameRow.invite_code

          await api.joinGame(search.code, search.name)

          const userId = (await supabase.auth.getUser()).data.user?.id
          if (!userId) throw new Error('Not authenticated')

          const { data: player, error: playerError } = await supabase
            .from('game_players')
            .select('game_id, role')
            .eq('game_id', gameId)
            .eq('user_id', userId)
            .single()

          if (playerError || !player) throw playerError ?? new Error('Player not found')
          role = player.role === 'host' ? 'host' : 'player'
        }

        setDisplayName(search.name)
        setLastGameId(gameId)

        notifyPlayerReady({
          slot: search.slot,
          gameId,
          inviteCode,
          displayName: search.name,
          role,
        })

        const route = (search.navigate ?? 'lobby') as DevNavigate
        setStatus(`Opening ${route}...`)

        const routeMap: Record<DevNavigate, string> = {
          lobby: `/game/${gameId}`,
          setup: `/game/${gameId}/setup`,
          boards: `/game/${gameId}/boards`,
          scoreboard: `/game/${gameId}/scoreboard`,
          reveal: `/game/${gameId}/reveal`,
        }

        const slotQuery = `?slot=${search.slot}`
        window.location.replace(`${routeMap[route] ?? routeMap.lobby}${slotQuery}`)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Dev bootstrap failed')
      }
    })()
  }, [search, setDisplayName, setLastGameId])

  if (error) {
    return (
      <div className="p-4">
        <ErrorBanner message={error} />
      </div>
    )
  }

  return <LoadingScreen message={status} />
}
