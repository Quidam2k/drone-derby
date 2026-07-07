import type { BoardDef, Direction } from './types';
import { emptyBoard, setTile } from './board';

/**
 * Built-in 10×10 board exercising every element: 4 spawn docks, 3 checkpoints,
 * a pit, normal + express conveyors, both gear spins, walls, 2 board lasers.
 * Used by the engine test suite now and by hot-seat play in Phase 2.
 *
 * Layout sketch (x → E, y → S):
 *   y=1  checkpoint 3 at (8,1)
 *   y=2  checkpoint 2 at (1,2), wall S of (8,2)
 *   y=3  laser emitter at (0,3) firing E; express conveyor N at (6,3)
 *   y=4  gear CW (2,4), express conveyor N (6,4), gear CCW (7,4), wall N of (1,4)
 *   y=5  pit at (4,5)
 *   y=6  checkpoint 1 at (8,6)
 *   y=7  conveyors E at (2..4,7), wall E of (5,7)
 *   y=8  laser emitter at (9,8) firing W
 *   y=9  spawns 1–4 at x = 1,3,5,7
 */
export function provingGrounds(): BoardDef {
  const board = emptyBoard('Proving Grounds', 10, 10);

  setTile(board, 1, 9, { kind: 'spawn', n: 1 });
  setTile(board, 3, 9, { kind: 'spawn', n: 2 });
  setTile(board, 5, 9, { kind: 'spawn', n: 3 });
  setTile(board, 7, 9, { kind: 'spawn', n: 4 });

  setTile(board, 8, 6, { kind: 'checkpoint', n: 1 });
  setTile(board, 1, 2, { kind: 'checkpoint', n: 2 });
  setTile(board, 8, 1, { kind: 'checkpoint', n: 3 });

  setTile(board, 4, 5, { kind: 'pit' });

  setTile(board, 2, 7, { kind: 'conveyor', dir: 'E', express: false });
  setTile(board, 3, 7, { kind: 'conveyor', dir: 'E', express: false });
  setTile(board, 4, 7, { kind: 'conveyor', dir: 'E', express: false });
  setTile(board, 6, 4, { kind: 'conveyor', dir: 'N', express: true });
  setTile(board, 6, 3, { kind: 'conveyor', dir: 'N', express: true });

  setTile(board, 2, 4, { kind: 'gear', cw: true });
  setTile(board, 7, 4, { kind: 'gear', cw: false });

  board.walls = [
    { x: 1, y: 4, side: 'N' },
    { x: 5, y: 7, side: 'E' },
    { x: 8, y: 2, side: 'S' },
  ];

  board.lasers = [
    { pos: { x: 0, y: 3 }, facing: 'E', strength: 1 },
    { pos: { x: 9, y: 8 }, facing: 'W', strength: 1 },
  ];

  return board;
}

/**
 * Built-in 12×10 board about one thing: a clockwise conveyor loop circling
 * the middle. Riding the loop is the fast way between checkpoints; walking
 * around it is slow but dodges the crossfire lasers sweeping rows 4 and 5.
 * Express lanes feed the loop from the north and south, gears sit on the
 * loop's outside corners, a pit and checkpoint 3 wait inside the ring.
 *
 * Layout sketch (x → E, y → S):
 *   y=1..2 express feeder S at (6,1..2) into the loop; gears CW (2,2) / CCW (9,2)
 *   y=2    checkpoint 1 at (10,2), wall S of it
 *   y=3    loop top: belts E at (3..7,3), corner S at (8,3)
 *   y=4    loop sides N (3,4) / S (8,4); pit (6,4); laser (0,4) firing E
 *   y=5    loop sides N (3,5) / S (8,5); checkpoint 3 at (5,5) with wall S;
 *          laser (11,5) firing W
 *   y=6    loop bottom: corner N (3,6), belts W at (4..7,6), corner W (8,6)
 *   y=7    checkpoint 2 at (1,7) with wall E; gears CCW (2,7) / CW (9,7);
 *          express feeder N at (5,7..8) into the loop
 *   y=9    spawns 1–4 at x = 2,4,7,9
 */
export function spinCycle(): BoardDef {
  const board = emptyBoard('Spin Cycle', 12, 10);

  setTile(board, 2, 9, { kind: 'spawn', n: 1 });
  setTile(board, 4, 9, { kind: 'spawn', n: 2 });
  setTile(board, 7, 9, { kind: 'spawn', n: 3 });
  setTile(board, 9, 9, { kind: 'spawn', n: 4 });

  setTile(board, 10, 2, { kind: 'checkpoint', n: 1 });
  setTile(board, 1, 7, { kind: 'checkpoint', n: 2 });
  setTile(board, 5, 5, { kind: 'checkpoint', n: 3 });

  setTile(board, 6, 4, { kind: 'pit' });

  // The loop: a clockwise ring of normal belts around the 6×4 center block.
  const ring: [number, number, Direction][] = [
    [3, 3, 'E'], [4, 3, 'E'], [5, 3, 'E'], [6, 3, 'E'], [7, 3, 'E'], [8, 3, 'S'],
    [8, 4, 'S'], [8, 5, 'S'], [8, 6, 'W'],
    [7, 6, 'W'], [6, 6, 'W'], [5, 6, 'W'], [4, 6, 'W'], [3, 6, 'N'],
    [3, 5, 'N'], [3, 4, 'N'],
  ];
  for (const [x, y, dir] of ring) {
    setTile(board, x, y, { kind: 'conveyor', dir, express: false });
  }

  // Express on-ramps into the loop from the north and south.
  setTile(board, 6, 1, { kind: 'conveyor', dir: 'S', express: true });
  setTile(board, 6, 2, { kind: 'conveyor', dir: 'S', express: true });
  setTile(board, 5, 7, { kind: 'conveyor', dir: 'N', express: true });
  setTile(board, 5, 8, { kind: 'conveyor', dir: 'N', express: true });

  setTile(board, 2, 2, { kind: 'gear', cw: true });
  setTile(board, 9, 2, { kind: 'gear', cw: false });
  setTile(board, 2, 7, { kind: 'gear', cw: false });
  setTile(board, 9, 7, { kind: 'gear', cw: true });

  board.walls = [
    { x: 10, y: 2, side: 'S' },
    { x: 1, y: 7, side: 'E' },
    { x: 5, y: 5, side: 'S' },
  ];

  board.lasers = [
    { pos: { x: 0, y: 4 }, facing: 'E', strength: 1 },
    { pos: { x: 11, y: 5 }, facing: 'W', strength: 1 },
  ];

  return board;
}

/**
 * Built-in 12×12 board about one thing: walls and lasers — pick a route
 * north and pay its price. Three ways from the south spawns to the top:
 * the west lane is walled and hazard-free but long; the center gauntlet is
 * a two-lane walled corridor swept end-to-end by one laser per lane —
 * fastest walk, paid in damage; the east express belts skirt a pit column —
 * fast and free if the program is exact. Each lane of the gauntlet is
 * sealed at one end (the wall also stops that lane's beam at the corridor),
 * so a full transit must switch lanes mid-corridor. Checkpoint 2 sits
 * southwest so no single route wins all three legs.
 *
 * Layout sketch (x → E, y → S):
 *   y=1    checkpoint 1 at (5,1) at the corridor's north exit; gear CCW
 *          (6,1) in the pocket behind lane 6's sealed exit
 *   y=2    checkpoint 3 at (10,2); laser (5,2) firing S down lane 5;
 *          wall N of (6,2) seals lane 6's exit and stops its beam
 *   y=2..9 the gauntlet: lanes x=5,6, walled W of 5 and E of 6
 *   y=3..6 walls E of (1,3..6) commit the west safe lane mid-board
 *   y=4..6 pit column at (9,4..6); express belts N at (10,4..7) beside it
 *   y=7    express belt E at (9,7) bends the on-ramp around the pits
 *   y=8..9 express on-ramp N at (9,8..9)
 *   y=9    laser (6,9) firing N up lane 6; wall S of (5,9) seals lane 5's
 *          mouth and stops its beam
 *   y=10   checkpoint 2 at (1,10); gear CW (5,10) in the pocket at lane
 *          5's sealed mouth
 *   y=11   spawns 1–4 at x = 2,4,7,9
 */
export function theGauntlet(): BoardDef {
  const board = emptyBoard('The Gauntlet', 12, 12);

  setTile(board, 2, 11, { kind: 'spawn', n: 1 });
  setTile(board, 4, 11, { kind: 'spawn', n: 2 });
  setTile(board, 7, 11, { kind: 'spawn', n: 3 });
  setTile(board, 9, 11, { kind: 'spawn', n: 4 });

  setTile(board, 5, 1, { kind: 'checkpoint', n: 1 });
  setTile(board, 1, 10, { kind: 'checkpoint', n: 2 });
  setTile(board, 10, 2, { kind: 'checkpoint', n: 3 });

  // Pit column the east belt line skirts.
  setTile(board, 9, 4, { kind: 'pit' });
  setTile(board, 9, 5, { kind: 'pit' });
  setTile(board, 9, 6, { kind: 'pit' });

  // East shortcut: express on-ramp north, one bend east around the pits,
  // then express north past them toward checkpoint 3.
  const belts: [number, number, Direction][] = [
    [9, 9, 'N'], [9, 8, 'N'], [9, 7, 'E'],
    [10, 7, 'N'], [10, 6, 'N'], [10, 5, 'N'], [10, 4, 'N'],
  ];
  for (const [x, y, dir] of belts) {
    setTile(board, x, y, { kind: 'conveyor', dir, express: true });
  }

  // Rescue gears in the pockets at the sealed corridor mouths.
  setTile(board, 5, 10, { kind: 'gear', cw: true });
  setTile(board, 6, 1, { kind: 'gear', cw: false });

  board.walls = [
    // Gauntlet corridor sides, lanes x=5,6, rows y=2..9.
    ...Array.from({ length: 8 }, (_, i) => ({ x: 5, y: 2 + i, side: 'W' as Direction })),
    ...Array.from({ length: 8 }, (_, i) => ({ x: 6, y: 2 + i, side: 'E' as Direction })),
    // Mouth caps: seal one end of each lane and stop its beam there.
    { x: 5, y: 9, side: 'S' },
    { x: 6, y: 2, side: 'N' },
    // West safe lane, committed mid-board.
    { x: 1, y: 3, side: 'E' },
    { x: 1, y: 4, side: 'E' },
    { x: 1, y: 5, side: 'E' },
    { x: 1, y: 6, side: 'E' },
  ];

  board.lasers = [
    { pos: { x: 5, y: 2 }, facing: 'S', strength: 1 },
    { pos: { x: 6, y: 9 }, facing: 'N', strength: 1 },
  ];

  return board;
}

/**
 * Every built-in board, keyed by a stable id shared between the client
 * (pickers) and Convex (createGame's `builtin` arg). Entry order is the
 * display order in pickers.
 */
export const BUILTIN_BOARDS: Record<string, { name: string; factory: () => BoardDef }> = {
  'proving-grounds': { name: 'Proving Grounds', factory: provingGrounds },
  'spin-cycle': { name: 'Spin Cycle', factory: spinCycle },
  'the-gauntlet': { name: 'The Gauntlet', factory: theGauntlet },
};
