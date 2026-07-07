# Session State
Updated: 2026-07-07 ~10:00 (Phase 15 DONE — deployed to prod)

## Current Task
Drone Derby v2 — cascade: cascades/2026-07-05-v2-rewrite.md.
Phases 1–15 DONE and LIVE at https://drone-derby.pages.dev (Convex prod
fastidious-dinosaur-923). Everything is ready for THE fun-playtest.

## Just Completed
- Phase 15: playtest readiness. Telemetry (convex/telemetry.ts sink +
  src/services/telemetry.ts client: crash auto-capture, 🐞 note button,
  localStorage ring buffer, `npx convex run telemetry:recent --prod` to
  read). Root README.md (playtest guide + test-everything checklist).
  Tests 88 → 92. Verified local + prod smoke (note read back from prod).

## Next Steps
1. THE STANDING GATE: Todd plays on prod. Afterwards, mine
   `npx convex run telemetry:recent --prod` + his verdict → rules/pacing
   tweaks become their own phase (informing a Gauntlet re-tune).
2. Backlog: Resend/Google auth (waiting on creds), gallery
   search/pagination (when board count warrants).

## Open Questions / Blockers
- Playtest verdict pending; auth creds pending.

## Key Files
- src/services/telemetry.ts, convex/telemetry.ts, README.md,
  cascades/2026-07-05-v2-rewrite.md (§15 at bottom)
