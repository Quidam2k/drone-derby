import { describe, expect, it } from 'vitest';
import { emptyBoard, wallBlocked } from '../board';
import { card, eventsOf, makeState, prog, robot, robotOf, run } from './helpers';

describe('walls', () => {
  it('blocks crossing from both sides of the edge', () => {
    const b = emptyBoard('walls', 10, 10);
    b.walls = [{ x: 4, y: 5, side: 'E' }]; // between (4,5) and (5,5)
    expect(wallBlocked(b, { x: 4, y: 5 }, 'E')).toBe(true);
    expect(wallBlocked(b, { x: 5, y: 5 }, 'W')).toBe(true);
    expect(wallBlocked(b, { x: 4, y: 5 }, 'W')).toBe(false);
    expect(wallBlocked(b, { x: 4, y: 5 }, 'N')).toBe(false);
  });

  it('stops a moving robot and emits robot-blocked', () => {
    const b = emptyBoard('walls', 10, 10);
    b.walls = [{ x: 5, y: 5, side: 'N' }];
    const s = makeState(b, [robot('a', 5, 6, 'N')]);
    const r = run(s, { a: prog(card('move3', 800)) });
    // one step to (5,5), then blocked; remaining movement forfeited
    expect(robotOf(r, 'a').pos).toEqual({ x: 5, y: 5 });
    expect(eventsOf(r.events, 'robot-moved')).toHaveLength(1);
    expect(eventsOf(r.events, 'robot-blocked')).toMatchObject([
      { player: 'a', at: { x: 5, y: 5 }, dir: 'N' },
    ]);
  });

  it('a wall behind the pushed robot blocks the whole chain', () => {
    const b = emptyBoard('walls', 10, 10);
    b.walls = [{ x: 5, y: 4, side: 'N' }]; // between b at (5,4) and (5,3)
    const s = makeState(b, [robot('a', 5, 5, 'N'), robot('b', 5, 4, 'S')]);
    const r = run(s, { a: prog(card('move1', 500)) });
    expect(robotOf(r, 'a').pos).toEqual({ x: 5, y: 5 });
    expect(robotOf(r, 'b').pos).toEqual({ x: 5, y: 4 });
    expect(eventsOf(r.events, 'robot-moved')).toHaveLength(0);
    expect(eventsOf(r.events, 'robot-blocked')).toMatchObject([{ player: 'a' }]);
  });

  it('blocks backUp as well', () => {
    const b = emptyBoard('walls', 10, 10);
    b.walls = [{ x: 5, y: 5, side: 'S' }];
    const s = makeState(b, [robot('a', 5, 5, 'N')]);
    const r = run(s, { a: prog(card('backUp', 450)) });
    expect(robotOf(r, 'a').pos).toEqual({ x: 5, y: 5 });
    expect(eventsOf(r.events, 'robot-blocked')).toHaveLength(1);
  });
});
