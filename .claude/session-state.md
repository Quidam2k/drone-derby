# Session State
Updated: 2026-07-17 ~13:50

## Current Task
Phase 22 (Pit Archipelago, 5th built-in board) implemented + verified
locally; committing + deploying now. THEN: plan mode for the
ghost-preview feature (Todd's new request — see cascade ⚠️ NEXT).

## Just Completed
- §22: pitArchipelago() in boards.ts (12×11 islands/pit channels,
  causeways vs laser-taxed belt bridges), RulesScreen + README entries.
  109 tests, typecheck, Playwright 1280+375 hot-seat turn green.
- Plan premise fixed: Move 2 does NOT jump pits (per-cell); design
  uses narrow causeways instead.

## Next Steps
1. Commit §22, `npm run deploy`, prod smoke (5 boards in picker).
2. Plan mode: ghost preview while programming (deterministic solo
   executeTurn of registers-so-far; no other robots). Jumps ahead of
   composition/SFX/docs (old phases 23–25).

## Open Questions / Blockers
- Port 5173 = Leyline Tycoon app; drone_derby dev = 5175 currently.

## Key Files
- src/engine/boards.ts (pitArchipelago), src/engine/execute.ts
- cascades/2026-07-05-v2-rewrite.md §22 + ⚠️ NEXT
