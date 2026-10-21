# Board source map (PRIVATE — notes only, never shipped)

#4762 / assignment #8843. Every player-facing board name is our own. This file
is the only place the printed source sheets are named. Reference images live in
the gitignored `input/reference_photos/tartarus/` and are never committed or
deployed; only our own transcriptions (src/engine/layouts.ts, authentic.ts) ship.

| Our name | Layout id | Source sheet | Set |
|---|---|---|---|
| Packing Plant | packingPlant | Cannery Row | Base 1994 |
| Crossroads | crossroads | Cross | Base |
| Switchyard | switchyard | Exchange | Base |
| Atoll | atoll | Island | Base |
| Spiral Mill | spiralMill | Maelstrom | Base |
| Sinkhole Grid | sinkholeGrid | Pit Maze | Base |
| The Rift | theRift | Chasm | Armed and Dangerous |
| Short Circuit | shortCircuit | Circuit Trap | A&D |
| The Ring | theRing | Colosseum | A&D |
| Spillway | spillway | Flood Zone | A&D |
| Cog Yard | cogYard | Gear Box | A&D (re-transcribed from the clean image; the photo-based version was wrong) |
| Beam Lattice | beamLattice | Laser Maze | A&D |
| Far Straight | farStraight | Back Stretch | Grand Prix |
| Gorge Run | gorgeRun | Canyon | Grand Prix |
| Service Lane | serviceLane | Pit Row | Grand Prix |
| Smelter | smelter | Blast Furnace | Crash and Burn |
| Tool Room | toolRoom | Machine Shop | Crash and Burn |
| Windmill | windmill | Pinwheel | Radioactive |
| Hot Zone | (authentic.ts reactorCore) | Reactor Core | Radioactive |
| Rattle Oven | (authentic.ts shakeNBake) | Shake 'n' Bake | Radioactive |
| Gambit | gambit | Chess | 2005 |
| Scrapyard | scrapyard | Chop Shop | 2005 |
| Turntable | turntable | Spin Zone | 2005 |
| Strongroom | strongroom | Vault | 2005 |
| Summit | summit | King of the Hill | Origins '99 promo |

## Icon legend used for transcription
red round disc = teleporter; red/black starburst = repulsor; colored hexagon =
portal; blue cog with green arrows = clockwise gear, red/lavender = counter-
clockwise; numbered hazard pit = trapdoor; numbered crosshair/grille disc =
crusher; numbered striped bar = pusher; numbered flame = flamer; wrench or
crossed wrench+hammer = repair; chop shop = floor. Merge squares are encoded as
a curve for the side branch (engine rotates only entrants across the entry edge).

## House rules (Todd to review): oil, water/current, whirlpool, steep ledge
See docs/game_mechanics_md.md "House rules". Built as proposed in amendment 32997.

## Legal-distance tweaks — NOT applied (Todd wants the originals; friends-only play)
Kept here in case the game ever goes public. Default option: mirror each board
east-west (gameplay identical, every square moves). Plus one optional
single-square change per board:
Packing Plant: drop 1 crusher on the belt column. Crossroads: move a wrench 1
square. Switchyard: one gear flips spin. Atoll: one corner pit → floor. Spiral
Mill: move one laser 1 square. Sinkhole Grid: one pit → trapdoor. The Rift: one
teleporter → floor. Short Circuit: one crusher changes register. The Ring: one
crusher → floor. Spillway: one whirlpool → plain water. Cog Yard: one gear flips
spin. Beam Lattice: one laser 1→2 strength. Far Straight: one oil slick a square
shorter. Gorge Run: one portal pair recolored. Service Lane: one pusher's
registers swap. Smelter: one flamer's registers shift. Tool Room: one oil slick
→ floor. Windmill / Hot Zone / Rattle Oven: rename only. Gambit: move a wrench 1
square. Scrapyard: one pit → floor. Turntable: one gear flips spin. Strongroom:
drop one laser. Summit: move one ramp square.

## Verification fixes at registry time (2026-10-21, commit 751fc30)

- Spiral Mill: added the missing mount wall `9,11 S` (every other edge pusher
  had one; 180° partner `9,0 N` exists).
- Far Straight + Service Lane: pushers print with their wall stripe in the
  art and no separate wall, so mount walls were added under each pusher.
- Summit / Gorge Run plateau rails kept as plain two-way walls (gaps at the
  ramps); Summit centre uses `steep`. One-way-ledge alternative is a question
  on Todd's Review card (notes/review/2026-10-21-drone-derby-25-boards-in-ok-the-house-rules.md, Pantheon).
- Spillway whirlpool spin direction (all W-) is a guess; the art has no arrows.
