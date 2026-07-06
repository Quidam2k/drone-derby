# Session State
Updated: 2026-07-05

## Current Task
Drone Derby v2 from-scratch rewrite — cascade plan at cascades/2026-07-05-v2-rewrite.md. Phase 1 pending approval.

## Just Completed
- Decided v2 architecture: Convex backend, pure-function engine + EventLog, DOM board, PWA + push, Zustand, no Redux/MUI/Express/Redis/Docker.
- Decided location: rewrite in-place, old code moves to legacy/.
- Wrote cascade plan (6 phases).

## Next Steps
1. Phase 1: archive old code to legacy/ (delete node_modules), scaffold Vite+React+TS at root, build pure engine in src/engine/ with Vitest suite, rewrite CLAUDE.md.
2. Phase 2: hot-seat UI + replay player (see cascade file).

## Key Files
- cascades/2026-07-05-v2-rewrite.md (source of truth for the rewrite)
- legacy/shared/types/game.ts (old card/tile enums, reference only — after archiving)
