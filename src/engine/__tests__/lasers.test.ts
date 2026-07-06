import { describe, expect, it } from 'vitest';
import { emptyBoard } from '../board';
import { card, eventsOf, makeState, prog, robot, robotOf, run } from './helpers';

describe('board lasers', () => {
  it('hits the first robot in the beam path once per register', () => {
    const b = emptyBoard('lasers', 10, 10);
    b.lasers = [{ pos: { x: 0, y: 5 }, facing: 'E', strength: 1 }];
    const s = makeState(b, [robot('a', 3, 5, 'N')]);
    const r = run(s); // idles, gets hit 5 times
    expect(robotOf(r, 'a').damage).toBe(5);
    const shots = eventsOf(r.events, 'laser-fired');
    expect(shots.filter((e) => e.source === 'board' && e.hit === 'a')).toHaveLength(5);
    expect(shots[0].path).toEqual([
      { x: 0, y: 5 },
      { x: 1, y: 5 },
      { x: 2, y: 5 },
      { x: 3, y: 5 },
    ]);
  });

  it('is blocked by walls', () => {
    const b = emptyBoard('lasers', 10, 10);
    b.lasers = [{ pos: { x: 0, y: 5 }, facing: 'E', strength: 1 }];
    b.walls = [{ x: 1, y: 5, side: 'E' }];
    const s = makeState(b, [robot('a', 3, 5, 'N')]);
    const r = run(s);
    expect(robotOf(r, 'a').damage).toBe(0);
    expect(eventsOf(r.events, 'laser-fired')[0].path).toEqual([
      { x: 0, y: 5 },
      { x: 1, y: 5 },
    ]);
  });

  it('the first robot shields robots behind it', () => {
    const b = emptyBoard('lasers', 10, 10);
    b.lasers = [{ pos: { x: 0, y: 5 }, facing: 'E', strength: 1 }];
    const s = makeState(b, [robot('a', 2, 5, 'N'), robot('b', 4, 5, 'N')]);
    const r = run(s);
    expect(robotOf(r, 'a').damage).toBe(5);
    expect(robotOf(r, 'b').damage).toBe(0);
  });
});

describe('robot lasers', () => {
  it('a robot shoots the first robot it faces, 1 damage per register', () => {
    const b = emptyBoard('lasers', 10, 10);
    const s = makeState(b, [robot('a', 2, 5, 'E'), robot('b', 5, 5, 'N')]);
    const r = run(s);
    expect(robotOf(r, 'b').damage).toBe(5);
    expect(robotOf(r, 'a').damage).toBe(0); // b faces N, never hits a
    const shot = eventsOf(r.events, 'laser-fired').find((e) => e.source === 'robot');
    expect(shot).toMatchObject({ shooter: 'a', hit: 'b' });
    expect(shot?.path).toEqual([
      { x: 3, y: 5 },
      { x: 4, y: 5 },
      { x: 5, y: 5 },
    ]);
  });

  it('cannot shoot through a wall directly in front of the shooter', () => {
    const b = emptyBoard('lasers', 10, 10);
    b.walls = [{ x: 2, y: 5, side: 'E' }];
    const s = makeState(b, [robot('a', 2, 5, 'E'), robot('b', 5, 5, 'N')]);
    const r = run(s);
    expect(robotOf(r, 'b').damage).toBe(0);
  });
});

describe('damage, locked registers, destruction', () => {
  it('locks registers from 5 downward with the card programmed this turn', () => {
    const b = emptyBoard('lasers', 10, 10);
    b.lasers = [{ pos: { x: 0, y: 5 }, facing: 'E', strength: 5 }];
    const s = makeState(b, [robot('a', 5, 5, 'N')]);
    const moveCard = card('move3', 800);
    // reg 1: idle in the beam → 5 damage → register 5 locks holding move3.
    // reg 2: step N out of the beam row. reg 5: the locked move3 executes.
    const r = run(s, { a: prog(null, card('move1', 490), null, null, moveCard) });
    const locks = eventsOf(r.events, 'register-locked');
    expect(locks).toMatchObject([{ player: 'a', register: 5, card: moveCard }]);
    expect(robotOf(r, 'a').pos).toEqual({ x: 5, y: 1 }); // (5,4) + move3 N
    expect(robotOf(r, 'a').damage).toBe(5);
    expect(robotOf(r, 'a').lockedRegisters[4]).toMatchObject({ id: 'move3-800' });
  });

  it('a previously locked card executes instead of the program slot', () => {
    const b = emptyBoard('lasers', 10, 10);
    const s = makeState(b, [
      robot('a', 5, 5, 'N', {
        damage: 5,
        lockedRegisters: [null, null, null, null, card('move1', 500)],
      }),
    ]);
    const r = run(s); // program slots all null; locked reg 5 still fires
    expect(robotOf(r, 'a').pos).toEqual({ x: 5, y: 4 });
    const revealed = eventsOf(r.events, 'card-revealed');
    expect(revealed).toMatchObject([{ player: 'a', register: 5, card: { id: 'move1-500' } }]);
    // still damaged, so the card stays locked (not discarded)
    expect(robotOf(r, 'a').lockedRegisters[4]).toMatchObject({ id: 'move1-500' });
  });

  it('10 damage destroys the robot; it respawns with 2 damage and clean registers', () => {
    const b = emptyBoard('lasers', 10, 10);
    b.lasers = [{ pos: { x: 0, y: 5 }, facing: 'E', strength: 1 }];
    const s = makeState(b, [
      // damage 9 → all registers locked; 1–4 locked empty (hand was tiny),
      // register 5 still holds a card that must be wiped by destruction
      robot('a', 3, 5, 'N', {
        damage: 9,
        lockedRegisters: [null, null, null, null, card('move1', 490)],
      }),
    ]);
    const r = run(s);
    expect(eventsOf(r.events, 'robot-destroyed')).toMatchObject([
      { player: 'a', at: { x: 3, y: 5 } },
    ]);
    expect(eventsOf(r.events, 'life-lost')).toMatchObject([{ player: 'a', remaining: 2 }]);
    const a = robotOf(r, 'a');
    expect(a.damage).toBe(2);
    expect(a.lives).toBe(2);
    expect(a.destroyed).toBe(false);
    expect(a.pos).toEqual({ x: 3, y: 5 }); // archive
    expect(a.lockedRegisters).toEqual([null, null, null, null, null]);
  });
});
