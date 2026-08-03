# Cascade — Diagnosability pass (2026-08-03)

Plan of record for the post-playtest-polish cascade. Approved by Jarvis
(assignment #2499, amendment #7087). Supersedes nothing; the previous cascade
`2026-07-31-playtest-polish.md` is complete and terminal.

## Status

| Phase | Title | Status |
|-------|-------|--------|
| P1 | Diagnosability pass | DONE (2026-08-03) |
| P2 | Hot-seat resilience | DONE (2026-08-03) |
| PA | Board element animation (added by #2500/#2501) | PENDING |
| P3 | Session + hot-seat beacons | PENDING |
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
