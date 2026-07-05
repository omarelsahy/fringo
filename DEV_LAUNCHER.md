# Fringo Dev Launcher

Desktop multi-player testing tool for Fringo. Shows every player's screen in one window with isolated auth sessions, scenario presets, and quick navigation.

## Prerequisites

Same as the main app:

1. Docker + local Supabase (`npm run supabase:start` + `npm run supabase:reset`)
2. `.env` with `VITE_SUPABASE_ANON_KEY` (legacy JWT from `npx supabase status`)
3. Game dev server: `npm run dev` (port 5173)

Install launcher dependencies once:

```bash
npm run dev:launcher:install
```

## Launch

In one terminal:

```bash
npm run dev
```

In another:

```bash
npm run dev:launcher
```

Click **Launch Session** in the toolbar. Player views appear in a grid below the controls.

## Features

- **2–6 isolated players** — each BrowserView uses its own session partition (separate anonymous Supabase auth)
- **Editable player names** — defaults: Alice (host), Bob, Carol, Dave, …
- **Scenario presets**
  - **Lobby** — all players joined, waiting
  - **Setup** — empty voting phase
  - **Setup (seeded)** — prefilled submissions + upvotes
  - **Active** — boards generated, ready for gameplay
  - **Reveal** — post-game reveal screen
- **Navigate all** — jump every player to lobby / setup / boards / scoreboard / reveal
- **Reload all / Reset** — refresh views or tear down the session

## Browser fallback (no Electron)

Open `http://localhost:5173/dev` for an iframe-based multi-player grid. Same scenarios, useful if you cannot run Electron.

## How it works

1. Host view hits `/dev/player` → creates a game (Game Night preset, 3×3 board)
2. Other views auto-join via invite code
3. Dev scenario API seeds game state via Supabase service role (local default key)
4. All views navigate to the target game section

Service role key: set `SUPABASE_SERVICE_ROLE_KEY` in `.env` or rely on the local Supabase demo key.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| "Dev server not reachable" | Run `npm run dev` in repo root |
| Launch times out | Ensure Supabase is running; check browser console in a player view |
| Scenario failed | Run `npm run supabase:reset`; verify service role key |
| Blank player panels | Click **Reload All** or **Reset** then relaunch |
