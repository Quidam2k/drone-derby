// Phase 32: a destroyed robot's player chooses its re-entry facing. The
// choice is made while programming the NEXT turn, so the robot respawns
// facing N (flagged justRespawned) and executeTurn's 4th arg applies the
// choice right after turn-started as a plain robot-rotated.

import { describe, expect, it } from 'vitest';
import type { Direction, GameState } from '../types';
import { emptyBoard, setTile } from '../board';
import { executeTurn } from '../execute';
import { card, eventsOf, prog, makeState, robot, robotOf, run } from './helpers';

/** Turn N: drive A into a pit so it dies and respawns flagged. */
function stateAfterDeath(): GameState {
  const board = emptyBoard('t', 8, 8);
  setTile(board, 2, 2, { kind: 'pit' });
  const state = makeState(board, [robot('A', 2, 3, 'N'), robot('B', 6, 6, 'S')]);
  const result = run(state, { A: [card('move1', 500)] });
  return result.state;
}

/** Turn N+1 with everyone idling; only the facing map varies per test. */
function runNextTurn(state: GameState, facings?: Record<string, Direction>) {
  return executeTurn(state, { A: prog(), B: prog() }, 2, { respawnFacing: facings });
}

describe('respawn facing', () => {
  it('flags a respawned robot and respawns it facing N', () => {
    const s = stateAfterDeath();
    const a = s.robots.find((r) => r.player === 'A')!;
    expect(a.destroyed).toBe(false);
    expect(a.facing).toBe('N');
    expect(a.justRespawned).toBe(true);
    expect(s.robots.find((r) => r.player === 'B')!.justRespawned).toBeUndefined();
  });

  it('applies the chosen facing right after turn-started and clears the flag', () => {
    const result = runNextTurn(stateAfterDeath(), { A: 'E' });

    const types = result.events.map((e) => e.type);
    expect(types[0]).toBe('turn-started');
    expect(types[1]).toBe('robot-rotated');
    const rotate = eventsOf(result.events, 'robot-rotated')[0];
    expect(rotate).toMatchObject({ player: 'A', from: 'N', to: 'E' });

    const a = robotOf(result, 'A');
    expect(a.facing).toBe('E');
    expect(a.justRespawned).toBeUndefined();
  });

  it('no choice → stays N, no rotate event, flag still cleared', () => {
    const result = runNextTurn(stateAfterDeath());
    expect(eventsOf(result.events, 'robot-rotated')).toHaveLength(0);
    const a = robotOf(result, 'A');
    expect(a.facing).toBe('N');
    expect(a.justRespawned).toBeUndefined();
  });

  it("choosing 'N' (the current facing) emits no event but clears the flag", () => {
    const result = runNextTurn(stateAfterDeath(), { A: 'N' });
    expect(eventsOf(result.events, 'robot-rotated')).toHaveLength(0);
    expect(robotOf(result, 'A').justRespawned).toBeUndefined();
  });

  it('a choice from a player who did not respawn is ignored', () => {
    const result = runNextTurn(stateAfterDeath(), { A: 'E', B: 'W' });
    const rotates = eventsOf(result.events, 'robot-rotated');
    expect(rotates).toHaveLength(1);
    expect(rotates[0].player).toBe('A');
    expect(robotOf(result, 'B').facing).toBe('S');
  });

  it('an invalid direction is ignored (untrusted map)', () => {
    const result = runNextTurn(stateAfterDeath(), { A: 'X' as Direction });
    expect(eventsOf(result.events, 'robot-rotated')).toHaveLength(0);
    const a = robotOf(result, 'A');
    expect(a.facing).toBe('N');
    expect(a.justRespawned).toBeUndefined();
  });

  it('an eliminated robot never turns, and its stale flag is cleared', () => {
    // Hand-built corruption: flag set on an eliminated robot. The choice must
    // be ignored (isActive gate) and the flag swept regardless.
    const state = makeState(emptyBoard('t', 8, 8), [
      robot('A', 2, 3, 'N'),
      robot('B', 6, 6, 'S', { eliminated: true, lives: 0, justRespawned: true }),
      robot('C', 4, 4, 'N'),
    ]);
    const result = executeTurn(state, { A: prog(), C: prog() }, 1, {
      respawnFacing: { B: 'E' },
    });
    expect(eventsOf(result.events, 'robot-rotated')).toHaveLength(0);
    const b = result.state.robots.find((r) => r.player === 'B')!;
    expect(b.facing).toBe('S');
    expect(b.justRespawned).toBeUndefined();
  });

  it('is deterministic and never mutates the input state', () => {
    const s = stateAfterDeath();
    const snapshot = structuredClone(s);
    const first = executeTurn(s, { A: prog(), B: prog() }, 2, { respawnFacing: { A: 'W' } });
    const second = executeTurn(s, { A: prog(), B: prog() }, 2, { respawnFacing: { A: 'W' } });
    expect(second).toEqual(first);
    expect(s).toEqual(snapshot);
  });
});
