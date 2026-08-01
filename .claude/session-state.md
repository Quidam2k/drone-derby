# Session State
Updated: 2026-07-31 (phase 42 start)

## Current Task
Playtest-polish cascade (cascades/2026-07-31-playtest-polish.md) —
Phase 42: playtest telemetry (server flow events, version stamp,
client flow events, digest query + script).

## Just Completed
- Cascade plan approved and copied to cascades/2026-07-31-playtest-polish.md.

## Next Steps
1. Phase 42 implementation: convex/helpers.ts logFlow, games.ts call
   sites, vite define __APP_VERSION__, telemetry.ts 'flow' kind +
   logFlowEvent, digest internalQuery + scripts/telemetry-digest.mjs.
2. typecheck + test, verify digest on dev deployment, commit, deploy.
3. Then Phase 43 (flag placement at game creation).

## Key Files
convex/telemetry.ts, convex/games.ts, convex/helpers.ts,
src/services/telemetry.ts, vite.config.ts,
cascades/2026-07-31-playtest-polish.md
