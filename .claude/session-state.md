# Session State
Updated: 2026-07-25 (phase 28 done, phase 29 planned)

## Current Task
New cascade "review fixes → tabletop parity → robot art" = phases 28–34,
appended to `cascades/2026-07-05-v2-rewrite.md`. **Phase 28 is DONE and
committed.** Next up: phase 29 (robot art baker, chassis 0 — a GATE).

## Just Completed
- Phase 28: six review fixes (conveyor clipPath `useId`, `archive` object
  aliasing, unconditional `cleanUpCards` on mid-register win, Convex
  `expectedTurn` stale-drop, lobby `seats` from board spawns, nudge
  cooldown re-render) + new `src/engine/__tests__/invariants.test.ts`
  (220 seeded fuzz games; tripwire verified against the reverted fix).
- typecheck (root + convex) + 120 tests green; Playwright hot-seat on
  Spin Cycle: 20/20 unique clip ids, 0 unresolved, zero console errors.

## Next Steps
1. Phase 29 — `scripts/bake-robots.mjs` (3D→SVG baker) → chassis 0 only,
   `npm run art`, Playwright screenshots desktop + 52px. **Gate: Todd's
   eyeball.** Good → phase 34; ugly → hand-authored SVG, drop generator.
2. Phase 30 — repair economy (flag + wrench tiles). Repair MUST run
   before `cleanUpCards` so unlocked registers return cards to the deck.
3. Phases 31–33: curved conveyors, respawn facing, power-down.

## Open Questions / Blockers
- Standing gates (external, unchanged): Todd sends invite links → unblocks
  phase 27 telemetry mining; Todd's phase-25 SFX ear-check; auth creds.
- Untracked junk file at repo root with a mangled name
  (`C:UsersTodd.claudeplans...md`) — left alone, safe to delete.

## Key Files
cascades/2026-07-05-v2-rewrite.md (§28 + ⚠️ NEXT → phase 29),
notes/2026-07-25-session.md, src/engine/__tests__/invariants.test.ts,
src/engine/execute.ts, src/components/board/sprites.tsx, convex/games.ts
