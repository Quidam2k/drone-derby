# Session State
Updated: 2026-07-07 ~09:35 (Phase 14 DONE — deployed to prod)

## Current Task
Drone Derby v2 — cascade: cascades/2026-07-05-v2-rewrite.md.
Phases 1–14 DONE and LIVE at https://drone-derby.pages.dev (Convex prod
fastidious-dinosaur-923). Built-in boards: Proving Grounds, Spin Cycle,
The Gauntlet.

## Just Completed
- Phase 14: third built-in "The Gauntlet" (12×12, walls+lasers, three
  routes north; mouth-cap walls confine the corridor beams and force a
  lane switch). One file: src/engine/boards.ts. Tests stay 88.
- Verified: engine drive 15/15 (damage/beams/gear/belts/pit/CP1),
  Playwright dev turn-1 replay matches engine, pickers 1280+375, prod
  smoke (3 boards, Gauntlet hot-seat deals). Cascade §14 has full detail.

## Next Steps
1. THE STANDING GATE: Todd's fun-playtest verdict — rules/pacing tweaks
   become their own phase and preempt everything (incl. Gauntlet re-tune).
2. Backlog: Resend/Google auth (waiting on creds), gallery
   search/pagination (when board count warrants).

## Open Questions / Blockers
- Playtest verdict pending; auth creds pending.

## Key Files
- src/engine/boards.ts (theGauntlet + registry),
  src/engine/__tests__/validate.test.ts (registry-iterating gate),
  cascades/2026-07-05-v2-rewrite.md (§14 at bottom)
