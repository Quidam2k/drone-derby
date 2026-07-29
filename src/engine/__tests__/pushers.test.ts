// Phase 34: wall-mounted pushers. They fire during board-element resolution
// on the registers printed on them — after the belt pulses, before gears —
// and shove the robot in their cell one space with normal chain-push /
// wall-block / pit-fall rules.

import { describe, expect, it } from 'vitest';
import { emptyBoard, setTile } from '../board';
import { executeTurn } from '../execute';
import type { EngineEvent, EventLog } from '../events';
import { eventsOf, makeState, robot, robotOf, run } from './helpers';

/** The register each event of `type` fired in, in order. */
function registersOf(events: EventLog, type: EngineEvent['type']): number[] {
  const out: number[] = [];
  let register = 0;
  for (const e of events) {
    if (e.type === 'register-started') register = e.register;
    else if (e.type === type) out.push(register);
  }
  return out;
}

describe('pushers', () => {
  it('fires only on its listed registers', () => {
    const board = emptyBoard('t', 6, 6);
    board.pushers = [{ pos: { x: 2, y: 2 }, facing: 'E', registers: [1, 3, 5] }];
    const result = run(makeState(board, [robot('a', 2, 2)]));

    // The robot is shoved out on register 1 and never returns, so the
    // pusher's later registers fire into an empty cell — silently.
    expect(registersOf(result.events, 'pusher-fired')).toEqual([1]);
    expect(robotOf(result, 'a').pos).toEqual({ x: 3, y: 2 });
  });

  it('a 2/4 pusher stays quiet on register 1 and fires on 2', () => {
    const board = emptyBoard('t', 6, 6);
    board.pushers = [{ pos: { x: 2, y: 2 }, facing: 'E', registers: [2, 4] }];
    const result = run(makeState(board, [robot('a', 2, 2)]));

    expect(registersOf(result.events, 'pusher-fired')).toEqual([2]);
  });

  it('fires after the belt pulses: a belt delivers a robot into the pusher cell and it is shoved the same register', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 2, 2, { kind: 'conveyor', dir: 'E', express: false });
    board.pushers = [{ pos: { x: 3, y: 2 }, facing: 'N', registers: [1] }];
    const result = run(makeState(board, [robot('a', 2, 2)]));

    expect(eventsOf(result.events, 'conveyor-moved')[0]).toMatchObject({
      from: { x: 2, y: 2 },
      to: { x: 3, y: 2 },
    });
    expect(registersOf(result.events, 'pusher-fired')).toEqual([1]);
    expect(robotOf(result, 'a').pos).toEqual({ x: 3, y: 1 });
  });

  it('fires before gears: a robot shoved onto a gear rotates the same register', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 3, 1, { kind: 'gear', cw: true });
    board.pushers = [{ pos: { x: 3, y: 2 }, facing: 'N', registers: [1] }];
    const result = run(makeState(board, [robot('a', 3, 2, 'N')]));

    expect(registersOf(result.events, 'gear-rotated')).toContain(1);
    const r = robotOf(result, 'a');
    expect(r.pos).toEqual({ x: 3, y: 1 });
    // Rotated once per register spent on the gear: the shove lands it there
    // in register 1, and it idles on the gear for the rest of the turn.
    expect(eventsOf(result.events, 'gear-rotated')).toHaveLength(5);
    // Event order within register 1: piston, then the move, then the spin.
    const types = result.events.map((e) => e.type);
    const fired = types.indexOf('pusher-fired');
    expect(types.indexOf('robot-moved')).toBeGreaterThan(fired);
    expect(types.indexOf('gear-rotated')).toBeGreaterThan(types.indexOf('robot-moved'));
  });

  it('chain-pushes a second robot', () => {
    const board = emptyBoard('t', 6, 6);
    board.pushers = [{ pos: { x: 1, y: 1 }, facing: 'E', registers: [1] }];
    const result = run(makeState(board, [robot('a', 1, 1), robot('b', 2, 1)]));

    expect(robotOf(result, 'a').pos).toEqual({ x: 2, y: 1 });
    expect(robotOf(result, 'b').pos).toEqual({ x: 3, y: 1 });
    const moves = eventsOf(result.events, 'robot-moved');
    expect(moves).toHaveLength(2);
    expect(moves.every((m) => m.pushed)).toBe(true);
  });

  it('a wall blocks the shove: robot-blocked, nobody moves', () => {
    const board = emptyBoard('t', 6, 6);
    board.walls = [{ x: 1, y: 1, side: 'E' }];
    board.pushers = [{ pos: { x: 1, y: 1 }, facing: 'E', registers: [1, 3, 5] }];
    const result = run(makeState(board, [robot('a', 1, 1)]));

    // Still there every firing register, so the piston slams (and is
    // blocked) three times.
    expect(registersOf(result.events, 'pusher-fired')).toEqual([1, 3, 5]);
    expect(eventsOf(result.events, 'robot-blocked')).toHaveLength(3);
    expect(eventsOf(result.events, 'robot-moved')).toHaveLength(0);
    expect(robotOf(result, 'a').pos).toEqual({ x: 1, y: 1 });
  });

  it('shoves a robot into a pit and it falls', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 2, 1, { kind: 'pit' });
    board.pushers = [{ pos: { x: 1, y: 1 }, facing: 'E', registers: [1] }];
    const result = run(makeState(board, [robot('a', 1, 1)]));

    expect(eventsOf(result.events, 'robot-fell')[0]).toMatchObject({
      player: 'a',
      cause: 'pit',
      at: { x: 2, y: 1 },
    });
  });

  it('shoves a powered-down robot like anything else', () => {
    const board = emptyBoard('t', 6, 6);
    board.pushers = [{ pos: { x: 2, y: 2 }, facing: 'S', registers: [1] }];
    const result = run(makeState(board, [robot('a', 2, 2, 'N', { poweredDown: true })]));

    expect(registersOf(result.events, 'pusher-fired')).toEqual([1]);
    expect(robotOf(result, 'a').pos).toEqual({ x: 2, y: 3 });
  });

  it('an empty pusher fires silently — no event without a subject', () => {
    const board = emptyBoard('t', 6, 6);
    board.pushers = [{ pos: { x: 4, y: 4 }, facing: 'E', registers: [1, 2, 3, 4, 5] }];
    const result = run(makeState(board, [robot('a', 0, 0)]));

    expect(eventsOf(result.events, 'pusher-fired')).toHaveLength(0);
  });

  it('pusher-fired carries the cell, the shove direction and the victim; the move is pushed', () => {
    const board = emptyBoard('t', 6, 6);
    board.pushers = [{ pos: { x: 2, y: 2 }, facing: 'W', registers: [1] }];
    const result = run(makeState(board, [robot('a', 2, 2)]));

    expect(eventsOf(result.events, 'pusher-fired')[0]).toEqual({
      type: 'pusher-fired',
      at: { x: 2, y: 2 },
      dir: 'W',
      player: 'a',
    });
    expect(eventsOf(result.events, 'robot-moved')[0]).toEqual({
      type: 'robot-moved',
      player: 'a',
      from: { x: 2, y: 2 },
      to: { x: 1, y: 2 },
      pushed: true,
    });
  });

  it('is deterministic and never mutates the input state', () => {
    const board = emptyBoard('t', 6, 6);
    board.pushers = [
      { pos: { x: 2, y: 2 }, facing: 'E', registers: [1, 3, 5] },
      { pos: { x: 3, y: 2 }, facing: 'E', registers: [2, 4] },
    ];
    const state = makeState(board, [robot('a', 2, 2), robot('b', 4, 4)]);
    for (const r of state.robots) state.hands[r.player] = [];
    const programs = { a: [null, null, null, null, null], b: [null, null, null, null, null] };
    const snapshot = structuredClone(state);

    const r1 = executeTurn(state, programs, 7);
    const r2 = executeTurn(state, programs, 7);

    expect(state).toEqual(snapshot);
    expect(r1.state).toEqual(r2.state);
    expect(r1.events).toEqual(r2.events);
  });

  it('a board without pushers behaves as before (the field is optional)', () => {
    const board = emptyBoard('t', 6, 6);
    delete board.pushers; // a stored board predating pushers
    const result = run(makeState(board, [robot('a', 2, 2)]));
    expect(eventsOf(result.events, 'pusher-fired')).toHaveLength(0);
  });
});
