# Game Mechanics Specification

**Status:** v2 rules source (updated 2026-07-05 with the confirmed MVP
"full lite" scope). Implemented by `src/engine/`; the engine test suite is
the executable form of this document.

## Board Setup
- **Grid**: rectangular, typically 10×10 (x grows east, y grows south)
- **Elements**: floor, edge-based walls, pits, conveyor belts (normal +
  express), gears (CW/CCW), checkpoints, spawn docks, wall-mounted board
  lasers
- **Starting**: robot for seat N spawns on dock N, facing north
- **Objective**: touch the numbered checkpoints in sequence

## Turn Structure

### Programming Phase
- Each player draws **9 − damage** cards from their personal deck
  (reshuffling their discard pile when the draw pile empties)
- Select cards for the unlocked registers among 1–5 (locked registers keep
  last turn's card — see Damage)
- Submit when ready (asynchronous); the turn executes when all players
  have submitted

### Execution Phase — per register (1 through 5)
1. Reveal cards; sort by **priority, highest first**. Ties are broken by
   seat order starting from the start player, which rotates each turn.
2. Execute robot movement in that order (with pushing, walls, falls).
3. Board elements: **express conveyors pulse 1**, then **all conveyors
   pulse 1** (express robots thus move 2), then **gears rotate 90°**.
4. **Board lasers** fire, then **all robot lasers** fire simultaneously.
5. **Checkpoints**: a robot ending the register on a checkpoint touches it
   (updates its respawn archive); it *claims* it only if it is the next one
   in sequence. Passing over a checkpoint mid-move does not count.
6. Check win conditions.

After register 5: destroyed robots with lives remaining respawn, and new
hands are dealt.

## Movement Cards

| Card | Effect | Count | Priorities |
|---|---|---|---|
| U-Turn | rotate 180° | 6 | 10–60 (step 10) |
| Turn Left | rotate 90° CCW | 18 | 70–410 (step 20) |
| Turn Right | rotate 90° CW | 18 | 80–420 (step 20) |
| Back Up | 1 space backward | 6 | 430–480 (step 10) |
| Move 1 | 1 space forward | 18 | 490–660 (step 10) |
| Move 2 | 2 spaces forward | 12 | 670–780 (step 10) |
| Move 3 | 3 spaces forward | 6 | 790–840 (step 10) |

**Total: 84 cards per player**, all priorities unique within a deck.
Multi-space moves resolve one step at a time.

## Robot Interactions
- **Pushing**: a robot moving into an occupied square pushes that robot one
  space; chains push through multiple robots. Backing up pushes too.
- **Walls** sit on cell edges and block crossing in both directions — for
  the mover and for the entire push chain (nobody moves).
- **Board edge**: moving, being pushed, or being conveyed off the board
  destroys the robot (see Lives).
- **Pits**: a robot falls the moment it enters a pit, forfeiting the rest
  of its movement. Robots can be pushed or conveyed into pits.

## Board Elements
- **Conveyors** move robots riding them at board-element time; they do not
  push: a robot moving into an occupied, non-vacating square stays put. Two
  robots converging on one square: neither moves. Facing conveyors never
  swap robots. Walls block conveyor movement silently.
- **Gears** rotate the robot on them 90° CW or CCW.
- **Board lasers** are wall-mounted; the beam covers the emitter's own
  square and travels until a robot, wall edge, or board edge stops it. The
  first robot in the path takes the laser's strength in damage each
  register.
- **Robot lasers**: every operating robot fires a strength-1 laser in its
  facing direction each register (from the square in front of it; walls in
  front block it). All robot lasers fire simultaneously.

## Damage & Locked Registers
- Damage accumulates from lasers; there are **no repair sites in MVP** —
  damage clears only via destruction + respawn.
- Hand size shrinks: **9 − damage** cards dealt.
- At **5+ damage** registers lock, from register 5 downward (5 damage locks
  register 5; 9 damage locks all five). A register locks holding the card
  in it *this turn*, and that card repeats every subsequent turn until the
  lock clears.
- At **10 damage** the robot is destroyed.

## Lives, Destruction & Respawn
- Each robot starts with **3 lives**. Falling in a pit, leaving the board,
  or reaching 10 damage costs one.
- A destroyed robot is removed for the rest of the turn (it doesn't block,
  fire, or act), then respawns at end of turn at its **archive** — the last
  checkpoint it touched, else its spawn dock — facing north with **2
  damage** and cleared register locks. If the archive is occupied, it
  respawns on the nearest free non-pit square (deterministic scan).
- At **0 lives** the player is eliminated permanently.

## Win Conditions
- **Checkpoints**: first robot to claim all checkpoints in order wins
  immediately.
- **Last robot standing**: if all other players are eliminated, the
  survivor wins (multiplayer only).

## Cut from MVP
Pushers, repair sites, option cards, power-down, priority antenna.

## Determinism
Turn execution is a pure function `(state, programs, seed)` →
`(newState, EventLog)`. The seed drives only card dealing; everything else
is fully determined. The EventLog is the replay/animation contract
(`src/engine/events.ts`).
