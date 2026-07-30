# Session note — authentic-boards cascade, Phases 35–36 (2026-07-29)

Cascade: `cascades/2026-07-29-authentic-boards.md`. Engine phases done;
renderer phases next.

## Phase 35 (engine, mechanical) — DONE, 433 tests green
- New tile kinds: `trapdoor {registers}`, `radiation`, `waste`; `pit` gained
  renderer-only `style?: 'drain'`. `WallDef.oneWay?: 'in'|'out'` (one change
  in `wallBlocked` covers movement + lasers). `BoardDef.crushers`.
- Trap-doors are pits for the ENTIRE scheduled phase: `openTrapdoors` kills
  at phase start; `fallsAt(ctx,pos)` (register-aware) replaces the raw pit
  checks in `tryStep`/`conveyorPulse`.
- Crushers slam after gears (`fireCrushers`): emit `crusher-crushed` (slam
  visual) then the standard `robot-destroyed` kill path — replay needed no
  new removal logic.
- Laser simultaneity: `fireLasers` traces board + robot beams from ONE
  snapshot, then applies damage. A robot killed by a board laser returns
  fire; its hulk blocks beams that segment. Event order preserved
  (board beams, robot beams, damage).
- Waste burns each register end, radiation only register 5, both in the
  laser segment (`hazardFloorDamage`); `damage` event gained
  `source?: 'flamer'|'radiation'|'waste'`.

## Phase 36 (engine, movement) — DONE, 463 tests green
- Photo re-read confirmed: **teleporter Back-Up appears 2 squares FORWARD**
  (guide's own example); Gear Box shows **repulsors as full-square tiles**.
- New tile kinds: `portal {color}` (pairs validated), `teleporter`,
  `repulsor`. `BoardDef.flamers` (pos + registers).
- Ctx gained `cardMove`/`cardValue`/`repulsing` — gates the elements that
  only react to card movement (per printed timing): flamer move-through,
  portals, repulsors. Belts/pushers leave them inert.
- Teleporter: card squares + 2 forward in `cardMoveRobot`; occupied dest →
  normal move; past rim → edge death (judgment call, in code comment).
- Repulsor: fling = opposite travel dir × card value, chain-pushes back
  through the mover, card's remaining movement lost. Field-driven flight
  burns flamers but never re-triggers portals/repulsors (recursion guard).
- New events (additive): `robot-teleported {via}`, `repulsed {from,to}`
  (summary AFTER its robot-moved steps — the event is the flash, not the
  motion; visualState endpoint update is idempotent).

## Gotcha worth remembering
EngineEvent switches are compile-time exhaustive in FIVE places; every new
event type needs a case: `replay/eventPresentation.ts` (duration+caption),
`replay/visualState.ts`, `board3d/directorMath.ts` (interest+points),
`board3d/directorTurn.test.ts` (legacyFocus), `services/audio.ts`
EVENT_SOUND + hand list in `audio.test.ts`.

## Phases 37–38 (renderers) — DONE
DOM sprites + editor tools + RulesScreen legend; 3D boardMesh batches +
scene dispatch (crusher slam, teleport blink, repulsed kick). Screenshot
verified both (screengrab/element-zoo-*.png).

## Phase 39 (Reactor Core + Gear Box transcription) — DONE, 477 tests
- `src/engine/authentic.ts`: `reactorCore()` — radiation floor with ten
  one-way-walled rest pockets, waste cross, sealed 2×2 core, 4 belt lines
  feeding 4 teleporters, 4 drains. `gearBox()` — 20 meshed alternating
  gears, 11 repulsors, 12 pits (one 2-cell chasm), 3 teleporters, belt
  spirals, 5 E-facing lasers (2 double: NW approach + the (8,8) cage).
- Census tests (`__tests__/authentic.test.ts`) assert exact photo counts —
  a transcription regression net. Both compose over dockyard() as 12×19
  built-ins `reactor-core` / `gear-box`.
- Transcription pipeline (perspective-warp + marker montages) lived in the
  previous session's scratchpad — rebuild from the method note in
  `.claude/session-state.md` history if needed: warp.py (4 corners →
  200px/tile flat PNG), rows/regions/markers strips. One-way art rule:
  G|R band pair = wall faces, RED-side cell cannot cross (store 'out' on
  red cell). Copper belt rollers fake red bands at low zoom — always zoom.
- README: checklist rows for both boards; lobby card count 6→8.
- Eyeballed: authentic-thumbs.png, reactor-core-3d.png, gear-box-3d.png
  (screengrab/), console clean in 3D for both.
- A mid-session reboot interrupted verification; recovery confirmed all
  Phase 39 work had landed on disk (typecheck + 477 tests green).

## Phase 40 (Pinwheel + Shake 'n' Bake + ship) — DONE, 493 tests
- Photos confirmed on open: …843259 = Pinwheel (title left edge),
  …850395 = Shake 'n' Bake (title upside-down → warp with --rot180).
- **Method upgrade**: corner-warp alone left ±60px interior drift (the
  boards bow), and seam auto-detection drowned in art. What worked:
  per-cell labeled contact sheets (`cellsheet.py`, 12 crops/row with
  margins) — bow < half a tile, so crop-center = cell identity, no
  pixel math. Region zooms (`zoomcells.py`) for digits/junctions and a
  numeric green-fraction classifier for radiation/waste extents.
- Grand Prix + Radioactive FFG photo settled the green regions: dark
  moss = radiation, bright skull-texture = waste. NO oil slicks printed
  on either board (Grand Prix oil slicks are black puddles) — the
  stop-and-flag tripwire never fired.
- `pinwheel()`: 40 normal belt cells in 4 ccw spokes + 4 isolated
  express singles (real on the photo — copper rollers; validate lint
  warning is expected, exception lives in validate.test.ts), 16
  radiation, 6 waste, purple portal pair, 8 trapdoors, 2 CW gears,
  2 wrenches, 2 double lasers on mount walls, 2 flamers spanning
  jet+ball cells (regs 1/2/4 N, 2/4/5 S), chop shops → floor.
- `shakeNBake()`: all-express (52 cells, 12 lines, 6 curves), belts
  convey INTO the 2×2 four-flamer oven; 12 one-way walls (red side
  stored 'out') form oven doors + approach valves, green side inward;
  blue + orange portal pairs; 8 trapdoors in stacked pairs; 2 wrenches;
  no lasers/gears/pits.
- Both boards are exactly 180°-rotationally symmetric (including belt
  dirs, curve chirality, express-ness) — `expectRotationallySymmetric`
  in authentic.test.ts locks it. Trapdoor register schedules are NOT
  digit-symmetric (photo-checked twice).
- `input/` (49MB of photos of WotC-copyrighted boards) gitignored like
  screengrab/ — stays local as the transcription source of truth.
- Verified: typecheck + 493 tests + build clean; lobby shows 10 cards;
  both boards eyeballed in 2D and 3D, console clean (screengrab/
  lobby-10-cards.png, pinwheel-2d.png, pinwheel-3d.png,
  shake-n-bake-3d.png).

## Next
Cascade complete; playtest gate open. Optional Phase 41: Blender art
for the new tile-kit pieces (CPU only — ask before GPU).
