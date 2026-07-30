// Phase 35: overhead crushers (base-game element, the last one we lacked).
// A crusher slams during Board Elements step 5 — after gears — on the
// registers printed on it, destroying any robot in its cell outright.
// crusher-crushed is the slam visual; the kill itself is the standard
// robot-destroyed path, so replay and respawn need nothing new.

import { describe, expect, it } from 'vitest';
import { composeBoards } from '../compose';
import { emptyBoard, setTile } from '../board';
import { executeTurn } from '../execute';
import type { EngineEvent, EventLog } from '../events';
import { validateBoard } from '../validate';
import { card, eventsOf, makeState, robot, robotOf, run } from './helpers';

function registersOf(events: EventLog, type: EngineEvent['type']): number[] {
  const out: number[] = [];
  let register = 0;
  for (const e of events) {
    if (e.type === 'register-started') register = e.register;
    else if (e.type === type) out.push(register);
  }
  return out;
}

describe('crushers', () => {
  it('destroys the robot in its cell on a scheduled register', () => {
    const board = emptyBoard('t', 6, 6);
    board.crushers = [{ pos: { x: 2, y: 2 }, registers: [2, 4] }];
    const result = run(makeState(board, [robot('a', 2, 2)]));

    expect(registersOf(result.events, 'crusher-crushed')).toEqual([2]);
    expect(eventsOf(result.events, 'crusher-crushed')[0]).toEqual({
      type: 'crusher-crushed',
      player: 'a',
      at: { x: 2, y: 2 },
    });
    expect(eventsOf(result.events, 'robot-destroyed')[0]).toMatchObject({
      player: 'a',
      at: { x: 2, y: 2 },
    });
    expect(eventsOf(result.events, 'life-lost')[0]).toMatchObject({ player: 'a', remaining: 2 });
    // Standard respawn at end of turn.
    expect(robotOf(result, 'a').destroyed).toBe(false);
    expect(robotOf(result, 'a').damage).toBe(2);
  });

  it('stays quiet on non-scheduled registers and over an empty cell', () => {
    const board = emptyBoard('t', 6, 6);
    board.crushers = [{ pos: { x: 4, y: 4 }, registers: [1, 2, 3, 4, 5] }];
    const result = run(makeState(board, [robot('a', 0, 0)]));

    expect(eventsOf(result.events, 'crusher-crushed')).toHaveLength(0);
  });

  it('slams after the belts: a belt delivers a robot under it the same register', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 2, 2, { kind: 'conveyor', dir: 'E', express: false });
    board.crushers = [{ pos: { x: 3, y: 2 }, registers: [1] }];
    const result = run(makeState(board, [robot('a', 2, 2)]));

    expect(registersOf(result.events, 'crusher-crushed')).toEqual([1]);
  });

  it('slams after gears: the doomed robot still gets its gear rotation first', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 2, 2, { kind: 'gear', cw: true });
    board.crushers = [{ pos: { x: 2, y: 2 }, registers: [1] }];
    const result = run(makeState(board, [robot('a', 2, 2)]));

    const types = result.events.map((e) => e.type);
    const gear = types.indexOf('gear-rotated');
    const slam = types.indexOf('crusher-crushed');
    expect(gear).toBeGreaterThan(-1);
    expect(slam).toBeGreaterThan(gear);
  });

  it('a robot that walks out from under it before the slam survives', () => {
    const board = emptyBoard('t', 6, 6);
    board.crushers = [{ pos: { x: 2, y: 2 }, registers: [1] }];
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [card('move1', 500)],
    });

    expect(eventsOf(result.events, 'crusher-crushed')).toHaveLength(0);
    expect(robotOf(result, 'a').pos).toEqual({ x: 3, y: 2 });
  });

  it('crushes a powered-down robot like anything else', () => {
    const board = emptyBoard('t', 6, 6);
    board.crushers = [{ pos: { x: 2, y: 2 }, registers: [1] }];
    const result = run(makeState(board, [robot('a', 2, 2, 'N', { poweredDown: true })]));

    expect(registersOf(result.events, 'crusher-crushed')).toEqual([1]);
  });

  it('is deterministic and never mutates the input state', () => {
    const board = emptyBoard('t', 6, 6);
    board.crushers = [{ pos: { x: 2, y: 2 }, registers: [3] }];
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

  it('a board without crushers behaves as before (the field is optional)', () => {
    const board = emptyBoard('t', 6, 6);
    delete board.crushers;
    const result = run(makeState(board, [robot('a', 2, 2)]));
    expect(eventsOf(result.events, 'crusher-crushed')).toHaveLength(0);
  });

  it('validation rejects bad schedules and crushers over pits', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 0, 0, { kind: 'spawn', n: 1 });
    setTile(board, 1, 0, { kind: 'spawn', n: 2 });
    setTile(board, 5, 5, { kind: 'checkpoint', n: 1 });

    board.crushers = [{ pos: { x: 3, y: 3 }, registers: [] }];
    expect(validateBoard(board).errors.some((e) => e.includes('crusher'))).toBe(true);

    setTile(board, 3, 3, { kind: 'pit' });
    board.crushers = [{ pos: { x: 3, y: 3 }, registers: [1] }];
    expect(validateBoard(board).errors.some((e) => e.includes('sits over a pit'))).toBe(true);
  });

  it('composeBoards offsets crushers with their part', () => {
    const top = emptyBoard('top', 6, 6);
    setTile(top, 5, 5, { kind: 'checkpoint', n: 1 });
    top.crushers = [{ pos: { x: 2, y: 3 }, registers: [1, 3] }];
    const dock = emptyBoard('dock', 6, 2);
    setTile(dock, 1, 1, { kind: 'spawn', n: 1 });
    setTile(dock, 4, 1, { kind: 'spawn', n: 2 });

    const composed = composeBoards([top, dock], 'combo');
    expect(composed.crushers).toEqual([{ pos: { x: 2, y: 3 }, registers: [1, 3] }]);
  });
});
