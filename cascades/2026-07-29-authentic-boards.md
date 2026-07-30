# Cascade: Authentic boards — transcribe the four photographed RoboRally boards

Started 2026-07-29. Reference photos: `input/reference_photos/` (12 shots).
Verification results + element inventory: `notes/2026-07-29-reference-photo-checklist.md`.
Approved plan lives in this file; per-phase status below.

## Goal

Add the ~10 expansion board elements the four photographed boards need
(engine + both renderers + editor + legend), close the two rules deltas
(crushers, laser simultaneity), then transcribe Pinwheel, Shake 'n' Bake,
Gear Box, and Reactor Core. Playtests are gated until they can run on
transcribed boards. Option cards stay permanently cut (chop shops → floor,
waste option-draws → damage only).

## Cross-phase decisions

- **Drains = `pit` with `style: 'drain'`** — engine ignores it, renderers art it.
- **Trap-door pit**: `{ kind: 'trapdoor', registers: number[] }` — a pit for the
  ENTIRE scheduled phase (kills at phase start AND mid-move).
- **Crushers/flamers are BoardDef arrays** (pusher pattern), not tile kinds.
- **One-way walls**: `WallDef.oneWay?: 'in' | 'out'` — one check in `wallBlocked`
  covers movement + lasers (dir-aware).
- **Radiation** damages end of TURN (register 5's laser segment); **waste**
  damages end of EVERY register phase (laser segment).
- **Laser simultaneity**: board + robot lasers computed from one position
  snapshot, then damage applied; event stream stays sequential.
- **Portals** paired by color; inert when twin occupied. **Teleporter**: card
  squares + 2 forward, ignore everything between; destination occupied → move
  normally; out of bounds → edge death. Back-Up distance: re-read from the
  Radioactive FFG photo before coding Phase 36.
- **Repulsor field**: edge feature; repulsed N = the moving/pushing robot's
  card value; mover loses remaining movement; repulsed robots chain-push.
- Portals/teleporters/repulsors act during CARD movement only (chain pushes
  yes; belts/pushers no, per printed timing).
- **Events**: extend additively. `damage` gains
  `source?: 'flamer'|'radiation'|'waste'|'crusher'`; new types
  `crusher-crushed`, `robot-teleported {via: 'portal'|'teleporter'}`,
  `repulsed`. No event without a subject.
- All four boards are 12×12, no printed docks/flags → compose with
  `dockyard()` + our own flag placements (adjust when Todd photographs
  official scenarios).

## Phases

- [x] **35 — Engine, mechanical tier + laser delta**: DONE (433 tests).
  trapdoor, pit style 'drain', crushers, one-way walls, radiation, waste,
  laser snapshot fix. Note: EngineEvent switches are compile-time
  exhaustive in eventPresentation/visualState/directorMath/
  directorTurn.test/audio(+test) — every new event needs a case there.
- [x] **36 — Engine, movement tier**: DONE (463 tests). Flamers, portals,
  teleporters, repulsors. Confirmed from photos: teleporter Back-Up
  appears 2 squares FORWARD (guide's own example); repulsors are
  full-square tiles on Gear Box (not edge features). Judgment calls in
  code comments: teleport past rim = edge death; field-driven flight
  burns flamers but re-triggers neither portals nor repulsors.
- [x] **37 — DOM renderer + editor + legend**: DONE. 9 new sprites +
  crusher/flamer cell overlays, one-way wall CSS gradients (red = blocking
  face), 9 new editor tools (fixtureOdd/portalColor/wallOneWay options),
  RulesScreen: 11 new legend rows + wrench row + fixed stale damage/laser
  copy. Screenshot-verified (screengrab/element-zoo-editor.png,
  rules-legend.png).
- [x] **38 — 3D renderer + replay**: DONE. boardMesh primitive batches for
  all new elements (portal rings tint per instance; one-way walls = paired
  red/green slabs), scene.ts dispatch: crusher slam, teleport blink
  (rig.snap + land effect), repulsed discharge kick. eventPresentation/
  visualState/director/audio cases landed with phases 35–36.
  Screenshot-verified (screengrab/element-zoo-3d.png).
- [x] **39 — Transcribe Reactor Core + Gear Box**: DONE (477 tests).
  `src/engine/authentic.ts`: `reactorCore()` (58 radiation, 34 waste,
  4 drains, 4 teleporters, 24 belts, sealed 2×2 core, 16 one-way walls)
  + `gearBox()` (20 meshed gears, 11 repulsors, 12 pits, 3 teleporters,
  45 belts, 5 E-facing lasers incl. 2 double). Census tests in
  `__tests__/authentic.test.ts`; BUILTIN_BOARDS composes each over
  dockyard() (12×19). README: board checklist entries + card count 6→8.
  Eyeballed: screengrab/authentic-thumbs.png, reactor-core-3d.png,
  gear-box-3d.png (console clean).
- [x] **40 — Transcribe Pinwheel + Shake 'n' Bake + ship**: DONE (493
  tests). `pinwheel()`: 4 ccw belt spokes, radiation corners + waste
  pools, purple portal pair, 2 two-cell flamers (regs 1/2/4 + 2/4/5),
  2 double lasers, 8 trapdoors, 2 CW gears, 4 isolated express singles
  (photo-real; validate-lint exception in validate.test). `shakeNBake()`:
  52 express cells in 12 lines/6 curves feeding a 4-flamer oven behind
  12 one-way walls (green side in), blue+orange portal pairs, 8
  trapdoors in pairs. Both exactly 180°-rotationally symmetric —
  symmetry test guards the transcription. Photos identified: …843259 =
  Pinwheel, …850395 = Shake 'n' Bake (rot 180°). Method note: cell-sheet
  crops (per-cell labeled contact sheets) beat grid overlays — the
  boards bow, corners-only warps leave ±60px interior drift.
  `input/` gitignored (49MB photos of WotC art stay local-only).
  README rows + lobby 8→10. Shipped: commit + deploy + prod smoke.
- [ ] **(optional) 41 — Blender art** for new tile kit pieces (CPU only).

## Verification per phase

Engine: `npm run typecheck` + `npm test`. Renderers: dev-server screenshot
pass in both renderers (browser minimized) + editor round-trip.
Transcription: validate() clean + per-board element-count test vs. photo +
thumb/3D eyeball. Ship: full pre-flight + deploy + prod smoke.

⚠️ NEXT: cascade COMPLETE — all four boards transcribed and shipped;
the playtest gate is open. Optional Phase 41 remains: Blender art for
the new tile-kit pieces (portal ring, teleporter pad, repulsor coil,
trapdoor hatch, crusher head, flamer nozzle, one-way slabs — CPU only,
ask before GPU).
