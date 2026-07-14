# Session State
Updated: 2026-07-14

## Current Task
Phase 21 (in-app How to Play screen) — code done + local-smoked;
committing, deploying, prod smoke of https://drone-derby.pages.dev/#/rules.

## Just Completed
- §21: `#/rules` route (renders WITHOUT backend, above the !convex
  fallback), RulesScreen (player-facing rewrite of the mechanics doc,
  legend reuses real sprites.tsx SVGs), entry links: lobby card, join
  screen "First time?" quiet-link (back returns to invite), hot-seat
  setup subtitle. route.test.ts new — 101 tests, typecheck, build,
  Playwright smoke (all 3 entry points + direct load + 375px) green.
- Board audit: 4 built-ins are a good playtest spread — no changes.
- Backlog logged in cascade: multi-board composition design sketch
  (BoardDef stitching, no engine change) — future phase.

## Next Steps
1. Commit §21, `npm run deploy`, prod smoke `#/rules` (new SW build,
   sprites render, no console errors).
2. THE STANDING GATE: Todd's prod playtest with friends → mine
   `npx convex run telemetry:recent --prod` → rules/pacing phase.

## Key Files
- src/components/rules/RulesScreen.tsx, src/services/route.ts(+test)
- cascades/2026-07-05-v2-rewrite.md (§21 + composition backlog logged)
