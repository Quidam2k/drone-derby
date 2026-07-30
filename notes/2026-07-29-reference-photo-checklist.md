# Reference-photo verification checklist — RESULTS (photos reviewed 2026-07-29)

Photos: `input/reference_photos/` (12 shots). Contents: 1994 base Factory
Floor Guide front+back ×2 copies (the canonical Timing Summary), Grand Prix
FFG + Timing Summary, Radioactive FFG + Timing Summary, Radioactive FAQ
sheet ×2 sides, and four board maps: **Pinwheel**, **Shake 'n' Bake**,
**Gear Box**, **Reactor Core**. **No program-card photos** — deck spec
(§1 below) is still unverified; needs a shot of the cards if we want it.

## Verdict vs. the base-game Timing Summary — WE MATCH

Printed sequence: Reveal → Robots Move by priority (pits/walls/pushing) →
Board Elements Move (1. express ×1, 2. express 2nd + normal together,
3. pushers if scheduled, 4. gears, 5. crushers) → Resolve Laser Fire →
Touch Checkpoints (archive update, count toward victory; survivors only)
→ after register 5, End-of-Turn Board Effects (repairs).
Engine matches step for step, including pushers-before-gears and the
express/normal overlap (`conveyorPulse(true)` then `(false)`).
Turning-belt rule verified too: rotate ONLY when a belt carries the robot
in through the curve's entry edge (`execute.ts` curve rule) — exact match.
Pusher register schedules + multi-push: match. Laser blocking (first
robot in beam): match. Repair-site "two wrenches → option card": cut with
the option deck, by design.

## Two deltas found (small)

1. **Crushers** — the base FFG lists them (destroy robot, scheduled
   registers, Board Elements step 5). We don't implement; no board of
   ours uses them. The one base-game element we lack. Cheap to add if a
   transcribed board ever needs one (pusher-style schedule, kill on hit).
2. **Laser simultaneity** — printed rule resolves board + robot lasers in
   one segment; we fire board lasers then robot lasers. Edge case: a
   robot destroyed by a board laser returns fire on tabletop,
   not in our engine. Cosmetic-tier; note only.

## The four photographed boards — all expansion boards

Pinwheel (Grand Prix), Shake 'n' Bake, Gear Box, Reactor Core
(Radioactive). Every one leans on elements we don't have: flamers,
portals/teleporters, trap-door pits, repulsor fields, oil slicks,
one-way walls, radioactive waste/radiation, drains, chop shops (+ crushers).
Faithful transcription therefore needs new engine elements first.
Rough effort tiers if Todd wants them:
- **Cheap**: trap-door pits (pit + register schedule), drains (=pits),
  crushers, one-way walls (edge rule variant), radiation (flat damage).
- **Medium**: flamers, oil slicks, portals, teleporters, repulsor fields.
- **Cut by scope** (option-card-dependent): chop shops, waste option draws.

---

# Original pre-photo checklist follows

Written 2026-07-29, before the photos arrive. Purpose: when Todd photographs
the physical 1994 RoboRally reference cards and board maps, diff them against
what the engine implements — fast, with no re-derivation.

## 1. Program card deck — what we implement (`src/engine/deck.ts`)

84 cards, one shared deck, all priorities unique:

| Type       | Count | Priorities          |
|------------|-------|---------------------|
| U-Turn     | 6     | 10..60, step 10     |
| Turn Left  | 18    | 70..410, step 20    |
| Turn Right | 18    | 80..420, step 20    |
| Back Up    | 6     | 430..480, step 10   |
| Move 1     | 18    | 490..660, step 10   |
| Move 2     | 12    | 670..780, step 10   |
| Move 3     | 6     | 790..840, step 10   |

**Check against card photos:** count per type, priority range and step per
type, that left/right interleave (L odd-tens, R even-tens), 84 total.
Any mismatch → change `DECK_SPEC`; card conservation test (84) and the
mechanics doc `docs/game_mechanics_md.md` must move with it.

## 2. Turn/register order — what we implement (`src/engine/execute.ts`)

Per register: reveal by priority (ties: seat order rotating from
`startPlayerIndex`) → moves with chain pushing → express belts pulse →
all belts pulse → pushers (their registers) → gears → board lasers →
robot lasers → checkpoints/wrenches (touch) → win check. End of turn:
repair on wrench/flag, respawns (facing N; player picks facing while
programming next turn), power-down handling.

**Check against the player reference card:** exact phase order, especially
express-then-all belts, when pushers fire, and whether lasers precede
touching flags. This is the highest-value photo — it's the canonical
ordering we claim parity with.

## 3. Boards — what we have vs. the printed maps

All six built-ins are **original designs**, not transcriptions
(`src/engine/boards.ts`): Proving Grounds 10×10, Spin Cycle 12×10,
The Gauntlet 12×12, Vortex Arena 11×11, Pit Archipelago 12×11,
Grand Circuit (Spin Cycle + Dockyard staging yard, 12×17, composed).

**From the map photos** we can transcribe authentic boards. Per photo we
need, per cell: floor/pit/belt (direction + express?)/gear (spin)/wrench/
spawn-number, plus **edge-based** walls (which side of which cell), laser
mounts (wall position + direction + strength), pusher mounts (side +
register schedule). Flags are scenario-dependent in the physical game —
note which flag layout the photo shows, if any. Grid is 12×12 per printed
board; docks are a separate smaller board that composes on (our
`composeBoards` already handles that, per Grand Circuit).

Scope reminder (memory): 1994 WotC set + Armed & Dangerous/Radioactive
boards are in scope; option cards are permanently cut.

## 4. Small parity items to eyeball in photos

- Damage ladder on reference card: hand 9−damage, locks at 5+ from
  register 5 down, destroyed at 10 — matches `deck.ts` helpers.
- Respawn: 2 damage on re-entry, player chooses facing — matches
  Phase 32 (`applyRespawnFacing`).
- Repair: wrench/flag end-of-turn repair 1 (we cut option-card wrenches
  with the option deck — expect the printed card to mention options; that
  difference is by design).
