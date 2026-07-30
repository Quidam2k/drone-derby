// Authentic boards, transcribed cell-by-cell from Todd's photographs of the
// physical 1994-era RoboRally expansion boards (input/reference_photos/,
// perspective-corrected crops; method + verification notes in
// notes/2026-07-29-authentic-boards-session.md).
//
// The printed boards carry no spawn docks and no numbered flags — docks and
// flag placement are scenario setup in the physical game. Each factory here
// is the bare 12×12 factory floor; BUILTIN_BOARDS composes it above the
// shared dockyard() and our own checkpoint placements provide the race
// (cheap to adjust when official scenario photos arrive).
//
// House substitutions (option cards are permanently cut — see
// cascades/2026-07-29-authentic-boards.md):
//   - chop shops → plain floor
//   - waste's option-card draw → damage only
//   - crossed wrench+hammer sites → plain wrench (repair keeps, option cut)
//   - Reactor Core's impenetrable core → fully-walled cells

import type { BoardDef, Direction } from './types';
import { emptyBoard, setTile } from './board';

type Curve = 'cw' | 'ccw';

/**
 * REACTOR CORE (RoboRally: Radioactive, 12×12).
 *
 * The whole floor is irradiated: every tile is radiation (1 damage if you
 * end the TURN on it) except ten bare-metal "rest pocket" tiles, the waste
 * cross around the core (1 damage per register ended there), four drains,
 * four teleporters and the belts. The reactor itself is an impenetrable
 * 2×2 block. Sixteen one-way walls guard the pockets: a pocket can always
 * be LEFT, but belts and floors next to a marker cannot push into it.
 * Four belt lines run the compass: each feeds a teleporter from one side
 * of the board and resumes on the far side as an outbound run straight
 * off the rim.
 *
 * Layout sketch (x → E, y → S; R = radiation everywhere unmarked):
 *   y=0..2  belt N at x=3 (exits the north rim); belt S at x=8 (feeds the
 *           (8,3) teleporter); wrench (1,1); crossed wrench (10,1);
 *           pockets (4,1),(7,1),(2,2),(9,2); waste (5..6,1)
 *   y=3     belts E x=0..2 → teleporter (3,3); drain (7,3);
 *           teleporter (8,3); belts E x=9..11 (exit the east rim)
 *   y=4..8  the waste cross: rows 4–8 around the walled 2×2 core at
 *           (5..6,5..6); drains (9,5),(3,6),(6,7); pockets (2,5),(9,6);
 *           waste arms reach the west rim on row 6 and the east rim on
 *           row 5 (waste barrels are printed art, no mechanics)
 *   y=8     belts W x=9..11 → teleporter (8,8); belts W x=0..2 (exit the
 *           west rim); teleporter (3,8)
 *   y=9..11 belt N at x=3 (feeds (3,8)); belt S at x=8 (exits the south
 *           rim); pockets (2,9),(9,9),(4,10),(7,10); waste (5..6,10);
 *           crossed wrench (1,10); wrench (10,10)
 *   flags (ours): 1 at (6,9), 2 in pocket (2,2) — enter it from N/W only,
 *   the one-ways seal the other approaches — 3 at (9,4) beside the core.
 */
export function reactorCore(): BoardDef {
  const board = emptyBoard('Reactor Core', 12, 12);

  // Radiation everywhere; carve the exceptions out below.
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) setTile(board, x, y, { kind: 'radiation' });
  }

  // Bare-metal rest pockets (safe floor).
  const pockets: [number, number][] = [
    [4, 1], [7, 1], [2, 2], [9, 2], [2, 5], [9, 6], [2, 9], [9, 9], [4, 10], [7, 10],
  ];
  for (const [x, y] of pockets) setTile(board, x, y, { kind: 'floor' });

  // The waste cross and outlying patches.
  const waste: [number, number][] = [
    [5, 1], [6, 1],
    [4, 3], [5, 3], [6, 3],
    [3, 4], [4, 4], [5, 4], [6, 4], [7, 4], [8, 4],
    [3, 5], [4, 5], [7, 5], [8, 5], [10, 5], [11, 5],
    [0, 6], [1, 6], [2, 6], [4, 6], [7, 6], [8, 6],
    [3, 7], [4, 7], [5, 7], [7, 7], [8, 7],
    [4, 8], [5, 8], [6, 8], [7, 8],
    [5, 10], [6, 10],
  ];
  for (const [x, y] of waste) setTile(board, x, y, { kind: 'waste' });

  // Drains: pits wearing grates.
  for (const [x, y] of [[7, 3], [9, 5], [3, 6], [6, 7]] as const) {
    setTile(board, x, y, { kind: 'pit', style: 'drain' });
  }

  // Teleporters at the four belt terminals.
  for (const [x, y] of [[3, 3], [8, 3], [3, 8], [8, 8]] as const) {
    setTile(board, x, y, { kind: 'teleporter' });
  }

  // The reactor: a walled-off 2×2. Plain floor inside; the wall ring below
  // makes it unreachable (and blocks lasers), matching the printed art.
  for (const [x, y] of [[5, 5], [6, 5], [5, 6], [6, 6]] as const) {
    setTile(board, x, y, { kind: 'floor' });
  }

  // Belt lines (all normal speed, single-arrow on the printed board).
  const belts: [number, number, Direction][] = [
    [3, 0, 'N'], [3, 1, 'N'], [3, 2, 'N'], // out the north rim
    [8, 0, 'S'], [8, 1, 'S'], [8, 2, 'S'], // into teleporter (8,3)
    [0, 3, 'E'], [1, 3, 'E'], [2, 3, 'E'], // into teleporter (3,3)
    [9, 3, 'E'], [10, 3, 'E'], [11, 3, 'E'], // out the east rim
    [0, 8, 'W'], [1, 8, 'W'], [2, 8, 'W'], // out the west rim
    [9, 8, 'W'], [10, 8, 'W'], [11, 8, 'W'], // into teleporter (8,8)
    [3, 9, 'N'], [3, 10, 'N'], [3, 11, 'N'], // into teleporter (3,8)
    [8, 9, 'S'], [8, 10, 'S'], [8, 11, 'S'], // out the south rim
  ];
  for (const [x, y, dir] of belts) {
    setTile(board, x, y, { kind: 'conveyor', dir, express: false });
  }

  // Repair sites. The crossed wrench-and-hammer sites at (10,1)/(1,10) are
  // option-card sites in the printed game; the option half is cut, the
  // repair half stays — plain wrenches here.
  for (const [x, y] of [[1, 1], [10, 1], [1, 10], [10, 10]] as const) {
    setTile(board, x, y, { kind: 'wrench' });
  }

  // Our flag placements (the printed board has none).
  setTile(board, 6, 9, { kind: 'checkpoint', n: 1 });
  setTile(board, 2, 2, { kind: 'checkpoint', n: 2 });
  setTile(board, 9, 4, { kind: 'checkpoint', n: 3 });

  board.walls = [
    // The reactor's impenetrable shell.
    { x: 5, y: 5, side: 'N' }, { x: 6, y: 5, side: 'N' },
    { x: 5, y: 6, side: 'S' }, { x: 6, y: 6, side: 'S' },
    { x: 5, y: 5, side: 'W' }, { x: 5, y: 6, side: 'W' },
    { x: 6, y: 5, side: 'E' }, { x: 6, y: 6, side: 'E' },
    // One-way walls (16). Stored on the RED-side cell with oneWay 'out':
    // that cell cannot cross the edge; the far side passes freely. Every
    // marker guards a rest pocket or fences a belt line.
    { x: 3, y: 2, side: 'W', oneWay: 'out' },  // belt ↛ pocket (2,2)
    { x: 2, y: 3, side: 'N', oneWay: 'out' },  // belt row ↛ pocket (2,2)
    { x: 4, y: 2, side: 'N', oneWay: 'out' },  // floor ↛ pocket (4,1)
    { x: 7, y: 2, side: 'N', oneWay: 'out' },  // floor ↛ pocket (7,1)
    { x: 8, y: 2, side: 'E', oneWay: 'out' },  // belt ↛ pocket (9,2)
    { x: 9, y: 3, side: 'N', oneWay: 'out' },  // belt row ↛ pocket (9,2)
    { x: 3, y: 5, side: 'W', oneWay: 'out' },  // waste ↛ pocket (2,5)
    { x: 8, y: 6, side: 'E', oneWay: 'out' },  // waste ↛ pocket (9,6)
    { x: 2, y: 8, side: 'S', oneWay: 'out' },  // belt ↛ pocket (2,9)
    { x: 3, y: 9, side: 'W', oneWay: 'out' },  // belt ↛ pocket (2,9)
    { x: 3, y: 9, side: 'E', oneWay: 'out' },  // belt ↛ floor (4,9)
    { x: 9, y: 8, side: 'S', oneWay: 'out' },  // belt ↛ pocket (9,9)
    { x: 8, y: 9, side: 'E', oneWay: 'out' },  // belt ↛ pocket (9,9)
    { x: 4, y: 9, side: 'S', oneWay: 'out' },  // floor ↛ pocket (4,10)
    { x: 7, y: 9, side: 'S', oneWay: 'out' },  // floor ↛ pocket (7,10)
    { x: 3, y: 10, side: 'E', oneWay: 'out' }, // belt ↛ pocket (4,10)
  ];

  board.lasers = [];

  return board;
}

/**
 * GEAR BOX (12×12). Twenty gears — the central 4×2-and-friends cluster
 * alternates spin like real meshed gearwork — ringed by belt lines that
 * feed three corner teleporters, twelve pit cells (one printed as a single
 * 2-cell-wide chasm), eleven repulsor fields, and five wall-mounted lasers
 * including two DOUBLE mounts (strength 2): one guarding the north-west
 * approach, one firing wall-to-wall across a single cell — a cage anyone
 * shoved onto (8,8) regrets. Plain walls only; the holes here are honest
 * open pits (the covered, scheduled trap-doors live on Pinwheel and
 * Shake 'n' Bake).
 *
 * Layout sketch (x → E, y → S):
 *   y=0..2  teleporters (0,0)/(11,0); belt run (10,0)N out the rim; pits
 *           (2,0),(4,0),(8,1),(10,1) — (11,1)W belt-feeds the (10,1) pit;
 *           double laser (2,1)E → wall E of (4,1); repulsors (7,0),(1,1),
 *           (9,2); wrench (9,1)
 *   y=2..4  the twin belt spirals: (5,x)S line bending W→S→E into the
 *           gear cluster, (7,4)N start bending W→N out the north rim;
 *           gears begin; crossed wrench (2,3); the 2-cell pit (5..6,3);
 *           lasers (8,3)E and (9,4)E (walled pocket beside pit (10,4))
 *   y=5..6  belt belts W (row 5) and E (row 6) sandwich the gear cluster;
 *           mid-band walls S of (2,5),(3,5)
 *   y=7..9  gears taper off; crossed wrench (7,7); laser cage (8,8)E
 *           between its own walls; laser (10,7)E; repulsor field cluster
 *           SW: (0,8),(1,8),(3,8); pits (2,7),(4,7),(2,9),(4,9)
 *   y=10,11 teleporter (10,10) fed by (10,11)N; belts (0,10)E, (1,11)S,
 *           (11,10)E; repulsors (1,10),(3,10),(11,11) and the walled-off
 *           repulsor alcove (3,11); wrench (0,11); walled slot (8,10..11)
 *   flags (ours): 1 at (2,10) between the repulsor pair, 2 at (9,0)
 *   behind the pit row beside the wrench, 3 at (0,4) across the gearwork.
 */
export function gearBox(): BoardDef {
  const board = emptyBoard('Gear Box', 12, 12);

  // Pits — all open holes; (5,3)+(6,3) is the printed double-wide chasm.
  const pits: [number, number][] = [
    [2, 0], [4, 0], [8, 1], [10, 1], [5, 3], [6, 3], [8, 4], [10, 4],
    [2, 7], [4, 7], [2, 9], [4, 9],
  ];
  for (const [x, y] of pits) setTile(board, x, y, { kind: 'pit' });

  // Repulsor fields.
  const repulsors: [number, number][] = [
    [7, 0], [1, 1], [9, 2], [0, 8], [1, 8], [3, 8], [8, 9], [1, 10],
    [3, 10], [11, 11], [3, 11],
  ];
  for (const [x, y] of repulsors) setTile(board, x, y, { kind: 'repulsor' });

  // Teleporters (three — the SW corner has none).
  for (const [x, y] of [[0, 0], [11, 0], [10, 10]] as const) {
    setTile(board, x, y, { kind: 'teleporter' });
  }

  // Gears: the meshed cluster alternates CW/CCW like real gearwork.
  const gearsCW: [number, number][] = [
    [1, 2], [3, 2], [0, 3], [1, 4], [3, 4], [5, 4], [4, 5], [6, 5],
    [5, 6], [7, 6], [6, 7],
  ];
  const gearsCCW: [number, number][] = [
    [6, 4], [5, 5], [7, 5], [6, 6], [8, 6], [5, 7], [2, 8], [7, 10], [2, 11],
  ];
  for (const [x, y] of gearsCW) setTile(board, x, y, { kind: 'gear', cw: true });
  for (const [x, y] of gearsCCW) setTile(board, x, y, { kind: 'gear', cw: false });

  // Belts (all normal speed). Two spiral lines thread the north half:
  // the (5,x) southbound line bends W then S then E into the gear cluster;
  // the (7,x)/(6,x) northbound line bends W then N and exits the rim.
  const belts: [number, number, Direction, Curve?][] = [
    [1, 0, 'S'], [0, 1, 'W'],
    [5, 0, 'S'], [5, 1, 'S'], [5, 2, 'W', 'cw'], [4, 2, 'S', 'ccw'],
    [4, 3, 'S'], [4, 4, 'E', 'ccw'],
    [7, 4, 'N'], [7, 3, 'N'], [7, 2, 'W', 'ccw'], [6, 2, 'N', 'cw'],
    [6, 1, 'N'], [6, 0, 'N'],
    [3, 3, 'S'],
    [10, 0, 'N'], [11, 1, 'W'],
    [0, 5, 'W'], [1, 5, 'W'], [2, 5, 'W'], [3, 5, 'W'],
    [8, 5, 'W'], [9, 5, 'W'], [10, 5, 'W'], [11, 5, 'W'],
    [0, 6, 'E'], [1, 6, 'E'], [2, 6, 'E'], [3, 6, 'E'], [4, 6, 'E'],
    [9, 6, 'E'], [10, 6, 'E'], [11, 6, 'E'],
    [5, 8, 'S'], [5, 9, 'S'], [5, 10, 'S'], [5, 11, 'S'],
    [6, 11, 'N'], [6, 10, 'N'], [6, 9, 'N'], [6, 8, 'N'],
    [0, 10, 'E'], [1, 11, 'S'], [10, 11, 'N'], [11, 10, 'E'],
  ];
  for (const [x, y, dir, curve] of belts) {
    setTile(board, x, y, curve
      ? { kind: 'conveyor', dir, express: false, curve }
      : { kind: 'conveyor', dir, express: false });
  }

  // Repair sites: two plain wrenches, two crossed wrench-and-hammer sites
  // (option half cut — plain repair here).
  for (const [x, y] of [[9, 1], [2, 3], [7, 7], [0, 11]] as const) {
    setTile(board, x, y, { kind: 'wrench' });
  }

  // Our flag placements (the printed board has none).
  setTile(board, 2, 10, { kind: 'checkpoint', n: 1 });
  setTile(board, 9, 0, { kind: 'checkpoint', n: 2 });
  setTile(board, 0, 4, { kind: 'checkpoint', n: 3 });

  board.walls = [
    { x: 2, y: 1, side: 'W' },  // double-laser mount
    { x: 4, y: 1, side: 'E' },  // stops its beams
    { x: 9, y: 0, side: 'N' },  // rim rail
    { x: 8, y: 3, side: 'W' },  // laser mount
    { x: 9, y: 4, side: 'W' },  // laser mount
    { x: 10, y: 4, side: 'W' }, // pit guard; stops the (9,4) beam
    { x: 2, y: 5, side: 'S' },  // mid-band walls between the belt rows
    { x: 3, y: 5, side: 'S' },
    { x: 0, y: 7, side: 'N' },
    { x: 0, y: 7, side: 'W' },  // rim rail
    { x: 1, y: 8, side: 'W' },
    { x: 2, y: 8, side: 'N' },
    { x: 8, y: 8, side: 'W' },  // the laser cage
    { x: 8, y: 8, side: 'E' },
    { x: 10, y: 7, side: 'W' }, // laser mount
    { x: 10, y: 8, side: 'S' },
    { x: 8, y: 10, side: 'N' }, // the walled slot at (8,10..11)
    { x: 8, y: 11, side: 'W' },
    { x: 8, y: 11, side: 'E' },
    { x: 8, y: 11, side: 'S' }, // rim rail
    { x: 3, y: 11, side: 'N' }, // the sealed repulsor alcove
    { x: 3, y: 11, side: 'W' },
    { x: 3, y: 11, side: 'E' },
    { x: 0, y: 4, side: 'W' },  // rim rail
  ];

  board.lasers = [
    { pos: { x: 2, y: 1 }, facing: 'E', strength: 2 }, // double mount
    { pos: { x: 8, y: 3 }, facing: 'E', strength: 1 },
    { pos: { x: 9, y: 4 }, facing: 'E', strength: 1 },
    { pos: { x: 10, y: 7 }, facing: 'E', strength: 1 },
    { pos: { x: 8, y: 8 }, facing: 'E', strength: 2 }, // the cage
  ];

  return board;
}

/**
 * PINWHEEL (12×12). Four normal-speed belt spokes, each turning LEFT at a
 * curve, spin the whole floor counterclockwise: ride any spoke and you're
 * flung down the next. The board is exactly 180°-rotationally symmetric.
 * Radiation blocks fill two opposite corners, each with a waste pool and a
 * purple portal on its edge — the portal pair links the corners. Two
 * flamers guard the spokes (the printed flame spans two squares: a jet cell
 * at the wall nozzle and the numbered fireball beyond — both burn), two
 * DOUBLE lasers cross the middle fired from wall mounts beside the chop
 * shops, and eight trap-door pits pepper the approaches. Express singles in
 * the other two corners feed a CW gear each. No plain walls at all — just
 * the four mounts.
 *
 * Layout sketch (x → E, y → S):
 *   y=0..2  NW radiation block cols 0-3 (waste pool (0..2,1), purple portal
 *           (3,1) on its rim); flamer ball (5,1) + jet (5,2), regs 1/2/4,
 *           nozzle wall S of (5,2); belt N col 6; belt S col 8; express N
 *           (10,0) feeding gear CW (10,1); express W (11,1); wrench (10,2)
 *   y=3     belt E cols 0-5 → ccw curve (6,3) up col 6; trapdoor (7,3)[2]
 *   y=4     trapdoors (3,4)[1,5] (4,4)[3] (7,4)[4]; chop shop (5,4) → floor;
 *           double laser E from wall W of (6,4), beams cross cols 6-11
 *   y=5     belt W cols 0-2 ← ccw curve (3,5) off col 3's northbound line
 *   y=6     belt E cols 9-11 ← ccw curve (8,6) off col 8's southbound line
 *   y=7     trapdoors (4,7)[2] (7,7)[1] (8,7)[3,5]; chop shop (6,7) → floor;
 *           double laser W from wall E of (5,7), beams cross cols 0-5
 *   y=8     belt W cols 6-11 → ccw curve (5,8) down col 5
 *   y=9..11 SE radiation block cols 8-11 (waste pool (9..11,10), purple
 *           portal (8,10)); flamer ball (6,10) + jet (6,9), regs 2/4/5,
 *           nozzle wall N of (6,9); wrench (1,9); gear CW (1,10) fed by
 *           express E (0,10); express S (1,11)
 *   flags (ours): 1 at (9,7), 2 at (2,4), 3 at (9,2) — a counterclockwise
 *   tour with the spin.
 */
export function pinwheel(): BoardDef {
  const board = emptyBoard('Pinwheel', 12, 12);

  // Radiation corner blocks (the mossy green fields; fuzzy printed edges
  // resolved per-cell with a green-fraction classifier over the photo).
  const radiation: [number, number][] = [
    [0, 0], [1, 0], [2, 0], [3, 0], [0, 2], [1, 2], [2, 2], [3, 2],
    [8, 9], [9, 9], [10, 9], [11, 9], [8, 11], [9, 11], [10, 11], [11, 11],
  ];
  for (const [x, y] of radiation) setTile(board, x, y, { kind: 'radiation' });

  // Waste pools (skull-textured bright green, barrels are art).
  const waste: [number, number][] = [
    [0, 1], [1, 1], [2, 1], [9, 10], [10, 10], [11, 10],
  ];
  for (const [x, y] of waste) setTile(board, x, y, { kind: 'waste' });

  // The purple portal pair linking the two radiation corners.
  setTile(board, 3, 1, { kind: 'portal', color: 'purple' });
  setTile(board, 8, 10, { kind: 'portal', color: 'purple' });

  // The pinwheel: four normal-speed spokes, every curve a left turn (ccw).
  const belts: [number, number, Direction, Curve?][] = [
    [6, 0, 'N'], [6, 1, 'N'], [6, 2, 'N'], [6, 3, 'N', 'ccw'], // exits north rim
    [0, 3, 'E'], [1, 3, 'E'], [2, 3, 'E'], [3, 3, 'E'], [4, 3, 'E'], [5, 3, 'E'],
    [8, 0, 'S'], [8, 1, 'S'], [8, 2, 'S'], [8, 3, 'S'], [8, 4, 'S'], [8, 5, 'S'],
    [8, 6, 'E', 'ccw'], [9, 6, 'E'], [10, 6, 'E'], [11, 6, 'E'], // exits east rim
    [3, 6, 'N'], [3, 7, 'N'], [3, 8, 'N'], [3, 9, 'N'], [3, 10, 'N'], [3, 11, 'N'],
    [3, 5, 'W', 'ccw'], [0, 5, 'W'], [1, 5, 'W'], [2, 5, 'W'], // exits west rim
    [6, 8, 'W'], [7, 8, 'W'], [8, 8, 'W'], [9, 8, 'W'], [10, 8, 'W'], [11, 8, 'W'],
    [5, 8, 'S', 'ccw'], [5, 9, 'S'], [5, 10, 'S'], [5, 11, 'S'], // exits south rim
  ];
  for (const [x, y, dir, curve] of belts) {
    setTile(board, x, y, curve
      ? { kind: 'conveyor', dir, express: false, curve }
      : { kind: 'conveyor', dir, express: false });
  }

  // Express singles in the NE/SW corners, each feeding its gear.
  setTile(board, 10, 0, { kind: 'conveyor', dir: 'N', express: true });
  setTile(board, 11, 1, { kind: 'conveyor', dir: 'W', express: true });
  setTile(board, 0, 10, { kind: 'conveyor', dir: 'E', express: true });
  setTile(board, 1, 11, { kind: 'conveyor', dir: 'S', express: true });

  // Both printed gears spin clockwise (mint arrows on the blue discs).
  setTile(board, 10, 1, { kind: 'gear', cw: true });
  setTile(board, 1, 10, { kind: 'gear', cw: true });

  // Trap-door pits with their printed register schedules.
  const trapdoors: [number, number, number[]][] = [
    [3, 4, [1, 5]], [4, 4, [3]], [7, 3, [2]], [7, 4, [4]],
    [4, 7, [2]], [4, 8, [4]], [7, 7, [1]], [8, 7, [3, 5]],
  ];
  for (const [x, y, registers] of trapdoors) {
    setTile(board, x, y, { kind: 'trapdoor', registers });
  }

  // Crossed wrench-and-hammer sites (option half cut — plain repair).
  setTile(board, 10, 2, { kind: 'wrench' });
  setTile(board, 1, 9, { kind: 'wrench' });

  // Chop shops at (5,4) and (6,7) print on the board; option cards are cut,
  // so they stay plain floor (house substitution).

  // Our flag placements (the printed board has none).
  setTile(board, 9, 7, { kind: 'checkpoint', n: 1 });
  setTile(board, 2, 4, { kind: 'checkpoint', n: 2 });
  setTile(board, 9, 2, { kind: 'checkpoint', n: 3 });

  board.walls = [
    { x: 6, y: 4, side: 'W' }, // double-laser mount, fires E
    { x: 5, y: 7, side: 'E' }, // double-laser mount, fires W
    { x: 5, y: 2, side: 'S' }, // flamer nozzle wall (flame shoots N over it)
    { x: 6, y: 9, side: 'N' }, // flamer nozzle wall (flame shoots S over it)
  ];

  board.lasers = [
    { pos: { x: 6, y: 4 }, facing: 'E', strength: 2 },
    { pos: { x: 5, y: 7 }, facing: 'W', strength: 2 },
  ];

  // Each printed flame spans two squares — the jet at the nozzle and the
  // numbered ball beyond. Both burn on the printed registers.
  board.flamers = [
    { pos: { x: 5, y: 1 }, registers: [1, 2, 4] }, // ball
    { pos: { x: 5, y: 2 }, registers: [1, 2, 4] }, // jet
    { pos: { x: 6, y: 9 }, registers: [2, 4, 5] }, // jet
    { pos: { x: 6, y: 10 }, registers: [2, 4, 5] }, // ball
  ];

  return board;
}

/**
 * SHAKE 'N' BAKE (12×12). An all-express factory built around a four-flamer
 * oven in the center 2×2. Twelve express lines lace the floor and every one
 * of them, followed far enough, delivers you INTO the middle: the four
 * cardinal feeds dead-end at the oven with one-way walls for doors — green
 * side out, so belts and walkers pass inward freely and nothing walks back
 * out. Eight more one-ways ring the approaches (row 3 can't back out north,
 * row 8 can't back out south, cols 3/8 can't back out west/east). Two
 * portal pairs (blue and orange) are the only shortcuts across, and eight
 * trap-door pits — in stacked pairs by each portal — punish the detours.
 * The board is exactly 180°-rotationally symmetric. No lasers, no gears,
 * no plain walls, no pits: heat and momentum do all the work.
 *
 * Layout sketch (x → E, y → S):
 *   cols 1/5/8 run express S from the north rim, cols 3/6/10 express N from
 *   the south rim; rows 1/5/8 run express W from the east rim, rows 3/6/10
 *   express E from the west rim. Six printed curves splice them: (5,3) E→S,
 *   (8,1) W→S, (8,5) S→W, (3,6) N→E, (6,8) W→N, (3,10) E→N.
 *   y=1     blue portal (2,1); trapdoors (3,1)[1,5] (4,1)[2,3,4]
 *   y=2..3  one-ways N of (6,3)/(7,3); wrench (7,3); orange portal (10,2)
 *   y=3..4  trapdoors (10,3)[1,2,4] (10,4)[2,3,5]; chop shop (3,4) → floor;
 *           one-ways W of (3,4)/(3,5)
 *   y=5..6  the oven: flamers (5,5)[1,4] (6,5)[1,3,5] (5,6)[2,4] (6,6)[2,5];
 *           oven doors: one-ways N of (5,5), E of (6,5), W of (5,6),
 *           S of (6,6); one-ways E of (8,6)/(8,7)
 *   y=7..8  trapdoors (1,7)[1,2,4] (1,8)[2,3,5]; wrench (4,8); chop shop
 *           (8,7) → floor; one-ways S of (4,8)/(5,8)
 *   y=9..10 orange portal (1,9); blue portal (9,10); trapdoors
 *           (7,10)[1,3,5] (8,10)[2,4]
 *   flags (ours): 1 at (2,9), 2 at (9,2), 3 at (0,5) — two long diagonals
 *   past the oven and back.
 */
export function shakeNBake(): BoardDef {
  const board = emptyBoard("Shake 'n' Bake", 12, 12);

  // Every belt on this board is express. Twelve lines, six printed curves.
  const belts: [number, number, Direction, Curve?][] = [
    [1, 0, 'S'], [1, 1, 'S'], [1, 2, 'S'],
    [5, 0, 'S'], [5, 1, 'S'], [5, 2, 'S'], [5, 3, 'S', 'cw'], [5, 4, 'S'],
    [8, 0, 'S'], [8, 1, 'S', 'ccw'], [8, 2, 'S'], [8, 3, 'S'], [8, 4, 'S'],
    [9, 1, 'W'], [10, 1, 'W'], [11, 1, 'W'],
    [0, 3, 'E'], [1, 3, 'E'], [2, 3, 'E'], [3, 3, 'E'], [4, 3, 'E'],
    [7, 5, 'W'], [8, 5, 'W', 'cw'], [9, 5, 'W'], [10, 5, 'W'], [11, 5, 'W'],
    [0, 6, 'E'], [1, 6, 'E'], [2, 6, 'E'], [3, 6, 'E', 'cw'], [4, 6, 'E'],
    [3, 7, 'N'], [3, 8, 'N'], [3, 9, 'N'], [3, 10, 'N', 'ccw'], [3, 11, 'N'],
    [6, 7, 'N'], [6, 8, 'N', 'cw'], [6, 9, 'N'], [6, 10, 'N'], [6, 11, 'N'],
    [7, 8, 'W'], [8, 8, 'W'], [9, 8, 'W'], [10, 8, 'W'], [11, 8, 'W'],
    [0, 10, 'E'], [1, 10, 'E'], [2, 10, 'E'],
    [10, 9, 'N'], [10, 10, 'N'], [10, 11, 'N'],
  ];
  for (const [x, y, dir, curve] of belts) {
    setTile(board, x, y, curve
      ? { kind: 'conveyor', dir, express: true, curve }
      : { kind: 'conveyor', dir, express: true });
  }

  // Portal pairs: blue and orange, each linking opposite quadrants.
  setTile(board, 2, 1, { kind: 'portal', color: 'blue' });
  setTile(board, 9, 10, { kind: 'portal', color: 'blue' });
  setTile(board, 10, 2, { kind: 'portal', color: 'orange' });
  setTile(board, 1, 9, { kind: 'portal', color: 'orange' });

  // Trap-door pits, in pairs beside each portal.
  const trapdoors: [number, number, number[]][] = [
    [3, 1, [1, 5]], [4, 1, [2, 3, 4]],
    [10, 3, [1, 2, 4]], [10, 4, [2, 3, 5]],
    [1, 7, [1, 2, 4]], [1, 8, [2, 3, 5]],
    [7, 10, [1, 3, 5]], [8, 10, [2, 4]],
  ];
  for (const [x, y, registers] of trapdoors) {
    setTile(board, x, y, { kind: 'trapdoor', registers });
  }

  // Crossed wrench-and-hammer sites (option half cut — plain repair).
  setTile(board, 7, 3, { kind: 'wrench' });
  setTile(board, 4, 8, { kind: 'wrench' });

  // Chop shops at (3,4) and (8,7) print on the board; option cards are cut,
  // so they stay plain floor (house substitution).

  // Our flag placements (the printed board has none).
  setTile(board, 2, 9, { kind: 'checkpoint', n: 1 });
  setTile(board, 9, 2, { kind: 'checkpoint', n: 2 });
  setTile(board, 0, 5, { kind: 'checkpoint', n: 3 });

  // One-way walls, stored on the RED-side cell with 'out': that cell cannot
  // cross this edge, the green side passes freely. Four oven doors plus
  // eight approach valves — inward is always open.
  board.walls = [
    { x: 6, y: 3, side: 'N', oneWay: 'out' },
    { x: 7, y: 3, side: 'N', oneWay: 'out' },
    { x: 3, y: 4, side: 'W', oneWay: 'out' },
    { x: 3, y: 5, side: 'W', oneWay: 'out' },
    { x: 8, y: 6, side: 'E', oneWay: 'out' },
    { x: 8, y: 7, side: 'E', oneWay: 'out' },
    { x: 4, y: 8, side: 'S', oneWay: 'out' },
    { x: 5, y: 8, side: 'S', oneWay: 'out' },
    { x: 5, y: 5, side: 'N', oneWay: 'out' }, // the oven doors
    { x: 6, y: 5, side: 'E', oneWay: 'out' },
    { x: 5, y: 6, side: 'W', oneWay: 'out' },
    { x: 6, y: 6, side: 'S', oneWay: 'out' },
  ];

  board.lasers = [];

  // The oven: four flamers whose schedules overlap so something is always
  // hot — register 1 through 5 never goes dark.
  board.flamers = [
    { pos: { x: 5, y: 5 }, registers: [1, 4] },
    { pos: { x: 6, y: 5 }, registers: [1, 3, 5] },
    { pos: { x: 5, y: 6 }, registers: [2, 4] },
    { pos: { x: 6, y: 6 }, registers: [2, 5] },
  ];

  return board;
}
