# Session State
Updated: 2026-07-27 (Phase 3D-3 built + verified, awaiting Todd's look gate)

## Current Task
Phase 3D-3 **Blender board tile kit** is BUILT and browser-verified: 11
modelled pieces in one `public/models/tiles.glb`, instanced by the existing
`Batch` machinery, industrial factory-floor direction. Waiting on Todd's eye
on the screengrabs. Nothing committed.

## Just Completed
- New: `scripts/blender/common.py` (primitives lifted out of `robots.py`),
  `scripts/blender/tiles.py`, `scripts/blender-path.mjs`,
  `scripts/render-tiles.mjs` (`npm run art:tiles`),
  `src/components/board3d/tileKit.ts`. Changed: `boardMesh.ts`
  (`buildBoard(board, kit?)`, per-piece `??` fallback), `scene.ts` (kit load
  + lighting rebalanced for metal), `robots.py`, `render-robots.mjs`.
- Design: TWO materials for the whole kit; the palette rides in per-vertex
  `COLOR_0`, which glTF multiplies into base colour. Each piece is modelled
  in the same local frame as the primitive it replaces, so placements are
  untouched and a missing .glb falls back piece by piece.
- Numbers: main JS **116.15 KB gz** (unchanged), scene chunk 173.33 →
  **174.10**, precache 2134.75 → **2852.96 KiB** (tiles.glb = 716 KiB).
  Draw calls **86**/frame with kit vs **88** with primitives (raw GL, incl.
  shadow pass) — no regression. 60.0 fps, 54.3 fps under a calibrated 9.38×
  CPU throttle. **144 tests green**, zero console errors/warnings.
- Kit-missing path verified (renamed the .glb: one warning, no crash).
  Flag isolation verified (lobby/setup/editor fetch no scene chunk, no .glb).

## Next Steps
1. Todd looks at `screengrab/3d3-*.png` and calls the art direction. If
   detail beats readability the fix is material-side (flatten the deck, push
   contrast into the functional pieces), not a re-model.
2. Then 3D-4 event parity, 3D-5 real director, 3D-6 reels, 3D-7 cutover.
3. Rules work, independent: phase 30 repair economy (repair MUST run before
   `cleanUpCards`), 31 curved conveyors, 32 respawn facing, 33 power-down.

## Open Questions / Blockers
- Precache now 2853 KiB for an offline PWA. Draco/meshopt still untried and
  still the only lever if that number has to come down.
- Standing gates (external): invite links → phase 27 telemetry mining;
  phase-25 SFX ear-check; auth creds.
- Browser-testing trap: `page.goto` to a URL differing only in the hash does
  NOT reload. Use `location.reload()` or you will judge a stale asset.

## Key Files
scripts/blender/{common,tiles}.py, scripts/{blender-path,render-tiles}.mjs,
src/components/board3d/{tileKit,boardMesh,scene}.ts,
notes/2026-07-27-session.md, cascades/2026-07-05-v2-rewrite.md (§3D-3)
