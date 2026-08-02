# Session note — 2026-07-31 — Playtest-polish cascade, Phase 42

Cascade: `cascades/2026-07-31-playtest-polish.md` (phases 42–50).

## Phase 42 shipped: playtest telemetry (commit 5583bd2, deployed to prod)

- **Server flow rows**: `logFlow()` in convex/helpers.ts (kind `'flow'`,
  never throws, 2KB data cap, context `{source:'server', gameId}`).
  games.ts logs: game-created, game-joined, game-started,
  program-submitted, turn-executed {ms}, turn-error {stack},
  game-finished, nudge.
- **Design deviation (important)**: turn-error does NOT rethrow — a thrown
  Convex mutation rolls back all writes including the telemetry row. The
  catch logs + returns `{stale:false}`; a bricked turn shows "executing…"
  forever and a digest `turn ERRORS` count. Documented in cascade
  cross-phase decisions.
- **Version stamp**: `__APP_VERSION__` = pkg.version+gitshort+yyyymmdd via
  vite define (declared src/vite-env.d.ts, read as `APP_VERSION` in
  services/telemetry.ts with typeof guard for node). Client telemetry
  context gains `appVersion`; dim `.version-tag` in the lobby footer.
- **Client flow events**: `logFlowEvent()` — renderer-fallback (Board3D
  catch), push-subscribe-failed (subscribeToPush wrap), pwa-installed
  (appinstalled, main.tsx).
- **Digest**: `node scripts/telemetry-digest.mjs [--prod] [--hours N]` →
  telemetry:digest internalQuery (funnel, counts by kind, errors + 🐞
  notes verbatim newest-25, sessions/games/versions seen, 4000-row bound
  with truncated flag). `telemetry:clear '{"olderThanDays":N}'` prunes
  (JSON arg must have no spaces on PowerShell).

## Verification

- typecheck + 495 tests green; convex/ tsconfig checked separately.
- E2E on cloud dev deployment (two anonymous users via localStorage
  auth-token swap — snapshot `__convexAuth*` keys, swap, reload):
  create→join→start→2×submit→execute gave digest funnel exactly
  1/1/1/2/1, renderer-fallback 1 (fired via `import('/src/services/
  telemetry.ts')` in dev), version seen. clear deleted the rows.
- Prod smoke: deploy via `npm run deploy`; prod digest runs; lobby footer
  shows `2.0.0+5583bd2+20260801` (needed SW update + reload — autoUpdate
  serves the stale precache for one load).

## Gotchas for later phases

- ProgrammingView interaction is select-card-THEN-click-register (not
  click-to-place); Playwright helper loop in transcript.
- `npx convex run` JSON args from PowerShell: escape quotes and avoid
  spaces inside the JSON, or it splits into two argv entries.

## Phase 43 shipped: flag placement at game creation (commit 4993feb, deployed to prod)

- **Engine**: `src/engine/placement.ts` — `checkpointPositions(board)`
  (checkpoints sorted by n) and `applyFlagPlacements(board, positions)`
  (strip all printed flags to floor, paint 1..n in array order; pure).
  The helper THROWS on off-board/fractional/duplicate targets and on
  anything that isn't plain floor after the strip — validateBoard can't
  catch a flag painted over a belt (the result is still "valid", minus a
  belt), so strictness lives in the helper. 9 tests incl. all-builtins
  round-trip deep-equal.
- **UI**: `src/components/board/FlagPlacer.tsx` — collapsed "Customize
  flags" expander under the BoardPicker (LobbyScreen create card +
  hot-seat SetupScreen). DOM Board + click-only hit layer (reuses
  editor-board-wrap/editor-hit-layer CSS geometry). State in the parent
  as `Position[] | null` (null = printed = untouched path); parent resets
  to null on board switch; Create/Start disabled at 0 flags.
- **Server**: createGame optional `flagPlacements` — re-applied to the
  SERVER-resolved board (never trusts a client board), validateBoard on
  the result, snapshot stored (incl. on the default Proving Grounds path,
  which otherwise stores none). Rejections are clean errors, no game row.
  game-created flow row gains `customFlags: n`.
- **Verified E2E** (dev deployment vivid-cat-177): custom flags show in
  lobby thumb + turn-1 board in BOTH renderers; hot-seat same on Spin
  Cycle; untouched default identical to printed; belt/off-board
  placements rejected server-side. Prod smoked at 2.0.0+4993feb.
- Screenshots: screengrab/flag-placer-lobby.png, flags-turn1-{3d,2d}.png,
  prod-smoke-phase43-flags.png.

## Phase 44 shipped: editor UX overhaul (not deployed — next deploy at 50)

- **Tool grouping + hotkeys**: new `src/components/editor/editorHotkeys.ts`
  holds TOOL_SECTIONS (Terrain/Hazards/Movers/Course/Edges/Eraser) +
  TOOL_HOTKEYS + pure `editorKeyCommand()` (no JSX → node-testable).
  ToolPalette pairs it with a typed icon map and renders labels + `kbd`
  key hints as FLAT flex children — the mobile scroll-snap row just hides
  `.tool-section-label`/`.tool-key`. Keys: F P D T / R A U M / C G O X Q /
  K S N / W L H / E. EditorScreen's keydown handler now routes everything
  (undo/redo chords + plain tool keys) through editorKeyCommand; form
  fields swallow all keys, modified letters left to the browser.
- **Templates**: `TemplateBoardModal.tsx` (AppendBoardModal's card
  pattern, no shared component — copy differs) behind "New from
  template…" in the toolbar. Pick → `loadDraft({...factory(), name:
  'Copy of <name>'})` — one undo step, attribution cleared (built-ins
  aren't gallery forks).
- **Renumber**: `renumberCheckpoints()` store action (reading-order sweep
  via `update()`; returns false when clean → no history entry, so
  idempotent for free). ValidationPanel shows "Renumber flags" when any
  error contains `'checkpoint number'`.
- 513 tests green (9 new); Playwright verified desktop + 375px + corner
  hit-layer regression; screenshots in screengrab/phase44-*.png. Todd's
  "Element Zoo" localStorage draft was preserved (restored via undo after
  testing).

⚠️ NEXT: Phase 45 — UI consistency pass (S). index.css-centric: speech
bubbles to dark theme, button scale tokens, :focus-visible ring, themed
scrollbars; Playwright before/after sweep at 1280 + 375. Plan in cascade.

## Phase 45 shipped: UI consistency pass (not deployed — next deploy at 50)

Written 7/31 late, verified + landed 8/1.

- **Speech bubbles** off the cream `#fffdf5` onto `--panel-2` + `--line`
  border. The tail is two stacked triangles — `::before` in `--line` sits
  1px proud of the `::after` in `--panel-2` — so the bubble's border
  continues around the tail instead of stopping at the corners. Checked in
  both renderers (3D and DOM fallback).
- **Scale tokens** `--radius` (8px), `--radius-sm` (6px), `--btn-py`,
  `--btn-px` replace ~15 ad-hoc 8/10/12px radii and the button padding
  literals. Mobile 44px touch minimums untouched.
- **Focus ring**: global `:focus-visible` accent outline, 2px offset —
  measured live, and mouse clicks stay ring-free. Removed `outline: none`
  from `input:focus` so text fields participate.
- **Themed scrollbars** (`scrollbar-color`/`scrollbar-width` + webkit
  pseudo-elements); **disabled buttons** get `filter: saturate(0.4)` so a
  disabled `.primary` reads grey, not faded-accent.
- **Hero gradient is lobby-only now.** This was the one plan item nobody
  had done: `.title` carried the gradient, so all 8 screens using it wore
  the brand. `.title` → plain `--text`; gradient moved to `.title.brand`
  on the three "Drone Derby" wordmark sites only. New screens get the
  plain title by default.
- 513 tests + typecheck green. Screenshot caveat: the 7/31 lobby/gallery
  before+after shots all caught the signed-out splash (all 22798 bytes,
  useless); real ones recaptured 8/1 as phase45-after-lobby-1280 /
  -lobby-focus-1280 / -lobby-375 / -gallery-1280 /
  -gallery-plain-title-1280.

⚠️ NEXT: Phase 46 — Blender kit pieces for the 10 expansion elements (L).
tiles.py → `npm run art:tiles` → tiles.glb, then boardMesh.ts/tileKit.ts
wiring. Model each piece in the LOCAL FRAME of the primitive it replaces
(read boardMesh.ts:300-500 first). CPU only; primitive fallback must keep
working with tiles.glb deleted.

## Phase 46 shipped: Blender kit pieces for the expansion elements

14 new pieces (10 elements; four are two pieces each — portal ring+core,
teleporter pad+core, repulsor coil+core, crusher post+head). `PIECE_NAMES`
15 → 29. Each modelled in the LOCAL FRAME of the primitive it replaces, so
boardMesh placements are untouched.

- **Materials split 8/6.** Eight pieces take the kit's `tile_pbr` and carry
  their palette in COLOR_0. Six keep a CODE material because their colour is
  a rule, not art: waste, teleporter_core, repulsor_core (emissive hazard
  cue), portal ring+core (pair colour is per-instance), oneway_slab
  (red/green IS the rule). Those six get geometry only — so they must read
  through silhouette.
- **Radiation moved off that list mid-phase.** Planned as geometry-only, but
  the modelled trefoil was invisible under the emissive material: uniform
  emission kills the shading that makes relief legible. Now painted hazard
  yellow on HAZARD_K via the kit material — the DOM board's read.
- **The deterministic-export check actually failed first time.** Two exports
  differed by exactly 2.5 KB, all of it one mesh's index buffer:
  `repulsor_core`, a UV sphere. Quads → exporter triangulates → not stable
  run to run. Rebuilt as an icosphere; byte-identical since. `common.dome`
  left alone, so robots.py may carry the same latent issue into Phase 47.
- **Verification gotcha worth remembering**: `browser_navigate` to the same
  `#/hash` URL is a FRAGMENT nav, not a reload — the JS never re-executes.
  Cost a round of "my change isn't taking effect"; `location.reload()` is
  the reliable move when checking a source edit in the running app.
- Crushers and flamers are unreachable by screenshot (no builtin board has a
  crusher), so all 14 pieces were confirmed by runtime probe against a
  synthetic board: each InstancedMesh holds the kit geometry BY IDENTITY.
- Fallback verified with tiles.glb removed: full primitive board, one
  designed warning, zero errors.
- Size: raw 0.96 → 1.61 MB, but brotli over the wire is 0.21 → 0.27 MB
  (+60 KB). Not worth trimming; the raw number is decompressed size.
- New guard: `tileKit.pieces.test.ts` parses tiles.py's PIECES table and
  asserts it matches PIECE_NAMES both directions. 517 tests green.

⚠️ NEXT: Phase 47 — robot mesh animation (treads / hexapod gait / wheels /
hover bob) driven off the rig's eased velocity. Named parts excluded from
the by-material merge; anims must stop when settled so the on-demand render
loop still sleeps; reduced-motion skips; missing part → static, no crash.

## Phase 47 shipped: robot mesh animation (2026-08-01)

The four chassis move now — rolling treads, an alternating tripod gait,
spinning wheels, a hovercraft bob and thruster pulse. No engine changes: all
of it is derived from the rig's existing eased position.

- **Blender**: `common.anim_group(name, pivot, objects)` parents the moving
  parts to an `anim_<name>` empty. PARENTING, not `bpy.ops.object.join` —
  join keeps only the active object's modifiers and would silently drop every
  bevel but one. `export_glb` gains one exception to "strip every non-MESH":
  EMPTY objects named `anim_*`, which are pivots, not scaffolding.
  Eight groups: tread_l/r, tripod_a/b, wheel_0..3.
- **Two model changes to make the motion legible**: the tread rib strip went
  11 → 12 ribs (the extra rear rib is what lets the strip translate forward
  by `dist mod 0.067` and still cover the band — max forward extent 0.402
  stays inside the pod's 0.43 half-length), and each wheel gained 10 tread
  lugs in the tyre's own material. A smooth cylinder rotating is invisible;
  with lugs the spin reads and the buggy is a better model.
- **Loader** (`robots.ts`): `mergeByMaterial` buckets by (owner, material)
  instead of material alone. Anything under an `anim_*` node goes into a
  per-part `THREE.Group` at the empty's world position, geometry baked to
  `world - pivot` — translation only, so a part's local axes are still the
  chassis's and -Z is still "forward". No `.glb` empties → zero parts → the
  old static behaviour exactly.
- **Rig**: `object` is now a wrapper with the chassis as an inner `body`,
  because `cell()` reports `object.position.y` as height above the deck and
  Playwright asserts nothing is airborne — so the bob had to live on a child.
  New `stepAnim(dt, dx, dz)` runs after `applyTransform`.
- **Maths** in a new pure `robotAnim.ts` (the effectMath/directorMath
  pattern): `treadOffset` (positive modulo, so reversing scrolls backwards),
  `gaitPhase`/`gait` (phase advances with DISTANCE — π of phase is 2·stride
  of travel, which makes the planted tripod slide back under the body at
  exactly body speed), `wheelSpin`, `hoverPose`, `thrustGlow`,
  `motionEnvelope`.
- **`setStill`** mirrors `setPoweredDown`, wired from scene.ts's existing
  `prefersReducedMotion()`. `BoardScene` gained `stats()` (draw calls +
  triangles off `renderer.info.render`) and `probe()` gained `parts`.

### Verification

- 558 tests green (was 517). New: robotAnim.test.ts (24), robots.rig.test.ts
  (10), robotAnim.parity.test.ts (7).
- **The sleep guarantee had to become a unit test.** Every builtin board has
  conveyors (4–52), and belts keep the rAF loop alive by themselves, so
  "settled after a move" is not observable in the app. robots.rig.test.ts
  drives the rig directly: `step()` goes false inside two seconds, including
  at the clamped 0.05 dt a backgrounded tab produces. Under reduced motion
  (belts stop too) the browser confirms it: `settled()` true and staying true.
- Runtime probe: all four chassis resolved their parts by name from the live
  scene — 2 / 6 / 0 / 8 draw calls (hovercraft has none by design; its bob is
  the whole body). 16 extra across four robots, ~4 each, exactly the budget.
- 24 scrub steps (12 back, 12 forward): all settled back onto the deck,
  nothing airborne or invisible. Zero console errors.
- Screenshots: `screengrab/phase47/`.

### Decisions worth carrying

- **`common.dome` is an icosphere now** — Phase 46 predicted this and it was
  right. The robot export was non-deterministic on exactly the two chassis
  that call it (1's `cap`, 2's `screen`). That fixed chassis 2.
- **Chassis 1 needed a second, different fix.** Its two `antenna` rods are
  r=0.009 with the default 0.008 bevel — 89% of the radius — at 10 sides.
  The clamped, near-degenerate corners left split normals agreeing only to
  within float noise, so the exporter's vertex merge took them on some runs
  and not others: 269 vertices one export, 268 the next. 12 sides and bevel
  0.003 (matching chassis 0's always-stable `mast`) fixed it. All four seats
  are now byte-identical across three consecutive exports.
  **General rule: a bevel near the radius, or a very low-vertex cylinder, is
  an export-determinism hazard.**
- **Sprites were re-rendered too.** The mesh changes (12th rib, wheel lugs,
  icosphere domes, antenna) would otherwise have drifted from the .glb, and
  "the mesh in the browser is the mesh in the sprite" is a project rule.
- **Playwright gotcha**: a background tab throttles rAF and scene.ts clamps
  dt to 0.05, so scene time ran ~20× slower than wall clock — every fixed
  `sleep()` read as "the animation never finished". Poll `probe()` until the
  robot is back on the deck. The upside is that a robot holds a mid-tile pose
  for ~2s of wall clock, which is the only reason the mid-move screenshots
  were catchable.

## Phase 48 shipped: lighting + effects polish (2026-08-01)

The board now reacts to what happens on it. Before this, a flamer roasting a
robot, a crusher slamming, a teleport, a repulsor fling and a radiation tick
all looked identical — the caption was the entire difference.

- **`lightMath.ts` (new, pure + 35 tests)** — the key light's reaction as a
  one-slot nudge state machine. `NUDGES`: damage (red tint, slight dip, 0.26s),
  destroyed (20% dim, 0.5s), laser (pulse, 0.14s = exactly `BEAM_PUNCH` so the
  beam flare and the key pulse read as ONE flash), win (the pre-48 flourish,
  unchanged at 2.4 → 3.7 over 0.8s). `stepKey` in scene.ts folds it into
  `key.intensity` + `key.color`. Also owns `flameScale`.
- **`effects.ts`** — four new pooled effects, no new geometry or material
  types: `shockwave` (3 staggered rings, replaces the single ring inside
  `blast`), `teleport` (6 cyan billboards on a lifted sine arc — the only
  thing saying the two end marks belong to the same robot), `hazardPulse`
  (ring in the hazard's OWN colour: flamer orange, radiation yellow-green,
  waste green — the beat the six silhouette-only pieces never had), `slam`
  (inward ring on `crusher-crushed`, the `repair()` idiom, so a press reads as
  arriving from above rather than as another explosion). Pools 8/22 → 14/32.
- **`boardMesh.ts`** — `flameAt(x, y, scale)` drives the already-instanced
  flamer cone from `damage source:'flamer'`; portal idle swirl in `tick()`
  (ring yaws, core breathes) and `animated` now includes portals.
- **Emissive tuning under ACES**: flame 1.2 → 0.6 (was clipping through orange
  to a pale beige cone), teleporter core 0.7 → 0.45 (its modelled iris had
  vanished), waste 0.18 → 0.10 (it was the brightest thing on the deck, louder
  than radiation for the same 1 damage). Phase 46 had already got the rest
  right — this was a smaller pass than expected, which is the good outcome.
- **Bloom: implemented, measured, REVERTED.** See the decision below.
- Triggers use EXISTING events only. No engine changes, as the cascade required.

## Verification

- typecheck + **593 tests** green (558 → 593; all 35 new in `lightMath.test.ts`).
  The tests that matter assert the EXACT-return-to-rest property per nudge kind
  — that IS the loop-sleep guarantee, and Phase 47 proved this class of bug is
  invisible in the browser because every builtin board has belts.
- Runtime, on a synthetic board carrying flamer/radiation/waste/crusher/
  portals/teleporter (no builtin board reaches all of those): every new trigger
  fired and photographed. `screengrab/phase48/`.
- **Effect pools hold**: 304 events over 8 turns × 5 registers at 4× replay
  speed → `stolen` 0. Headroom probe: a worst-case register (teleport +
  crusher + 3 hazard hits + destruction + checkpoint) fired 16ms apart also
  costs 0; theft only starts on a SECOND such register stacked immediately on
  top with no gap, which no replay speed can produce.
- **Reduced motion**: `settled()` reaches true after every new effect
  (24–52 frames), including on the portal board where the swirl stops too.
  Freeze poses photographed.
- `stats()`: 114 calls / 160k triangles idle on the test board, 138 at the peak
  of a destruction. The extra pool slots are `visible = false` when idle, so
  the idle figure is unchanged by this phase.

## Gotchas / decisions worth carrying

- **The Playwright rAF gotcha bit again, in a NEW way.** Phase 47's lesson was
  "don't sleep, poll". Phase 48's is worse: an effect lives 0.3–0.5s, and the
  wall-clock gap between `page.evaluate` returning and the screenshot being
  captured is longer than that — so the first three flamer screenshots showed
  nothing and looked exactly like a broken drive. The fix is to **replace
  `window.requestAnimationFrame` with a manual queue** before creating the
  scene, so scene time advances only on an explicit `H.step(n)`. Every
  screenshot in `screengrab/phase48/` was taken with the clock frozen. This is
  the technique to reuse for any future effect work.
- **A board with portals never sleeps**, exactly as a board with belts never
  sleeps. Deliberate and consistent; costs nothing in practice because every
  builtin board already has 4–52 belts. The rejected alternative was a
  conditional swirl, which would make the same portal look different depending
  on what else was on its board.
- **Bloom was rejected on a measurement, not on taste.** EffectComposer +
  UnrealBloomPass + OutputPass was wired up behind the lazy `./scene` boundary
  and mobile-gated on `(pointer: coarse)`. Criterion 2 held — the loop still
  settled (1 idle frame, 43 after a blast) because the composer renders from
  inside `frame()`. Criterion 1 failed twice over: idle frame submit went
  0.80 → 1.07 ms/frame (+33%), and — decisively — `renderer.info.render` then
  describes the OutputPass's full-screen quad, so `stats()` reported **1 call /
  1 triangle instead of 114 / 160246**. That hook is how the robot merge budget
  and the scene's cost are checked at all; a composer blinds it. The art case
  was weak too: this phase's own tuning pass spent itself pulling emissives
  DOWN because they were already clipping to white under ACES, which is the
  opposite of what bloom wants — and the bloom screenshot
  (`12-bloom-experiment-rejected.png`) shows the robots' modelled lamp and
  screen detail turning into white blobs. A `// NO POST-PROCESSING HERE` block
  in scene.ts records this so it isn't re-litigated by accident.
- **Robot `lamp`/`thrust` emissives were left alone on purpose.** They are
  modelled values baked into the `.glb`s and read at load; changing them means
  a Blender re-export of all four chassis plus their sprites. Nothing in the
  screenshots said they were wrong.
- The flamer's register label floats at y=0.52, right at the resting flame
  cone's tip, and reads as a red smear at extreme zoom. Pre-existing (Phase
  38/46), harmless at play distance, noted rather than fixed.

## Phase 49 shipped: camera niceties (2026-08-02)

The last thing on the board that was still deadpan was the camera itself: it
framed the action competently but never performed, so winning the game looked
exactly like claiming a checkpoint. Two flourishes, both small, both entirely
inside `camera.ts` — no engine change, no new events.

- **`flourishMath.ts`** (new, pure, 12 tests): `orbitYaw(t)` — radians of yaw
  offset into a 1.8 s win sweep, peaking at `ORBIT_PEAK_RAD` 0.55 (~32°) — and
  `fovWiden(travel)` — degrees to add to the resting FOV, ramping on
  `min(1, travel / WHIP_DISTANCE)` and topping out at `FOV_WIDEN_DEG` 2.2.
  `orbitYaw` reuses `lightMath.nudgeCurve` outright rather than re-deriving the
  shape, so the exact-zero-at-both-ends branch has one implementation.
- **`camera.ts`**: `winFlourish()` + `orbitT`/`flourishYaw`, an additive layer
  composed at `apply()` (and folded into `pan()`, so a drag mid-sweep still
  follows the finger); `FOV` becomes a resting value with a live `camera.fov`
  beside it; `step()` folds both into `moving`, `snapValues()` clears both.
  New `flourishDegrees()` accessor, surfaced through the probe.
- **`scene.ts`**: one call in the `game-won` arm, plus `flourishYaw` and `fov`
  on `view()`.
- 593 → **617 tests**, typecheck green. NOT COMMITTED (nor are 44–48).

## Verification

- Both curves land on their resting values EXACTLY, from a branch — the
  loop-sleep guarantee, and still only observable in a unit test because every
  builtin board has 4–52 conveyors and never settles in the browser (re-checked
  this phase: all ten builtins, minimum 4 belts).
- Browser run used the Phase 48 frozen-rAF clock. Sweep measured 0 → 31.51° at
  t=0.90 → exactly 0 at t=1.80, `yaw`/`tilt`/`zoom` bit-identical throughout;
  re-firing the win on the shot already held added **0 cuts**; FOV peaked at
  21.68° on a cross-board re-aim and decayed to exactly 20 on landing;
  `stats()` identical either side (78 calls / 195 200 triangles). Reduced
  motion: settled in 54 frames, `flourishYaw` never left 0, `fov` never left
  20. Zero console errors. `screengrab/phase49/`.

## Gotchas / decisions worth carrying

- **The sweep must never be written into `view.yaw`.** That field is the
  PLAYER's viewpoint, eased toward the persisted `viewSettings` value — an
  orbit inside it would fight its own ease and would leave the player's saved
  camera permanently rotated after a win. It is an additive offset composed at
  `apply()` time and nothing else. The consequence for verification is that
  `view().yaw` does NOT move during a flourish, which is why the probe grew a
  separate `flourishYaw`: sampling `yaw` alone reports a dead-still camera
  through the entire victory lap.
- **`fit()` must keep solving from the RESTING FOV.** It derives the pull-back
  distance FROM the field of view, so a widened `fit()` pulls the camera in by
  exactly as much as the lens opened and cancels the effect — with a settled
  pose that still looks perfectly correct, which is what makes it dangerous.
  `pan()` is the opposite: it converts a screen fraction into world units and
  genuinely wants the live projection.
- **The test for that had to be built by mutation.** The obvious check — whip
  into a shot, then compare the settled pose against a `cutTo` onto the same
  shot — passes under the bug, because by the time everything settles the fov
  is back at 20 either way. What actually catches it is a whip between two
  shots of the SAME radius, where the pull-back is identical at both ends and
  `camera.position.y` must therefore be flat across the whole flight. Verified
  by applying the mutation and watching the suite go red, then reverting.
- **A sweep, not an orbit.** 32° and asserted under a quarter turn. Past that
  the camera swings behind the board and shows the far rim and the backs of
  every tile.
- **Reduced motion has to be patched before `scene.ts` is imported**, not
  after: it caches the `MediaQueryList` in a module-level const, so the
  reduced-motion run needs its own page load with `matchMedia` stubbed first.

## Phase 50 shipped: the cascade is on prod (2.0.0+6db4049+20260802)

- **The WebGL context leak is fixed** (commit b99ef67, on its own because it
  touches teardown for all four player-facing screens). `renderer.dispose()`
  frees GL objects but leaves the *context* alive; `forceContextLoss()` is the
  only way to hand one back. It goes AFTER every other dispose in the function
  — before them and they free against a dead context — and is optional-called
  because headless/mocked contexts don't have it.
- **The A/B is the point, not the fix.** A clean run proves nothing on its own,
  because a passing run and a run that never stressed the limit look identical.
  So: 30 real React remounts (`#/rules` ↔ `#/hotseat` on a live hot-seat game)
  with the fix → 0 warnings, 30/30 boards drawing. Then the same 30 cycles with
  `WEBGL_lose_context` stubbed to null — which makes three's `forceContextLoss()`
  a silent no-op, i.e. exactly the old code — → 15 "Too many active WebGL
  contexts", first at cycle ~16. That second run is what makes the first one
  mean something.
- **`git add -p` is unusable non-interactively, so the split was done with
  index-level patches.** Four hand-cut patches applied with
  `git apply --cached --recount` (`--recount` matters: it infers hunk line
  counts, so hand-written patches don't have to get the arithmetic right).
  Only `scene.ts` genuinely spanned phases — and it spanned all four, not the
  two the plan predicted, because `rig.animParts()`/`setStill()` are 47's.
  Everything else was single-phase and staged whole.
- **The split was proved lossless before any commit was made**: apply all four
  to the index, then `git diff` index-vs-worktree on `scene.ts` — empty. That
  check is cheap and it is the difference between "the phases look separated"
  and "no line was dropped in separating them".
- **Each intermediate commit was actually typechecked**, not assumed: a
  throwaway `git worktree` with `node_modules` junctioned in (`mklink /J`, no
  admin needed), checked out at each of the four SHAs. All PASS, tip 617/617.
  The plan's stated risk was an intermediate that doesn't compile; this is the
  only way to know it didn't happen.
- **RulesScreen: inspected, changed nothing.** The legend is SVG sprites from
  `board/sprites` — it never touches `public/robots/*.png`, so 47's re-export
  couldn't have broken it. Worth writing down so the next person doesn't
  re-check it.
- **Prod smoke found nothing wrong.** Reactor Core, full turn to replay: anim
  parts resolved out of the `.glb` *on prod* (`anim_tread_l/r`,
  `anim_tripod_a/b` — the probe answers "did the art land" by name, which is
  exactly what 47 built it for), `stolen: 0` all replay, `fov` 20 → 20.97 on a
  whip re-aim, zero console messages at any level, toggle both ways,
  `?render=dom` beating a stored `"renderer":"3d"`.
- **The stale-service-worker scare was diagnosed, not waved away.** The footer
  read 4993feb after deploying. Checked properly: the edge `sw.js` was
  byte-identical to the new `dist/sw.js` and already listed the new asset hash,
  and `wrangler pages deployment list` showed the new deploy as Production on
  master. So it was purely this browser profile refusing to revalidate the SW
  script — one refresh, same as Phase 43.
- Telemetry digest confirms the stamp: `versionsSeen: ["2.0.0+6db4049+20260802"]`,
  `errors: []`, `rendererFallbacks: 0`.

⚠️ NEXT: **cascade complete — playtest.** Phases 42–50 all done and on prod.
No phase is queued and nothing is carried forward. Run the README's
test-everything checklist against https://drone-derby.pages.dev, file 🐞 notes
while playing, read them back with `npx convex run telemetry:digest --prod`,
and let what real players hit pick the next cascade. Still outstanding from
before this cascade: Todd's photos of the 84 program cards.
