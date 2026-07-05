import { useEffect, useRef, useState } from 'react'
import { useSearch } from '@tanstack/react-router'
import { LoadingScreen, ErrorBanner } from '@/components/layout'
import { GAME_PRESETS, type PresetKey } from '@/lib/constants'
import { api } from '@/lib/api'
import { supabase } from '@/lib/supabase'
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
        const { data: authData, error: authError } = await supabase.auth.signInAnonymously()
        if (authError) throw authError
        if (!authData.session) throw new Error('Anonymous sign-in failed')

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

          const playerId = await api.joinGame(search.code, search.name)

          // Retry logic to handle RLS timing issues
          let player = null
          for (let attempt = 0; attempt < 5; attempt++) {
            const { data, error: playerError } = await supabase
              .from('game_players')
              .select('game_id, role')
              .eq('id', playerId)
              .maybeSingle()

            if (playerError) throw playerError
            if (data) {
              player = data
              break
            }
            await new Promise((r) => setTimeout(r, 200))
          }

          if (!player) throw new Error('Player not found after join')
          gameId = player.game_id
          role = player.role === 'host' ? 'host' : 'player'

          // Retry logic for game fetch
          let game = null
          for (let attempt = 0; attempt < 5; attempt++) {
            game = await api.getGame(gameId)
            if (game) break
            await new Promise((r) => setTimeout(r, 200))
          }

          if (!game) throw new Error('Game not found after join')
          inviteCode = game.invite_code
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

        if (search.navigate) {
          const route = search.navigate as DevNavigate
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
        } else {
          setStatus(`Ready as ${search.name}. Waiting for launcher...`)
        }
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
