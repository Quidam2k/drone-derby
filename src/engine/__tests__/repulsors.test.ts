// Phase 36: repulsor fields (Grand Prix expansion). A robot that runs into
// a repulsor square during card movement is flung directly away for its
// card's value and loses the rest of the card; a robot chain-pushed into
// one is flung by the pushing robot's card value and the pusher loses its
// remaining movement. Flung robots chain-push normally. The field is inert
// to belts and pusher pistons, and field-driven flight never re-triggers
// another field (judgment call — prevents ping-pong recursion).

import { describe, expect, it } from 'vitest';
import { emptyBoard, setTile } from '../board';
import { card, eventsOf, makeState, robot, robotOf, run } from './helpers';

describe('repulsor fields', () => {
  it('flings the mover back by its card value and eats the rest of the card', () => {
    const board = emptyBoard('t', 8, 6);
    setTile(board, 3, 2, { kind: 'repulsor' });
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [card('move2', 700)],
    });

    expect(robotOf(result, 'a').pos).toEqual({ x: 0, y: 2 });
    expect(eventsOf(result.events, 'repulsed')[0]).toEqual({
      type: 'repulsed',
      player: 'a',
      from: { x: 2, y: 2 },
      to: { x: 0, y: 2 },
    });
    const moves = eventsOf(result.events, 'robot-moved');
    expect(moves).toHaveLength(2);
    expect(moves.every((m) => m.pushed)).toBe(true);
  });

  it('a Move 1 flings just one square', () => {
    const board = emptyBoard('t', 8, 6);
    setTile(board, 3, 2, { kind: 'repulsor' });
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [card('move1', 500)],
    });

    expect(robotOf(result, 'a').pos).toEqual({ x: 1, y: 2 });
  });

  it("a robot pushed into a field is flung by the pusher's card value, shoving the pusher back", () => {
    const board = emptyBoard('t', 8, 6);
    setTile(board, 6, 2, { kind: 'repulsor' });
    const result = run(makeState(board, [robot('a', 4, 2, 'E'), robot('b', 5, 2)]), {
      a: [card('move2', 700)],
    });

    // b is flung W twice, chain-pushing a back both times; a's card ends.
    expect(eventsOf(result.events, 'repulsed')[0]).toMatchObject({
      player: 'b',
      from: { x: 5, y: 2 },
      to: { x: 3, y: 2 },
    });
    expect(robotOf(result, 'a').pos).toEqual({ x: 2, y: 2 });
    expect(robotOf(result, 'b').pos).toEqual({ x: 3, y: 2 });
  });

  it('a wall stops the fling', () => {
    const board = emptyBoard('t', 8, 6);
    setTile(board, 3, 2, { kind: 'repulsor' });
    board.walls = [{ x: 2, y: 2, side: 'W' }];
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [card('move3', 800)],
    });

    expect(robotOf(result, 'a').pos).toEqual({ x: 2, y: 2 });
    expect(eventsOf(result.events, 'repulsed')[0]).toMatchObject({
      from: { x: 2, y: 2 },
      to: { x: 2, y: 2 },
    });
    expect(eventsOf(result.events, 'robot-blocked')).toHaveLength(1);
  });

  it('a flung robot can land in a pit', () => {
    const board = emptyBoard('t', 8, 6);
    setTile(board, 3, 2, { kind: 'repulsor' });
    setTile(board, 1, 2, { kind: 'pit' });
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [card('move2', 700)],
    });

    expect(eventsOf(result.events, 'robot-fell')[0]).toMatchObject({
      cause: 'pit',
      at: { x: 1, y: 2 },
    });
  });

  it('field-driven flight passes over another repulsor without re-triggering', () => {
    const board = emptyBoard('t', 8, 6);
    setTile(board, 3, 2, { kind: 'repulsor' });
    setTile(board, 1, 2, { kind: 'repulsor' });
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [card('move2', 700)],
    });

    expect(eventsOf(result.events, 'repulsed')).toHaveLength(1);
    expect(robotOf(result, 'a').pos).toEqual({ x: 0, y: 2 });
  });

  it('a flung robot crossing an active flamer still burns', () => {
    const board = emptyBoard('t', 8, 6);
    setTile(board, 4, 2, { kind: 'repulsor' });
    board.flamers = [{ pos: { x: 2, y: 2 }, registers: [1] }];
    const result = run(makeState(board, [robot('a', 3, 2, 'E')]), {
      a: [card('move1', 500)],
    });

    // Flung onto the flamer (1 burn) and ends the phase there (1 more).
    const burns = eventsOf(result.events, 'damage').filter((e) => e.source === 'flamer');
    expect(burns).toHaveLength(2);
    expect(robotOf(result, 'a').pos).toEqual({ x: 2, y: 2 });
  });

  it('a belt carries a robot ONTO a repulsor square without a fling; it walks off freely', () => {
    const board = emptyBoard('t', 8, 6);
    setTile(board, 2, 2, { kind: 'conveyor', dir: 'E', express: false });
    setTile(board, 3, 2, { kind: 'repulsor' });
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [null, card('move1', 500)],
    });

    // Register 1: belt deposits a on the field (inert to belts).
    // Register 2: a walks off it eastward, unbothered.
    expect(eventsOf(result.events, 'repulsed')).toHaveLength(0);
    expect(robotOf(result, 'a').pos).toEqual({ x: 4, y: 2 });
  });
});
