import { describe, expect, it } from 'vitest';
import { buildDeck, dealHands, drawCards, handSize, isRegisterLocked } from '../deck';
import { createGame } from '../setup';
import { executeTurn } from '../execute';
import { provingGrounds } from '../boards';
import { createRng } from '../rng';
import { emptyBoard } from '../board';
import type { GameState, PlayerId, Program } from '../types';
import { makeState, naiveProgram, robot } from './helpers';

describe('deck composition', () => {
  it('builds the 84-card deck from the spec', () => {
    const deck = buildDeck();
    expect(deck).toHaveLength(84);
    const count = (type: string) => deck.filter((c) => c.type === type).length;
    expect(count('move1')).toBe(18);
    expect(count('move2')).toBe(12);
    expect(count('move3')).toBe(6);
    expect(count('backUp')).toBe(6);
    expect(count('turnLeft')).toBe(18);
    expect(count('turnRight')).toBe(18);
    expect(count('uTurn')).toBe(6);
    // priorities and ids are unique within a deck
    expect(new Set(deck.map((c) => c.priority)).size).toBe(84);
    expect(new Set(deck.map((c) => c.id)).size).toBe(84);
    expect(Math.min(...deck.map((c) => c.priority))).toBe(10);
    expect(Math.max(...deck.map((c) => c.priority))).toBe(840);
  });
});

describe('dealing', () => {
  it('createGame deals 9 cards to every player from one shared deck', () => {
    const g = createGame(provingGrounds(), ['alice', 'bob'], 42);
    expect(g.hands.alice).toHaveLength(9);
    expect(g.hands.bob).toHaveLength(9);
    expect(g.deck.drawPile).toHaveLength(84 - 18);
    expect(g.deck.discardPile).toHaveLength(0);
    // hands come from the same deck: no card in two places
    const ids = [...g.deck.drawPile, ...g.hands.alice, ...g.hands.bob].map((c) => c.id);
    expect(new Set(ids).size).toBe(84);
  });

  it('damaged robots draw smaller hands (9 − damage)', () => {
    expect(handSize(0)).toBe(9);
    expect(handSize(4)).toBe(5);
    expect(handSize(9)).toBe(0);
    const s = makeState(emptyBoard('e', 5, 5), [robot('a', 2, 2, 'N', { damage: 6 })]);
    dealHands(s, createRng(1));
    expect(s.hands.a).toHaveLength(3);
  });

  it('locks registers from 5 downward as damage climbs past 4', () => {
    expect(isRegisterLocked(4, 5)).toBe(false);
    expect(isRegisterLocked(5, 5)).toBe(true);
    expect(isRegisterLocked(5, 4)).toBe(false);
    expect(isRegisterLocked(8, 1)).toBe(false); // damage 8 locks registers 2–5
    expect(isRegisterLocked(8, 2)).toBe(true);
    expect(isRegisterLocked(9, 1)).toBe(true);
  });

  it('reshuffles the discard pile when the draw pile runs dry', () => {
    const cards = buildDeck();
    const deck = { drawPile: cards.slice(0, 2), discardPile: cards.slice(2, 12) };
    const drawn = drawCards(deck, 5, createRng(7));
    expect(drawn).toHaveLength(5);
    expect(deck.drawPile).toHaveLength(7);
    expect(deck.discardPile).toHaveLength(0);
  });

  it('stops drawing gracefully when the whole deck is exhausted', () => {
    const deck = { drawPile: buildDeck().slice(0, 3), discardPile: [] };
    const drawn = drawCards(deck, 9, createRng(7));
    expect(drawn).toHaveLength(3);
  });

  it('is deterministic: same seed → identical shuffles and hands', () => {
    const a = createGame(provingGrounds(), ['p1', 'p2'], 1234);
    const b = createGame(provingGrounds(), ['p1', 'p2'], 1234);
    expect(a).toEqual(b);
    const c = createGame(provingGrounds(), ['p1', 'p2'], 1235);
    expect(c.hands.p1).not.toEqual(a.hands.p1);
  });
});

describe('shared-deck scarcity', () => {
  // Six players draw 54 of 84 cards per full deal, so the second deal must
  // run the draw pile dry and fold everyone's discards back in — the
  // board-game scarcity mechanic this phase exists for.
  const PLAYERS = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6'];

  function playTurns(turns: number): GameState[] {
    const state = makeState(
      emptyBoard('scarcity', 12, 12),
      PLAYERS.map((p, i) => robot(p, i * 2, 5, 'N')),
    );
    dealHands(state, createRng(9));
    const states: GameState[] = [];
    let s = state;
    for (let t = 0; t < turns; t++) {
      const programs: Record<PlayerId, Program> = {};
      for (const r of s.robots) {
        if (!r.eliminated) programs[r.player] = naiveProgram(s, r.player);
      }
      s = executeTurn(s, programs, 100 + t).state;
      states.push(s);
    }
    return states;
  }

  function allIds(s: GameState): string[] {
    return [
      ...s.deck.drawPile.map((c) => c.id),
      ...s.deck.discardPile.map((c) => c.id),
      ...Object.values(s.hands).flat().map((c) => c.id),
      ...s.robots.flatMap((r) =>
        r.lockedRegisters.filter((c) => c !== null).map((c) => c!.id),
      ),
    ];
  }

  it('reshuffles the shared discard pile into the second deal', () => {
    const [afterTurn1] = playTurns(1);
    // Turn 1's end-of-turn deal needed ~54 cards with only 30 in the draw
    // pile, so the discard pile was reshuffled in and emptied.
    expect(afterTurn1.deck.discardPile).toHaveLength(0);
    expect(afterTurn1.deck.drawPile.length).toBeGreaterThan(0);
    // Conservation holds through the reshuffle.
    const ids = allIds(afterTurn1);
    expect(ids).toHaveLength(84);
    expect(new Set(ids).size).toBe(84);
  });

  it('stays deterministic and conserves cards across reshuffling turns', () => {
    const a = playTurns(4);
    const b = playTurns(4);
    expect(a).toEqual(b);
    for (const s of a) {
      const ids = allIds(s);
      expect(ids).toHaveLength(84);
      expect(new Set(ids).size).toBe(84);
    }
  });
});
