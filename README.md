# Fortress Games

Multiplayer lobby + room game app built with Next.js for Vercel deployment.

## Features

- Lobby with room creation and room-code joins (`ABCDEF` format).
- Username is set when entering lobby and bound to a server session cookie.
- Room lifecycle with host failover semantics:
  - if host disconnects while human players remain, a random human player is promoted to host.
  - room closes when all human players have left.
- Acchi Muite Hoi (`arrow_predict`) multiplayer game — see [docs/arrow-predict.md](docs/arrow-predict.md):
  - Timed rounds with a rotating leader.
  - Players who freeze are auto-submitted on timeout.
  - Dodgers score for mismatching the leader; the leader scores per catch.
- Starshield Crisis (`spaceship_defense`) co-op multiplayer game — see [docs/spaceship-defense.md](docs/spaceship-defense.md).
- FrankenBeasts (`frankenbeasts`) 1v1 monster-building duel — see [docs/frankenbeasts.md](docs/frankenbeasts.md) for the full ruleset, parts catalog, and tips.
- Per-game rules are rendered in-app at `/rules/<gameType>` and linked from each game room's header.
- Host can add `fortress-bot` players.
- Server-authoritative state transitions and seeded randomness.
- Commit-reveal RNG: the seed hash is published during a round, plaintext is revealed afterward for verification.
- Optimistic-locked persistence with automatic conflict-retry so concurrent player actions are not dropped.
- Room actions are authorized through server-side session identity (no client-supplied player id).
- Room chat is only returned to players who have joined the room.
- Extensible game and bot registries for additional game types.
- Rooms/sessions/game state are persisted to Supabase versioned runtime-state tables.
- Inactive rooms and stale sessions are cleaned up after 30 minutes.
- Timed rounds advance on client polling: connected clients schedule a refresh at each round deadline, which drives the server-side state transition. Rooms with no connected clients simply pause until someone returns or the inactivity TTL culls them.

## Architecture

- `src/lib/game/contracts.ts`: game and bot plugin interfaces.
- `src/lib/game/registry.ts`: server registry for game definitions and bot strategies.
- `src/lib/game/plugins/arrow-game.ts`: Acchi Muite Hoi game state machine.
- `src/lib/game/plugins/spaceship-defense-game.ts`: Starshield Crisis game state machine.
- `src/lib/game/plugins/frankenbeasts-game.ts` + `frankenbeasts-data.ts`: FrankenBeasts state machine and parts/balance data (rules documented in `docs/frankenbeasts.md`).
- `src/lib/game/bots/arrow-bot.ts`: random fortress-bot behavior.
- `src/lib/game/session-service.ts`: authoritative room/game command handling with conflict-retry.
- `src/lib/store/supabase-store.ts`: in-process cache + Supabase-backed runtime snapshot sync.
- `src/lib/supabase/runtime-state.ts`: Supabase runtime-state data access functions.
- `src/lib/supabase/realtime.ts`: HTTP broadcast publishing for room/lobby updates.
- `src/app/room/[code]/games/registry.tsx`: client-side registry mapping game types to their room UI (and rules links).
- `src/app/rules/[game]/page.tsx` + `src/lib/markdown.ts`: in-app renderer for the per-game rule docs in `docs/`.
- `docs/`: per-game rule docs (`arrow-predict.md`, `spaceship-defense.md`, `frankenbeasts.md`).
- `supabase/migrations`: SQL schema and seed tables (including versioned runtime-state tables).

## Environment variables

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Supabase server config is required. If `SUPABASE_URL` or `SUPABASE_SERVICE_ROLE_KEY` is missing, server routes fail fast.

## Run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

## Quality checks

```bash
npm run typecheck
npm run lint
npm run test
```

Suggested CI gates:
- TypeScript typecheck on every PR.
- ESLint on every PR.
- Test suite (`tsx --test`) on every PR.

## Deployment checklist

1. Provision Supabase project and apply migration in `supabase/migrations`.
2. Configure Vercel environment variables.
3. Deploy app with `npm run build`.
4. Smoke test:
   - create/join room
   - add bot
   - start game
   - timeout auto-submit
   - host leave closes room
   - room state survives refresh/redeploy
