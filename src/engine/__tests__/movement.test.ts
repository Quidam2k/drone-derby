import { describe, expect, it } from 'vitest';
import { emptyBoard } from '../board';
import { card, eventsOf, makeState, prog, robot, robotOf, run } from './helpers';

const board = () => emptyBoard('empty', 10, 10);

describe('movement cards', () => {
  it('move1 advances one cell in the facing direction', () => {
    const s = makeState(board(), [robot('a', 5, 5, 'N')]);
    const r = run(s, { a: prog(card('move1', 500)) });
    expect(robotOf(r, 'a').pos).toEqual({ x: 5, y: 4 });
    expect(eventsOf(r.events, 'robot-moved')).toEqual([
      { type: 'robot-moved', player: 'a', from: { x: 5, y: 5 }, to: { x: 5, y: 4 }, pushed: false },
    ]);
  });

  it('move2 and move3 advance step by step', () => {
    const s = makeState(board(), [robot('a', 2, 8, 'E')]);
    const r = run(s, { a: prog(card('move3', 800), card('move2', 700)) });
    expect(robotOf(r, 'a').pos).toEqual({ x: 7, y: 8 });
    expect(eventsOf(r.events, 'robot-moved')).toHaveLength(5);
  });

  it('backUp moves one cell opposite the facing without turning', () => {
    const s = makeState(board(), [robot('a', 5, 5, 'E')]);
    const r = run(s, { a: prog(card('backUp', 450)) });
    expect(robotOf(r, 'a').pos).toEqual({ x: 4, y: 5 });
    expect(robotOf(r, 'a').facing).toBe('E');
  });

  it('rotation cards turn in place', () => {
    const s = makeState(board(), [robot('a', 5, 5, 'N')]);
    const r = run(s, {
      a: prog(card('turnLeft', 100), card('turnRight', 120), card('uTurn', 30)),
    });
    expect(robotOf(r, 'a').pos).toEqual({ x: 5, y: 5 });
    expect(robotOf(r, 'a').facing).toBe('S'); // N -L-> W -R-> N -U-> S
    expect(eventsOf(r.events, 'robot-rotated').map((e) => e.to)).toEqual(['W', 'N', 'S']);
  });
});

describe('pushing', () => {
  it('a moving robot pushes a stationary robot one cell', () => {
    const s = makeState(board(), [robot('a', 5, 5, 'N'), robot('b', 5, 4, 'E')]);
    const r = run(s, { a: prog(card('move1', 500)) });
    expect(robotOf(r, 'a').pos).toEqual({ x: 5, y: 4 });
    expect(robotOf(r, 'b').pos).toEqual({ x: 5, y: 3 });
    const moves = eventsOf(r.events, 'robot-moved');
    // pushed robot shifts first (far end of the chain moves first)
    expect(moves[0]).toMatchObject({ player: 'b', pushed: true });
    expect(moves[1]).toMatchObject({ player: 'a', pushed: false });
  });

  it('pushes chain through multiple robots', () => {
    const s = makeState(board(), [
      robot('a', 2, 5, 'E'),
      robot('b', 3, 5, 'N'),
      robot('c', 4, 5, 'N'),
    ]);
    const r = run(s, { a: prog(card('move2', 700)) });
    expect(robotOf(r, 'a').pos).toEqual({ x: 4, y: 5 });
    expect(robotOf(r, 'b').pos).toEqual({ x: 5, y: 5 });
    expect(robotOf(r, 'c').pos).toEqual({ x: 6, y: 5 });
  });

  it('pushing a robot off the board edge destroys it', () => {
    const s = makeState(board(), [robot('a', 5, 1, 'N'), robot('b', 5, 0, 'E')]);
    const r = run(s, { a: prog(card('move1', 500)) });
    expect(robotOf(r, 'a').pos).toEqual({ x: 5, y: 0 });
    expect(eventsOf(r.events, 'robot-fell')).toEqual([
      { type: 'robot-fell', player: 'b', cause: 'edge', at: { x: 5, y: 0 } },
    ]);
    expect(eventsOf(r.events, 'life-lost')).toMatchObject([{ player: 'b', remaining: 2 }]);
    // b respawns at end of turn; a is parked on b's archive cell, so b is
    // displaced to the nearest free cell (deterministic scan)
    expect(robotOf(r, 'b').destroyed).toBe(false);
    expect(robotOf(r, 'b').pos).toEqual({ x: 4, y: 0 });
    expect(robotOf(r, 'b').damage).toBe(2);
  });

  it('a robot walking off the edge itself is destroyed', () => {
    const s = makeState(board(), [robot('a', 0, 5, 'W')]);
    const r = run(s, { a: prog(card('move1', 500)) });
    expect(eventsOf(r.events, 'robot-fell')).toMatchObject([
      { player: 'a', cause: 'edge', at: { x: 0, y: 5 } },
    ]);
    expect(eventsOf(r.events, 'robot-respawned')).toMatchObject([
      { player: 'a', pos: { x: 0, y: 5 } },
    ]);
  });

  it('backUp pushes too', () => {
    const s = makeState(board(), [robot('a', 5, 5, 'N'), robot('b', 5, 6, 'E')]);
    const r = run(s, { a: prog(card('backUp', 450)) });
    expect(robotOf(r, 'a').pos).toEqual({ x: 5, y: 6 });
    expect(robotOf(r, 'b').pos).toEqual({ x: 5, y: 7 });
  });

  it('a destroyed robot no longer blocks or acts for the rest of the turn', () => {
    // b walks into the pit-free edge fall at register 1; a then moves through
    // b's old cell at register 2.
    const s = makeState(board(), [robot('a', 5, 2, 'N'), robot('b', 5, 0, 'N')]);
    const r = run(s, {
      a: prog(null, card('move2', 700)),
      b: prog(card('move1', 500), card('move1', 510)),
    });
    // register 1: b moves N off the edge and dies; register 2: a moves N twice
    expect(robotOf(r, 'a').pos).toEqual({ x: 5, y: 0 });
    // b idles its register-2 card (dead), respawns at archive after the turn,
    // displaced to the nearest free cell because a is standing on it
    const respawn = eventsOf(r.events, 'robot-respawned');
    expect(respawn).toHaveLength(1);
    expect(respawn[0].pos).not.toEqual({ x: 5, y: 0 });
  });
});
