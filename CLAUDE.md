# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Drone Derby v2 — an asynchronous multiplayer RoboRally-style programming
game. Browser-first PWA. From-scratch rewrite; the plan of record is
`cascades/2026-07-05-v2-rewrite.md` (phases, cross-phase decisions).

## Commands

- `npm run dev` — Vite dev server (default port 5173)
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
- **Rendering is DOM/CSS grid**, not canvas. Canvas is reserved for the
  future level editor (Phase 6).
- **Rules source**: `docs/game_mechanics_md.md` (MVP scope: moves, pushing,
  edge-based walls, pits, conveyors + express, gears, checkpoints, board +
  robot lasers, damage with locked registers, 3 lives, respawn). Cut from
  MVP: pushers, repair sites, option cards, power-down.
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
