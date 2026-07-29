// Phase 33: power-down (1994 rule). Announced while programming turn N via
// TurnChoices.powerDown; during turn N+1 the robot is down — all damage
// removed at the start of that turn, no program, no laser — while belts,
// gears, pushes and lasers still act on it. At end of the down turn the
// player either stays down (named again) or wakes. Destruction ends it.

import { describe, expect, it } from 'vitest';
import { emptyBoard, setTile } from '../board';
import { handSize } from '../deck';
import { executeTurn } from '../execute';
import type { Card, GameState, PlayerId, Program, TurnChoices } from '..';
import { card, eventsOf, makeState, prog, robot, robotOf } from './helpers';

/** Like helpers.run, but with TurnChoices and powered-down robots skipped. */
function runWithChoices(
  state: GameState,
  programs: Record<PlayerId, (Card | null)[]>,
  choices?: TurnChoices,
  seed = 1,
) {
  const full: Record<PlayerId, Program> = {};
  for (const r of state.robots) {
    if (r.eliminated || r.poweredDown) continue;
    const p = prog(...(programs[r.player] ?? []));
    state.hands[r.player] = p.filter((c): c is Card => c !== null);
    full[r.player] = p;
  }
  return executeTurn(state, full, seed, choices);
}

/** drawPile + discardPile + all hands + all locked registers. */
function countCards(state: GameState): number {
  let n = state.deck.drawPile.length + state.deck.discardPile.length;
  for (const hand of Object.values(state.hands)) n += hand.length;
  for (const r of state.robots) n += r.lockedRegisters.filter((c) => c !== null).length;
  return n;
}

function twoBots(): GameState {
  return makeState(emptyBoard('t', 8, 8), [robot('A', 2, 5, 'N'), robot('B', 6, 6, 'S')]);
}

describe('power-down: announcing', () => {
  it('sets poweredDown at end of turn, emits the event, and deals no hand', () => {
    const result = runWithChoices(twoBots(), {}, { powerDown: ['A'] });

    const a = robotOf(result, 'A');
    expect(a.poweredDown).toBe(true);
    expect(robotOf(result, 'B').poweredDown).toBeUndefined();
    expect(eventsOf(result.events, 'robot-powered-down')).toMatchObject([{ player: 'A' }]);
    expect(result.state.hands['A']).toEqual([]);
    expect(result.state.hands['B']).toHaveLength(9);
  });

  it('the powered-down turn needs no program for that player', () => {
    const s = runWithChoices(twoBots(), {}, { powerDown: ['A'] }).state;
    // Only B submits; prepareTurn would throw for a normal program-less robot.
    expect(() => executeTurn(s, { B: prog() }, 2)).not.toThrow();
  });

  it('an announcement from a robot destroyed the same turn is void', () => {
    const board = emptyBoard('t', 8, 8);
    setTile(board, 2, 4, { kind: 'pit' });
    const state = makeState(board, [robot('A', 2, 5, 'N'), robot('B', 6, 6, 'S')]);

    const result = runWithChoices(state, { A: [card('move1', 500)] }, { powerDown: ['A'] });

    const a = robotOf(result, 'A');
    expect(a.destroyed).toBe(false); // respawned
    expect(a.justRespawned).toBe(true);
    expect(a.poweredDown).toBeUndefined();
    expect(eventsOf(result.events, 'robot-powered-down')).toHaveLength(0);
  });

  it('a name with no robot, or an eliminated robot, is ignored', () => {
    const state = twoBots();
    state.robots[1].eliminated = true;
    state.robots[1].lives = 0;
    const result = runWithChoices(state, {}, { powerDown: ['B', 'nobody'] });
    expect(robotOf(result, 'B').poweredDown).toBeUndefined();
    expect(eventsOf(result.events, 'robot-powered-down')).toHaveLength(0);
  });
});

describe('power-down: start-of-turn recovery', () => {
  it('clears all damage via one repair event and releases locked registers to the discard pile', () => {
    const held4 = card('move2', 670);
    const held5 = card('uTurn', 10);
    const state = makeState(emptyBoard('t', 8, 8), [
      robot('A', 2, 5, 'N', {
        poweredDown: true,
        damage: 6, // locks registers 4 and 5
        lockedRegisters: [null, null, null, held4, held5],
      }),
      robot('B', 6, 6, 'S'),
    ]);
    // The held cards live on the registers, outside the deck.
    state.deck.drawPile = state.deck.drawPile.filter(
      (c) => c.id !== held4.id && c.id !== held5.id,
    );
    expect(countCards(state)).toBe(84);

    const result = executeTurn(state, { B: prog() }, 3);

    expect(eventsOf(result.events, 'repair')).toMatchObject([
      { player: 'A', amount: 6, total: 0 },
    ]);
    expect(eventsOf(result.events, 'register-unlocked')).toMatchObject([
      { player: 'A', register: 4, card: { id: held4.id } },
      { player: 'A', register: 5, card: { id: held5.id } },
    ]);
    const a = robotOf(result, 'A');
    expect(a.damage).toBe(0);
    expect(a.lockedRegisters).toEqual([null, null, null, null, null]);
    expect(result.state.deck.discardPile.map((c) => c.id)).toEqual(
      expect.arrayContaining([held4.id, held5.id]),
    );
    expect(countCards(result.state)).toBe(84);
  });
});

describe('power-down: the down turn', () => {
  it('is still pushed, carried by belts, and rotated by gears', () => {
    const board = emptyBoard('t', 8, 8);
    setTile(board, 2, 4, { kind: 'conveyor', dir: 'E', express: false });
    setTile(board, 3, 4, { kind: 'gear', cw: true });
    const state = makeState(board, [
      robot('A', 2, 5, 'N', { poweredDown: true }),
      robot('B', 2, 6, 'N'),
    ]);

    // Register 1: B walks north into A, pushing it onto the belt; the belt
    // carries it east onto the gear, which spins it.
    const result = runWithChoices(state, { B: [card('move1', 500)] });

    expect(eventsOf(result.events, 'robot-moved')).toMatchObject([
      { player: 'A', from: { x: 2, y: 5 }, to: { x: 2, y: 4 }, pushed: true },
      { player: 'B', from: { x: 2, y: 6 }, to: { x: 2, y: 5 }, pushed: false },
    ]);
    expect(eventsOf(result.events, 'conveyor-moved')).toMatchObject([
      { player: 'A', to: { x: 3, y: 4 } },
    ]);
    // It parks on the gear, so it spins there every remaining register.
    const gears = eventsOf(result.events, 'gear-rotated');
    expect(gears).toHaveLength(5);
    expect(gears.every((e) => e.player === 'A' && e.cw)).toBe(true);
  });

  it('fires no laser but is still shot, and the damage sticks', () => {
    const state = makeState(emptyBoard('t', 8, 8), [
      robot('A', 2, 5, 'E', { poweredDown: true }), // faces B — must not fire
      robot('B', 5, 5, 'W'),
    ]);

    const result = runWithChoices(state, {});

    const robotShots = eventsOf(result.events, 'laser-fired').filter((e) => e.source === 'robot');
    expect(robotShots).toHaveLength(5); // one per register — B only
    expect(robotShots.every((e) => e.shooter === 'B' && e.hit === 'A')).toBe(true);
    expect(robotOf(result, 'A').damage).toBe(5); // stuck at end of turn
  });

  it('touches checkpoints where it stands (archive moves, claims in order)', () => {
    const board = emptyBoard('t', 8, 8);
    setTile(board, 2, 5, { kind: 'checkpoint', n: 1 });
    setTile(board, 6, 1, { kind: 'checkpoint', n: 2 }); // so claiming 1 can't win
    const state = makeState(board, [
      robot('A', 2, 5, 'N', { poweredDown: true, archive: { x: 0, y: 0 } }),
      robot('B', 6, 6, 'S'),
    ]);

    const result = runWithChoices(state, {});

    const a = robotOf(result, 'A');
    expect(a.checkpoints).toBe(1);
    expect(a.archive).toEqual({ x: 2, y: 5 });
    expect(eventsOf(result.events, 'checkpoint-claimed')).toMatchObject([
      { player: 'A', checkpoint: 1 },
    ]);
  });
});

describe('power-down: staying down and waking', () => {
  it('named again → stays down; damage taken while down clears at the next turn start', () => {
    const board = emptyBoard('t', 8, 8);
    board.lasers.push({ pos: { x: 0, y: 5 }, facing: 'E', strength: 1 });
    const state = makeState(board, [
      robot('A', 2, 5, 'N', { poweredDown: true }),
      robot('B', 6, 6, 'S'),
    ]);

    const down = runWithChoices(state, {}, { powerDown: ['A'] });
    const a1 = robotOf(down, 'A');
    expect(a1.poweredDown).toBe(true);
    expect(a1.damage).toBe(5); // one board-laser hit per register, kept
    expect(eventsOf(down.events, 'robot-powered-up')).toHaveLength(0);
    expect(down.state.hands['A']).toEqual([]);

    // Move A off the beam so the next clear is visible in the end state.
    down.state.robots[0].pos = { x: 2, y: 3 };
    const next = runWithChoices(down.state, {});
    expect(eventsOf(next.events, 'repair')).toMatchObject([{ player: 'A', amount: 5, total: 0 }]);
    expect(robotOf(next, 'A').damage).toBe(0);
  });

  it('not named → wakes with the event and a fresh full hand', () => {
    const state = makeState(emptyBoard('t', 8, 8), [
      robot('A', 2, 5, 'N', { poweredDown: true }),
      robot('B', 6, 6, 'S'),
    ]);

    const result = runWithChoices(state, {});

    const a = robotOf(result, 'A');
    expect(a.poweredDown).toBeUndefined();
    expect(eventsOf(result.events, 'robot-powered-up')).toMatchObject([{ player: 'A' }]);
    expect(result.state.hands['A']).toHaveLength(handSize(0)); // 9 — damage cleared at turn start
  });

  it('destroyed while down → power-down ends, normal respawn, may announce again', () => {
    const board = emptyBoard('t', 8, 8);
    setTile(board, 2, 4, { kind: 'pit' });
    const state = makeState(board, [
      robot('A', 2, 5, 'N', { poweredDown: true }),
      robot('B', 2, 6, 'N'),
    ]);

    // B pushes the sleeping A into the pit — staying down must not survive it.
    const result = runWithChoices(state, { B: [card('move1', 500)] }, { powerDown: ['A'] });

    const a = robotOf(result, 'A');
    expect(a.destroyed).toBe(false);
    expect(a.lives).toBe(2);
    expect(a.justRespawned).toBe(true);
    expect(a.poweredDown).toBeUndefined();
    expect(eventsOf(result.events, 'robot-powered-up')).toHaveLength(0);

    // Back in play, the player may announce again (riding the same
    // submission as the Phase 32 facing picker).
    const again = runWithChoices(result.state, {}, { powerDown: ['A'], respawnFacing: { A: 'E' } });
    const a2 = robotOf(again, 'A');
    expect(a2.poweredDown).toBe(true);
    expect(a2.facing).toBe('E');
  });
});

describe('power-down: determinism', () => {
  it('same inputs twice → deep-equal results; input state never mutated', () => {
    const state = makeState(emptyBoard('t', 8, 8), [
      robot('A', 2, 5, 'N', { poweredDown: true, damage: 4 }),
      robot('B', 6, 6, 'S'),
    ]);
    state.hands['B'] = [card('move1', 500)];
    const programs = { B: prog(card('move1', 500)) };
    const choices: TurnChoices = { powerDown: ['A'] };
    const snapshot = structuredClone(state);

    const first = executeTurn(state, programs, 7, choices);
    const second = executeTurn(state, programs, 7, choices);

    expect(second).toEqual(first);
    expect(state).toEqual(snapshot);
  });
});
