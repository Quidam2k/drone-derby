# 2026-07-28 — Rules parity scoping (pre-plan)

Scoping session only. **No code was changed.** Next session drops into plan
mode for the rules-parity cascade (phases 30–34).

## What Todd asked

He's not ready to playtest yet. Before he plays with friends he wants "as
much of the base rules as possible" in the game, and asked (a) how far along
we are, (b) whether we need a host so he doesn't serve from his machine, and
(c) whether photos of his physical boards / reference sheets would help.

## Answers established this session

### Hosting — already solved, nothing to do
`npm run deploy` = Convex prod + Cloudflare Pages (`package.json:16`). Live at
**https://drone-derby.pages.dev**, invite-code join, no sign-up. The only
caveat: **prod is behind the working tree** because 3D-5/6/7 are still
uncommitted. Ship those before inviting anyone.

### Edition — original Wizards of the Coast RoboRally (1994, Garfield)
Todd's set says Wizards of the Coast; he also has the **Armed and Dangerous**
and **Radioactive** expansions. That's the classic card-priority game — the
one the engine already implements. **No engine invariants need re-deciding**
(no priority antenna, no upgrade/damage card decks — those are Renegade 2016).

⚠️ I am **not confident** which new board elements A&D and Radioactive
introduce. Do not plan against them from memory. Photos will settle it.

### Reference photos — Todd is shooting ALL of it
He confirmed he'll photograph **every board plus the reference cards**. Treat
the photos as the authority over anything recalled from memory.

The 1994 rulebook is well-known enough to implement from. What is *not* known
cell-precise is the **board layouts** (Exchange, Island, Cross, Spin Zone,
Chess, Maelstrom…) — so the board photos are the valuable half, and the
expansion boards are **required** before touching expansion elements.

When they land: drop them in `screengrab/` (or a `docs/reference/` folder if
they're worth keeping long-term), and transcribe each board into
`src/engine/boards.ts` form rather than eyeballing it at build time.

## Rules coverage audit (engine read end-to-end)

**Implemented and test-covered (325 tests):** 84-card priority ladder, 5
registers, reveal-by-priority with rotating start-player seat tiebreak, chain
pushing, edge-based walls blocking the whole chain, pits, board-edge death,
normal + express conveyors (non-pushing, no swap, converge-stalemate),
gears, wall lasers with strength, simultaneous robot lasers, `9 − damage`
hands, registers locking 5→1 from 5 damage, destruction at 10, 3 lives,
archive respawn at 2 damage, sequential checkpoints, both win conditions.

**Missing vs. the physical game:**

| Gap | Phase | Note |
|---|---|---|
| Repair sites (wrench) **+ flags repairing 1 at end of turn** | 30 | Biggest. Damage is currently a one-way ratchet — only death clears it. |
| Curved conveyors (rotate a robot carried round a bend) | 31 | Required for faithful recreation of the real boards. |
| Respawn facing chosen by the player | 32 | We hard-code `'N'`. |
| Power-down (announce, sit out, clear all damage) | 33 | The counterweight to the repair economy. |
| Pushers (wall-mounted, fire on odd/even registers) | 34 | Present on most real boards. |
| Option cards (~26) | — | **Explicitly out of scope** (Todd's call). |

### Todd's scope decision
**"Everything except option cards."** → phases 30, 31, 32, 33, 34.

### Open decision, raised but not answered
The physical game uses **one shared 84-card deck**; card scarcity at 5–6
players is a live mechanic. We give **every player their own 84-card deck**
(`src/engine/deck.ts:26`, and the conservation invariant is written per
player). Friendlier and simpler, but it is not the printed rule. Ask before
phase 30 — changing it later invalidates the card-conservation test suite.

## Engine anchors for the coming work

- Turn loop / phase ordering — `src/engine/execute.ts:66`
- Board-element order (express → all → gears) — `execute.ts:84`
- `conveyorPulse` (curved conveyors land here) — `execute.ts:274`
- `applyDamage` + lock ledger — `execute.ts:435`
- `respawnRobots`, hard-coded `facing = 'N'` — `execute.ts:514`, `:520`
- `cleanUpCards` — `execute.ts:561`. **Repair must run BEFORE this** (a
  standing cross-phase decision, cascade plan line ~940 / ~1778).
- `TileDef` union — `src/engine/types.ts:37`
- `EngineEvent` union — `src/engine/events.ts:8`. **Extend, never reshape**;
  it is the replay contract.

Layers each rules phase will ripple through: `engine/{types,execute,validate,
boards,preview}`, `components/board/{Tile,sprites,Board}`,
`components/board3d/{boardMesh,tileKit,effects}`, `components/editor/
ToolPalette`, `scripts/blender/tiles.py`, and for power-down also
`components/programming/ProgrammingView` + `convex/{schema,games}`.

## ⚠️ NEXT
Todd is switching this session to **Fable**. On resume: confirm whether the
board photos have arrived, settle the shared-vs-per-player deck question,
then `EnterPlanMode` for **Phase 30 — repair economy** (wrench tiles + flags
repairing 1 damage at end of turn, running before `cleanUpCards`).
