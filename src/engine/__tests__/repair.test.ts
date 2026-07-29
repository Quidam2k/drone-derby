import { describe, expect, it } from 'vitest';
import type { Card, GameState } from '../types';
import { emptyBoard, setTile } from '../board';
import { RESPAWN_DAMAGE } from '../execute';
import { card, eventsOf, makeState, prog, robot, robotOf, run } from './helpers';

const wrenchBoard = () => {
  const b = emptyBoard('repair', 10, 10);
  setTile(b, 5, 4, { kind: 'wrench' });
  return b;
};

/**
 * Pull a card out of the shared draw pile by id, so hand-planting it in a
 * locked register keeps the deck at exactly 84 unique cards — the invariant
 * the unlock tests assert on.
 */
function takeFromDeck(s: GameState, id: string): Card {
  const i = s.deck.drawPile.findIndex((c) => c.id === id);
  if (i === -1) throw new Error(`${id} not in draw pile`);
  return s.deck.drawPile.splice(i, 1)[0];
}

function totalCards(s: GameState): number {
  const held = s.robots.reduce(
    (n, r) => n + r.lockedRegisters.filter((c) => c !== null).length,
    0,
  );
  const inHands = Object.values(s.hands).reduce((n, h) => n + h.length, 0);
  return s.deck.drawPile.length + s.deck.discardPile.length + inHands + held;
}

describe('end-of-turn repair', () => {
  it('ending the turn on a wrench discards 1 damage and moves the archive there', () => {
    const s = makeState(wrenchBoard(), [robot('a', 5, 5, 'N', { damage: 3 })]);
    const r = run(s, { a: prog(card('move1', 500)) });
    expect(eventsOf(r.events, 'repair')).toEqual([
      { type: 'repair', player: 'a', amount: 1, total: 2 },
    ]);
    expect(robotOf(r, 'a').damage).toBe(2);
    expect(robotOf(r, 'a').archive).toEqual({ x: 5, y: 4 });
  });

  it('an undamaged robot does not repair, but the archive still moves', () => {
    const s = makeState(wrenchBoard(), [robot('a', 5, 5, 'N')]);
    const r = run(s, { a: prog(card('move1', 500)) });
    expect(eventsOf(r.events, 'repair')).toHaveLength(0);
    expect(robotOf(r, 'a').damage).toBe(0);
    expect(robotOf(r, 'a').archive).toEqual({ x: 5, y: 4 });
  });

  it('passing over a wrench mid-move does not repair — only ending the turn there does', () => {
    const s = makeState(wrenchBoard(), [robot('a', 5, 5, 'N', { damage: 3 })]);
    const r = run(s, { a: prog(card('move2', 700)) }); // crosses (5,4), ends (5,3)
    expect(eventsOf(r.events, 'repair')).toHaveLength(0);
    expect(robotOf(r, 'a').damage).toBe(3);
  });

  it('a checkpoint repairs too (flags are repair sites)', () => {
    const b = emptyBoard('cp-repair', 10, 10);
    setTile(b, 5, 4, { kind: 'checkpoint', n: 1 });
    const s = makeState(b, [robot('a', 5, 5, 'N', { damage: 4 })]);
    const r = run(s, { a: prog(card('move1', 500)) });
    expect(eventsOf(r.events, 'checkpoint-claimed')).toHaveLength(1);
    // Claiming the only checkpoint wins the game; repair is gated on the game
    // continuing, so use a 2-checkpoint board when asserting the repair.
    const b2 = emptyBoard('cp-repair-2', 10, 10);
    setTile(b2, 5, 4, { kind: 'checkpoint', n: 1 });
    setTile(b2, 1, 1, { kind: 'checkpoint', n: 2 });
    const s2 = makeState(b2, [robot('a', 5, 5, 'N', { damage: 4 })]);
    const r2 = run(s2, { a: prog(card('move1', 500)) });
    expect(eventsOf(r2.events, 'repair')).toEqual([
      { type: 'repair', player: 'a', amount: 1, total: 3 },
    ]);
    expect(robotOf(r2, 'a').damage).toBe(3);
  });

  it('a destroyed robot does not repair the turn it died, even respawning onto a wrench', () => {
    const b = wrenchBoard();
    setTile(b, 6, 5, { kind: 'pit' });
    const s = makeState(b, [
      robot('a', 5, 5, 'E', { damage: 4, archive: { x: 5, y: 4 } }),
      robot('b', 0, 0, 'N'),
    ]);
    const r = run(s, { a: prog(card('move1', 500)) }); // walks into the pit
    expect(eventsOf(r.events, 'robot-fell')).toHaveLength(1);
    expect(eventsOf(r.events, 'repair')).toHaveLength(0);
    const a = robotOf(r, 'a');
    expect(a.pos).toEqual({ x: 5, y: 4 }); // respawned onto the wrench
    expect(a.damage).toBe(RESPAWN_DAMAGE); // untouched by the wrench this turn
  });

  it('repairing 5→4 unlocks register 5 and the freed card joins the shared discard', () => {
    const s = makeState(wrenchBoard(), [robot('a', 5, 5, 'N', { damage: 5 })]);
    const locked = takeFromDeck(s, 'uTurn-10');
    s.robots[0].lockedRegisters[4] = locked;
    const move = takeFromDeck(s, 'move1-500');
    const r = run(s, { a: prog(move) }); // register 5 replays the locked uTurn in place

    expect(eventsOf(r.events, 'repair')).toEqual([
      { type: 'repair', player: 'a', amount: 1, total: 4 },
    ]);
    expect(eventsOf(r.events, 'register-unlocked')).toEqual([
      { type: 'register-unlocked', player: 'a', register: 5, card: locked },
    ]);
    const a = robotOf(r, 'a');
    expect(a.damage).toBe(4);
    expect(a.lockedRegisters).toEqual([null, null, null, null, null]);
    // The freed card flowed back into the shared pool the same turn (29c).
    expect(r.state.deck.discardPile.some((c) => c.id === locked.id)).toBe(true);
    expect(totalCards(r.state)).toBe(84);
  });

  it('repairing 7→6 frees only register 3; registers 4 and 5 stay locked', () => {
    const s = makeState(wrenchBoard(), [robot('a', 5, 5, 'N', { damage: 7 })]);
    const l3 = takeFromDeck(s, 'turnLeft-70');
    const l4 = takeFromDeck(s, 'turnRight-80');
    const l5 = takeFromDeck(s, 'uTurn-10');
    s.robots[0].lockedRegisters[2] = l3;
    s.robots[0].lockedRegisters[3] = l4;
    s.robots[0].lockedRegisters[4] = l5;
    const move = takeFromDeck(s, 'move1-500');
    const r = run(s, { a: prog(move) });

    expect(eventsOf(r.events, 'register-unlocked')).toEqual([
      { type: 'register-unlocked', player: 'a', register: 3, card: l3 },
    ]);
    const a = robotOf(r, 'a');
    expect(a.damage).toBe(6);
    expect(a.lockedRegisters).toEqual([null, null, null, l4, l5]);
    expect(r.state.deck.discardPile.some((c) => c.id === l3.id)).toBe(true);
    expect(r.state.deck.discardPile.some((c) => c.id === l4.id)).toBe(false);
    expect(r.state.deck.discardPile.some((c) => c.id === l5.id)).toBe(false);
    expect(totalCards(r.state)).toBe(84);
  });

  it('unlocking a register that locked while idle emits card: null', () => {
    const s = makeState(wrenchBoard(), [robot('a', 5, 5, 'N', { damage: 5 })]);
    // Register 5 locked with nothing in it (the robot idled when it locked).
    const move = takeFromDeck(s, 'move1-500');
    const r = run(s, { a: prog(move) });
    expect(eventsOf(r.events, 'register-unlocked')).toEqual([
      { type: 'register-unlocked', player: 'a', register: 5, card: null },
    ]);
    expect(totalCards(r.state)).toBe(84);
  });
});
