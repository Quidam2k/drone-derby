# Cascade — Diagnosability pass (2026-08-03)

Plan of record for the post-playtest-polish cascade. Approved by Jarvis
(assignment #2499, amendment #7087). Supersedes nothing; the previous cascade
`2026-07-31-playtest-polish.md` is complete and terminal.

## Status

| Phase | Title | Status |
|-------|-------|--------|
| P1 | Diagnosability pass | DONE (2026-08-03) |
| P2 | Hot-seat resilience | DONE (2026-08-03) |
| PA | Board element animation (added by #2500/#2501) | DONE (2026-08-03) |
| P3 | Session + hot-seat beacons | DONE (2026-08-03) |
| P4 | Golden-game regression harness | PENDING |
| P5 | **HARD STOP** — hand Todd a checklist, do not proceed | — |
| P6 | Comprehensibility pass | **NOT APPROVED TO SCOPE** |

## Context

**Nobody has played a full game yet.** The telemetry is instrumentation built
in advance, for a playtest that has not started. Todd's framing: rules are in
place, graphics look good, *"I did ask it to put telemetry in there so that
once we do start testing, it knows exactly what went wrong when things do go
wrong."*

That promise was audited on 2026-08-03
(`Q:\Pantheon\project-reports\drone_derby\2026-08-03-instrument-audit-and-polish-proposal.md`).
Findings that drive this cascade, ordered **by how blind we are**, not by ease:

1. **Silent wrong-outcome rules bugs are totally blind.** Nothing throws;
   `turn-executed` logs `{turn, ms, playerCount}` whether the turn was right
   or wrong. The only channel is the 🐞 button, which captures free text and
   nothing else. **This is the whole point of the cascade.**
2. **Hot-seat throws lose their repro context and the game itself** to the
   same reload — no try/catch at `gameStore.ts:118`, no `persist` on the
   store (while `editorStore.ts:71` persists editor drafts).
3. **WebGL context loss is uninstrumented** — the b99ef67 bug's exact shape.
4. **Abandonment is invisible**; no session-start beacon, so no denominator.
5. **Server flow rows carry no `appVersion`/`sessionId`** (`helpers.ts:41`) —
   a client crash cannot be joined to the server turn that caused it.

What already works and must not regress: the **online** engine-throw path is
well built. `games.ts:450-466` deliberately commits the `turn-error` row
rather than rethrowing (a rethrow would roll back the evidence with the turn,
since Convex mutations are transactions), and the failure is exactly
reproducible — seed is `game.seed + turn`, programs stay in submissions,
state is un-advanced.

## Standing constraints

- **Engine stays pure.** Never import `src/services/telemetry.ts` (or
  anything else) into `src/engine/`. All capture happens at the call site.
- **EventLog extended additively only.** This cascade adds NO engine events.
- **Convex schema changes additive** — prod data is live.
- **No gameplay changes.** No option cards. No deck-spec work (still waiting
  on Todd's photos).
- Both renderers (DOM fallback + WebGL default) stay working.
- `npm run typecheck` + `npm test` before every commit.
- **Read-only on production. No deploys in P1–P4.**
- Commit and push at every phase boundary; report progress at each.

## Phases

### P1 — Diagnosability pass

The phase that makes every later report worth reading. Ships first for the
same reason Phase 42 shipped first.

Four items, all four required — Jarvis folded (c) and (d) in explicitly:
*"a playtester on a phone whose bug button silently does nothing, filing
against a stale build, invalidates the entire evidence chain P1 exists to
build."*

**(a) 🐞 button repro key** — the highest-leverage fix in the audit.
- New `src/services/diagnostics.ts` exporting `collectRepro()`. It may import
  the store and the renderer choice; `telemetry.ts` stays store-free.
- Payload: route/hash, renderer in use, `appVersion`, online `gameId` if any,
  hot-seat `{seed, turn, boardName, playerCount}` if any, and the tail of the
  localStorage ring buffer (last ~15 entries).
- Rationale: online, `gameId + turn` is already a complete repro because
  `turns.prevState` and `turns.events` are stored (`games.ts:475`). Hot-seat,
  `seed + turn + boardName` is complete. This turns "the push looked wrong on
  turn 4" into a deterministic replay.

**(b) `webglcontextlost` alarm** — `scene.ts`.
- Listeners for `webglcontextlost` / `webglcontextrestored` on the canvas,
  emitting `logFlowEvent('webgl-context-lost', { deliberate })`.
- **The `deliberate` flag is load-bearing, not decoration.** Since b99ef67 our
  own `forceContextLoss()` (`scene.ts:1013`) fires this on *every* unmount, so
  without the flag the signal is 100% noise. Set it immediately before the
  teardown call. An event on a canvas we did not tear down is the alarm.

**(c) `appVersion` + `sessionId` on server flow rows.**
- The server cannot know the client's build, so the client must send it.
  Additive optional arg on the mutations that already emit flow events;
  `logFlow` stamps it into the row.
- Fifth on blindness but tiny — it rides along here rather than waiting.

**(d) Service-worker "new version available" prompt.**
- Today `registerType: 'autoUpdate'` (`vite.config.ts:37`) means a returning
  player runs the previous build until one refresh. Normal PWA behaviour, but
  during a playtest it means round-one reports get filed against a stale
  build — the `appVersion` stamp will say so, but only after the bug has
  already been chased.

**(e) Replace `window.prompt` in the bug button** (`App.tsx:52`) with a small
in-app modal. `prompt` is suppressed in some embedded and iOS contexts, so a
playtester on a phone may find the button silently does nothing.

*Verify:* typecheck + tests; bug-button note in dev carries the repro payload;
context-loss event fires with `deliberate:true` on unmount and would fire
without it on an eviction; server flow row shows the client stamp.

### P2 — Hot-seat resilience

- Wrap `executeTurn` (`gameStore.ts:118`) in try/catch, logging
  `{seed: initialSeed + game.turn, turn, boardName, programs, playerCount}` —
  an exact repro key — then surface a recoverable error rather than a dead
  screen.
- Persist the hot-seat game to localStorage so a reload **resumes** instead of
  erasing. Note the asymmetry being fixed: editor drafts already persist.
- *Opinion, recorded as such:* for a game passed around a table, an accidental
  refresh or a phone locking is the likeliest way a first playtest ends badly
  — and today it would end badly with no record of why.

*Verify:* typecheck + tests; a forced throw produces a row with the repro key;
reload mid-game resumes at the same turn.

### P3 — Session + hot-seat beacons

- `app-open` once per session; `screen` on route change.
- Hot-seat lifecycle: `hotseat-game-started`, `hotseat-turn-executed`,
  `hotseat-game-finished`, `replay-watched`.
- Online abandonment visibility (a started game that never finishes is today
  indistinguishable from one in progress at any horizon).
- Extend `telemetry:digest` with a hot-seat funnel beside the online one, and
  surface app-opens separately from `sessionsSeen`.
- Rationale: without a denominator the digest cannot express a rate; and
  hot-seat — the mode Todd describes himself using — emits nothing today.

*Verify:* typecheck + tests; digest renders both funnels against dev data.

### P4 — Golden-game regression harness

- Drive a full scripted game through the engine and assert the final state and
  event log against a golden fixture, so a rules regression is caught by CI
  rather than by a playtester's raised eyebrow.
- *Grounded in:* Case 3 being undetectable at runtime by construction.
- *Opinion:* the engine's determinism guarantee — same `(state, programs,
  seed)` always deep-equals — makes a golden log an unusually stable
  assertion here.

*Verify:* the harness fails loudly when a rule is perturbed.

### P5 — HARD STOP

**Not a phase to execute.** When P1–P4 are shipped and verified: `orch_report`
to Jarvis with a short README-style checklist for Todd, and **stop**.

Do not scope, plan, or begin any polish or comprehensibility work from my own
reading of the game. Todd's hands-on impressions are the input to the next
cascade and **they do not exist yet**.

### P6 — Comprehensibility pass — NOT APPROVED TO SCOPE

Left alone until Todd's notes exist. Recorded here only so it is not
rediscovered as a new idea.

## Cross-phase decisions

- **Priority order is by blindness, not ease.** If P1(a) — the repro key —
  ever looks like it is being traded away to make another phase land,
  **escalate instead**. It is the reason this cascade exists.
- Telemetry additions are all `flow` kind or enriched `note` data; no new
  telemetry *kinds*, so `digest` keeps working unchanged until P3 extends it.
- No deploy in this cascade. Todd deploys before playtesting, or the P5
  checklist tells him to.

## P1 verification log (2026-08-03)

- `npm run typecheck` clean; `npm test` 622 passed / 54 files (5 new in
  `src/services/diagnostics.test.ts`, up from 617).
- `npm run build` succeeds and emits `virtual_pwa-register` +
  `workbox-window.prod` chunks and `dist/sw.js` — the registration change
  actually resolves, which is the one thing a typecheck could not tell us.
- Shipped: (a) `services/diagnostics.ts` `collectRepro()` attached to 🐞
  notes, (b) `webglcontextlost`/`restored` listeners in `scene.ts` with the
  `deliberate` flag set before `forceContextLoss()`, (c) `clientStamp()` on
  all six online mutation call sites → `logFlow` stamps appVersion/sessionId
  into the row context, (d) `registerType: 'prompt'` + `swUpdate.ts` +
  `UpdateBanner`, (e) 🐞 `window.prompt` → in-app modal reusing the existing
  `.modal-backdrop`/`.modal` convention from phase 24.
- Tests assert the hot-seat seed matches `initialSeed + game.turn` exactly —
  a mismatch would replay a different turn than the one being reported, which
  is the failure mode that would quietly make the whole instrument useless.
- NOT verified in a real browser: the eviction path of the context-loss alarm
  (the `deliberate:false` branch). Reproducing it needs the leak back. The
  teardown path is exercised on every unmount.

## P2 verification log (2026-08-03)

- `npm run typecheck` clean; `npm test` 629 passed / 55 files (7 new in
  `src/store/gameStore.test.ts`, up from 622).
- Shipped: try/catch around `executeTurn` capturing
  `{seed, turn, boardName, playerCount, programs, powerDown, respawnFacing,
  stack}` — the same `initialSeed + game.turn` expression `collectRepro()`
  uses, so a note and an auto-captured error name the same turn. A new
  `turnError` field surfaces it in `HotSeatGame` instead of a frozen screen,
  and the game is left standing so its state is still inspectable.
- Persistence: `dd-hotseat` in localStorage, versioned, saved at every screen
  transition, cleared on `newGame()`. A save taken mid-`replay` resumes at the
  next handoff (or game-over) because `lastTurn` is deliberately not persisted
  — the turn was already applied to `game`, so the only loss is re-watching
  it, which is what `finishReplay` would have done next anyway.
- **A test-quality catch worth recording:** the first version of the reload
  tests put `vi.resetModules()` only in `beforeEach`, so the second
  `import()` inside a test returned the cached module — the "reloaded" store
  was the same object, and three persistence assertions passed without any
  persistence existing. Only the version-mismatch test failed, which is what
  exposed it. `resetModules()` now lives inside the `freshStore()` helper.

⚠️ NEXT: PA — board element animation. **Survey first** (what already animates
vs. what snaps) and report the gap before building. Presentation only: if
legibility needs a rules or timing change, STOP and report — pacing is Todd's
call. Then P3, P4, P5 hard stop.

### PA — Board element animation (added by #2500, re-prioritised by #2501)

Approved, lower priority than the diagnosability phases: *"useful polish."*
Note #2501 explicitly withdrew the argument that this is part of the Case 3
instrument — the robot's own movement already renders a wrong outcome, so
animating a pusher adds legibility, not a detection channel. Do not re-derive
that justification.

- Scope: board elements visibly performing their own action — pushers
  extending/retracting, gears rotating, conveyors carrying, lasers firing,
  movement reading as motion rather than teleport. Plus general look-nicer.
- **The `webglcontextlost` alarm (P1) is already in.** That was the binding
  constraint on starting this work: per-element animation is exactly the kind
  of change that could reintroduce the b99ef67 context leak, and now the
  instrument catches it instead of Todd's eye. Watch for
  `deliberate:false` rows.
- No gameplay, rules or timing changes. If animating serially makes a turn
  drag, report the trade-off rather than silently speeding things up or
  dropping steps.

#### PA survey (2026-08-03) — what already animates vs. what snaps

Read `scene.ts` (the event switch, ~line 500-620), `boardMesh.ts` (`tick`),
`effects.ts`, `directorMath.ts`. **Much more already animates than the brief
assumes — the gap is narrower and more specific than "board elements don't
animate."**

**Already animated, do not rebuild:**
- *Robots* — eased movement between cells, rotation, `rig.fall(cause, dir)`,
  `rig.recoil()`, `rig.snap()` for teleports, plus the Phase 47 mesh animation
  (treads, hexapod gait, wheels). Movement already reads as motion, not
  teleport.
- *Conveyor chevrons* scroll continuously and *portal rings* spin and pulse —
  `boardMesh.tick(elapsed)`, gated by an `animated` flag.
- *Lasers* — beam drawn along the path, plus a camera nudge, suppressed when
  the path is zero-length so a pulse never reads as a dropped frame.
- *Impacts* — bump rings, `slam`, `impact`, hazard pulses, flame, repair,
  teleport arcs, landing marks, explosions.

**The actual gap — board elements that resolve a rule without their own
geometry moving:**
1. **Pusher.** `pusher-fired` draws `effects.bump()` — a ring kicked in the
   shove direction. **The pusher never extends or retracts.** Todd's headline
   example, and the clearest defect.
2. **Gear.** `gear-rotated` has **no case in the scene event switch at all**.
   The robot turns; the gear tile itself never rotates. Todd's second example.
3. **Conveyor carrying.** `conveyor-moved` likewise has **no case**. The robot
   slides, but the belt does not respond to the pulse — its chevrons scroll at
   a constant ambient rate whether or not it just moved someone.
4. **Crusher.** Gets `slam` + `impact` + `bump`, but no press descending.

**Mechanism already exists — this is the reason the work is tractable.**
`boardMesh` keeps portal cells in batch order with their instance indices so
`tick(elapsed)` can re-pose each ring and core every frame (`boardMesh.ts:318`,
`tickPortals`). Pushers, gears and crushers need the same treatment: collect
their cells with instance handles, then drive them from `tick`. The one new
thing needed is an **event-driven** trigger (a short-lived per-cell animation
kicked by the event) rather than the purely ambient time-driven poses that
exist today.

**Risk to watch:** `animated` currently gates the render-on-demand loop. Adding
event-driven element animation must not flip boards into always-on rendering —
that is a battery and heat regression on the phones a playtester holds, and it
is the same class of quiet defect as the b99ef67 leak. The `webglcontextlost`
alarm from P1 is in, so a context regression would now be caught, but an
always-rendering board would not be. Worth its own check.

#### PA verification log (2026-08-03)

- `npm run typecheck` clean; `npm test` **651 passed / 57 files** (22 new, up
  from 629/55); `npm run build` succeeds.
- **The precedent used, and it is the flamer.** `startFlame`/`stepFlame`
  (`scene.ts`) was already an event-driven per-cell animation that does not
  keep the board awake, and its own comment already named the failure mode
  ("a held pose that is never released is a flamer left permanently twice its
  size"). PA is the fourth, fifth and sixth instance of that pattern, not a new
  mechanism. Nothing about the render loop itself changed.
- Shipped: new pure `board3d/elementAnim.ts` (timing + pose curves, no three,
  no DOM); cell→instance handles in `boardMesh.ts` for pusher plates, gear
  discs + teeth, crusher heads, and belt chevrons, exposed as `pusherAt` /
  `gearAt` / `crusherAt` / `beltSurgeAt`; `stepElements(dt)` in `scene.ts`
  joining the `moving` chain exactly as `stepFlame` does; new `gear-rotated`
  and `conveyor-moved` cases, plus geometry motion added to the existing
  `pusher-fired` and `crusher-crushed` cases.
- **`animated` is untouched.** Elements never join the ambient flag.
- **Transient vs cumulative — the design decision worth keeping.** A pusher and
  a crusher RETURN (rest is 0). A gear and a belt have MOVED, so their pose is
  cumulative and settles at a NEW constant. Snapping either back to a canonical
  zero on the last frame would be a visible jump backwards, and for the gear it
  would additionally bet on the kit's model happening to be 45°-symmetric.
  "At rest" here therefore means THE VALUE STOPS CHANGING, not that it returns
  to zero; both flavours satisfy the release invariant identically.
- Gear direction: clockwise is a NEGATIVE angle, because `DIR_YAW` has N=0 and
  E=-π/2. Getting it backwards would spin every gear against the arrows painted
  on its own tile. Asserted.
- The gear's painted arrows are deliberately NOT rotated — they are a signpost
  saying which way this gear turns, and a rotating signpost stops being
  readable. Only the disc and its teeth turn.
- Timing: 0.40–0.46s, inside the existing 0.26–0.72s vocabulary
  (`RECOIL_SECONDS` 0.26, `FLAME_SECONDS` 0.45). **No register or turn pacing
  changed**, and none needed changing for the elements to read.
- Reduced motion holds every element at rest, exactly as it stops belts.

**The two render-on-demand guards, and proof they bite.** Both were perturbed
and observed to fail before being kept — the P2 lesson (a green suite that
proves nothing) applied literally rather than trusted:
- `elementAnim.test.ts` — drives the queue past the longest animation and
  asserts `live === false`, that a settled animator writes *nothing*, and that
  the releasing frame still writes the rest pose. Deleting the `active.delete`
  release ⇒ **3 tests fail**.
- `boardMesh.animated.test.ts` — a board with pushers + gears + crushers and no
  belts and no portals asserts `animated === false`, with belt and portal
  boards as the control so the assertion cannot pass on a hard-wired `false`.
  ORing `gearIndex.size > 0` into `animated` ⇒ **1 test fails**.

**A real defect the tests caught during the build, worth recording.** The first
version snapped a pusher back to zero when it was re-fired mid-throw — reachable
whenever the same pusher fires on consecutive registers and the replay is
running faster than the 0.4s throw. Fixed by seeking into the outward leg
(analytically invertible, since it is `easeOut`) rather than restarting the
curve. The test was written before the bug was known and found it immediately.

*Not verified in a browser:* how the four read in motion. The assertions cover
the release, the flag, the direction and the rest pose — they cannot cover
legibility. That is on Todd's P5 checklist.

#### P3 verification log (2026-08-03)

- `npm run typecheck` clean; `npm test` **669 passed / 58 files** (18 new, up
  from 651/57); `npm run build` succeeds.
- **`convex/` is NOT covered by `npm run typecheck`** — the root `tsconfig.json`
  includes only `src` and `vite.config.ts`. Convex code typechecks under
  `npx tsc --noEmit -p convex/tsconfig.json`, which is what was run here. Worth
  knowing before anyone trusts a green typecheck on a Convex-only change.
- **The dedupe had to change before any beacon was worth adding.**
  `logTelemetry` collapsed any repeat of `kind+message` within 5 s — built to
  stop error loops flooding the sink, and it would have silently eaten a second
  `screen` or `hotseat-turn-executed` inside that window. A funnel with dropped
  rows is worse than no funnel: it presents as a real denominator and is not
  one. The key now includes serialised `data` for `'flow'` rows **only**, so an
  identical-repeat flood still collapses while a beacon carrying a differing
  `{turn}`/`{name}` gets through. A test asserts identical `error` rows still
  collapse — proof the rule was narrowed, not that a hole was widened.
- **The data key was necessary but not sufficient, which the tests caught.** A
  round trip home → hotseat → home emits two *byte-identical* `screen` payloads,
  so no data key can tell them apart. The beacon carries a navigation ordinal,
  which doubles as the order a session actually visited things in.
- Shipped: `app-open` at `main.tsx` module scope (**not** an effect — StrictMode
  double-invokes effects in dev and would report twice the sessions that exist);
  new `services/screenBeacon.ts` on `hashchange` (**not** a hook — `useRoute`
  re-runs per render, so a beacon there counts renders, not navigations);
  hot-seat lifecycle in `gameStore.ts`; digest extended with a hot-seat funnel,
  a screens breakdown, `appOpens` beside `sessionsSeen`, and abandonment.
- **`executeTurn` advances `turn` only when the game did NOT end** (the
  `if (!gameEnded)` guard in `execute.ts`). So the turn just watched is
  `turn - 1` on an ongoing game and `turn` on the last one. A blanket `turn - 1`
  would misname the final turn of every game — the turn most likely to be the
  subject of a 🐞 note. Asserted in both directions.
- **A resume must not re-report a start**, or one game is started twice and
  finished once, and every downstream rate silently deflates. Asserted.
  Conversely a reload *during the winning replay* now still reports the finish:
  `finishReplay` never runs in that path, so the completed game would otherwise
  sit in the funnel looking abandoned. No extra bookkeeping was needed — a save
  reading `'gameover'` is by construction one whose finish already fired.
- **Abandonment is read from `games` + `turns`, not from telemetry rows**, with
  no schema change. Confirmed against the dev deployment: a 720 h window holds
  **4 telemetry rows** but **22 unfinished games — 14 stalled, 8 lobbies never
  started**. Deriving it from rows would have reported almost nothing, and
  under-reporting is the one direction that matters here.
- Hot-seat turn errors arrive as kind `'error'` from the store's try/catch, not
  as flow rows, so the hot-seat funnel matches them by message prefix the way
  the online funnel reads `turn-error`.

**Perturbations, each observed to fail before the code was kept:**
- revert the flow dedupe key ⇒ the two-beacons-in-the-window test fails (1)
- drop the screen ordinal ⇒ return-visit + ordering tests fail (2)
- name the watched turn with a blanket `turn - 1` ⇒ finished-game test fails (1)
- drop the resume-side finish emit ⇒ reload-during-winning-replay fails (1)

**A test-quality catch worth recording.** `playTurn` first submitted
`hand.slice(0, 5)`, which is an invalid program once a robot has 5 damage —
locked registers must stay null and the hand shrinks one card per damage. Board
lasers can do that on turn one, so the suite failed on roughly one seed in
three. The helper now respects locks, and the clock is pinned so the dealt game
is identical every run. **A test that fails one run in three is a test nobody
will trust the fourth time.**

*Not verified in a browser:* that `app-open` and `screen` fire from a real page
load (they are wired at module scope and typecheck, and the beacon logic is
unit-tested against a fake window). On the P5 checklist.

⚠️ NEXT: P4 — golden-game regression harness. Then the P5 hard stop.
