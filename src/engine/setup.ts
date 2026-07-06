import type { BoardDef, GameState, PlayerId, RobotState } from './types';
import { spawnPos } from './board';
import { buildDeck, dealHands } from './deck';
import { createRng, shuffle } from './rng';

export const STARTING_LIVES = 3;

/**
 * Create a fresh game: robots on their numbered spawn docks (seat i gets
 * spawn i+1), shuffled decks, first hands dealt. Deterministic in
 * (boardDef, playerIds, seed).
 */
export function createGame(board: BoardDef, playerIds: PlayerId[], seed: number): GameState {
  if (playerIds.length < 1) throw new Error('createGame: need at least one player');
  if (new Set(playerIds).size !== playerIds.length) {
    throw new Error('createGame: duplicate player ids');
  }

  const rng = createRng(seed);
  const robots: RobotState[] = playerIds.map((player, i) => {
    const pos = spawnPos(board, i + 1);
    if (!pos) throw new Error(`createGame: board has no spawn ${i + 1}`);
    return {
      player,
      pos,
      facing: 'N',
      damage: 0,
      lives: STARTING_LIVES,
      checkpoints: 0,
      archive: pos,
      lockedRegisters: [null, null, null, null, null],
      destroyed: false,
      eliminated: false,
    };
  });

  const state: GameState = {
    board,
    robots,
    decks: Object.fromEntries(
      playerIds.map((p) => [p, { drawPile: shuffle(buildDeck(), rng), discardPile: [] }]),
    ),
    hands: Object.fromEntries(playerIds.map((p) => [p, []])),
    turn: 1,
    startPlayerIndex: 0,
    winner: null,
  };

  dealHands(state, rng);
  return state;
}
