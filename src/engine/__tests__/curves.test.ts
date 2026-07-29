// Curved conveyors (Phase 31, 1994 rule): a robot the BELT carries onto a
// curved section rotates 90° in the curve's direction. Walking, being pushed,
// and respawning onto a curve do NOT rotate; neither does riding out of one
// or being conveyed in from a non-entry side.

import { describe, expect, it } from 'vitest';
import { emptyBoard, setTile } from '../board';
import { card, eventsOf, makeState, robot, robotOf, run } from './helpers';

describe('curved conveyors', () => {
  it('carried onto a cw curve: conveyor-moved then conveyor-rotated, facing turns cw', () => {
    const b = emptyBoard('curve', 10, 10);
    // Rider travels E along the belt, the corner turns it to S (cw).
    setTile(b, 3, 5, { kind: 'conveyor', dir: 'E', express: false });
    setTile(b, 4, 5, { kind: 'conveyor', dir: 'S', express: false, curve: 'cw' });
    const s = makeState(b, [robot('a', 3, 5, 'E')]);
    const r = run(s);
    const moved = eventsOf(r.events, 'conveyor-moved');
    const rotated = eventsOf(r.events, 'conveyor-rotated');
    expect(moved[0]).toMatchObject({ from: { x: 3, y: 5 }, to: { x: 4, y: 5 } });
    expect(rotated[0]).toMatchObject({ player: 'a', cw: true, from: 'E', to: 'S' });
    // The rotation event follows its move in the log.
    expect(r.events.indexOf(rotated[0])).toBeGreaterThan(r.events.indexOf(moved[0]));
    // Register 2 carries it out of the curve southward without rotating again.
    expect(rotated).toHaveLength(1);
    expect(robotOf(r, 'a').pos).toEqual({ x: 4, y: 6 });
    expect(robotOf(r, 'a').facing).toBe('S');
  });

  it('carried onto a ccw curve: facing turns ccw', () => {
    const b = emptyBoard('curve', 10, 10);
    // Rider travels E, the corner turns it to N (ccw).
    setTile(b, 3, 5, { kind: 'conveyor', dir: 'E', express: false });
    setTile(b, 4, 5, { kind: 'conveyor', dir: 'N', express: false, curve: 'ccw' });
    const s = makeState(b, [robot('a', 3, 5, 'W')]);
    const r = run(s);
    expect(eventsOf(r.events, 'conveyor-rotated')[0]).toMatchObject({
      player: 'a',
      cw: false,
      from: 'W',
      to: 'S',
    });
  });

  it('express line into an express curve: rotates on the express pulse, all-belt pulse exits without rotating', () => {
    const b = emptyBoard('curve', 10, 10);
    setTile(b, 3, 5, { kind: 'conveyor', dir: 'E', express: true });
    setTile(b, 4, 5, { kind: 'conveyor', dir: 'S', express: true, curve: 'cw' });
    setTile(b, 4, 6, { kind: 'conveyor', dir: 'S', express: true });
    const s = makeState(b, [robot('a', 3, 5, 'N')]);
    const r = run(s);
    const rotated = eventsOf(r.events, 'conveyor-rotated');
    // Register 1: express pulse carries onto the curve (rotate N→E... cw from
    // N is E — the robot's facing turns with the bend regardless of where it
    // was aimed), all-belt pulse carries it off the curve with no second
    // rotation. Register 2 continues down the straight line, still no
    // rotation.
    expect(rotated).toHaveLength(1);
    expect(rotated[0]).toMatchObject({ cw: true, from: 'N', to: 'E' });
    const firstMove = eventsOf(r.events, 'conveyor-moved')[0];
    expect(firstMove).toMatchObject({ to: { x: 4, y: 5 }, express: true });
  });

  it('walking onto a curve with a card move does not rotate', () => {
    const b = emptyBoard('curve', 10, 10);
    setTile(b, 4, 5, { kind: 'conveyor', dir: 'S', express: false, curve: 'cw' });
    // Approach from the west moving E — exactly the belt's entry direction,
    // but on foot. (Register 1's belt pulse then carries the robot out S.)
    const s = makeState(b, [robot('a', 3, 5, 'E')]);
    const r = run(s, { a: [card('move1', 500)] });
    expect(eventsOf(r.events, 'conveyor-rotated')).toHaveLength(0);
    expect(robotOf(r, 'a').facing).toBe('E');
  });

  it('being pushed onto a curve does not rotate either robot', () => {
    const b = emptyBoard('curve', 10, 10);
    setTile(b, 4, 5, { kind: 'conveyor', dir: 'S', express: false, curve: 'cw' });
    const s = makeState(b, [robot('a', 2, 5, 'E'), robot('b', 3, 5, 'N')]);
    const r = run(s, { a: [card('move1', 500)] });
    // b is pushed onto the curve; the pulse then carries b south, still
    // without a rotation.
    expect(eventsOf(r.events, 'conveyor-rotated')).toHaveLength(0);
    expect(robotOf(r, 'b').facing).toBe('N');
  });

  it('starting a pulse ON a curve exits without rotating', () => {
    const b = emptyBoard('curve', 10, 10);
    setTile(b, 4, 5, { kind: 'conveyor', dir: 'S', express: false, curve: 'cw' });
    const s = makeState(b, [robot('a', 4, 5, 'W')]);
    const r = run(s);
    expect(eventsOf(r.events, 'conveyor-rotated')).toHaveLength(0);
    expect(robotOf(r, 'a').pos).toEqual({ x: 4, y: 6 });
    expect(robotOf(r, 'a').facing).toBe('W');
  });

  it('conveyed in from a non-entry side moves but does not rotate', () => {
    const b = emptyBoard('curve', 10, 10);
    // The cw S-exit curve is entered moving E; feed it from the north moving
    // S instead (author error) — the ride continues, the bend does nothing.
    setTile(b, 4, 4, { kind: 'conveyor', dir: 'S', express: false });
    setTile(b, 4, 5, { kind: 'conveyor', dir: 'S', express: false, curve: 'cw' });
    const s = makeState(b, [robot('a', 4, 4, 'N')]);
    const r = run(s);
    expect(eventsOf(r.events, 'conveyor-moved').length).toBeGreaterThan(0);
    expect(eventsOf(r.events, 'conveyor-rotated')).toHaveLength(0);
    expect(robotOf(r, 'a').facing).toBe('N');
  });

  it('a wall on the exit edge blocks the curve like any belt', () => {
    const b = emptyBoard('curve', 10, 10);
    setTile(b, 3, 5, { kind: 'conveyor', dir: 'E', express: false });
    setTile(b, 4, 5, { kind: 'conveyor', dir: 'S', express: false, curve: 'cw' });
    b.walls = [{ x: 4, y: 5, side: 'S' }];
    const s = makeState(b, [robot('a', 3, 5, 'E')]);
    const r = run(s);
    // Register 1 carries it in and rotates it; the wall then pins it there
    // for the rest of the turn.
    expect(eventsOf(r.events, 'conveyor-rotated')).toHaveLength(1);
    expect(eventsOf(r.events, 'conveyor-moved')).toHaveLength(1);
    expect(robotOf(r, 'a').pos).toEqual({ x: 4, y: 5 });
    expect(robotOf(r, 'a').facing).toBe('S');
  });
});
