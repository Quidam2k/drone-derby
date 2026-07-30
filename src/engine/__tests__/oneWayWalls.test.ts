// Phase 35: one-way walls (expansion rule). A one-way wall is a normal wall
// from its red side and nonexistent from the green side: 'out' blocks only
// leaving its cell through that edge, 'in' blocks only entering. Movement
// and laser fire share wallBlocked, so beams obey the same one-way rule.

import { describe, expect, it } from 'vitest';
import { composeBoards } from '../compose';
import { emptyBoard, setTile, wallBlocked } from '../board';
import { validateBoard } from '../validate';
import { card, eventsOf, makeState, robot, robotOf, run } from './helpers';

describe('one-way walls', () => {
  it("'out' blocks leaving the cell through the edge but not entering it", () => {
    const board = emptyBoard('t', 6, 6);
    board.walls = [{ x: 2, y: 2, side: 'E', oneWay: 'out' }];

    expect(wallBlocked(board, { x: 2, y: 2 }, 'E')).toBe(true); // leaving (2,2) E
    expect(wallBlocked(board, { x: 3, y: 2 }, 'W')).toBe(false); // entering (2,2) from E
  });

  it("'in' blocks entering the cell through the edge but not leaving it", () => {
    const board = emptyBoard('t', 6, 6);
    board.walls = [{ x: 3, y: 2, side: 'W', oneWay: 'in' }];

    expect(wallBlocked(board, { x: 2, y: 2 }, 'E')).toBe(true); // entering (3,2) from W
    expect(wallBlocked(board, { x: 3, y: 2 }, 'W')).toBe(false); // leaving (3,2) W
  });

  it('a wall without oneWay still blocks both directions', () => {
    const board = emptyBoard('t', 6, 6);
    board.walls = [{ x: 2, y: 2, side: 'E' }];

    expect(wallBlocked(board, { x: 2, y: 2 }, 'E')).toBe(true);
    expect(wallBlocked(board, { x: 3, y: 2 }, 'W')).toBe(true);
  });

  it('movement: a robot passes the green side and bounces off the red side', () => {
    const board = emptyBoard('t', 6, 6);
    board.walls = [{ x: 2, y: 2, side: 'E', oneWay: 'out' }];
    // b crosses W-ward through the same edge freely; a is blocked E-ward.
    const result = run(makeState(board, [robot('a', 2, 2, 'E'), robot('b', 3, 3, 'W')]), {
      a: [card('move1', 500)],
      b: [card('move1', 490)],
    });

    expect(eventsOf(result.events, 'robot-blocked')[0]).toMatchObject({ player: 'a' });
    expect(robotOf(result, 'a').pos).toEqual({ x: 2, y: 2 });
    expect(robotOf(result, 'b').pos).toEqual({ x: 2, y: 3 });
  });

  it('a chain push is blocked only in the blocked crossing direction', () => {
    const board = emptyBoard('t', 6, 6);
    board.walls = [{ x: 3, y: 2, side: 'E', oneWay: 'out' }];
    // a pushes b; b would have to LEAVE (3,2) eastward through the red side.
    const result = run(makeState(board, [robot('a', 2, 2, 'E'), robot('b', 3, 2)]), {
      a: [card('move1', 500)],
    });

    expect(eventsOf(result.events, 'robot-moved')).toHaveLength(0);
    expect(robotOf(result, 'a').pos).toEqual({ x: 2, y: 2 });
    expect(robotOf(result, 'b').pos).toEqual({ x: 3, y: 2 });
  });

  it('lasers pass the green side and stop at the red side', () => {
    const board = emptyBoard('t', 8, 6);
    // Beam travelling E out of (2,2) is blocked; travelling W into (2,2) is not.
    board.walls = [{ x: 2, y: 2, side: 'E', oneWay: 'out' }];
    board.lasers = [
      { pos: { x: 0, y: 2 }, facing: 'E', strength: 1 }, // hits the wall at (2,2)
      { pos: { x: 7, y: 2 }, facing: 'W', strength: 1 }, // sails through to x=0... but
      // the eastbound emitter cell blocks nothing — walls do, robots do.
    ];
    const result = run(makeState(board, [robot('a', 5, 5)]));

    const beams = eventsOf(result.events, 'laser-fired').filter((e) => e.source === 'board');
    const east = beams.find((b) => b.path[0].x === 0)!;
    const west = beams.find((b) => b.path[0].x === 7)!;
    // Eastbound beam stops where the wall blocks leaving (2,2).
    expect(east.path[east.path.length - 1]).toEqual({ x: 2, y: 2 });
    // Westbound beam crosses the same edge unhindered to the board edge.
    expect(west.path[west.path.length - 1]).toEqual({ x: 0, y: 2 });
  });

  it('validation rejects a bad oneWay value and accepts good ones', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 0, 0, { kind: 'spawn', n: 1 });
    setTile(board, 1, 0, { kind: 'spawn', n: 2 });
    setTile(board, 5, 5, { kind: 'checkpoint', n: 1 });

    board.walls = [{ x: 2, y: 2, side: 'E', oneWay: 'sideways' as never }];
    expect(validateBoard(board).errors.some((e) => e.includes('oneWay'))).toBe(true);

    board.walls = [
      { x: 2, y: 2, side: 'E', oneWay: 'out' },
      { x: 4, y: 4, side: 'N', oneWay: 'in' },
    ];
    expect(validateBoard(board).errors).toEqual([]);
  });

  it('composeBoards carries oneWay through with the offset', () => {
    const top = emptyBoard('top', 6, 6);
    setTile(top, 5, 5, { kind: 'checkpoint', n: 1 });
    top.walls = [{ x: 1, y: 2, side: 'S', oneWay: 'in' }];
    const dock = emptyBoard('dock', 6, 2);
    setTile(dock, 1, 1, { kind: 'spawn', n: 1 });
    setTile(dock, 4, 1, { kind: 'spawn', n: 2 });

    const composed = composeBoards([top, dock], 'combo');
    expect(composed.walls).toEqual([{ x: 1, y: 2, side: 'S', oneWay: 'in' }]);
  });
});
