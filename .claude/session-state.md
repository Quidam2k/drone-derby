# Session State
Updated: 2026-07-06 ~22:00 (Phase 11 DONE — deployed to prod)

## Current Task
Drone Derby v2 — cascade: cascades/2026-07-05-v2-rewrite.md.
Phases 1–11 DONE and LIVE at https://drone-derby.pages.dev (Convex prod
fastidious-dinosaur-923). MVP + editor + custom boards + mobile + 2 boards
+ sprites + thumbnail pickers + board gallery/sharing.

## Just Completed
- Phase 11: publish/unpublish + gallery() in convex/boards.ts (schema:
  publishedAt/authorName + by_publishedAt index); createGame accepts
  foreign PUBLISHED boardIds (snapshot semantics verified — unpublish
  never breaks existing games). New #/gallery GalleryScreen, editor
  Publish/Unpublish button, lobby gallery card, picker "published" badge.
  CSS fix: .lobby-header .back-link position:static (was fixed, overlapped
  the title). Cascade §11 has detail.
- Verified: typecheck + 86 tests; Playwright 2-account pass (publish →
  guest B sees/creates → unpublish → B's game survives), 375px + desktop.
  Deployed Convex prod + CF Pages; prod smoke OK.

## Next Steps
1. THE STANDING GATE: Todd's fun-playtest verdict — rules/pacing tweaks
   become their own phase and preempt everything if they land.
2. Backlog: third built-in board (after verdict), Resend/Google auth
   (waiting on creds), gallery follow-up: board forking ("open a copy in
   the editor").

## Key Files
- convex/boards.ts, convex/games.ts, convex/schema.ts,
  src/components/online/GalleryScreen.tsx,
  src/components/editor/EditorToolbar.tsx,
  cascades/2026-07-05-v2-rewrite.md (§11 at bottom)
