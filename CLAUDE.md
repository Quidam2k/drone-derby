# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Project

Drone Derby v2 — an asynchronous multiplayer RoboRally-style programming
game. Browser-first PWA. From-scratch rewrite; the plan of record is
`cascades/2026-07-05-v2-rewrite.md` (phases, cross-phase decisions).

## Commands

- `npm run dev` — Vite dev server (default port 5173)
- `CONVEX_AGENT_MODE=anonymous npx convex dev` — local Convex backend
  (anonymous local deployment, no Convex account; writes `.env.local`).
  Run alongside `npm run dev` for online play; without a configured
  `VITE_CONVEX_URL` the app falls back to hot-seat-only.
- `npm run build` — typecheck + production build
- `npm test` — run the Vitest suite once
- `npm run test:watch` — Vitest in watch mode
- `npm run typecheck` — TypeScript only, no emit

Run `npm run typecheck` and `npm test` before committing.

## Architecture (v2)

- **Stack**: Vite + React + TypeScript at repo root. State: Zustand
  (Phase 2+). Backend: Convex (Phase 3+), confined to `convex/` plus thin
  client hooks. No Redux, no MUI, no Express/Postgres/Redis/Socket.io.
- **`src/engine/` is a pure, deterministic game engine** with zero
  dependencies: `executeTurn(state, programs, seed, choices?) → { state,
  events }` (`TurnChoices`: respawn facing, power-down).
  No DOM, no IO, no `Date.now()`, no `Math.random()` — all randomness goes
  through the seeded RNG in `src/engine/rng.ts`. The engine is shared
  verbatim by the client (hot-seat, previews, replay) and Convex functions
  (authoritative execution). Keep it that way.
- **EventLog is the animation contract**: `executeTurn` emits atomic
  `EngineEvent`s (see `src/engine/events.ts`) grouped by register. The
  replay player consumes only the EventLog; never derive animations from
  state diffs. Changing the event union is a breaking change to replay —
  extend, don't reshape.
- **The editor and thumbnails are DOM/CSS grid, never canvas.** The level
  editor (Phase 6a) reuses the game's `Board`/`Tile` renderer under a
  transparent hit layer and finds cells with `document.elementFromPoint` +
  `data-x`/`data-y`; that cannot work over a tilted 3D canvas, and
  raycasting would be a rewrite of the authoring tool for zero player
  benefit. `BoardThumb` stays DOM/SVG too. Both are permanent.
- **The player-facing board is WebGL by default** (Phase 3D-1 onward,
  `src/components/board3d/`; the default since the 3D-7 cutover). Mesh
  animation — rolling treads, a hexapod walk cycle, spinning wheels — is not
  expressible in CSS 3D, which can only tilt and fly DOM planes, so the
  dynamic camera and animated robots need three.js. `three` is reached only
  through `await import('./scene')` so no other screen pays for it.
- **`board/BoardView.tsx` is the only thing that mounts either board.** The
  four player-facing screens (ReplayPlayer, HighlightReel, ProgrammingView,
  OnlineGameScreen) import it and never `Board`/`Board3D` directly — a
  source-text test enforces that. It resolves the renderer through the pure
  `board/rendererChoice.ts`, in this order: `?render=dom` → capability (no
  WebGL2, or a scene that threw this page load) → `?render=3d` → the player's
  persisted preference (`viewSettings.renderer`, default `'3d'`).
- **The DOM `Board` is never deleted, and it is now the FALLBACK.** The
  editor and `BoardThumb` need it regardless, which makes it close to free —
  but it is also what a machine without WebGL2 gets and what `Board3D`'s
  catch hands back to via `markRenderer3dFailed()`. That flag is
  deliberately not persisted: one bad load must not permanently downgrade a
  player who chose 3D. Keep both renderers reachable and both working.
- **Blender is the art pipeline for both robots and board tiles.**
  `scripts/blender/common.py` holds the shared primitives;
  `robots.py` → `public/models/robot-*.glb` (`npm run art -- --glb`) and
  `tiles.py` → `public/models/tiles.glb` (`npm run art:tiles`). Every piece
  is modelled in the local frame of the three.js primitive it replaces, so
  `boardMesh.ts` placements never move and a missing `.glb` falls back to
  that primitive piece by piece — keep both paths working.
- **Rules source**: `docs/game_mechanics_md.md` (scope: moves, pushing,
  edge-based walls, pits, conveyors + express, gears, checkpoints, board +
  robot lasers, damage with locked registers, 3 lives, respawn, end-of-turn
  repair on wrenches + flags, power-down, pushers). Still cut — and staying
  cut by design: option cards. Rules parity is complete (Phase 34);
  history: `notes/2026-07-28-rules-parity-scoping.md`.
- **Telemetry**: client crashes and 🐞 playtest notes are captured by
  `src/services/telemetry.ts` (localStorage ring buffer + fire-and-forget
  to the `convex/telemetry.ts` sink; read with
  `npx convex run telemetry:recent [--prod]`). Service layer only — never
  import it into `src/engine/`.
- The root `README.md` is the playtest guide (setup, test-everything
  checklist); keep it current when screens or boards change.
- **`legacy/` is the archived v1 codebase — reference only.** Never import
  from it or resurrect its stack. `docs/technical_architecture_md.md`
  describes that dead stack and is kept as history.

## Engine invariants (tested — keep them true)

- Same `(state, programs, seed)` twice → deep-equal results; input state is
  never mutated.
- Per register: reveal by priority (ties: seat order from
  `startPlayerIndex`, which rotates each turn) → moves with chain pushing →
  express belts pulse, all belts pulse, gears → board lasers, robot lasers →
  checkpoints → win check.
- Cards are conserved: drawPile + discardPile + all hands + all locked
  registers = 84 total (one shared deck, board-game rule), every turn; all
  card ids globally unique.

## Session continuity

`.claude/session-state.md` is the source of truth on cold start. Cascade
plan: `cascades/2026-07-05-v2-rewrite.md`.


## WORKER BOOT PROTOCOL

(Applies when PANTHEON_WORKER=1 — skip if you are not a worker session)

You are a Pantheon orchestrated worker for your project name (from your launch prompt). ACTION REQUIRED - do these IN ORDER before anything else: (A) Inbound delivery is automatic: the watcher pushes orch assignments, signoffs, PROCEED permits, confers, and messages straight into this session via a named pipe keyed to your team name. There is NO team to bind and NO TeamCreate to call - proceed directly to (B). (B) Call orch_get_assignments(project='your project name (from your launch prompt)', team_name='your team name (from your launch prompt)', limit=3) to check for work - ALWAYS pass team_name, it is what scopes the poll to work addressed to YOU (#606); without it the server falls back to inferring the sole live worker, which is how workers ended up owning assignments nobody wrote for them. If the reply carries pending_for_you_count > 0, more work is addressed to you behind the limit - poll again rather than assuming the queue is empty - this returns your freshest few non-completed assignments (pending, in_progress, or blocked), not the full queue (intentional: keeps your boot context lean). Claim-on-poll: the server auto-transitions pending assignments to in_progress when you poll, so returned items will typically be in_progress - treat them as actionable work, same as pending. Mid-session inbox pushes still deliver anything newer. (C) If you have assignments: acknowledge via orch_report, then immediately emit the slash command /rename your-project-name:<task-slug> to label your terminal tab (derive a short lowercase-hyphenated slug from the first 3-4 key words of the task, e.g. /rename your-project-name:orch-promote-suggestion). Then investigate, write a plan, send it back for approval via orch_report(event_type='question', criticality='low' or 'high'). Do NOT execute until approved. PLAN-BACK RULE (#450): submit exactly ONE plan-back per assignment, then STOP. Do not submit a second orch_report(event_type='question') for the same assignment. To amend after submission, use event_type='report' — do NOT re-submit a new question. TEAM IDENTITY: always pass team_name='your team name (from your launch prompt)' on every orch_report call so the orchestrator can track your session and the per-worker dedup guard can identify you. CRITICALITY: 'low' = research / read-only / drafting / catalog (single signoff unblocks). 'high' = code changes, DB mutations, file writes, system reconfiguration, anything destructive (dual-signoff from both Jarvis AND Karen required). When in doubt, mark high. You may self-elect to 'high' even for normally-low work when you want a second reviewer - say so in the plan body. Report progress at milestones. On completion reports, pass assignment_id=N on the orch_report call (event_type='completed', assignment_id=N) to auto-close the assignment in one call. Fallback: call orch_complete_assignment separately. (C0) Boot-queue triage: If orch_get_assignments returns items, you DO have work - do NOT fall through to (D). Note: orch_get_assignments returns ORDER BY id ASC, so 'freshest' = highest-numbered ID = LAST item in the returned list. Your boot poll (B) is intentionally limited to the freshest few non-completed (limit=3) to keep context lean - the full historical queue is NOT loaded and you do not need it; the highest-id triage below is unchanged. Order: (i) the highest-numbered [ORCH PROCEED]-prefixed item is your signed-off execution permit, execute it. (ii) If no PROCEED items, the highest-numbered non-PROCEED item is your assignment - acknowledge via orch_report and plan-back per (C). (iii) Take (D) idle path ONLY when the assignments list is empty. (iv) Mid-session inbox pushes are LIVE: ANY new inbox push prefixed [ORCH ASSIGNMENT] #N is fresh work that arrived after your boot - ack via orch_report and plan-back per (C). ANY new push prefixed [ORCH PROCEED] #N is a signoff-fired execution permit per (H). Inbox pushes are NEVER stale boot-snapshot items; the watcher only pushes on fresh DB activity. Do NOT call orch_worker_final while an unprocessed [ORCH ASSIGNMENT] or [ORCH PROCEED] push is in your inbox. If a higher-numbered assignment ID appears in your inbox than was in your initial poll, that is fresh work - there is a brief boot-poll write->read race where assignments INSERTed within seconds of your boot may have missed your initial snapshot. (D) If NO assignments on boot poll: DO NOT stand down immediately - a dispatch race may have created work after your poll window. (1) Call orch_report(project='your project name (from your launch prompt)', content='Online - boot poll empty, watching for late dispatch.', event_type='idle') to signal boot success. (2) Call orch_get_assignments(project='your project name (from your launch prompt)', team_name='your team name (from your launch prompt)', limit=3) once more immediately. (3a) If the second poll returns work: treat it as (C)/(H) and continue. (3b) If the second poll is also empty AND no inbox push has arrived: call orch_worker_final(project='your project name (from your launch prompt)', team_name='your team name (from your launch prompt)', content='Boot double-poll empty - no work dispatched. Closing cleanly.', event_type='idle') to close. (#117/#100 boot-race fix.) (E) For blockers: use orch_escalate. For questions to the orchestrator: use orch_report with event_type='question'. (F) On every orch_report call, include context_pct - the EXACT value from the <system-reminder>Context window: N% used.</system-reminder> injected at the start of this turn by the context hook. Use that N directly - do NOT estimate or substitute anchor values. Anchor fallback ONLY when no system-reminder appeared this turn (first boot turn, hook hiccup): 5=first-turn boot, 15=early work. CLEAR THRESHOLD: 30% for every worker regardless of model — the threshold is about compaction risk vs remaining task size, not model tier (#826). At ~30% context, park in plain text and close - do not compact. PLAN MODE IS THE DEFAULT for any multi-file edit or multi-assignment work. Pattern: plan with current context -> /clear -> execute plan in a fresh session. The plan carries forward; you don't need to re-read your planning context to execute it. Enter plan mode proactively. Don't wait for high context. (G) Ending your session - orch_report vs orch_worker_final: These are DIFFERENT tools for DIFFERENT jobs. orch_report(event_type='completed', assignment_id=N) closes a specific assignment as completed - use it per (C). orch_worker_final(project='your project name (from your launch prompt)', team_name='your team name (from your launch prompt)', content=<final message>) posts a final message and kills your terminal after ~2s - use it ONLY when the session is DONE (no more phases or assignments). CRITICAL: orch_worker_final does NOT complete assignments - it marks any remaining in_progress assignments as ABANDONED. Correct end-of-session sequence: (1) orch_report(event_type='completed', assignment_id=N) for each finished assignment, THEN (2) orch_worker_final(...) to post your cascade-done summary and exit. Mid-cascade parking does NOT use orch_worker_final - park in plain text and let Todd /clear. WORKER REUSE VIA SELF-CLEAR (#458): when your completion poll shows MORE same-project queue items, you MAY reuse this terminal instead of dying: (1) close every finished assignment (event_type='completed', assignment_id=N), (2) write YOUR OWN checkpoint file - the path the launcher hands you in WRAPPER_CHECKPOINT_PATH, i.e. Q:\project-reports\<project>\<your team name>-checkpoint.md (#2761: that drop dir moved OUT of the Pantheon repo on 2026-08-07 and is now its own repo with a private remote) - because the wrapper's checkpoint gate stats THAT file and blocks the clear if it is missing or older than 5 minutes. WRITE that file; do NOT commit it - the gate reads its MTIME, not git, and orch_safe_commit.py now REFUSES project-reports paths outright, so the old #726 instruction to git add your checkpoint is withdrawn. Durable notes for Pantheon go to a tracked notes/<ticket>-<slug>.md instead, (3) emit <<SELF_CLEAR_NOW>>. Do NOT write .claude/session-state.md for this: it is shared by every concurrently-live worker in the same tree (#717), so it both loses handoffs to a race and does NOT satisfy the gate, which means a worker that writes it instead of its own file stays armed forever and never clears. The wrapper clears your context and injects a lean re-poll prompt; the fresh context boot-polls and claims the next item (including #45 context-held rows). Reuse WITHIN your project only - cross-project work gets its own worker. Queue empty -> orch_worker_final as below, NOT a self-clear. CASCADE-DONE WITHOUT SELF-KILL: if your assignment instructs you to stay alive after cascade-done (orchestrator kills your terminal via orch_stop_worker), post your final summary via orch_report(event_type='completed', cascade_done=True, team_name='your team name (from your launch prompt)') - the cascade_done flag raises the stop-worker obligation reminding the orchestrator to close your terminal. NEVER set cascade_done=True on per-assignment completion reports mid-cascade (more phases or queue items remaining) - a mid-cascade obligation invites the orchestrator to kill you while you are still executing. (H) PROCEED-prefixed assignments are pre-approved plans. The watcher push begins with '[ORCH PROCEED]' - task body inside still starts with 'Plan-back #N APPROVED ... PROCEED' as before, but the wrapper is your primary signal. That IS the green light for the previously-submitted plan-back #N. Do NOT re-plan - execute directly per the approved plan. If you're a fresh execution worker spun up specifically to execute a prior session's plan, the proceed-assignment task body usually inlines the key directives + answers to open questions; if you need the original plan-back content and it isn't inline, ask Jarvis via orch_report(event_type='question', criticality='low') for a copy rather than re-planning from scratch. While waiting for plan-back approval, NEW non-PROCEED orch_assigns from your orchestrator are still queued and must be acknowledged immediately via orch_report - plan-back signoff does NOT supersede other queue items. Watch for the [ORCH PROCEED] prefix specifically - those are your signoff-fired execution permits, not new work. (I) Do NOT call EnterPlanMode. Worker terminals are not monitored by Todd - plan mode gates will freeze your terminal waiting for a click that never comes. The ONLY plan approval channel is orch_report -> Jarvis -> orch_assign. Submit your plan via orch_report, wait for Jarvis to send an orch_assign approving it, then execute. (J) Commit + push discipline (#826, compressing #666): commit as soon as something builds and works — via `python scripts/orch_safe_commit.py --marker '#<ticket>' --message-file msg.txt <paths>` — then `git push` as its own bare command where a remote exists; no session ends with meaningful uncommitted changes (run `git status` before orch_worker_final, a self-clear, or parking), because working-tree-only work and unpushed commits both die with this one disk. Full rules, including migration scope verification with scripts/check_uncommitted.py: your project CLAUDE.md sections "Commit early, commit often (#666)" and "Committing in a shared working tree (#620)".

(K) THIS BLOCK IS GENERATED - EDIT THE CANONICAL FILE, NOT YOUR CLAUDE.md (#2626). Everything above is written into your project's CLAUDE.md by the orchestrator at WORKER SPAWN, from scripts/worker_boot_protocol.md in the Pantheon repo. It is REPLACED IN PLACE on every spawn. So if you hand-edit the generated boot-protocol section of any project's CLAUDE.md, your edit survives only until the next worker is spawned in that project and then vanishes with no warning and no git conflict - the file simply comes back different. To change worker boot instructions, edit scripts/worker_boot_protocol.md and the change reaches every project the next time each one spawns a worker. This is a real trap and it has already cost us once: canonical and Pantheon's own CLAUDE.md drifted in OPPOSITE directions because section (J) was added to canonical while the self-clear protocol in (G) was added straight to CLAUDE.md, so each file was silently missing what the other had. Anything ABOVE this line is fair game to propose changes to; nothing above it should be edited anywhere except the canonical file.
