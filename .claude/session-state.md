# Session State
Updated: 2026-07-26 (Phase 3D-1 built, awaiting Todd's look gate)

## Current Task
Phase 3D-1 `Board3D` spike is **BUILT and verified** — real-time 3D board
behind `?render=3d`, DOM board untouched and still the default. Waiting on
Todd's eyeball on the side-by-side screengrabs.

## Just Completed
- `src/components/board3d/{Board3D,scene,boardMesh,robots,camera}`, props
  derived from `Board` so they can't drift. `three` only via
  `await import('./scene')`. Flag = one line at each of 3 call sites.
- `robots.py --export-glb` (reuses `build(seat)`), 4 `.glb` in public/models.
- Numbers: main JS +1.0 KB gz (114.90); lazy chunk **171 KB gz** (the
  analysis note's 38 KB was 4.5x low); precache 709 KiB → **2126 KiB**;
  **60 fps at 1x/4x/6x CPU throttle** on the 12x17 composed board, with a
  busy-loop calibration proving the throttle applied. CDP throttles CPU,
  not GPU — a real phone is still the honest test.
- 99-step replay walk: zero off-grid/out-of-bounds/diagonal. Zero console
  errors or warnings. Editor + thumbnails still DOM and still hit-test
  with the flag ON, and never fetch three.js or any .glb.
- typecheck clean, **120 tests green, unchanged**. Nothing committed yet.

## Next Steps
1. Show Todd `screengrab/3d1-compare-1280.png` + `3d1-compare-375.png`.
   Good → 3D-2 (Blender board assets). Bad → delete `board3d/` + the dep.
2. If green: 3D-2 board assets, 3D-3 rigging (hexapod walk = risk item),
   3D-4 event parity, 3D-5 camera director (seed interest scoring from
   `eventDuration`), 3D-6 reels, 3D-7 cutover.
3. Rules work, independent: phase 30 repair economy (repair MUST run
   before `cleanUpCards`), 31 curved conveyors, 32 respawn facing, 33
   power-down.

## Open Questions / Blockers
- Precache more than tripled (2126 KiB). Draco/meshopt on the .glb is the
  untried lever if that's too much for an offline PWA.
- Standing gates (external): invite links → phase 27 telemetry mining;
  phase-25 SFX ear-check; auth creds.

## Key Files
src/components/board3d/*, scripts/blender/robots.py (--export-glb),
notes/2026-07-26-session.md, cascades/2026-07-05-v2-rewrite.md (§3D-1),
screengrab/3d1-compare-*.png
