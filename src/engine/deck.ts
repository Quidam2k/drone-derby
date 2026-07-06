import type { Card, CardType, GameState, PlayerDeck, PlayerId } from './types';
import type { Rng } from './rng';
import { shuffle } from './rng';

/**
 * 84-card deck per player, classic priority ladder (all priorities unique
 * within a deck). Matches docs/game_mechanics_md.md composition:
 *   U-Turn        6 × (10..60   step 10)
 *   Turn Left    18 × (70..410  step 20)
 *   Turn Right   18 × (80..420  step 20)
 *   Back Up       6 × (430..480 step 10)
 *   Move 1       18 × (490..660 step 10)
 *   Move 2       12 × (670..780 step 10)
 *   Move 3        6 × (790..840 step 10)
 */
const DECK_SPEC: { type: CardType; count: number; start: number; step: number }[] = [
  { type: 'uTurn', count: 6, start: 10, step: 10 },
  { type: 'turnLeft', count: 18, start: 70, step: 20 },
  { type: 'turnRight', count: 18, start: 80, step: 20 },
  { type: 'backUp', count: 6, start: 430, step: 10 },
  { type: 'move1', count: 18, start: 490, step: 10 },
  { type: 'move2', count: 12, start: 670, step: 10 },
  { type: 'move3', count: 6, start: 790, step: 10 },
];

/** Build one player's full 84-card deck in deterministic (unshuffled) order. */
export function buildDeck(): Card[] {
  const cards: Card[] = [];
  for (const spec of DECK_SPEC) {
    for (let i = 0; i < spec.count; i++) {
      const priority = spec.start + i * spec.step;
      cards.push({ id: `${spec.type}-${priority}`, type: spec.type, priority });
    }
  }
  return cards;
}

/** Registers locked at a damage level (locks fill from register 5 downward). */
export function lockedRegisterCount(damage: number): number {
  return Math.max(0, Math.min(5, damage - 4));
}

/** Is 1-based register r locked at this damage level? */
export function isRegisterLocked(damage: number, register: number): boolean {
  return register > 5 - lockedRegisterCount(damage);
}

/** Hand size at a damage level: 9 − damage, floor 0. */
export function handSize(damage: number): number {
  return Math.max(0, 9 - damage);
}

/** Draw n cards, reshuffling the discard pile into the draw pile if needed. */
export function drawCards(deck: PlayerDeck, n: number, rng: Rng): Card[] {
  const drawn: Card[] = [];
  while (drawn.length < n) {
    if (deck.drawPile.length === 0) {
      if (deck.discardPile.length === 0) break; // rest of deck is locked/held
      deck.drawPile = shuffle(deck.discardPile, rng);
      deck.discardPile = [];
    }
    drawn.push(deck.drawPile.shift()!);
  }
  return drawn;
}

/**
 * Deal every operating player a fresh hand of 9 − damage cards (locked
 * registers keep their cards outside the deck, so a damaged player needs
 * fewer). Mutates `state` — callers own cloning (executeTurn/createGame do).
 */
export function dealHands(state: GameState, rng: Rng): void {
  for (const robot of state.robots) {
    if (robot.eliminated) continue;
    state.hands[robot.player] = drawCards(
      state.decks[robot.player],
      handSize(robot.damage),
      rng,
    );
  }
}

export function discardHand(state: GameState, player: PlayerId): void {
  const hand = state.hands[player];
  if (hand && hand.length > 0) {
    state.decks[player].discardPile.push(...hand);
  }
  state.hands[player] = [];
}
