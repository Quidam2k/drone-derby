# Cascade: Playtest-ready — telemetry, flag placement, visual polish

Started 2026-07-31. Work phase by phase with `/clear` between; update
`.claude/session-state.md` at each landing point. Phase numbering continues
the project sequence (last shipped: 40; optional 41 is folded into 46 here).

## Status

| Phase | Title | Status |
|-------|-------|--------|
| 42 | Playtest telemetry | DONE (2026-07-31) |
| 43 | Flag placement at game creation | DONE (2026-07-31) |
| 44 | Editor UX overhaul (M) | DONE (2026-07-31) |
| 45 | UI consistency pass (S) | DONE (2026-08-01) |
| 46 | Blender kit pieces, 10 expansion elements (L) | DONE (2026-08-01) |
| 47 | Robot mesh animation (M/L) | DONE (2026-08-01) |
| 48 | Lighting + effects polish (M) | DONE (2026-08-01) |
| 49 | Camera niceties (S, optional — cut first) | DONE (2026-08-02) |
| 50 | Ship + docs + deploy | DONE (2026-08-02) — cascade complete |

## Context

Rules parity is complete (everything except option cards, Todd's call) and the
four authentic boards shipped. Todd is about to playtest with friends on prod
(https://drone-derby.pages.dev). Before that:

1. **Telemetry** — full game-flow tracking, so we can see where friends got
   stuck, what crashed, and on which build. Today only client crashes and 🐞
   notes are captured; `convex/games.ts` logs nothing server-side, turn
   execution has no error capture, and events carry no version tag.
2. **Flag placement at game creation** (Todd: yes) — tabletop-faithful:
   flags move from game to game. Choose a board, then place checkpoints
   before creating the game (online + hot-seat), defaulting to the board's
   printed flags.
3. **Visual polish** — Blender kit pieces for the 10 expansion elements
   (currently primitive-only), robot mesh animation (treads/gait/wheels —
   currently static), lighting/effects/camera improvements, editor UX
   (20 ungrouped tools, no template flow, no renumber aid, no hotkeys),
   and a general UI consistency pass (speech bubbles off-theme, scattered
   button sizes).

## Standing constraints

- Engine stays pure; telemetry never imported into `src/engine/`.
- EventLog extended additively only; this cascade adds NO engine events.
- Convex schema changes additive (prod data live).
- Blender: CPU only (ask before GPU); pieces modelled in the local frame of
  the primitive they replace; primitive fallback path must keep working.
- Both renderers (DOM fallback + WebGL default) stay working.
- `npm run typecheck` + `npm test` before every commit; deploy via
  `npm run deploy`; Playwright verification with browser minimized.
- Telemetry ships FIRST (friends may start playing before polish lands).

## Phases

### Phase 42 — Playtest telemetry (ship first)

**Server game-flow events** (`convex/helpers.ts` + `convex/games.ts`):
- `logFlow(ctx, event, data?)` helper in helpers.ts — inserts into the
  existing `telemetry` table with `kind: 'flow'`, whole body try/caught
  (never throws, never blocks the mutation), truncates data ~2KB, never
  includes hands/decks.
- Call sites in games.ts: createGame (`game-created` {boardName, builtin?}),
  joinGame (`game-joined` {seat}), startGame (`game-started` {playerCount,
  boardName}), submitProgram (`program-submitted` {turn}; after execution
  `turn-executed` {turn, ms, playerCount} — execution wrapped in try/catch
  that logs `turn-error` {turn, stack} then rethrows), game finish
  (`game-finished` {turns, winner}), nudge (`nudge`).
- Schema: no change needed (telemetry table already `kind: string` +
  `data: any` + optional userId); flow rows set context to
  {gameId, source: 'server'}.

**Version stamping** (`vite.config.ts`, `src/services/telemetry.ts`):
- `define: { __APP_VERSION__ }` = `pkg.version+<git short hash>+<yyyymmdd>`
  (git via child_process at config load, fallback 'unknown').
- Telemetry context gains `appVersion`; tiny dim version string in the
  lobby footer so playtesters can read it back.
- `src/vite-env.d.ts` (or equivalent) declares the global for TS.

**Client flow events** (`src/services/telemetry.ts` + call sites):
- Extend kind union with `'flow'`; `logFlowEvent(event, data?)` wrapper.
- Events: `renderer-fallback` (in markRenderer3dFailed path /
  Board3D.tsx catch), `push-subscribe-failed` (src/services/push.ts),
  `pwa-installed` (appinstalled listener, main.tsx).

**Readable digest** (`convex/telemetry.ts` + `scripts/telemetry-digest.mjs`):
- `digest` internalQuery {hours?}: error/note rows verbatim (newest N),
  counts by kind, game funnel (created/started/turns/finished), sessions
  seen, versions seen.
- `clear` internalMutation {olderThanDays?} for manual pruning (playtest
  volume is friends-scale; no auto-prune hot path).
- `scripts/telemetry-digest.mjs`: `node scripts/telemetry-digest.mjs
  [--prod] [--hours 48]` shells to `npx convex run telemetry:digest`,
  pretty-prints. README "reading playtest logs" section updated.

Tests: telemetry.test additions (kind union, logFlowEvent buffering);
digest shape unit-testable only via convex run — verify manually on dev
deployment + document. Playwright: create/join/start/submit a game on the
dev deployment → digest shows the funnel; forced scene failure logs
renderer-fallback.

### Phase 43 — Flag placement at game creation

**Engine helper** (`src/engine/placement.ts`, new; export via index):
- `applyFlagPlacements(board, placements: {x,y}[]) → BoardDef`: pure;
  strips all existing checkpoint tiles → floor, paints checkpoints
  numbered 1..n in array order. Throws nothing itself — caller runs
  `validateBoard` (catches OOB/pit/spawn/count problems; verify validate
  covers checkpoint-on-belt etc., add rules there if not).
- `checkpointPositions(board) → {x,y}[]` sorted by number (used to seed
  the UI with printed flags).
- Tests `src/engine/__tests__/placement.test.ts`: strip+paint, ordering,
  numbering from array order, result passes validateBoard on real boards
  (loop BUILTIN_BOARDS), invalid targets caught by validateBoard,
  no input mutation, 1–6 flags.

**Shared UI** (`src/components/board/FlagPlacer.tsx`, new):
- DOM Board/BoardThumb + transparent hit layer (EditorBoard's
  data-x/data-y pattern); click floor cell → next flag number; click a
  placed flag → remove (renumber closes gaps); reset-to-printed button;
  live validateBoard feedback; numbered badges reuse checkpoint sprite.
- Default remains the board's printed flags — placement UI is an optional
  "Customize flags" expander so the happy path stays one click.
- Integrated in LobbyScreen (online create) and hot-seat SetupScreen.

**Wiring**:
- convex/games.ts createGame: optional
  `flagPlacements: v.array(v.object({x: v.number(), y: v.number()}))` —
  server re-applies via the engine helper + validateBoard on the SERVER
  board (never trusts client board), then snapshots. Works for builtin
  AND saved boards; also snapshot when flags customized even on the
  default Proving Grounds path.
- Hot-seat: gameStore.startGame gains optional placements (or SetupScreen
  applies the helper before calling startGame — pick the smaller diff).
- RulesScreen/README note: flags can be repositioned per game.

Tests: engine tests above; Playwright — online create with 3 custom flags
→ game lobby thumb + turn 1 board show them; hot-seat same; default path
byte-identical to today.

### Phase 44 — Editor UX overhaul (M)

Files: `ToolPalette.tsx`, `EditorToolbar.tsx`, `ValidationPanel.tsx`,
`EditorScreen.tsx`, `src/store/editorStore.ts`, `index.css`.
- **Tool grouping**: TOOLS reorganized into sections with muted headers —
  Terrain (floor/pit/drain/trapdoor), Hazards (radiation/waste/crusher/
  flamer), Movers (conveyor/gear/portal/teleporter/repulsor), Course
  (checkpoint/spawn/wrench), Edges (wall/laser/pusher), Eraser. Desktop
  column keeps headers; mobile row elides them (scroll-snap preserved).
- **Per-tool hotkeys**: single-key scheme shown in button title + a small
  key hint on each button; keydown listener in EditorScreen (ignores
  events from inputs). Store-level `setTool` untouched.
- **Start from a built-in**: "New from template…" in the toolbar → modal
  listing BUILTIN_BOARDS thumbs (reuse AppendBoardModal's card pattern) →
  `loadDraft(factory())` (one undo step, name "Copy of X" via forkName).
- **Renumber flags**: `renumberCheckpoints()` store action (reading-order
  sweep reassigns 1..n; one undo step; idempotent) + button in
  ValidationPanel when checkpoint numbering errors/warnings exist.
- Tests: editorStore tests for renumber + template load; hotkey dispatch
  test. Playwright: 375px + desktop editor passes (grouping, hotkeys,
  template, renumber), hit-layer alignment regression.

### Phase 45 — UI consistency pass (S)

`index.css` (+ tiny component touches only where classes need renaming):
- Speech bubbles → dark theme (`--panel-2` bg, `--text`, themed arrow).
- Button scale tokens (`--btn-py/--btn-px`, `--radius/--radius-sm`)
  applied consistently; 44px touch min on mobile stays.
- Global focus ring (`:focus-visible` accent outline), themed scrollbars,
  disabled-state contrast, link hover.
- Hero gradient title stays lobby-only.
- Verify: Playwright screenshot sweep of every screen at 1280 + 375
  (before/after in screengrab/), taunt bubble in replay both renderers.

### Phase 46 — Blender kit pieces for the 10 expansion elements (L)
(supersedes optional Phase 41)

`scripts/blender/tiles.py` (+`common.py` if a coil/torus primitive is
needed) → `npm run art:tiles` → `public/models/tiles.glb`; then
`boardMesh.ts`/`tileKit.ts` piece-name wiring.
- New pieces, each modelled in the LOCAL FRAME of the primitive it
  replaces (read boardMesh.ts:300-500 frames before modelling):
  portal_ring (white/emissive — per-instance tint stays code-driven),
  teleporter_pad (+ emissive core), repulsor_coil (+ floating core),
  trapdoor_hatch, crusher_post + crusher_head, flamer_nozzle,
  oneway_slab (neutral; red/green tint stays code-driven), radiation_disc,
  waste_puddle, drain_grate.
- Contract checks: fallback still renders with tiles.glb deleted;
  deterministic export (re-export → identical bytes); CPU only.
- Verify: element-zoo board screenshots 3D kit vs fallback side-by-side;
  authentic boards eyeball (reactor core radiation/waste fields,
  shake-n-bake one-ways).

### Phase 47 — Robot mesh animation (M/L)

`scripts/blender/robots.py` + `src/components/board3d/robots.ts`
(+ scene.ts step wiring).
- Named animated sub-parts EXCLUDED from the by-material merge (loader
  keeps a name-tagged map; ~3-4 extra draw calls per robot): treads
  (UV-scroll or roller rotation from travel speed), hexapod legs
  (phase-offset sinusoid gait while moving), buggy wheels (spin from
  signed travel), hovercraft bob + thruster emissive pulse.
- Velocity from the rig's existing ease (smoothed); anims stop when
  settled so the on-demand render loop still sleeps; reduced-motion
  skips all of it; missing named parts → static fallback, no crash.
- Verify: replay scrub fwd/back clean; draw-call probe before/after;
  screenshots of each chassis mid-move.

### Phase 48 — Lighting + effects polish (M)

`scene.ts`, `effects.ts`, `boardMesh.ts`. Triggers use EXISTING events
only (no engine changes): `damage` (+source flamer/radiation/waste/
crusher), `crusher-crushed`, `robot-teleported`, `repulsed`,
`laser-fired`, `robot-destroyed`, `game-won`.
- Per-event key-light nudges: brief red tint on damage, 20% dim on
  destruction, pulse synced to the beam punch; all easing back, all
  inside the existing keyLift-style pattern.
- Effects: layered (2-3 staggered) shockwave rings on destruction;
  teleport particle trail (few pooled billboards along an arc, cyan);
  flamer flame animates on `damage source:'flamer'` (noise-scaled cone);
  radiation/waste damage pulse ring; crusher slam anticipation ring on
  `crusher-crushed`; portal idle swirl (only while loop is already alive
  — belts pattern; must not keep a settled scene awake on portal-less
  boards).
- Emissive tuning pass across kit + primitives under ACES (screenshot
  iteration).
- Bloom experiment (UnrealBloomPass, emissives): time-boxed; keep only
  if desktop frame time impact is trivial AND the on-demand loop stays
  honest; otherwise document-and-skip. Default OFF on mobile regardless.
- Verify: reduced-motion freeze poses; effect pool sizes hold on a long
  replay; before/after screenshots of laser/death/teleport/flamer beats.

### Phase 49 — Camera niceties (S, optional — cut first if time presses)

`camera.ts` (+directorMath.ts): win-orbit flourish on `game-won`; subtle
FOV widen on whip cuts. Skip idle drift (fights the on-demand loop).
Reduced-motion skips both.

### Phase 50 — Ship + docs

README playtest guide (version string, digest command, flag placement,
editor templates/hotkeys), RulesScreen touch-ups if legend changed,
commit sequence, `npm run deploy`, prod smoke (Playwright minimized),
session notes + memory updates.

## Phase order & rationale

42 telemetry → 43 flags (both needed before friends play) → 44 editor →
45 UI (cheap, playtest-facing) → 46 kit pieces → 47 robot anim → 48
lighting/effects → 49 camera (optional) → 50 ship. Visual phases 46-48
each end deployable, so Todd can start playtesting any time after 43 and
polish keeps landing behind him.

## Verification (every phase)

`npm run typecheck` + `npm test` green before commit; Playwright checks
with the browser minimized; screenshots into `screengrab/`; deploy only
at phase 42/43 boundary and at 50 (or on request). Cold-cache landing
notes per the session-state convention.

## Cross-phase decisions

- **Phase 49, THE WIN SWEEP IS ADDITIVE AND MUST STAY THAT WAY.** The orbit
  lives in `CameraDirector.orbitT`/`flourishYaw` and is composed onto the pose
  at `apply()` time; it never touches `view.yaw` or `wantedView.yaw`. Those are
  the PLAYER's viewpoint, eased toward the persisted `viewSettings` value — an
  orbit written into them would fight its own ease and would leave the player's
  saved camera permanently rotated after a win. The probe reports it as a
  separate `flourishYaw`, because a probe reading `view().yaw` alone would show
  a dead-still camera through the whole victory lap.
- **Phase 49, `fit()` KEEPS USING THE RESTING FOV; only `pan()` reads the live
  one.** `fit()` solves the pull-back FROM the field of view, so a widened
  `fit()` pulls the camera in by exactly as much as the lens opened and cancels
  the effect — silently, with a settled pose that still looks correct. This was
  called out as the risky half of the phase and it is now pinned by a test that
  fails on that exact mutation (verified by making it): a whip between two shots
  of the SAME radius must hold `camera.position.y` flat across the entire
  flight. `pan()` is the opposite case — it converts a screen fraction into
  world units, which is a genuine question about the projection on screen now.
- **Phase 49, a SWEEP, not an orbit.** `ORBIT_PEAK_RAD` is 0.55 rad (~32°) and
  the test asserts it stays under a quarter turn. A full revolution swings the
  camera behind the board and shows the far rim and the backs of every tile —
  that is a bug report, not a victory lap.
- **Phase 48, BLOOM WAS MEASURED AND REJECTED — do not re-litigate by
  accident.** EffectComposer + RenderPass + UnrealBloomPass + OutputPass was
  actually wired up behind the lazy `./scene` boundary (its own dynamic import,
  so a phone would not have downloaded it) and gated off on `(pointer: coarse)`.
  Of the plan's three keep-criteria: (2) HELD — the loop still settled, 1 idle
  frame and 43 after a blast, because the composer renders from inside
  `frame()` rather than a loop of its own; (3) was implemented; (1) FAILED
  TWICE. Idle frame submit went 0.80 → 1.07 ms/frame (+33%), and decisively
  `renderer.info.render` then describes the OutputPass's full-screen quad, so
  `stats()` reported **1 call / 1 triangle instead of 114 / 160246**. That hook
  is the only way the robot merge budget (Phase 47) and this scene's cost are
  checkable from outside, and a composer blinds it. The art case was weak
  independently: Phase 48's own tuning pass spent itself pulling emissives DOWN
  because they were already clipping to white under ACES, which is the opposite
  of what bloom wants — `12-bloom-experiment-rejected.png` shows the robots'
  modelled lamp and screen detail turning into white blobs. A
  `// NO POST-PROCESSING HERE` block in scene.ts carries this forward.
- **Phase 48, a board with PORTALS never sleeps** — exactly as a board with
  belts never sleeps. `BoardMeshes.animated` is now `chevrons.length > 0 ||
  portals.length > 0`, so the portal swirl rides the same `tick(elapsed)` the
  belts do and reduced motion stops both. This costs nothing in practice
  (every builtin board already carries 4–52 belts, so none of them slept
  anyway) and only matters for a hand-built portal-only board from the editor.
  The rejected alternative was a CONDITIONAL swirl — "animate only while
  something else already is" — which would make the same portal look different
  depending on what else happened to be on its board.
- **Phase 48, `damage` carries no position, so the hazard beat is inferred.**
  The event names only the player, so `dispatch` takes the robot's own cell
  from the VisualState and fires `hazardPulse` there; the flame is confirmed
  rather than assumed, because `meshes.flameAt()` returns false when there is
  no flamer on that cell. That guard is what keeps a flamer-sourced damage
  event from flaring the wrong tile if the robot has already moved on.
- **Phase 48, the flame's rest emissive is load-bearing, not decoration.**
  It was 1.2 and clipped through orange to pale beige; at that value a BURST
  cannot read as hotter than the idle jet, because the idle jet is already
  white. 0.6 is what makes the scaled cone read as fire.
- **Phase 48, the Playwright rAF gotcha has a second, nastier form.** Phase 47
  learned "poll, don't sleep". 48 learned that an effect (0.3–0.5 s) expires
  inside the wall-clock gap between `page.evaluate` returning and the
  screenshot being taken — three flamer screenshots came back empty and looked
  exactly like a broken drive. The fix is to **replace
  `window.requestAnimationFrame` with a manual queue before creating the
  scene**, so scene time advances only on an explicit `step(n)`. Every Phase 48
  screenshot was taken with the clock frozen; reuse this for any effect work.
- **Phase 48, observed but NOT fixed (pre-existing):** 25 Board3D mounts over a
  5-turn hot-seat game trip Chrome's "Too many active WebGL contexts" warning.
  `scene.dispose()` calls `renderer.dispose()` but never
  `forceContextLoss()`, so contexts accumulate until the oldest is dropped.
  Unrelated to this phase, and renderer lifecycle is not something to start
  changing on all four player-facing screens right before ship — for 49/50.
- **Phase 47, the animation clock is DISTANCE, not time.** Treads, gait and
  wheels are pure functions of how far the chassis has actually travelled, so
  they stop dead when the ease settles and the on-demand render loop can still
  sleep. Only the hovercraft's bob uses a real clock, and its amplitude is
  scaled by a smoothed speed that is SNAPPED to zero at 0.01 tiles/s —
  without that snap an exponential decay never reaches zero and every rig
  would report `moving` forever. See `robotAnim.ts`.
- **Phase 47, `RobotRig.object` is now a wrapper around an inner `body`.**
  `probe()`/`cell()` report `object.position.y` as height above the deck and
  Playwright asserts no robot is left airborne, so the hovercraft's bob had to
  live on a child. Everything else (death trajectory, respawn drop, opacity,
  visibility, dispose) still owns `object` and is unchanged.
- **Phase 47, the parts are held out of the merge in the PART's frame, but
  with the CHASSIS's axes.** Geometry is baked to `world - pivot` (translation
  only, not the full inverse of the empty's matrix), so -Z is still "where the
  robot is pointing" inside a part and a wheel spins about local X. The
  exported empties turned out to carry identity rotation anyway, so the two
  are equivalent today — the translation-only form just cannot be broken by a
  future exporter that decides to put the Y-up conversion on the node.
- **Phase 47, `common.dome` IS the icosphere now** (Phase 46 predicted it):
  the robot export was non-deterministic on exactly the two chassis that call
  it, 1's `cap` and 2's `screen`. That fixed chassis 2. Chassis 1 needed a
  SECOND fix — its two `antenna` rods, r=0.009 with the default 0.008 bevel
  (89% of the radius) at 10 sides. The near-degenerate corners left split
  normals agreeing only to within float noise, so the glTF exporter's vertex
  merge took them on some runs and not others (269 vertices one export, 268
  the next). 12 sides and bevel 0.003 — matching chassis 0's always-stable
  `mast` — and all four are byte-identical across three exports. General rule:
  a bevel near the radius, or a low-vertex cylinder, is an export-determinism
  hazard.
- **Phase 42, turn-error logging**: the plan said "log `turn-error` then
  rethrow", but a thrown Convex mutation rolls back ALL its writes —
  including the telemetry row. So the catch logs and COMMITS (returns
  `{stale:false}`): the submission stays, the turn stays unexecuted, the
  stack survives for the digest. A bricked turn shows as "executing…" in
  the lobby and a `turn ERRORS` count in the digest.
- **Phase 42, digest/clear are bounded** at 4000 rows per call (friends-
  scale is far below; digest reports `truncated`, clear reports
  `mayHaveMore`).
- Server flow rows: `context = {source:'server', gameId}`, `message` =
  event name, kind `'flow'` — shares the existing telemetry table, no
  schema change.
- Client flow events ride `logTelemetry` (5s dedupe applies); every client
  row now carries `context.appVersion` = `pkg.version+git+yyyymmdd` from
  vite `define` (`__APP_VERSION__`, declared in src/vite-env.d.ts, guarded
  via `APP_VERSION` export in services/telemetry.ts).

- **Phase 43, helper is strict instead of validateBoard**: the plan said
  "add rules to validateBoard if not covered", but the validator only sees
  the RESULT — a checkpoint painted over a belt is still a "valid" board,
  just a mutated one. So `applyFlagPlacements` itself throws on any target
  that isn't plain floor (after stripping printed flags), out of bounds,
  fractional, or duplicated; callers still run validateBoard for what it
  CAN see (flag count ≥1 etc.). Hot-seat applies the helper in SetupScreen
  (gameStore untouched); online, createGame re-applies placements to the
  SERVER-resolved board and snapshots — including the default
  Proving Grounds path, which stores a snapshot only when customized.

- **Phase 44, hotkey/section data lives in `editorHotkeys.ts`** (new, no
  JSX) so the keydown→command mapping is unit-testable in node;
  ToolPalette pairs it with a `Record<ToolId, ReactNode>` icon map (a
  missing icon is a type error) and renders sections as FLAT flex
  children (labels interleaved, hidden on mobile) so the horizontal
  scroll-snap row needs no restructure. Key map (20 unique): floor F,
  pit P, drain D, trapdoor T, radiation R, waste A, crusher U, flamer M,
  conveyor C, gear G, portal O, teleporter X, repulsor Q, checkpoint K,
  spawn S, wrench N, wall W, laser L, pusher H, eraser E. Form fields
  swallow everything (incl. the undo chords — unchanged behavior);
  Shift/Alt/Ctrl-modified letters stay with the browser.
- **Phase 46, a UV sphere broke the deterministic export**: the plan's
  "re-export → identical bytes" check FAILED on the first pass, and the
  cause was one piece. Diffing two exports showed the JSON chunk identical
  and exactly 2.5 KB of the binary differing — all of it the index buffer of
  `repulsor_core`, built with `common.dome`'s UV sphere. A UV sphere exports
  as quads, the glTF exporter triangulates them on the way out, and that
  triangulation is not stable run to run. Rebuilt as an icosphere (triangles
  already, no triangulation step, and no poles to pinch on a bead that
  small) and the export is byte-stable again. `common.dome` is untouched —
  robots.py still uses it, and robot determinism is untested; if Phase 47
  hits the same thing, this is the fix.
- **Phase 46, radiation had to give up its emissive material**: it was
  planned as geometry-only with boardMesh's emissive yellow-green kept, like
  waste and the portals. On screen the modelled trefoil was INVISIBLE —
  uniform emission flattens exactly the shading that makes relief legible,
  so a carefully modelled symbol rendered as a flat yellow blob. It now
  takes the kit material and paints hazard yellow on HAZARD_K, which is the
  DOM board's read. General rule for the six pieces still on code materials:
  they must read through SILHOUETTE, never through relief.
- **Phase 46, the kit's drain is one piece, not five**: the primitive path
  places five chord-scaled bars to fit a round torus rim; the kit's pit_rim
  is a square curb, so the grate is square and boardMesh places exactly one
  (`kit?.drain_grate` branch, same shape as the existing spawn/gear
  branches).
- **Phase 45, the gradient is a wordmark, not a heading style**: `.title`
  carried the player-color gradient, so all EIGHT screens using it
  ("Board gallery", "How to play", "Game lobby", "Join the derby",
  "Turn history"…) wore the brand treatment. `.title` is now plain
  `--text` and the gradient moved to `.title.brand`, applied only to the
  three "Drone Derby" wordmark sites (LobbyScreen, SetupScreen,
  online/common.tsx). Any NEW screen gets the plain title by default —
  that's the intended direction; add `brand` only for the wordmark.
- **Phase 44, renumber button trigger**: ValidationPanel matches the
  substring `'checkpoint number'` in error strings (covers both
  `duplicate checkpoint number N` and `missing checkpoint number N` from
  validate.ts numberingErrors) — no validator changes.

## Phase 50 verification log (2026-08-02) — CASCADE COMPLETE

- **The context leak is fixed and it is the only code change in the phase.**
  `scene.dispose()` now calls `renderer.forceContextLoss?.()` after every
  geometry/material/texture dispose above it (before them, they would free
  against a dead context) and optional-called because the method is absent on
  some headless/mocked contexts.
- **Verified in Chrome by A/B, not by reading.** 30 Board3D mount/unmount
  cycles driven through real React remounts (`#/rules` ↔ `#/hotseat` on a live
  hot-seat game), with the fix: **0 warnings, 0 blank boards, 30/30 mounts
  drawing**. Then the same 30 cycles with `WEBGL_lose_context` neutered so
  `forceContextLoss()` becomes a no-op — i.e. the old behaviour — reproduced
  **15× "Too many active WebGL contexts"**, first at cycle ~16. The control is
  what makes the clean run mean anything.
- **Commit split, four commits, each typechecked in isolation.** Only
  `scene.ts` actually spanned phases (47, 48, 49 AND the leak fix); `camera.ts`
  → 49, `boardMesh.ts`/`effects.ts` → 48, `robots.ts` + the `.py`/`.glb`/`.png`
  → 47, each whole. `git add -p` was not usable non-interactively, so the split
  was done as four index-level patches (`git apply --cached --recount`) and
  **proved lossless**: after applying all four the index was byte-identical to
  the working tree. Each commit was then checked out into a throwaway worktree
  (node_modules junctioned) and typechecked: b99ef67 / a0b2ece / bd9e212 /
  7208d0c all PASS, tip 617/617.
- README brought up to date 45→49: animated robot meshes + the
  `npm run art -- --glb` rebuild and piecewise fallback in the 3D board
  section, and five new playtester checklist lines (robots move like machines,
  the board reacts to hits, hazards land, the camera performs briefly, and an
  explicit reduced-motion line).
- **RulesScreen: checked, deliberately unchanged.** The legend renders SVG
  sprites from `board/sprites`, not the robot PNGs, so 47's re-export could not
  touch it, and 46 was art for elements the rules already listed. It also
  rendered 60× during the leak A/B with zero console errors.
- Deployed: Convex prod + Cloudflare Pages (Production, branch master, source
  6db4049). Version stamp **`2.0.0+6db4049+20260802`**.
- **Prod smoke, all green.** Old SW served 4993feb until the cache was cleared
  — normal PWA behaviour, same as Phase 43, and confirmed benign: the edge
  `sw.js` was byte-identical to the new `dist/sw.js` and already referenced the
  new asset hash. On the new build: footer stamp matches; Reactor Core hot-seat
  played a full turn through to replay; robot anim parts resolved out of the
  `.glb` on prod (`anim_tread_l/r` for the tank, `anim_tripod_a/b` for the
  hexapod); `stolen: 0` across the whole replay; `fov` widened to 20.97 on a
  whip re-aim (Phase 49, live); **zero console messages of any level**;
  renderer toggle worked both ways; `?render=dom` forced flat against a stored
  `"renderer":"3d"`. Telemetry digest: `versionsSeen` contains the new stamp,
  `errors: []`, `rendererFallbacks: 0`, `turnErrors: 0`.
- Screenshots: `screengrab/phase50/` (01 lobby version, 02 programming 3D,
  03 replay 3D, 04 renderer DOM).

## Phase 49 verification log (2026-08-02)

- New pure module `flourishMath.ts` (`orbitYaw` / `fovWiden`) + `camera.test.ts`
  driving `CameraDirector` directly. Suite **593 → 617**, typecheck green.
  `fovWiden` scales on `min(1, travel / WHIP_DISTANCE)`, importing directorMath's
  own threshold so "what counts as a whip" has one definition.
- The loop-sleep guarantee, per curve: `orbitYaw` is exactly 0 at 0, at
  `ORBIT_SECONDS` and past it; `fovWiden(0)` is exactly 0. Both from a branch,
  via `nudgeCurve`, for the reason Phase 47/48 documented.
- `camera.test.ts` pins the four things a screenshot cannot show: a
  `winFlourish()` leaves `currentView()` deep-equal and `cuts()`/`hardCuts()`
  unchanged; the sweep holds `step()` true for its whole life and then reports
  false with the offset at exactly 0 and `camera.fov` exactly 20; `setStill(true)`
  and `setBoard()` cancel it; a NaN dt ends it instead of pinning the loop awake.
- **The `fit()` mutation test is real, not decorative.** Replacing
  `degToRad(FOV)` with `degToRad(this.camera.fov)` in `fit()` was actually
  applied and the suite went red on the flat-pull-back assertion (17.554 vs
  17.697), then reverted. An earlier draft of that test passed under the
  mutation and was rewritten.
- **Browser, Playwright minimised, frozen-rAF clock** (manual queue installed
  before `createBoardScene`, per the Phase 48 decision log — a 1.8 s orbit
  otherwise expires in the wall-clock gap before the screenshot). Scene built by
  module import on Proving Grounds with 4 rigs; `game-won` injected through the
  real `update({currentEvent})` path, so `dispatch`'s `game-won` arm is what
  starts the sweep. Sampled every 6 frames: `flourishYaw` 0 → **31.51° at
  t=0.90** → **exactly 0 at t=1.80**, with `yaw`/`tilt`/`zoom` bit-identical at
  every sample.
- **A flourish is not a re-aim**: re-firing `game-won` on the shot the director
  was already holding gave `cuts` +0 across the whole sweep. (The FIRST win
  event does add one cut — that is the director framing the winner, interest 1
  cutting the dwell, and it predates this phase.)
- **FOV widen in the browser**: a cross-board re-aim peaked at **21.68°** and
  decayed monotonically to **exactly 20** on landing; a settled camera does no
  `updateProjectionMatrix()` work at all.
- **`stats()` unchanged** either side of a win — 78 calls / 195 200 triangles
  before and after. Neither flourish adds geometry.
- **Reduced motion**: separate page load with `matchMedia` patched before
  `scene.ts` imports (it caches the MediaQueryList in a module const). Loop
  asleep at start, `game-won` fired, **settled again in 54 frames**;
  `flourishYaw` never left 0, `fov` never left 20, the view was bit-identical
  throughout. Zero console errors in the session.
- Screenshots: `screengrab/phase49/` — `01`/`03` are the rest pose before and
  after the lap (pixel-identical), `02` is the sweep at its extreme, `04`/`05`
  are a whip mid-flight and landed, `06` is the reduced-motion still.
- Not deployed — Phase 50 ships 44–49 together.

## Phase 48 verification log (2026-08-01)

- New pure module `lightMath.ts` (key-light nudges + `flameScale`) with **35
  tests**; suite 558 → **593**, typecheck green. The load-bearing tests are the
  per-kind `nudgeLight` assertions that a spent nudge returns `KEY_REST`
  EXACTLY — the same loop-sleep guarantee Phase 47 had to prove in a unit test
  because every builtin board has belts and never settles in the browser.
- `effects.ts`: `shockwave` / `teleport` / `hazardPulse` / `slam`; pools
  8 rings / 22 puffs → **14 / 32**; `take()` now counts thefts and `stats()`
  exposes `stolen`.
- `boardMesh.ts`: `flameAt(x,y,scale)`, portal swirl in `tick()`, `animated`
  now `chevrons || portals`.
- **All seven new triggers fired and photographed** on a synthetic board
  carrying flamer + radiation + waste + crusher + portal pair + teleporter
  (no builtin board reaches all of those). `screengrab/phase48/`.
- **Pools hold**: 304 events over 8 turns × 5 registers at 4× replay speed →
  `stolen` 0. Worst-case single register (teleport + crusher + 3 hazard hits +
  destruction + checkpoint) fired 16 ms apart → 0. Theft only begins on a
  SECOND such register stacked immediately on top with no gap, i.e. 16 heavy
  effects inside 0.13 s, which no replay speed produces (4× gives ≥75 ms/event).
- **Real product path**: 4-player hot-seat on Reactor Core (the one builtin
  with radiation AND waste), 5 turns played out at 4×, 36 `stats()` samples —
  78–136 draw calls, `stolen` 0, **zero console errors**, robots taking real
  damage so the nudges ran on real events.
- **Reduced motion**: `settled()` true after every new effect (24–52 frames),
  including on the portal board. Freeze poses photographed.
- Emissive tuning under ACES: flame 1.2 → 0.6, teleporter core 0.7 → 0.45,
  waste 0.18 → 0.10, plus `TINT_MAX` 0.55 → 0.35 on the damage nudge.
  Before/after in `10-`/`11-` and `04-`/`04b-`.
- Not deployed (next deploy at Phase 50 or on request).

## Phase 47 verification log (2026-08-01)

- Blender: `common.anim_group(name, pivot, objects)` parents parts to an
  `anim_<name>` empty (parenting, NOT `object.join` — join keeps only the
  active object's modifiers and would drop every bevel but one).
  `export_glb` now keeps EMPTY objects named `anim_*` and nothing else.
  Eight groups: `tread_l/r`, `tripod_a/b`, `wheel_0..3`. Model changes:
  11 → 12 tread ribs (the extra rear rib is what makes the scroll wrap
  seamlessly), 10 tread lugs per wheel (a smooth cylinder rotating is
  invisible), and the antenna/dome determinism fixes above.
- Export verified BY NODE NAME out of the .glb JSON chunk, not by eye: the
  empties survive with identity rotation and correct pivots, 12 children
  each. Byte-deterministic across three consecutive exports, all four seats.
  Sprites re-rendered so the mesh in the browser stays the mesh in the sprite.
- typecheck + **558 tests** green (517 → 558): 24 in `robotAnim.test.ts`
  (positive modulo, the no-slip gait identity, hover/thrust rest values
  exact at speed 0), 10 in `robots.rig.test.ts`, 7 in
  `robotAnim.parity.test.ts` (source-text guard between `ANIM_PARTS` and the
  `anim_group(...)` calls, both directions, plus a check that the scan saw
  every call — the one way the guard could fail open).
- **The loop-sleep guarantee is a unit test, not a browser observation, and
  had to be**: every builtin board has conveyors (4–52 of them), and belts
  keep the rAF loop alive on their own, so a settled board is not observable
  in the app at all. `robots.rig.test.ts` drives the rig directly and asserts
  `step()` returns false inside two seconds, including at scene.ts's clamped
  0.05 dt. It IS observable under reduced motion (belts stop too) and was
  checked there: `settled()` true 2s after the last event, and stays true.
- Runtime probe, four-player hot-seat: every chassis resolved its parts BY
  NAME from the live scene — tracked 2 draw calls, hexapod 6, hovercraft 0
  (its bob is the whole body), buggy 8. 16 extra across the board, ~4/robot,
  exactly the planned budget; 98–115 total calls depending on the shot.
  `probe()` gained `parts` and `BoardScene` gained `stats()` for this.
- 12 backward + 12 forward scrub steps: every one settled back onto the deck,
  nothing left airborne or invisible, final state clean. Reduced-motion
  freeze verified. Zero console errors.
- Screenshots in `screengrab/phase47/`: all four chassis mid-move (tread comb
  scrolled, tripods asymmetric mid-stride, wheel lugs turned, hovercraft
  visibly nose-up) plus the reduced-motion freeze pose.
- **Verification gotcha**: a Playwright tab throttles rAF, and scene.ts
  clamps dt to 0.05 — so scene time ran ~20× slower than wall clock and every
  fixed `sleep()` read as "the animation never finished". Poll `probe()`
  until it is on the deck; never sleep a fixed time. (The upside: a robot
  holds a mid-tile pose for ~2s of wall clock, which is what made the
  mid-move screenshots possible at all.)

## Phase 46 verification log (2026-08-01)

- 14 new pieces in tiles.py (the 10 elements, four of which are two pieces:
  portal ring+core, teleporter pad+core, repulsor coil+core, crusher
  post+head). `PIECE_NAMES` 15 → 29.
- typecheck + 517 tests green (4 new in tileKit.pieces.test.ts, a source-text
  parity guard between `PIECE_NAMES` and tiles.py's `PIECES` — the two lists
  had nothing linking them and both failure directions are silent).
- All 14 confirmed reaching the board by runtime probe: built a synthetic
  board carrying every element (crushers and flamers included — NO builtin
  board has a crusher, so that pair is unreachable by screenshot) and
  asserted each InstancedMesh holds the kit's geometry object by identity,
  not the primitive. 14/14 kit.
- Visual, Reactor Core + Gear Box at zoom: radiation trefoils, waste
  puddles, trapdoor hatches, portal rings, one-way slabs, repulsor drums,
  drain grate all read correctly.
- Fallback contract: with tiles.glb removed, the board renders fully from
  primitives, one `[board3d] tile kit failed to load` warning, ZERO errors.
- Deterministic: two consecutive exports are byte-identical (sha256
  cd5db6f7…). This did NOT hold on the first pass — see the decision below.
- Size: raw 0.96 → 1.61 MB, but that is the decompressed figure. Over the
  wire it is brotli 0.21 → 0.27 MB, i.e. +60 KB. Left alone deliberately.
- Screenshots: screengrab/phase46-kit-zoom-final.png (elements at zoom),
  -kit-gearbox.png, -kit-reactor-core-3d.png, -fallback-zoom.png (no kit).
- Not deployed (next deploy at Phase 50 or on request).

## Phase 45 verification log (2026-08-01)

- typecheck + 513 tests green (CSS-only + 3 className edits; no new tests —
  nothing here is unit-testable, verification is the screenshot sweep).
- Speech bubbles: cream `#fffdf5` → `--panel-2` + `--line` border, with a
  two-triangle tail (`::before` line-colored, `::after` panel-colored) so the
  border wraps the tail. Verified in the 3D renderer AND the DOM fallback.
- Tokens `--radius`/`--radius-sm`/`--btn-py`/`--btn-px` replace ~15 scattered
  8/10/12px radii and the button padding literals.
- `:focus-visible` global ring measured live at `2px solid rgb(76,201,240)`,
  offset 2px; mouse clicks leave buttons ring-free. `input:focus`'s
  `outline: none` removed so text fields ring too (accent border + ring reads
  as one halo — checked at 1280, acceptable).
- Themed scrollbars (Firefox `scrollbar-color` + webkit pseudo-elements);
  visible on the mobile board-picker row at 375.
- Disabled buttons gain `filter: saturate(0.4)` so a disabled `.primary`
  reads grey instead of faded-accent (see the Join button, lobby shots).
- Hero gradient is now lobby-only — see the decision below.
- Screenshots: screengrab/phase45-before-* (7/31) and -after-*. NOTE: the
  7/31 `-before-lobby`/`-before-gallery`/`-after-lobby`/`-after-gallery`
  shots all caught the signed-out splash (identical 22798 bytes) and are
  worthless; the real ones are `phase45-after-lobby-1280.png`,
  `-after-lobby-focus-1280.png`, `-after-lobby-375.png`,
  `-after-gallery-1280.png`, `-after-gallery-plain-title-1280.png`.
- Not deployed (next deploy at Phase 50 or on request).

## Phase 44 verification log (2026-07-31)

- typecheck + 513 tests green (9 new: 3 renumber, 1 template-load,
  5 in editorHotkeys.test.ts incl. 20-unique-keys integrity check).
- Playwright (dev server only, minimized): desktop 1280 — section headers
  + key hints render; `W` selects wall, `E` eraser, `P` pit; typing
  "pge" in the board-name input changes the name only (tool untouched);
  "New from template…" → Spin Cycle loads as "Copy of Spin Cycle" 12×10
  playable; erasing checkpoint 2 → "missing checkpoint number 2" +
  Renumber flags button → click → board playable, flags 1..2 in reading
  order. 375px — tool row scrolls with snap, headers/key hints elided.
  Hit-layer regression: pit painted at all four corners of the 12×10
  board lands exactly in the corner cells. Todd's prior "Element Zoo"
  draft restored via undo afterwards.
- Screenshots: screengrab/phase44-desktop-sections.png, -template-modal,
  -renumber-error, -corner-pits, -mobile-toolrow.
- Not deployed (next deploy at Phase 50 or on request).

## Phase 43 verification log (2026-07-31)

- typecheck + 504 tests green (9 new in placement.test.ts, incl. printed-
  flags round-trip deep-equal over all BUILTIN_BOARDS).
- E2E on the cloud dev deployment: online create with flags moved to
  (0,0)/(5,5)/(9,9) → lobby thumb, 3D turn-1 board, and 2D turn-1 board
  all show them; removal renumbers; 0 flags shows the red validator line
  and disables Create; clicks on a conveyor are no-ops. Hot-seat on
  Spin Cycle with 2 custom flags → live board correct. Untouched default
  path → printed flags byte-identical. Hand-crafted mutation calls (flag
  on a belt, flag off-board) → clean server errors, no game row.
- Deployed (`npm run deploy`), prod smoke: version 2.0.0+4993feb, expander
  live (old SW cache served 5583bd2 until refresh — normal PWA behavior).
- Screenshots: screengrab/flag-placer-lobby.png, flags-turn1-3d.png,
  flags-turn1-2d.png, prod-smoke-phase43-flags.png.

## Phase 42 verification log (2026-07-31)

- typecheck + 495 tests green (convex/ tsconfig checked separately).
- E2E on the cloud dev deployment (vivid-cat-177), two anonymous users via
  localStorage auth-token swap: create → join → start → 2× submit →
  execute. Digest funnel read exactly 1/1/1/2/1, 0 turn errors, 1 renderer
  fallback (fired via module import), 1 session, version
  `2.0.0+c3e8b77+20260801` seen. `telemetry:clear` deleted the test rows.
- Screenshot: screengrab/phase42-lobby-version-footer.png (footer stamp).

⚠️ NEXT: **cascade complete — playtest.** Phases 42–50 are all done, committed
and on prod as `2.0.0+6db4049+20260802`. Nothing is carried forward and nothing
is left deliberately unfixed: the WebGL context leak that rode along from 47
through 49 was the one open item and it shipped fixed in b99ef67.

The next move is not a phase, it is play: run the README's test-everything
checklist against prod, file 🐞 notes as they come up, and read them back with
`npx convex run telemetry:digest --prod`. Let what playtesters actually hit
choose the next cascade rather than picking one now.

Known and accepted, not bugs: a returning playtester's service worker serves
the previous build until it revalidates (one refresh; seen at 43 and again at
50), and the 3D board deliberately does not match the flat board's palette.
Still outstanding from before this cascade: Todd's photos of the 84 program
cards, which the deck spec is still unverified against.
