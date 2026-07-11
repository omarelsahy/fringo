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

### Build vs. lint vs. dev
- `npm run dev` and `npm run lint` work.
- `npm run build` (`tsc -b && vite build`) must pass — CI runs lint + build on every PR.
- `npm run test:dev-scenarios` smoke-tests scenario seeding (requires Supabase + Vite; also runs in CI).

### Testing
Manual multiplayer checklist: [TESTING.md](./TESTING.md). Automated smoke test:
`npm run test:dev-scenarios` (after `supabase:reset` and `npm run dev`).

### Dev launcher (multi-player testing)
See [DEV_LAUNCHER.md](./DEV_LAUNCHER.md). Quick start after Supabase + `npm run dev`:
`npm run dev:launcher:install` once, then `npm run dev:launcher`.
Browser fallback: `http://localhost:5173/dev`.
Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env` from `npx supabase status -o env`.
