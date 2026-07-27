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
  dependencies: `executeTurn(state, programs, seed) → { state, events }`.
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
- **The player-facing board may be WebGL** (Phase 3D-1 onward,
  `src/components/board3d/`, behind `?render=3d`). Mesh animation — rolling
  treads, a hexapod walk cycle, spinning wheels — is not expressible in CSS
  3D, which can only tilt and fly DOM planes, so the dynamic camera and
  animated robots need three.js. `three` is reached only through
  `await import('./scene')` so no other screen pays for it. **The DOM
  `Board` is never deleted**: the editor needs it anyway, which makes
  keeping it as the low-end fallback renderer close to free.
- **Blender is the art pipeline for both robots and board tiles.**
  `scripts/blender/common.py` holds the shared primitives;
  `robots.py` → `public/models/robot-*.glb` (`npm run art -- --glb`) and
  `tiles.py` → `public/models/tiles.glb` (`npm run art:tiles`). Every piece
  is modelled in the local frame of the three.js primitive it replaces, so
  `boardMesh.ts` placements never move and a missing `.glb` falls back to
  that primitive piece by piece — keep both paths working.
- **Rules source**: `docs/game_mechanics_md.md` (MVP scope: moves, pushing,
  edge-based walls, pits, conveyors + express, gears, checkpoints, board +
  robot lasers, damage with locked registers, 3 lives, respawn). Cut from
  MVP: pushers, repair sites, option cards, power-down.
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
- Cards are conserved: drawPile + discardPile + hand + locked registers =
  84 per player, every turn.

## Session continuity

`.claude/session-state.md` is the source of truth on cold start. Cascade
plan: `cascades/2026-07-05-v2-rewrite.md`.
