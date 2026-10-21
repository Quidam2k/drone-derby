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
  const board = emptyBoard('Hot Zone', 12, 12);

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
  const board = emptyBoard('Rattle Oven', 12, 12);

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
