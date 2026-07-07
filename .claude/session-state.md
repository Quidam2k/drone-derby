# Session State
Updated: 2026-07-06 (Phase 7 DONE — deployed to prod)

## Current Task
Drone Derby v2 — cascade: cascades/2026-07-05-v2-rewrite.md.
Phases 1–7 DONE and LIVE at https://drone-derby.pages.dev (Convex prod
fastidious-dinosaur-923). MVP + editor + custom boards + mobile layout.

## Just Completed
- Phase 7 mobile pass: Board self-sizes --tile inline (tileFit() in
  Board.tsx, min(52px, vw/W, vh/H) — desktop unchanged at 52px cap;
  EditorBoard mirrors the var so the hit layer aligns). index.css ≤700px
  block: horizontal player strip, 5-up registers/hand, wrapped footer,
  44px touch targets; global touch-action, safe-area insets, dvh.
- Verified: typecheck + 85 tests; Playwright hot-seat turn @375 + online
  turn (2 auth contexts, 375/390); desktop 1280×800 unchanged; editor
  alignment. Deployed + prod spot-check @375. Cascade §7 has detail.

## Next Steps
1. Todd's fun-playtest verdict — rules/pacing tweaks take priority.
2. Backlog: SVG sprites, second built-in board, Resend/Google auth
   (needs creds), board gallery/sharing.

## Key Files
- src/index.css (phase-7 block at bottom), src/components/board/Board.tsx
  (tileFit), cascades/2026-07-05-v2-rewrite.md (§7 at the bottom)
