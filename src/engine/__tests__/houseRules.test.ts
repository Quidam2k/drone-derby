// House rules for the transcribed boards whose printed elements have no rule
// text on hand (pending Todd's review card): oil slicks, water + currents,
// whirlpools, and steep hill ledges (one-way walls via the layout parser).

import { describe, expect, it } from 'vitest';
import { emptyBoard, setTile } from '../board';
import { fromLayout } from '../layout';
import { card, eventsOf, makeState, robot, robotOf, run } from './helpers';

describe('oil slicks', () => {
  it('a robot ending its card on oil slides on until it leaves the oil', () => {
    const board = emptyBoard('t', 1, 8);
    setTile(board, 0, 5, { kind: 'oil' });
    setTile(board, 0, 4, { kind: 'oil' });
    const result = run(makeState(board, [robot('a', 0, 7, 'N')]), { a: [card('move2', 500)] });
    // Card ends on (0,5) oil → slides to (0,4) oil → slides to (0,3) floor.
    expect(robotOf(result, 'a').pos).toEqual({ x: 0, y: 3 });
  });

  it('sliding is stopped by a wall', () => {
    const board = emptyBoard('t', 1, 8);
    setTile(board, 0, 5, { kind: 'oil' });
    board.walls = [{ x: 0, y: 5, side: 'N' }];
    const result = run(makeState(board, [robot('a', 0, 6, 'N')]), { a: [card('move1', 500)] });
    expect(robotOf(result, 'a').pos).toEqual({ x: 0, y: 5 });
  });

  it('back-up slides backwards', () => {
    const board = emptyBoard('t', 1, 8);
    setTile(board, 0, 4, { kind: 'oil' });
    const result = run(makeState(board, [robot('a', 0, 3, 'N')]), { a: [card('backUp', 500)] });
    expect(robotOf(result, 'a').pos).toEqual({ x: 0, y: 5 });
  });

  it('being pushed onto oil does not slide', () => {
    const board = emptyBoard('t', 1, 8);
    setTile(board, 0, 4, { kind: 'oil' });
    const result = run(makeState(board, [robot('a', 0, 6, 'N'), robot('b', 0, 5, 'S')]), {
      a: [card('move1', 500)],
    });
    expect(robotOf(result, 'b').pos).toEqual({ x: 0, y: 4 });
    expect(robotOf(result, 'a').pos).toEqual({ x: 0, y: 5 });
  });
});

describe('water and currents', () => {
  it('a card begun in water moves one square less', () => {
    const board = emptyBoard('t', 1, 8);
    setTile(board, 0, 7, { kind: 'water' });
    const result = run(makeState(board, [robot('a', 0, 7, 'N')]), { a: [card('move3', 500)] });
    expect(robotOf(result, 'a').pos).toEqual({ x: 0, y: 5 });
  });

  it('move 1 begun in water goes nowhere; every card begun there is short', () => {
    const board = emptyBoard('t', 1, 8);
    setTile(board, 0, 7, { kind: 'water' });
    const result = run(makeState(board, [robot('a', 0, 7, 'N')]), {
      a: [card('move1', 500), card('move2', 490)],
    });
    expect(robotOf(result, 'a').pos).toEqual({ x: 0, y: 6 });
  });

  it('a current pulses like a normal belt', () => {
    const board = emptyBoard('t', 6, 1);
    setTile(board, 1, 0, { kind: 'water', current: 'E' });
    const result = run(makeState(board, [robot('a', 1, 0, 'N')]), {});
    // One pulse in register 1 carries it off the current onto floor.
    expect(robotOf(result, 'a').pos).toEqual({ x: 2, y: 0 });
    expect(eventsOf(result.events, 'conveyor-moved')).toHaveLength(1);
  });
});

describe('whirlpools', () => {
  it('turn like a gear and burn 1 per register ended on them', () => {
    const board = emptyBoard('t', 3, 3);
    setTile(board, 1, 1, { kind: 'whirlpool', cw: true });
    const result = run(makeState(board, [robot('a', 1, 1, 'N')]), {});
    expect(eventsOf(result.events, 'gear-rotated')).toHaveLength(5);
    expect(robotOf(result, 'a').facing).toBe('E'); // 5 quarter turns clockwise
    const burns = eventsOf(result.events, 'damage').filter((e) => e.source === 'whirlpool');
    expect(burns).toHaveLength(5);
  });
});

describe('steep ledges (layout)', () => {
  const board = fromLayout({
    name: 't',
    rows: ['..', '..'],
    steep: ['0,0 S'],
  });

  it('a robot can drop down the ledge', () => {
    const result = run(makeState(board, [robot('a', 0, 0, 'S')]), { a: [card('move1', 500)] });
    expect(robotOf(result, 'a').pos).toEqual({ x: 0, y: 1 });
  });

  it('but cannot climb it', () => {
    const result = run(makeState(board, [robot('a', 0, 1, 'N')]), { a: [card('move1', 500)] });
    expect(robotOf(result, 'a').pos).toEqual({ x: 0, y: 1 });
  });
});
