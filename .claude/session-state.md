# Session State
Updated: 2026-07-07 ~09:15 (Phase 13 DONE — deployed to prod)

## Current Task
Drone Derby v2 — cascade: cascades/2026-07-05-v2-rewrite.md.
Phases 1–13 DONE and LIVE at https://drone-derby.pages.dev (Convex prod
fastidious-dinosaur-923). Forking story complete (fork + attribution).

## Just Completed
- Phase 13: forked boards remember "forked from <name> by <author>" —
  `boards.forkedFrom` snapshot (insert-only, patch ignores), editorStore
  carries it beside the draft (not in undo history; Import JSON/reset
  clear it), gallery card renders a second muted line. Tests 86 → 88.
- Verified on dev (Playwright fork→save→publish→card + convex data row
  checks, 375px), deployed (Convex additive schema + CF Pages), prod
  smoke OK. Cascade §13 has full detail. Committed + pushed.

## Next Steps
1. THE STANDING GATE: Todd's fun-playtest verdict — rules/pacing tweaks
   become their own phase and preempt everything if they land.
2. Backlog: third built-in board (after verdict), Resend/Google auth
   (waiting on creds), gallery search/pagination (when count warrants).

## Open Questions / Blockers
- Playtest verdict pending; auth creds pending.

## Key Files
- convex/schema.ts + convex/boards.ts (forkedFrom), src/store/
  editorStore.ts (ForkAttribution, persist wrapper), src/components/
  online/GalleryScreen.tsx, src/components/editor/EditorToolbar.tsx,
  cascades/2026-07-05-v2-rewrite.md (§13 at bottom)
