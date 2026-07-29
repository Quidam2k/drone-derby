# Game Mechanics Specification

**Status:** v2 rules source (updated 2026-07-05 with the confirmed MVP
"full lite" scope). Implemented by `src/engine/`; the engine test suite is
the executable form of this document.

## Board Setup
- **Grid**: rectangular, typically 10×10 (x grows east, y grows south)
- **Elements**: floor, edge-based walls, pits, conveyor belts (normal +
  express), gears (CW/CCW), checkpoints, spawn docks, repair sites
  (wrenches), wall-mounted board lasers, wall-mounted pushers
- **Starting**: robot for seat N spawns on dock N, facing north
- **Objective**: touch the numbered checkpoints in sequence

## Turn Structure

### Programming Phase
- Each player draws **9 − damage** cards from the **one shared 84-card deck**,
  in seat order (board-game rule; the discard pile is reshuffled into the
  draw pile when it runs dry — card scarcity at high player counts is real)
- Select cards for the unlocked registers among 1–5 (locked registers keep
  last turn's card — see Damage)
- Submit when ready (asynchronous); the turn executes when all players
  have submitted

### Execution Phase — per register (1 through 5)
1. Reveal cards; sort by **priority, highest first**. Ties are broken by
   seat order starting from the start player, which rotates each turn.
2. Execute robot movement in that order (with pushing, walls, falls).
3. Board elements: **express conveyors pulse 1**, then **all conveyors
   pulse 1** (express robots thus move 2), then **pushers fire** (on the
   registers printed on them), then **gears rotate 90°**.
4. **Board lasers** fire, then **all robot lasers** fire simultaneously.
5. **Checkpoints**: a robot ending the register on a checkpoint touches it
   (updates its respawn archive); it *claims* it only if it is the next one
   in sequence. Passing over a checkpoint mid-move does not count.
6. Check win conditions.

After register 5: robots on repair sites repair (see Repair), destroyed
robots with lives remaining respawn, and new hands are dealt. Repair comes
before respawn on purpose: a robot destroyed this turn does not repair,
even if it respawns onto a wrench.

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

**Total: 84 cards in one shared deck**, all priorities (and card ids) unique.
Everyone deals from it and discards back to it; locked registers hold their
cards outside the deck until the lock clears. Multi-space moves resolve one
step at a time.

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
- **Curved conveyors** (belt corners): when the *belt* carries a robot onto
  a curved section — in across the curve's entry edge — the robot rotates
  90° in the curve's direction. That is the only trigger: walking, being
  pushed, or respawning onto a curve does not rotate, riding *out* of one
  does not rotate, and a robot conveyed in from a non-entry side just rides
  through unturned. A curve's `dir` is its exit direction.
- **Gears** rotate the robot on them 90° CW or CCW.
- **Pushers** are wall-mounted pistons that fire only on the registers
  printed on them (classic variants: 1/3/5 and 2/4). A firing pusher shoves
  the robot in its cell one space away from the wall, with normal chain
  pushing, wall blocking (the whole chain stays put) and pit/edge falls.
  Powered-down robots are shoved like anything else; a pusher with no robot
  in front of it does nothing.
- **Board lasers** are wall-mounted; the beam covers the emitter's own
  square and travels until a robot, wall edge, or board edge stops it. The
  first robot in the path takes the laser's strength in damage each
  register.
- **Robot lasers**: every operating robot fires a strength-1 laser in its
  facing direction each register (from the square in front of it; walls in
  front block it). All robot lasers fire simultaneously.

## Damage & Locked Registers
- Damage accumulates from lasers; it clears via destruction + respawn or
  via end-of-turn repair (see Repair).
- Hand size shrinks: **9 − damage** cards dealt.
- At **5+ damage** registers lock, from register 5 downward (5 damage locks
  register 5; 9 damage locks all five). A register locks holding the card
  in it *this turn*, and that card repeats every subsequent turn until the
  lock clears.
- At **10 damage** the robot is destroyed.

## Repair (wrench tiles & flags)
- At **end of turn** (after register 5, before respawns), a robot standing
  on a **repair site (wrench)** or **any checkpoint flag** discards **1
  damage token**, and its archive marker moves to that square. Passing over
  a wrench mid-turn does nothing; only ending the turn there counts.
- A robot destroyed this turn does **not** repair — repair resolves before
  respawn (1994 rule).
- Repairing below a lock threshold **unlocks** the affected register
  immediately: the card it held returns to the shared discard pile that
  same turn, and the next hand is dealt one card larger (9 − damage).
  Unlocks free registers from the lowest-numbered locked register upward
  (repairing 7→6 frees register 3; registers 4 and 5 stay locked).

## Power-Down (1994 rule)
- While programming turn N, **any player may announce a power-down** (not
  just damaged ones). The announcement rides the program submission; the
  robot powers down when turn N executes and is down for **all of turn
  N+1**.
- At the **start of the powered-down turn, ALL damage is removed** (one
  repair event), and every locked register releases — its card returns to
  the shared discard pile. This is the counterweight to the 1-point repair
  economy.
- While down the robot **executes no registers and fires no laser**, and
  holds no cards — but it is still a robot on the board: it is **pushed,
  conveyed, rotated by gears, and hit by board and robot lasers**. Damage
  taken while down **sticks** (only the start-of-down-turn clear removes
  it). It still touches checkpoints/wrenches where it ends the turn
  (archive moves; end-of-turn repair applies as normal).
- The powered-down player still submits their turn — a **single stay-down /
  wake-up choice** instead of a program — so async play never blocks on
  them. Staying down repeats the cycle (damage clears again next turn
  start); waking deals a fresh hand of 9 − damage at end of turn.
- **Destruction ends a power-down**: the robot respawns as normal (2
  damage, facing choice next turn) and its player may announce again while
  programming the next turn.

## Lives, Destruction & Respawn
- Each robot starts with **3 lives**. Falling in a pit, leaving the board,
  or reaching 10 damage costs one.
- A destroyed robot is removed for the rest of the turn (it doesn't block,
  fire, or act), then respawns at end of turn at its **archive** — the last
  checkpoint it touched, else its spawn dock — with **2 damage** and cleared
  register locks. If the archive is occupied, it respawns on the nearest
  free non-pit square (deterministic scan).
- **The player chooses the respawn facing** (1994 rule) while programming
  the next turn — you see where you re-entered before aiming, and the
  choice rides the program submission so async play never blocks. The robot
  re-enters facing north; the chosen facing is applied at the start of the
  next turn (default north if no choice is made).
- At **0 lives** the player is eliminated permanently.

## Win Conditions
- **Checkpoints**: first robot to claim all checkpoints in order wins
  immediately.
- **Last robot standing**: if all other players are eliminated, the
  survivor wins (multiplayer only).

## Cut from MVP
Option cards, priority antenna. (Repair sites joined the game in Phase 30;
power-down in Phase 33; pushers in Phase 34.)

## Determinism
Turn execution is a pure function `(state, programs, seed)` →
`(newState, EventLog)`. The seed drives only card dealing; everything else
is fully determined. The EventLog is the replay/animation contract
(`src/engine/events.ts`).
