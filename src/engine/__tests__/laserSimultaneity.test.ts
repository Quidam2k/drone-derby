// Phase 35: laser simultaneity (printed rule). Board and robot lasers
// resolve in ONE segment: every beam is traced from the same position
// snapshot before any damage lands. A robot destroyed by a board laser
// therefore still returns fire that segment, and its body still blocks
// beams that would otherwise pass through its cell. The event stream stays
// sequential — board laser-fired events, then robot laser-fired events,
// then the damage.

import { describe, expect, it } from 'vitest';
import { emptyBoard } from '../board';
import { eventsOf, makeState, robot, robotOf, run } from './helpers';

describe('laser simultaneity', () => {
  it('a robot destroyed by a board laser still returns fire that segment', () => {
    const board = emptyBoard('t', 8, 6);
    // Board laser finishes off a (at 9 damage); a faces b and fires anyway.
    board.lasers = [{ pos: { x: 2, y: 0 }, facing: 'S', strength: 1 }];
    const result = run(
      makeState(board, [robot('a', 2, 2, 'E', { damage: 9 }), robot('b', 5, 2, 'W')]),
    );

    expect(
      eventsOf(result.events, 'robot-destroyed').some((e) => e.player === 'a'),
    ).toBe(true);
    const aShot = eventsOf(result.events, 'laser-fired').find((e) => e.shooter === 'a')!;
    expect(aShot.hit).toBe('b');
    // b took a's dying shot AND b's own shot hit a (mutual facing).
    expect(robotOf(result, 'b').damage).toBeGreaterThan(0);
  });

  it("a destroyed robot's body still blocks other beams that segment", () => {
    const board = emptyBoard('t', 8, 6);
    // Board laser kills a; c fires down the same row and must hit a's hulk,
    // not b sheltering behind it.
    board.lasers = [{ pos: { x: 3, y: 0 }, facing: 'S', strength: 1 }];
    const result = run(
      makeState(board, [
        robot('a', 3, 2, 'N', { damage: 9 }),
        robot('b', 5, 2, 'N'),
        robot('c', 0, 2, 'E'),
      ]),
    );

    // Register 1 only: from register 2 on, a's hulk is off the board and c's
    // beam reaches b legitimately.
    const r1End = result.events.findIndex(
      (e) => e.type === 'register-started' && e.register === 2,
    );
    const r1 = result.events.slice(0, r1End);
    const cShot = eventsOf(r1, 'laser-fired').find((e) => e.shooter === 'c')!;
    expect(cShot.hit).toBe('a');
    expect(eventsOf(r1, 'damage').filter((e) => e.player === 'b')).toHaveLength(0);
  });

  it('two robots at 9 damage facing each other destroy each other', () => {
    const board = emptyBoard('t', 8, 6);
    const result = run(
      makeState(board, [
        robot('a', 2, 2, 'E', { damage: 9 }),
        robot('b', 5, 2, 'W', { damage: 9 }),
      ]),
    );

    const destroyed = eventsOf(result.events, 'robot-destroyed').map((e) => e.player);
    expect(destroyed).toContain('a');
    expect(destroyed).toContain('b');
  });

  it('event stream: board beams, then robot beams, then damage', () => {
    const board = emptyBoard('t', 8, 6);
    board.lasers = [{ pos: { x: 2, y: 0 }, facing: 'S', strength: 1 }];
    const result = run(makeState(board, [robot('a', 2, 2, 'E'), robot('b', 5, 2, 'W')]));

    // Look at register 1 only.
    const r1End = result.events.findIndex(
      (e) => e.type === 'register-started' && e.register === 2,
    );
    const slice = result.events.slice(0, r1End);
    const beams = slice
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.type === 'laser-fired');
    const sources = beams.map(({ e }) => (e.type === 'laser-fired' ? e.source : ''));
    expect(sources).toEqual(['board', 'robot', 'robot']);
    const firstDamage = slice.findIndex((e) => e.type === 'damage');
    expect(firstDamage).toBeGreaterThan(beams[beams.length - 1].i);
  });
});
