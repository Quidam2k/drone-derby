// Phase 36: portals (expansion rule), paired by color. A robot entering a
// portal during movement-card execution — walked or chain-pushed —
// relocates to the same-color twin and continues its movement from there.
// Twin occupied → the portal is inert floor. Belt and pusher movement
// never triggers a portal (Board Elements, printed timing).

import { describe, expect, it } from 'vitest';
import { emptyBoard, setTile } from '../board';
import { validateBoard } from '../validate';
import { card, eventsOf, makeState, robot, robotOf, run } from './helpers';

describe('portals', () => {
  it('walking in relocates to the twin and continues the movement there', () => {
    const board = emptyBoard('t', 8, 6);
    setTile(board, 3, 2, { kind: 'portal', color: 'red' });
    setTile(board, 5, 4, { kind: 'portal', color: 'red' });
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [card('move2', 700)],
    });

    expect(eventsOf(result.events, 'robot-teleported')[0]).toEqual({
      type: 'robot-teleported',
      player: 'a',
      from: { x: 3, y: 2 },
      to: { x: 5, y: 4 },
      via: 'portal',
    });
    // Step 2 of the Move 2 continues from the twin, still heading E.
    expect(robotOf(result, 'a').pos).toEqual({ x: 6, y: 4 });
  });

  it('an occupied twin makes the portal inert floor', () => {
    const board = emptyBoard('t', 8, 6);
    setTile(board, 3, 2, { kind: 'portal', color: 'red' });
    setTile(board, 5, 4, { kind: 'portal', color: 'red' });
    const result = run(makeState(board, [robot('a', 2, 2, 'E'), robot('b', 5, 4)]), {
      a: [card('move1', 500)],
    });

    expect(eventsOf(result.events, 'robot-teleported')).toHaveLength(0);
    expect(robotOf(result, 'a').pos).toEqual({ x: 3, y: 2 });
  });

  it('a chain-pushed robot goes through; the pusher then finds the twin occupied', () => {
    const board = emptyBoard('t', 8, 6);
    setTile(board, 3, 2, { kind: 'portal', color: 'blue' });
    setTile(board, 6, 2, { kind: 'portal', color: 'blue' });
    const result = run(makeState(board, [robot('a', 1, 2, 'E'), robot('b', 2, 2)]), {
      a: [card('move2', 700)],
    });

    // Step 1: b is pushed into the portal and pops out at the twin.
    // Step 2: a walks into the now-vacant portal cell — twin occupied by b,
    // so a stands on inert floor.
    const jumps = eventsOf(result.events, 'robot-teleported');
    expect(jumps).toHaveLength(1);
    expect(jumps[0]).toMatchObject({ player: 'b', to: { x: 6, y: 2 } });
    expect(robotOf(result, 'a').pos).toEqual({ x: 3, y: 2 });
    expect(robotOf(result, 'b').pos).toEqual({ x: 6, y: 2 });
  });

  it('a belt carrying a robot onto a portal does not trigger it', () => {
    const board = emptyBoard('t', 8, 6);
    setTile(board, 2, 2, { kind: 'conveyor', dir: 'E', express: false });
    setTile(board, 3, 2, { kind: 'portal', color: 'red' });
    setTile(board, 5, 4, { kind: 'portal', color: 'red' });
    const result = run(makeState(board, [robot('a', 2, 2)]));

    expect(eventsOf(result.events, 'robot-teleported')).toHaveLength(0);
    expect(robotOf(result, 'a').pos).toEqual({ x: 3, y: 2 });
  });

  it('a pusher piston shoving a robot onto a portal does not trigger it', () => {
    const board = emptyBoard('t', 8, 6);
    setTile(board, 3, 2, { kind: 'portal', color: 'red' });
    setTile(board, 5, 4, { kind: 'portal', color: 'red' });
    board.pushers = [{ pos: { x: 2, y: 2 }, facing: 'E', registers: [1] }];
    const result = run(makeState(board, [robot('a', 2, 2)]));

    expect(eventsOf(result.events, 'robot-teleported')).toHaveLength(0);
    expect(robotOf(result, 'a').pos).toEqual({ x: 3, y: 2 });
  });

  it('validation demands portal pairs and known colors', () => {
    const board = emptyBoard('t', 8, 6);
    setTile(board, 0, 0, { kind: 'spawn', n: 1 });
    setTile(board, 1, 0, { kind: 'spawn', n: 2 });
    setTile(board, 5, 5, { kind: 'checkpoint', n: 1 });

    setTile(board, 3, 2, { kind: 'portal', color: 'red' });
    expect(
      validateBoard(board).errors.some((e) => e.includes('portals come in pairs')),
    ).toBe(true);

    setTile(board, 6, 4, { kind: 'portal', color: 'red' });
    expect(validateBoard(board).errors).toEqual([]);

    setTile(board, 6, 4, { kind: 'portal', color: 'magenta' } as never);
    expect(validateBoard(board).errors.some((e) => e.includes('portal needs a color'))).toBe(
      true,
    );
  });
});
