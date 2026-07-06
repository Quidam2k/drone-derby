import { describe, expect, it } from 'vitest';
import { buildDeck, dealHands, drawCards, handSize, isRegisterLocked } from '../deck';
import { createGame } from '../setup';
import { provingGrounds } from '../boards';
import { createRng } from '../rng';
import { emptyBoard } from '../board';
import { makeState, robot } from './helpers';

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
  it('createGame deals 9 cards to every player', () => {
    const g = createGame(provingGrounds(), ['alice', 'bob'], 42);
    expect(g.hands.alice).toHaveLength(9);
    expect(g.hands.bob).toHaveLength(9);
    expect(g.decks.alice.drawPile).toHaveLength(75);
    expect(g.decks.bob.drawPile).toHaveLength(75);
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
