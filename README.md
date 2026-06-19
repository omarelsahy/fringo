# Fringo

Hidden-event social bingo for friends. PWA built with Vite + React + Supabase.

## Prerequisites

- Node.js 20+
- [Docker Desktop](https://docs.docker.com/desktop/) (for local Supabase)

## Quick start

```bash
# Install dependencies
npm install

# Start local Supabase (requires Docker)
npm run supabase:start

# Copy env vars from Supabase output into .env
cp .env.example .env
# Set VITE_SUPABASE_ANON_KEY from `supabase status`

# Apply migrations (if not auto-applied on start)
npm run supabase:reset

# Start dev server
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Production build |
| `npm run supabase:start` | Start local Supabase stack |
| `npm run supabase:reset` | Reset DB and run migrations |
| `npm run supabase:gen-types` | Regenerate TypeScript types from schema |

## Architecture

- **Frontend:** Vite, React, TypeScript, TanStack Router/Query, Tailwind, PWA
- **Backend:** Supabase Postgres, RLS, Realtime, SECURITY DEFINER RPCs
- **Auth:** Anonymous sign-in + invite codes (no email required for MVP)

## Game flow

1. Host creates a game and shares the invite code
2. Players join with a display name
3. Setup: submit & upvote actions for other players (never yourself)
4. Host finalizes and starts — boards are generated
5. Mark squares, claim targets, use guesses, view scores
6. Host reveals all hidden data postgame

See [fringo_ai_agent_handoff.md](./fringo_ai_agent_handoff.md) for full game design spec.
