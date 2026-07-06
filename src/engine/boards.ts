import type { BoardDef } from './types';
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
