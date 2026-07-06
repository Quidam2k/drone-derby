import { describe, expect, it } from 'vitest';
import { emptyBoard, setTile } from '../board';
import { eventsOf, makeState, robot, robotOf, run } from './helpers';

describe('gears', () => {
  it('a clockwise gear rotates the robot 90° CW each register', () => {
    const b = emptyBoard('gears', 10, 10);
    setTile(b, 5, 5, { kind: 'gear', cw: true });
    const s = makeState(b, [robot('a', 5, 5, 'N')]);
    const r = run(s); // idles 5 registers → 5 quarter turns CW
    expect(robotOf(r, 'a').facing).toBe('E'); // N→E→S→W→N→E
    expect(robotOf(r, 'a').pos).toEqual({ x: 5, y: 5 });
    expect(eventsOf(r.events, 'gear-rotated')).toHaveLength(5);
    expect(eventsOf(r.events, 'gear-rotated')[0]).toMatchObject({
      player: 'a',
      cw: true,
      from: 'N',
      to: 'E',
    });
  });

  it('a counter-clockwise gear rotates the robot 90° CCW each register', () => {
    const b = emptyBoard('gears', 10, 10);
    setTile(b, 5, 5, { kind: 'gear', cw: false });
    const s = makeState(b, [robot('a', 5, 5, 'N')]);
    const r = run(s);
    expect(robotOf(r, 'a').facing).toBe('W'); // N→W→S→E→N→W
    expect(eventsOf(r.events, 'gear-rotated')[0]).toMatchObject({ cw: false, from: 'N', to: 'W' });
  });
});
