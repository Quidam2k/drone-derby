# Session State
Updated: 2026-07-26 (Phase 3D-2 built + verified, awaiting Todd's drive-it gate)

## Current Task
Phase 3D-2 **player camera control** is BUILT and browser-verified: drag to
orbit, tilt, wheel/pinch zoom, pan, and an Action / My robot / Free follow
toggle, all persisted. Waiting on Todd actually driving it. Nothing committed.

## Just Completed
- Design that the phase turns on: **director owns the subject, player owns the
  viewpoint** — they compose; only panning takes the subject (→ `free` mode).
- New: `board3d/viewMath.ts` (+24 tests), `board3d/controls.ts` (hand-rolled
  Pointer Events, not OrbitControls), `services/viewSettings.ts`. Changed:
  `camera.ts` (composes, `refit()` gone), `scene.ts`, `Board3D.tsx` overlay,
  ProgrammingView/OnlineGameScreen publish the seat, ReplayPlayer ↺ Watch
  again, `index.css` `.board-3d-controls`.
- Numbers: main JS 114.90 → **116.15 KB gz**, scene chunk 171 → 173.33,
  precache 2126 → 2134.75 KiB. **144 tests green** (120 unchanged + 24 new).
  60.2 fps dragging, 58.8 fps under a calibrated 7.19× CPU throttle. Zero
  console errors/warnings.
- Two real bugs found in-browser and fixed: overlay read the focus player
  during render (hot-seat replay wrongly offered the lock); pinch-zoom flipped
  follow to `free` (deadzone now measures net centre displacement).
- Side fix: `dev:vivid-cat-177` Convex deployment was older than the code
  (no `expectedTurn`, no `grand-circuit`) — resynced with `npx convex dev --once`.

## Next Steps
1. Todd drives `?render=3d` and judges the composition. If keeping the
   player's angle while the director flies reads as disorienting, the
   alternative is "any drag suspends auto-follow until ↺" — one line.
2. Then 3D-3 Blender board assets (instanced; also where mesh compression
   gets measured, precache is 2134 KiB). Then 3D-4 event parity, 3D-5 real
   director, 3D-6 reels, 3D-7 cutover.
3. Rules work, independent: phase 30 repair economy (repair MUST run before
   `cleanUpCards`), 31 curved conveyors, 32 respawn facing, 33 power-down.

## Open Questions / Blockers
- Precache 2134 KiB for an offline PWA; Draco/meshopt still untried.
- Verifying anything online needs the dev Convex deployment in sync with the
  code — it silently wasn't.
- Standing gates (external): invite links → phase 27 telemetry mining;
  phase-25 SFX ear-check; auth creds.

## Key Files
src/components/board3d/{viewMath,controls,camera,scene,Board3D}*,
src/services/viewSettings.ts, notes/2026-07-26-session.md,
cascades/2026-07-05-v2-rewrite.md (§3D-2), screengrab/3d2-*.png
