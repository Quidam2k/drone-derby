# Session State
Updated: 2026-07-14 ~12:20

## Current Task
NONE IN FLIGHT — Phase 21 (in-app How to Play at #/rules) committed
(3640646) AND DEPLOYED to prod, smoke-tested (new SW bundle
index-C65HKPXE served after update, all 8 sections + 8 legend
sprites render, zero console errors).

## Just Completed
- §21: `#/rules` route (renders WITHOUT backend), RulesScreen
  (player-facing rewrite of mechanics doc, legend reuses real
  sprites.tsx SVGs), links from lobby card / join screen (back
  returns to invite — verified) / hot-seat setup. route.test.ts new;
  101 tests, typecheck, build, local + prod Playwright smoke green.
- Board audit: 4 built-ins are a good playtest spread — no changes.
- Backlog logged in cascade: multi-board composition design sketch
  (BoardDef stitching, no engine change) — future phase.

## Next Steps
1. THE STANDING GATE: Todd's prod playtest with friends (rules screen
   now live for invitees) → mine
   `npx convex run telemetry:recent --prod` → rules/pacing phase.
2. Backlog: multi-board composition, softer SFX pack, Pit
   Archipelago + banked boards, auth creds (Resend/Google) pending.

## Key Files
- src/components/rules/RulesScreen.tsx (edit rules copy here)
- cascades/2026-07-05-v2-rewrite.md (§21 + composition backlog logged)
