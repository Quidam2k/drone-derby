# Session State
Updated: 2026-07-06 ~22:30 (Phase 12 DONE — deployed to prod)

## Current Task
Drone Derby v2 — cascade: cascades/2026-07-05-v2-rewrite.md.
Phases 1–12 DONE and LIVE at https://drone-derby.pages.dev (Convex prod
fastidious-dinosaur-923). MVP + editor + custom boards + mobile + 2 boards
+ sprites + thumbnail pickers + gallery/sharing + board forking.

## Just Completed
- Phase 12: gallery cards get "Open a copy in the editor" — loadDraft
  with `Copy of <name>` (40-char cap) + navigate to #/editor; Save online
  then mints a NEW board. Client-only (GalleryScreen.tsx), no CSS, no
  Convex, tests stay 86. Cascade §12 has full verification detail (dev
  Playwright incl. undo-restore + convex-data row check; prod smoke with
  throwaway published board, unpublished after).

## Next Steps
1. THE STANDING GATE: Todd's fun-playtest verdict — rules/pacing tweaks
   become their own phase and preempt everything if they land.
2. Backlog: third built-in board (after verdict), Resend/Google auth
   (waiting on creds), gallery: attribution chain, search/pagination.

## Key Files
- src/components/online/GalleryScreen.tsx (fork button + forkName),
  src/store/editorStore.ts (loadDraft — unchanged, load-bearing),
  cascades/2026-07-05-v2-rewrite.md (§12 at bottom)
