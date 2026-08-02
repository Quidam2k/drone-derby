# Session State
Updated: 2026-08-01 ~20:30

## Current Task
Playtest-polish cascade (cascades/2026-07-31-playtest-polish.md).
Phases 42-46 DONE. Remaining: 47 robot anim, 48 lighting/fx, 49 camera
(optional), 50 ship+deploy.

## Just Completed
- Phase 46: Blender kit pieces for the 10 expansion elements — 14 new pieces
  (PIECE_NAMES 15 → 29), tiles.py + boardMesh/tileKit wiring. All 14 proven
  to reach the board by runtime identity probe; fallback verified with
  tiles.glb removed; export is byte-deterministic again after rebuilding
  repulsor_core as an icosphere. 517 tests green. Wire cost +60 KB brotli.
- Phase 45 landed earlier this session (UI consistency, commit 6c6de72).

## Next Steps
1. Phase 47 — robot mesh animation: scripts/blender/robots.py +
   src/components/board3d/robots.ts (+ scene.ts step wiring). Treads,
   hexapod gait, buggy wheels, hover bob, off the rig's eased velocity.
   Named sub-parts EXCLUDED from the by-material merge; anims stop when
   settled (on-demand loop must still sleep); reduced-motion skips;
   missing named part → static fallback, no crash.
2. Then 48 (lighting/effects), 49 (camera, optional), 50 (ship + deploy).
   Nothing deployed since Phase 43 — prod is missing 44, 45, 46.

## Open Questions / Blockers
- Still waiting on Todd's photos of the 84 program cards (deck spec
  unverified). Not blocking 47-50.
- If robots.glb exports non-deterministically in 47, suspect
  `common.dome`'s UV sphere first (see cascade decision log, Phase 46).

## Key Files
cascades/2026-07-31-playtest-polish.md (plan + decisions log),
scripts/blender/robots.py, scripts/blender/common.py,
src/components/board3d/robots.ts, src/components/board3d/scene.ts
