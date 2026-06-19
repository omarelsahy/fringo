import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader, ErrorBanner } from '@/components/layout'
import { GAME_PRESETS, type PresetKey } from '@/lib/constants'
import { useCreateGame } from '@/lib/api/hooks'
import { ensureAnonymousAuth } from '@/lib/supabase'
import { useSessionStore } from '@/stores/session'
import { cn } from '@/lib/utils'

export function CreateGamePage() {
  const navigate = useNavigate()
  const setLastGameId = useSessionStore((s) => s.setLastGameId)
  const [preset, setPreset] = useState<PresetKey>('night_out')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [error, setError] = useState('')
  const createGame = useCreateGame()

  const settings = GAME_PRESETS[preset]

  async function handleCreate() {
    setError('')
    try {
      await ensureAnonymousAuth()
      const gameId = await createGame.mutateAsync({
        name: name.trim() || 'Fringo Game',
        category: category.trim() || undefined,
        ...settings,
      })
      setLastGameId(gameId)
      void navigate({ to: '/game/$gameId', params: { gameId } })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create game')
    }
  }

  return (
    <>
      <PageHeader title="Create Game" subtitle="Choose a preset or customize" />
      <div className="flex flex-1 flex-col gap-4 p-4">
        {error && <ErrorBanner message={error} />}

        <div className="grid grid-cols-2 gap-2">
          {(Object.keys(GAME_PRESETS) as PresetKey[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPreset(key)}
              className={cn(
                'rounded-lg border p-3 text-left transition-colors',
                preset === key ? 'border-primary bg-primary/10' : 'border-border bg-card',
              )}
            >
              <div className="font-medium">{GAME_PRESETS[key].label}</div>
              <div className="text-xs text-muted-foreground">{GAME_PRESETS[key].description}</div>
            </button>
          ))}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Game name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Friday Bar Night" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category / theme</Label>
              <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="Bar night, game night..." />
            </div>
            <div className="rounded-md bg-secondary/40 p-3 text-sm text-muted-foreground">
              {settings.board_rows}×{settings.board_cols} board · {settings.actions_per_target} actions · {settings.guesses_per_target} guesses
            </div>
          </CardContent>
        </Card>

        <Button size="lg" onClick={handleCreate} disabled={createGame.isPending}>
          {createGame.isPending ? 'Creating...' : 'Create & Open Lobby'}
        </Button>
      </div>
    </>
  )
}
