# AGENTS.md

## Cursor Cloud specific instructions

Fringo is a single-product Vite + React 19 + TypeScript PWA backed by a local
**Supabase** stack (Postgres + Auth + PostgREST + Realtime) running in Docker.
Standard commands live in `README.md` and `package.json` scripts; only the
non-obvious startup caveats are captured here.

### Services and how to start them (in order)
The update script only runs `npm install`. Docker is pre-installed in the VM
snapshot, but the daemon and Supabase stack are **not** auto-started, so a fresh
session must bring them up manually:

1. **Docker daemon** — there is no systemd in this VM, so start dockerd directly
   (it must be running before Supabase): `sudo dockerd &` (or in a tmux session).
   If you hit a permission error talking to the socket, run
   `sudo chmod 666 /var/run/docker.sock` (the `ubuntu` user is already in the
   `docker` group from setup).
2. **Supabase stack** — `npm run supabase:start` (pulls/starts Docker
   containers; first run is slow). Apply schema + seed with
   `npm run supabase:reset`.
3. **Frontend dev server** — `npm run dev` (Vite on port `5173`).

### `.env` is required and gitignored
The app reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. Create `.env`
(copy `.env.example`) and set `VITE_SUPABASE_ANON_KEY` to the **legacy** JWT
`ANON_KEY` from `npx supabase status` — NOT the newer `sb_publishable_...`
key. The local anon key is a stable demo key, so the committed `.env` value does
not change between runs.

### Build vs. lint vs. dev (gotcha)
- `npm run dev` and `npm run lint` work. Lint emits 2 warnings, 0 errors.
- `npm run build` (`tsc -b && vite build`) currently **fails** on a pre-existing
  TypeScript error in `src/routes/home.tsx`: TanStack Router types treat
  `search` as required on `<Link to="/join">` because the `/join` route defines
  `validateSearch`. This is a source-code type issue, not an environment
  problem, and it does NOT affect the dev server (Vite does not typecheck).

### Testing
There is no automated test runner. Verification is manual per `TESTING.md`
(open 3+ browser profiles/incognito windows to simulate multiple players).
