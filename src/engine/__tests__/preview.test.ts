import { describe, expect, it } from 'vitest';
import { emptyBoard, setTile } from '../board';
import { previewProgram } from '../preview';
import type { Card, GameState, PlayerId } from '../types';
import { card, eventsOf, makeState, prog, robot } from './helpers';

/** Put the program's cards in the player's hand so validation passes. */
function giveHand(state: GameState, player: PlayerId, cards: (Card | null)[]): void {
  state.hands[player] = cards.filter((c): c is Card => c !== null);
}

describe('previewProgram', () => {
  it('is deterministic and never mutates the input state', () => {
    const state = makeState(emptyBoard('t', 8, 8), [robot('A', 2, 4, 'N'), robot('B', 5, 5, 'S')]);
    const program = prog(card('move1', 500), card('turnRight', 80), card('move1', 510));
    giveHand(state, 'A', program);
    const snapshot = structuredClone(state);

    const first = previewProgram(state, 'A', program);
    const second = previewProgram(state, 'A', program);

    expect(second).toEqual(first);
    expect(state).toEqual(snapshot);
    expect(first.length).toBeGreaterThan(0);
  });

  it('excludes rival robots entirely — no pushes, no rival events', () => {
    // B sits directly in A's path; the real turn would push it.
    const state = makeState(emptyBoard('t', 8, 8), [robot('A', 2, 3, 'N'), robot('B', 2, 2, 'N')]);
    const program = prog(card('move1', 500));
    giveHand(state, 'A', program);

    const events = previewProgram(state, 'A', program);

    for (const e of events) {
      if ('player' in e) expect(e.player).toBe('A');
      if ('shooter' in e && e.shooter !== undefined) expect(e.shooter).toBe('A');
    }
    const moves = eventsOf(events, 'robot-moved');
    expect(moves).toHaveLength(1);
    expect(moves[0].to).toEqual({ x: 2, y: 2 }); // ghost passes through B's cell
    expect(moves[0].pushed).toBe(false);
  });

  it('truncates after the last filled register', () => {
    const state = makeState(emptyBoard('t', 8, 8), [robot('A', 2, 5, 'N')]);
    const program = prog(card('move1', 500), card('move1', 510), card('turnLeft', 70));
    giveHand(state, 'A', program);

    const events = previewProgram(state, 'A', program);

    const registers = eventsOf(events, 'register-started').map((e) => e.register);
    expect(registers).toEqual([1, 2, 3]);
    expect(eventsOf(events, 'turn-ended')).toHaveLength(0);
  });

  it('returns an empty log when nothing is placed', () => {
    const state = makeState(emptyBoard('t', 8, 8), [robot('A', 2, 5, 'N')]);
    giveHand(state, 'A', []);
    expect(previewProgram(state, 'A', prog())).toEqual([]);
  });

  it('counts locked registers as filled, past empty slots', () => {
    // Damage 5 locks register 5, which holds a known card that auto-plays.
    const locked = card('move1', 520);
    const state = makeState(emptyBoard('t', 8, 8), [
      robot('A', 2, 6, 'N', { damage: 5, lockedRegisters: [null, null, null, null, locked] }),
    ]);
    const program = prog(card('move1', 500)); // only register 1 filled by hand
    giveHand(state, 'A', program);

    const events = previewProgram(state, 'A', program);

    const registers = eventsOf(events, 'register-started').map((e) => e.register);
    expect(registers).toEqual([1, 2, 3, 4, 5]);
    // The locked card moves the ghost in register 5: two moves total.
    const moves = eventsOf(events, 'robot-moved');
    expect(moves).toHaveLength(2);
    expect(moves[1].to).toEqual({ x: 2, y: 4 });
  });

  it('a ghost death emits robot-fell and no respawn — the ghost stays gone', () => {
    const board = emptyBoard('t', 8, 8);
    setTile(board, 2, 2, { kind: 'pit' });
    const state = makeState(board, [robot('A', 2, 3, 'N')]);
    const program = prog(card('move1', 500));
    giveHand(state, 'A', program);

    const events = previewProgram(state, 'A', program);

    const falls = eventsOf(events, 'robot-fell');
    expect(falls).toHaveLength(1);
    expect(falls[0].cause).toBe('pit');
    expect(eventsOf(events, 'robot-respawned')).toHaveLength(0);
  });

  it('works on a redacted online state (no decks, only own hand)', () => {
    const state = makeState(emptyBoard('t', 8, 8), [robot('A', 2, 5, 'N'), robot('B', 5, 5, 'S')]);
    const program = prog(card('move1', 500));
    giveHand(state, 'A', program);
    state.decks = {}; // what convex/games.ts sends to clients
    delete state.hands['B'];

    const events = previewProgram(state, 'A', program);

    const moves = eventsOf(events, 'robot-moved');
    expect(moves).toHaveLength(1);
    expect(moves[0].to).toEqual({ x: 2, y: 4 });
  });

  it('shows belt (express first) then gear ordering within a register', () => {
    const board = emptyBoard('t', 8, 8);
    setTile(board, 1, 1, { kind: 'conveyor', dir: 'E', express: true });
    setTile(board, 2, 1, { kind: 'conveyor', dir: 'E', express: true });
    setTile(board, 3, 1, { kind: 'gear', cw: true });
    const state = makeState(board, [robot('A', 1, 1, 'N')]);
    const program = prog(card('turnLeft', 70));
    giveHand(state, 'A', program);

    const events = previewProgram(state, 'A', program);

    const types = events.map((e) => e.type);
    const rotated = types.indexOf('robot-rotated'); // the card
    const beltFirst = types.indexOf('conveyor-moved'); // express pulse
    const beltSecond = types.lastIndexOf('conveyor-moved'); // all-belts pulse
    const gear = types.indexOf('gear-rotated');
    expect(rotated).toBeGreaterThan(-1);
    expect(rotated).toBeLessThan(beltFirst);
    expect(beltFirst).toBeLessThan(beltSecond);
    expect(beltSecond).toBeLessThan(gear);
    const belts = eventsOf(events, 'conveyor-moved');
    expect(belts.map((b) => b.express)).toEqual([true, true]);
    expect(belts[1].to).toEqual({ x: 3, y: 1 }); // express rode 2 cells onto the gear
  });
});
