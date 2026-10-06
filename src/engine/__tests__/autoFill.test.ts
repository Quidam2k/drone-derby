import { describe, expect, it } from 'vitest';
import { autoFillProgram, buildDeck, isRegisterLocked } from '../deck';
import { createRng } from '../rng';

const hand = buildDeck().slice(0, 9);

describe('autoFillProgram (turn timer ran out)', () => {
  it('fills all five registers with distinct hand cards', () => {
    const program = autoFillProgram(hand, 0, [null, null, null, null, null], createRng(1));
    expect(program).toHaveLength(5);
    const ids = program.map((c) => c!.id);
    expect(new Set(ids).size).toBe(5);
    for (const id of ids) expect(hand.some((c) => c.id === id)).toBe(true);
  });

  it('leaves locked registers null', () => {
    const damage = 7; // registers 3–5 locked, hand of 2
    const small = hand.slice(0, 2);
    const program = autoFillProgram(small, damage, [null, null, null, null, null], createRng(2));
    program.forEach((card, i) => {
      if (isRegisterLocked(damage, i + 1)) expect(card).toBeNull();
      else expect(card).not.toBeNull();
    });
  });

  it('keeps already-placed cards and never reuses them', () => {
    const partial = [hand[4], null, null, hand[0], null];
    const program = autoFillProgram(hand, 0, partial, createRng(3));
    expect(program[0]).toEqual(hand[4]);
    expect(program[3]).toEqual(hand[0]);
    expect(new Set(program.map((c) => c!.id)).size).toBe(5);
  });

  it('drops a partial card that sits in a locked register', () => {
    const program = autoFillProgram(hand.slice(0, 4), 5, [null, null, null, null, hand[0]], createRng(4));
    expect(program[4]).toBeNull();
  });

  it('is deterministic for the same seed', () => {
    const a = autoFillProgram(hand, 2, [null, null, null, null, null], createRng(42));
    const b = autoFillProgram(hand, 2, [null, null, null, null, null], createRng(42));
    expect(a).toEqual(b);
  });

  it('does not mutate its inputs', () => {
    const before = JSON.stringify(hand);
    const partial = [null, null, null, null, null];
    autoFillProgram(hand, 0, partial, createRng(5));
    expect(JSON.stringify(hand)).toBe(before);
    expect(partial).toEqual([null, null, null, null, null]);
  });
});
