# Session State
Updated: 2026-07-27 (Phase 3D-4 built + verified, awaiting Todd's replay gate)

## Current Task
Phase 3D-4 **event parity for the 3D board** is BUILT and browser-verified:
every EngineEvent that belongs on the board now has a visible consequence in
3D (bubbles, bump, pit/edge falls, blast, respawn drop, checkpoint pop,
muzzle-accurate lasers, win flourish). Waiting on Todd watching a replay end
to end. Nothing committed.

## Just Completed
- New: `src/components/board3d/effectMath.ts` (+ 41 tests), `effects.ts`
  (`EffectField`, pooled). Changed: `robots.ts` (death/drop/recoil state that
  survives `visible:false`; `SEAT_COLORS`; `probe` gains `height`), `scene.ts`
  (event dispatch, laser rework, key-light lift, bubble anchors),
  `boardMesh.ts` (`laserMuzzle()`, `checkpointRing()`), `Board3D.tsx`
  (bubbles overlay written straight to refs), `index.css`.
  **`ReplayPlayer.tsx` untouched** — fixed effect durations under
  `eventDuration`'s 1x budget, force-finished on the next event.
- Numbers: main JS **116.31 KB gz** (was 116.15), scene chunk 174.10 →
  **178.52**, precache 2852.96 → **2865.49 KiB**. Draw calls 76 idle / 78
  with a beam / **86 peak during effects** = 3D-3's baseline, no permanent
  rise. 60.0 fps, 52.3 fps under a calibrated 8.07x throttle.
  **185 tests green** (144 untouched + 41 new).
- Scrub-backwards verified with the new `height` probe: nothing stranded
  invisible, mid-air or on the wrong cell. Reduced motion verified.
- Screengrabs `screengrab/3d4-*.png` cover every event, side by side with the
  DOM board at the same cursor.

## Next Steps
1. Todd watches a replay. Risk is **noise**; the fix is per-effect (shorten,
   desaturate, cut one) — one `EffectField` method per event — not a rethink.
2. Remaining preview-build checks if wanted: kit-missing path, flag
   isolation, 1280/375 screengrabs of the real app (harness screengrabs
   already cover the events).
3. Then 3D-5 real director (interest scoring seeded from `eventDuration`),
   3D-6 highlight reels, 3D-7 cutover.

## Open Questions / Blockers
- On a small board the camera keeps the whole-board framing, so a robot
  thrown off the SOUTH rim leaves the bottom of the canvas (sized to the
  board, headroom only above). That is 3D-5's director, not this phase.
- Precache 2865 KiB for an offline PWA. Draco/meshopt still the only lever.
- Standing gates (external): invite links → phase 27 telemetry mining;
  phase-25 SFX ear-check; auth creds.
- Browser-testing traps: `page.goto` to a hash-only-different URL does NOT
  reload (use `location.reload()`); a CDP session does not survive between
  tool calls, so apply AND measure a CPU throttle inside one call; warm the
  busy-loop calibration ~8 runs first.

## Key Files
src/components/board3d/{effectMath,effectMath.test,effects,robots,scene,
boardMesh,Board3D}.ts(x), src/index.css,
notes/2026-07-27-session-3d4.md, cascades/2026-07-05-v2-rewrite.md (§3D-4)
