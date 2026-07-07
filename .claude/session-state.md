# Session State
Updated: 2026-07-06 (Phase 8 DONE — deployed to prod)

## Current Task
Drone Derby v2 — cascade: cascades/2026-07-05-v2-rewrite.md.
Phases 1–8 DONE and LIVE at https://drone-derby.pages.dev (Convex prod
fastidious-dinosaur-923). MVP + editor + custom boards + mobile + 2 boards.

## Just Completed
- Phase 8: second built-in board "Spin Cycle" (12×10 conveyor loop, express
  on-ramps, corner gears, pit + cp3 inside the ring, crossfire lasers).
  BUILTIN_BOARDS registry in src/engine/boards.ts shared by client + Convex;
  createGame({builtin?}) snapshots it; lobby picker always visible
  (builtin:<key> values); SetupScreen gains a hot-seat board select.
- Verified: typecheck + 86 tests; Playwright hot-seat @375 + online
  2-context game on Spin Cycle + desktop + default-board regression.
  Deployed + prod smoke. Cascade §8 has detail.

## Next Steps
1. Todd's fun-playtest verdict — rules/pacing tweaks take priority.
2. Backlog: SVG sprites, Resend/Google auth (needs creds), board
   gallery/sharing, third board.

## Key Files
- src/engine/boards.ts (spinCycle + BUILTIN_BOARDS), convex/games.ts
  (createGame builtin arg), cascades/2026-07-05-v2-rewrite.md (§8 at bottom)
