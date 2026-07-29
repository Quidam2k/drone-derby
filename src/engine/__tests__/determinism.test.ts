import { describe, expect, it } from 'vitest';
import { createGame } from '../setup';
import { executeTurn, isGameOver } from '../execute';
import { provingGrounds, spinCycle } from '../boards';
import { handSize } from '../deck';
import type { GameState, PlayerId, Program } from '../types';
import { naiveProgram } from './helpers';

function naivePrograms(state: GameState): Record<PlayerId, Program> {
  const programs: Record<PlayerId, Program> = {};
  for (const r of state.robots) {
    if (!r.eliminated) programs[r.player] = naiveProgram(state, r.player);
  }
  return programs;
}

describe('determinism', () => {
  it('same inputs produce identical outputs and never mutate the input', () => {
    const start = createGame(provingGrounds(), ['alice', 'bob'], 42);
    const programs = naivePrograms(start);
    const snapshot = structuredClone(start);

    const r1 = executeTurn(start, programs, 7);
    const r2 = executeTurn(start, programs, 7);

    expect(start).toEqual(snapshot); // input untouched
    expect(r1.state).toEqual(r2.state);
    expect(r1.events).toEqual(r2.events);
  });

  it('golden EventLog: fixed seed, fixed programs → exact event stream', () => {
    const start = createGame(provingGrounds(), ['alice', 'bob'], 42);
    const { events } = executeTurn(start, naivePrograms(start), 7);
    expect(events[0]).toEqual({ type: 'turn-started', turn: 1 });
    expect(events.filter((e) => e.type === 'register-started')).toHaveLength(5);
    expect(events).toMatchSnapshot();
  });

  it('Spin Cycle: same inputs produce identical outputs and never mutate the input', () => {
    const start = createGame(spinCycle(), ['alice', 'bob', 'carol', 'dave'], 42);
    const programs = naivePrograms(start);
    const snapshot = structuredClone(start);

    const r1 = executeTurn(start, programs, 7);
    const r2 = executeTurn(start, programs, 7);

    expect(start).toEqual(snapshot); // input untouched
    expect(r1.state).toEqual(r2.state);
    expect(r1.events).toEqual(r2.events);
  });

  it('multi-turn smoke: cards are conserved and hands match damage every turn', () => {
    let state = createGame(provingGrounds(), ['alice', 'bob', 'carol'], 99);
    for (let turn = 0; turn < 30 && !isGameOver(state); turn++) {
      state = executeTurn(state, naivePrograms(state), 1000 + turn).state;
      if (isGameOver(state)) break;
      const held = state.robots.reduce(
        (n, r) => n + r.lockedRegisters.filter((c) => c !== null).length,
        0,
      );
      const inHands = Object.values(state.hands).reduce((n, h) => n + h.length, 0);
      expect(
        state.deck.drawPile.length + state.deck.discardPile.length + inHands + held,
      ).toBe(84);
      for (const robot of state.robots) {
        if (robot.eliminated) continue;
        expect(state.hands[robot.player]).toHaveLength(handSize(robot.damage));
      }
    }
  });
});
