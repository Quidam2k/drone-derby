// Phase 35: trap-door pits (expansion rule). A trap-door is a covered pit
// with a register schedule: on a scheduled register it is a pit for the
// ENTIRE phase — a robot starting the phase on it falls immediately, and
// one entering it by card move, push, or belt falls too. Closed, it is
// plain floor. Drains are pits with grate art (style: 'drain'); the engine
// treats them as pits, so they ride along in this file.

import { describe, expect, it } from 'vitest';
import { emptyBoard, setTile } from '../board';
import { executeTurn } from '../execute';
import type { EngineEvent, EventLog } from '../events';
import { validateBoard } from '../validate';
import { card, eventsOf, makeState, robot, robotOf, run } from './helpers';

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

describe('trap-door pits', () => {
  it('a robot walking onto an open trap-door falls', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 3, 2, { kind: 'trapdoor', registers: [1] });
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [card('move1', 500)],
    });

    expect(eventsOf(result.events, 'robot-fell')[0]).toMatchObject({
      player: 'a',
      cause: 'pit',
      at: { x: 3, y: 2 },
    });
  });

  it('a closed trap-door is plain floor', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 3, 2, { kind: 'trapdoor', registers: [5] });
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [card('move2', 700)],
    });

    expect(eventsOf(result.events, 'robot-fell')).toHaveLength(0);
    expect(robotOf(result, 'a').pos).toEqual({ x: 4, y: 2 });
  });

  it('opens under a robot standing on it: destroyed at phase start, before its card acts', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 2, 1, { kind: 'trapdoor', registers: [2] });
    // Register 1 walks onto the closed door; register 2 opens it underfoot.
    const result = run(makeState(board, [robot('a', 2, 2, 'N')]), {
      a: [card('move1', 500), card('move1', 490)],
    });

    expect(registersOf(result.events, 'robot-fell')).toEqual([2]);
    // The register-2 card never executes — the robot died at phase start.
    expect(eventsOf(result.events, 'robot-moved')).toHaveLength(1);
  });

  it('kills mid-move: a Move 3 stops the moment it enters the open door', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 3, 2, { kind: 'trapdoor', registers: [1] });
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [card('move3', 800)],
    });

    expect(eventsOf(result.events, 'robot-moved')).toHaveLength(1);
    expect(eventsOf(result.events, 'robot-fell')[0]).toMatchObject({ at: { x: 3, y: 2 } });
  });

  it('a belt delivers a robot into an open trap-door and it falls', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 2, 2, { kind: 'conveyor', dir: 'E', express: false });
    setTile(board, 3, 2, { kind: 'trapdoor', registers: [1] });
    const result = run(makeState(board, [robot('a', 2, 2)]));

    expect(eventsOf(result.events, 'conveyor-moved')).toHaveLength(1);
    expect(eventsOf(result.events, 'robot-fell')[0]).toMatchObject({
      cause: 'pit',
      at: { x: 3, y: 2 },
    });
  });

  it('a push into an open trap-door kills the pushed robot', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 3, 2, { kind: 'trapdoor', registers: [1] });
    const result = run(makeState(board, [robot('a', 1, 2, 'E'), robot('b', 2, 2)]), {
      a: [card('move1', 500)],
    });

    expect(eventsOf(result.events, 'robot-fell')[0]).toMatchObject({
      player: 'b',
      at: { x: 3, y: 2 },
    });
    expect(robotOf(result, 'a').pos).toEqual({ x: 2, y: 2 });
  });

  it('standing on it on a non-scheduled register is safe', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 2, 2, { kind: 'trapdoor', registers: [3] });
    // Walk off before register 3.
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [null, card('move1', 500)],
    });

    expect(eventsOf(result.events, 'robot-fell')).toHaveLength(0);
    expect(robotOf(result, 'a').pos).toEqual({ x: 3, y: 2 });
  });

  it('is deterministic and never mutates the input state', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 2, 3, { kind: 'trapdoor', registers: [2, 4] });
    const state = makeState(board, [robot('a', 2, 2, 'S')]);
    for (const r of state.robots) state.hands[r.player] = [];
    const programs = { a: [null, null, null, null, null] };
    const snapshot = structuredClone(state);

    const r1 = executeTurn(state, programs, 7);
    const r2 = executeTurn(state, programs, 7);

    expect(state).toEqual(snapshot);
    expect(r1.state).toEqual(r2.state);
    expect(r1.events).toEqual(r2.events);
  });

  it('validation rejects a trap-door with a bad schedule', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 0, 0, { kind: 'spawn', n: 1 });
    setTile(board, 1, 0, { kind: 'spawn', n: 2 });
    setTile(board, 5, 5, { kind: 'checkpoint', n: 1 });
    setTile(board, 3, 3, { kind: 'trapdoor', registers: [] });
    expect(validateBoard(board).errors.some((e) => e.includes('trap-door'))).toBe(true);

    setTile(board, 3, 3, { kind: 'trapdoor', registers: [0, 6] });
    expect(validateBoard(board).errors.some((e) => e.includes('trap-door'))).toBe(true);

    setTile(board, 3, 3, { kind: 'trapdoor', registers: [1, 3, 5] });
    expect(validateBoard(board).errors).toEqual([]);
  });
});

describe('drains', () => {
  it('a drain is a pit to the engine — the style field changes nothing', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 3, 2, { kind: 'pit', style: 'drain' });
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [card('move1', 500)],
    });

    expect(eventsOf(result.events, 'robot-fell')[0]).toMatchObject({
      player: 'a',
      cause: 'pit',
      at: { x: 3, y: 2 },
    });
  });

  it('validation accepts style "drain" and rejects anything else', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 0, 0, { kind: 'spawn', n: 1 });
    setTile(board, 1, 0, { kind: 'spawn', n: 2 });
    setTile(board, 5, 5, { kind: 'checkpoint', n: 1 });
    setTile(board, 3, 3, { kind: 'pit', style: 'drain' });
    expect(validateBoard(board).errors).toEqual([]);

    setTile(board, 3, 3, { kind: 'pit', style: 'sewer' } as never);
    expect(validateBoard(board).errors.some((e) => e.includes('pit style'))).toBe(true);
  });
});
