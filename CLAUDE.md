# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Drone Derby v2 — an asynchronous multiplayer RoboRally-style programming
game. Browser-first PWA. From-scratch rewrite; the plan of record is
`cascades/2026-07-05-v2-rewrite.md` (phases, cross-phase decisions).

## Commands

- `npm run dev` — Vite dev server (default port 5173)
- `CONVEX_AGENT_MODE=anonymous npx convex dev` — local Convex backend
  (anonymous local deployment, no Convex account; writes `.env.local`).
  Run alongside `npm run dev` for online play; without a configured
  `VITE_CONVEX_URL` the app falls back to hot-seat-only.
- `npm run build` — typecheck + production build
- `npm test` — run the Vitest suite once
- `npm run test:watch` — Vitest in watch mode
- `npm run typecheck` — TypeScript only, no emit

Run `npm run typecheck` and `npm test` before committing.

## Architecture (v2)

- **Stack**: Vite + React + TypeScript at repo root. State: Zustand
  (Phase 2+). Backend: Convex (Phase 3+), confined to `convex/` plus thin
  client hooks. No Redux, no MUI, no Express/Postgres/Redis/Socket.io.
- **`src/engine/` is a pure, deterministic game engine** with zero
  dependencies: `executeTurn(state, programs, seed, choices?) → { state,
  events }` (`TurnChoices`: respawn facing, power-down).
  No DOM, no IO, no `Date.now()`, no `Math.random()` — all randomness goes
  through the seeded RNG in `src/engine/rng.ts`. The engine is shared
  verbatim by the client (hot-seat, previews, replay) and Convex functions
  (authoritative execution). Keep it that way.
- **EventLog is the animation contract**: `executeTurn` emits atomic
  `EngineEvent`s (see `src/engine/events.ts`) grouped by register. The
  replay player consumes only the EventLog; never derive animations from
  state diffs. Changing the event union is a breaking change to replay —
  extend, don't reshape.
- **The editor and thumbnails are DOM/CSS grid, never canvas.** The level
  editor (Phase 6a) reuses the game's `Board`/`Tile` renderer under a
  transparent hit layer and finds cells with `document.elementFromPoint` +
  `data-x`/`data-y`; that cannot work over a tilted 3D canvas, and
  raycasting would be a rewrite of the authoring tool for zero player
  benefit. `BoardThumb` stays DOM/SVG too. Both are permanent.
- **The player-facing board is WebGL by default** (Phase 3D-1 onward,
  `src/components/board3d/`; the default since the 3D-7 cutover). Mesh
  animation — rolling treads, a hexapod walk cycle, spinning wheels — is not
  expressible in CSS 3D, which can only tilt and fly DOM planes, so the
  dynamic camera and animated robots need three.js. `three` is reached only
  through `await import('./scene')` so no other screen pays for it.
- **`board/BoardView.tsx` is the only thing that mounts either board.** The
  four player-facing screens (ReplayPlayer, HighlightReel, ProgrammingView,
  OnlineGameScreen) import it and never `Board`/`Board3D` directly — a
  source-text test enforces that. It resolves the renderer through the pure
  `board/rendererChoice.ts`, in this order: `?render=dom` → capability (no
  WebGL2, or a scene that threw this page load) → `?render=3d` → the player's
  persisted preference (`viewSettings.renderer`, default `'3d'`).
- **The DOM `Board` is never deleted, and it is now the FALLBACK.** The
  editor and `BoardThumb` need it regardless, which makes it close to free —
  but it is also what a machine without WebGL2 gets and what `Board3D`'s
  catch hands back to via `markRenderer3dFailed()`. That flag is
  deliberately not persisted: one bad load must not permanently downgrade a
  player who chose 3D. Keep both renderers reachable and both working.
- **Blender is the art pipeline for both robots and board tiles.**
  `scripts/blender/common.py` holds the shared primitives;
  `robots.py` → `public/models/robot-*.glb` (`npm run art -- --glb`) and
  `tiles.py` → `public/models/tiles.glb` (`npm run art:tiles`). Every piece
  is modelled in the local frame of the three.js primitive it replaces, so
  `boardMesh.ts` placements never move and a missing `.glb` falls back to
  that primitive piece by piece — keep both paths working.
- **Rules source**: `docs/game_mechanics_md.md` (scope: moves, pushing,
  edge-based walls, pits, conveyors + express, gears, checkpoints, board +
  robot lasers, damage with locked registers, 3 lives, respawn, end-of-turn
  repair on wrenches + flags, power-down, pushers). Still cut — and staying
  cut by design: option cards. Rules parity is complete (Phase 34);
  history: `notes/2026-07-28-rules-parity-scoping.md`.
- **Telemetry**: client crashes and 🐞 playtest notes are captured by
  `src/services/telemetry.ts` (localStorage ring buffer + fire-and-forget
  to the `convex/telemetry.ts` sink; read with
  `npx convex run telemetry:recent [--prod]`). Service layer only — never
  import it into `src/engine/`.
- The root `README.md` is the playtest guide (setup, test-everything
  checklist); keep it current when screens or boards change.
- **`legacy/` is the archived v1 codebase — reference only.** Never import
  from it or resurrect its stack. `docs/technical_architecture_md.md`
  describes that dead stack and is kept as history.

## Engine invariants (tested — keep them true)

- Same `(state, programs, seed)` twice → deep-equal results; input state is
  never mutated.
- Per register: reveal by priority (ties: seat order from
  `startPlayerIndex`, which rotates each turn) → moves with chain pushing →
  express belts pulse, all belts pulse, gears → board lasers, robot lasers →
  checkpoints → win check.
- Cards are conserved: drawPile + discardPile + all hands + all locked
  registers = 84 total (one shared deck, board-game rule), every turn; all
  card ids globally unique.

## Session continuity

`.claude/session-state.md` is the source of truth on cold start. Cascade
plan: `cascades/2026-07-05-v2-rewrite.md`.
