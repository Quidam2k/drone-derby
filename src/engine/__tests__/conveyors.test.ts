import { describe, expect, it } from 'vitest';
import { emptyBoard, setTile } from '../board';
import { eventsOf, makeState, robot, robotOf, run } from './helpers';

describe('conveyors', () => {
  it('a normal conveyor moves a robot one cell per register', () => {
    const b = emptyBoard('conv', 10, 10);
    setTile(b, 2, 7, { kind: 'conveyor', dir: 'E', express: false });
    setTile(b, 3, 7, { kind: 'conveyor', dir: 'E', express: false });
    setTile(b, 4, 7, { kind: 'conveyor', dir: 'E', express: false });
    const s = makeState(b, [robot('a', 2, 7)]);
    const r = run(s); // idles all 5 registers, rides the belt
    // reg 1 → (3,7), reg 2 → (4,7), reg 3 → (5,7) = floor, then stays
    expect(robotOf(r, 'a').pos).toEqual({ x: 5, y: 7 });
    expect(eventsOf(r.events, 'conveyor-moved')).toHaveLength(3);
  });

  it('an express conveyor moves two cells per register (two pulses)', () => {
    const b = emptyBoard('conv', 10, 10);
    setTile(b, 5, 5, { kind: 'conveyor', dir: 'N', express: true });
    setTile(b, 5, 4, { kind: 'conveyor', dir: 'N', express: true });
    const s = makeState(b, [robot('a', 5, 5)]);
    const r = run(s);
    expect(robotOf(r, 'a').pos).toEqual({ x: 5, y: 3 });
    expect(eventsOf(r.events, 'conveyor-moved')).toMatchObject([
      { from: { x: 5, y: 5 }, to: { x: 5, y: 4 }, express: true },
      { from: { x: 5, y: 4 }, to: { x: 5, y: 3 }, express: true },
    ]);
  });

  it('two robots converging on one cell: neither moves', () => {
    const b = emptyBoard('conv', 10, 10);
    setTile(b, 4, 5, { kind: 'conveyor', dir: 'E', express: false });
    setTile(b, 6, 5, { kind: 'conveyor', dir: 'W', express: false });
    const s = makeState(b, [robot('a', 4, 5), robot('b', 6, 5)]);
    const r = run(s);
    expect(robotOf(r, 'a').pos).toEqual({ x: 4, y: 5 });
    expect(robotOf(r, 'b').pos).toEqual({ x: 6, y: 5 });
    expect(eventsOf(r.events, 'conveyor-moved')).toHaveLength(0);
  });

  it('head-on adjacent conveyors do not swap robots', () => {
    const b = emptyBoard('conv', 10, 10);
    setTile(b, 4, 5, { kind: 'conveyor', dir: 'E', express: false });
    setTile(b, 5, 5, { kind: 'conveyor', dir: 'W', express: false });
    const s = makeState(b, [robot('a', 4, 5), robot('b', 5, 5)]);
    const r = run(s);
    expect(robotOf(r, 'a').pos).toEqual({ x: 4, y: 5 });
    expect(robotOf(r, 'b').pos).toEqual({ x: 5, y: 5 });
  });

  it('does not push a stationary robot off the belt end', () => {
    const b = emptyBoard('conv', 10, 10);
    setTile(b, 4, 5, { kind: 'conveyor', dir: 'E', express: false });
    const s = makeState(b, [robot('a', 4, 5), robot('b', 5, 5)]);
    const r = run(s);
    expect(robotOf(r, 'a').pos).toEqual({ x: 4, y: 5 });
    expect(robotOf(r, 'b').pos).toEqual({ x: 5, y: 5 });
  });

  it('a belt train moves together', () => {
    const b = emptyBoard('conv', 10, 10);
    setTile(b, 4, 5, { kind: 'conveyor', dir: 'E', express: false });
    setTile(b, 5, 5, { kind: 'conveyor', dir: 'E', express: false });
    const s = makeState(b, [robot('a', 4, 5), robot('b', 5, 5)]);
    const r = run(s);
    // register 1: both advance together; afterwards a sits on the (5,5) belt
    // but b (now on floor at (6,5)) blocks it for the rest of the turn
    expect(robotOf(r, 'b').pos).toEqual({ x: 6, y: 5 });
    expect(robotOf(r, 'a').pos).toEqual({ x: 5, y: 5 });
    expect(eventsOf(r.events, 'conveyor-moved')).toHaveLength(2);
  });

  it('a wall stops the belt movement silently', () => {
    const b = emptyBoard('conv', 10, 10);
    setTile(b, 4, 5, { kind: 'conveyor', dir: 'E', express: false });
    b.walls = [{ x: 4, y: 5, side: 'E' }];
    const s = makeState(b, [robot('a', 4, 5)]);
    const r = run(s);
    expect(robotOf(r, 'a').pos).toEqual({ x: 4, y: 5 });
    expect(eventsOf(r.events, 'conveyor-moved')).toHaveLength(0);
    expect(eventsOf(r.events, 'robot-blocked')).toHaveLength(0);
  });

  it('a belt can carry a robot into a pit', () => {
    const b = emptyBoard('conv', 10, 10);
    setTile(b, 4, 5, { kind: 'conveyor', dir: 'E', express: false });
    setTile(b, 5, 5, { kind: 'pit' });
    const s = makeState(b, [robot('a', 4, 5)]);
    const r = run(s);
    expect(eventsOf(r.events, 'robot-fell')).toMatchObject([
      { player: 'a', cause: 'pit', at: { x: 5, y: 5 } },
    ]);
  });

  it('a belt can carry a robot off the board edge', () => {
    const b = emptyBoard('conv', 10, 10);
    setTile(b, 9, 5, { kind: 'conveyor', dir: 'E', express: false });
    const s = makeState(b, [robot('a', 9, 5)]);
    const r = run(s);
    expect(eventsOf(r.events, 'robot-fell')).toMatchObject([
      { player: 'a', cause: 'edge', at: { x: 9, y: 5 } },
    ]);
    expect(eventsOf(r.events, 'conveyor-moved')).toHaveLength(0);
  });
});
