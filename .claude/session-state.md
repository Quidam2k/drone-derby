# Session State
Updated: 2026-07-05 (Phase 1 complete)

## Current Task
Drone Derby v2 rewrite — cascade: cascades/2026-07-05-v2-rewrite.md.
Phase 1 DONE; Phase 2 (hot-seat + replay player) is next.

## Just Completed
- Phase 1: legacy archived to legacy/, git repo initialized (root commit
  eb190f2), Vite 6 + React 19 + TS + Vitest scaffold, pure engine in
  src/engine/ — 54 tests green (determinism + golden EventLog included).
- CLAUDE.md rewritten; docs/game_mechanics_md.md now the v2 rules source.
- Vite pinned ^6 (Node here is 20.18.0; Vite 7 needs 20.19+).

## Next Steps
1. Phase 2 (fresh context): board renderer (DOM grid), programming UI,
   EventLog replay player, Zustand, pass-and-play on provingGrounds().
2. Commit Phase 2 work; playtest for fun before any backend (Phase 3).

## Key Files
- cascades/2026-07-05-v2-rewrite.md — plan of record + Phase 1 notes
- src/engine/index.ts — engine public API (createGame, executeTurn)
- src/engine/events.ts — EventLog union = replay/animation contract
- docs/game_mechanics_md.md — rules source
