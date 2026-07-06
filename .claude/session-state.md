# Session State
Updated: 2026-07-06 (Phase 6b DONE — deployed to prod)

## Current Task
Drone Derby v2 — cascade: cascades/2026-07-05-v2-rewrite.md.
Phases 1–6b DONE and LIVE at https://drone-derby.pages.dev (Convex prod
fastidious-dinosaur-923). v2 MVP + editor + custom online boards shipped.

## Just Completed
- Phase 6b: boards table + convex/boards.ts CRUD (server validateBoard
  gate, 50/user cap, creator-only), custom-board games (BoardDef snapshot
  at createGame, seat cap = board spawn count in join/start/preview),
  lobby board picker, #/editor/<boardId> cloud save/load (pendingAuth
  effect for first-save sign-in; hydratedBoardId guard vs. reactive
  clobber). requireUserId → shared convex/helpers.ts.
- Verified: typecheck + 85 tests; 4-context Playwright E2E on dev deploy
  (save/reload-from-cloud/in-place resave/invalid-save + 4th-join HTTP
  probes/3-player game on 8×10 board/replay on all clients); prod smoke
  (editor → save → picker → custom-board game). Cascade §6b has detail.

## Next Steps
1. Todd's fun-playtest verdict — rules/pacing tweaks take priority.
2. Backlog: mobile layout, SVG sprites, second built-in board,
   Resend/Google auth (needs creds), board gallery/sharing.

## Key Files
- convex/boards.ts, convex/games.ts, src/components/editor/EditorToolbar.tsx,
  cascades/2026-07-05-v2-rewrite.md (§6b at the bottom)
