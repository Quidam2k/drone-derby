# Session State
Updated: 2026-07-06 (Phase 10 DONE — deployed to prod)

## Current Task
Drone Derby v2 — cascade: cascades/2026-07-05-v2-rewrite.md.
Phases 1–10 DONE and LIVE at https://drone-derby.pages.dev (Convex prod
fastidious-dinosaur-923). MVP + editor + custom boards + mobile + 2 boards
+ SVG sprites + thumbnail board pickers.

## Just Completed
- Phase 10: both <select> board pickers → BoardPicker radio-cards with
  live BoardThumb mini-renders (new src/components/board/BoardThumb.tsx,
  boardCellMaps extracted from Board.tsx). Convex additions: myBoards
  returns board defs; games.game returns board snapshot in lobby status
  (waiting room now shows a thumb). Mobile ≤700px: cards scroll sideways.
- Verified: typecheck + 86 tests; Playwright hot-seat/online creates from
  builtin + saved-board cards, 375px + desktop. Deployed + prod smoke.
  Cascade §10 has detail.

## Next Steps
1. Todd's fun-playtest verdict — rules/pacing tweaks take priority.
2. Backlog: third board, Resend/Google auth (needs creds), board
   gallery/sharing.

## Key Files
- src/components/board/BoardThumb.tsx (+Board/LobbyScreen/SetupScreen/
  OnlineGameScreen, convex/boards.ts, convex/games.ts),
  cascades/2026-07-05-v2-rewrite.md (§10 at bottom)
