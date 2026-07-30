// Phase 36: teleporters (Radioactive expansion). A robot executing a
// MOVEMENT card while standing on one appears (card squares + 2) forward —
// the printed guide's own example: Move 2 appears 4 forward, Back-Up
// appears 2 FORWARD — ignoring all intervening board elements, walls and
// robots. Destination occupied → the teleporter doesn't operate and the
// card executes normally. Rotate cards are unaffected.

import { describe, expect, it } from 'vitest';
import { emptyBoard, setTile } from '../board';
import { card, eventsOf, makeState, robot, robotOf, run } from './helpers';

describe('teleporters', () => {
  it('Move 1 on a teleporter appears 3 squares forward', () => {
    const board = emptyBoard('t', 10, 6);
    setTile(board, 2, 2, { kind: 'teleporter' });
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [card('move1', 500)],
    });

    expect(eventsOf(result.events, 'robot-teleported')[0]).toEqual({
      type: 'robot-teleported',
      player: 'a',
      from: { x: 2, y: 2 },
      to: { x: 5, y: 2 },
      via: 'teleporter',
    });
    expect(eventsOf(result.events, 'robot-moved')).toHaveLength(0);
    expect(robotOf(result, 'a').pos).toEqual({ x: 5, y: 2 });
  });

  it('Back-Up on a teleporter appears 2 squares FORWARD (printed example)', () => {
    const board = emptyBoard('t', 10, 6);
    setTile(board, 2, 2, { kind: 'teleporter' });
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [card('backUp', 450)],
    });

    expect(robotOf(result, 'a').pos).toEqual({ x: 4, y: 2 });
  });

  it('the jump ignores walls, robots and pits in between', () => {
    const board = emptyBoard('t', 10, 6);
    setTile(board, 2, 2, { kind: 'teleporter' });
    setTile(board, 4, 2, { kind: 'pit' });
    board.walls = [{ x: 2, y: 2, side: 'E' }];
    const result = run(makeState(board, [robot('a', 2, 2, 'E'), robot('b', 3, 2)]), {
      a: [card('move2', 700)], // appears 4 forward at (6,2)
    });

    expect(robotOf(result, 'a').pos).toEqual({ x: 6, y: 2 });
    expect(robotOf(result, 'b').pos).toEqual({ x: 3, y: 2 }); // untouched
    expect(eventsOf(result.events, 'robot-fell')).toHaveLength(0);
  });

  it('an occupied destination stops the teleporter: the card executes normally', () => {
    const board = emptyBoard('t', 10, 6);
    setTile(board, 2, 2, { kind: 'teleporter' });
    const result = run(makeState(board, [robot('a', 2, 2, 'E'), robot('b', 5, 2)]), {
      a: [card('move1', 500)], // would appear at (5,2) — b is there
    });

    expect(eventsOf(result.events, 'robot-teleported')).toHaveLength(0);
    expect(robotOf(result, 'a').pos).toEqual({ x: 3, y: 2 }); // normal Move 1
  });

  it('a rotate card on a teleporter is unaffected', () => {
    const board = emptyBoard('t', 10, 6);
    setTile(board, 2, 2, { kind: 'teleporter' });
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [card('uTurn', 60)],
    });

    expect(eventsOf(result.events, 'robot-teleported')).toHaveLength(0);
    expect(robotOf(result, 'a').facing).toBe('W');
  });

  it('appearing over a pit drops the robot in', () => {
    const board = emptyBoard('t', 10, 6);
    setTile(board, 2, 2, { kind: 'teleporter' });
    setTile(board, 5, 2, { kind: 'pit' });
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [card('move1', 500)],
    });

    expect(eventsOf(result.events, 'robot-fell')[0]).toMatchObject({
      cause: 'pit',
      at: { x: 5, y: 2 },
    });
  });

  it('a destination past the rim is an edge death (judgment call)', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 4, 2, { kind: 'teleporter' });
    const result = run(makeState(board, [robot('a', 4, 2, 'E')]), {
      a: [card('move1', 500)], // 3 forward = x 7, off a 6-wide board
    });

    expect(eventsOf(result.events, 'robot-fell')[0]).toMatchObject({
      cause: 'edge',
      at: { x: 5, y: 2 },
    });
  });

  it('walking ONTO a teleporter mid-move does nothing that register', () => {
    const board = emptyBoard('t', 10, 6);
    setTile(board, 3, 2, { kind: 'teleporter' });
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [card('move2', 700)],
    });

    expect(eventsOf(result.events, 'robot-teleported')).toHaveLength(0);
    expect(robotOf(result, 'a').pos).toEqual({ x: 4, y: 2 });
  });
});
