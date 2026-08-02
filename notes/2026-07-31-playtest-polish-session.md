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
