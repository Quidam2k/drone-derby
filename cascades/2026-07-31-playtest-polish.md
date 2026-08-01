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
| 45 | UI consistency pass (S) | pending |
| 46 | Blender kit pieces, 10 expansion elements (L) | pending |
| 47 | Robot mesh animation (M/L) | pending |
| 48 | Lighting + effects polish (M) | pending |
| 49 | Camera niceties (S, optional — cut first) | pending |
| 50 | Ship + docs | pending |

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
- **Phase 44, renumber button trigger**: ValidationPanel matches the
  substring `'checkpoint number'` in error strings (covers both
  `duplicate checkpoint number N` and `missing checkpoint number N` from
  validate.ts numberingErrors) — no validator changes.

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

⚠️ NEXT: Phase 45 — UI consistency pass (speech bubbles to dark theme,
button scale tokens, focus ring, scrollbars). index.css-centric, S-sized.
