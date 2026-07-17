// Ghost preview for the programming screen: run one player's turn-so-far on
// a solo copy of the state so board effects — belts (express order), gears,
// walls, pits, board lasers, checkpoints — play out as engine truth. Other
// robots are EXCLUDED, not frozen: their programs are unknown, so a predicted
// push would usually be wrong. The ghost may pass through them.

import type { Card, GameState, PlayerId, Program } from './types';
import type { EventLog } from './events';
import { isRegisterLocked } from './deck';
import { executeTurn, isGameOver } from './execute';

/**
 * Simulate `player`'s partially-programmed turn and return the EventLog,
 * truncated after the last filled register (locked registers count as
 * filled — their cards are known and auto-play). Empty registers before the
 * last filled one idle, but board effects still pulse there. Returns [] when
 * nothing is filled. If the ghost dies, the log ends with the death — no
 * respawn — so the ghost stays gone.
 */
export function previewProgram(state: GameState, player: PlayerId, program: Program): EventLog {
  const robot = state.robots.find((r) => r.player === player);
  if (!robot || robot.destroyed || robot.eliminated || isGameOver(state)) return [];

  const padded: (Card | null)[] = Array.from({ length: 5 }, (_, i) => program[i] ?? null);
  let last = 0;
  for (let r = 1; r <= 5; r++) {
    if (isRegisterLocked(robot.damage, r) || padded[r - 1] !== null) last = r;
  }
  if (last === 0) return [];

  // Solo state: only this robot exists — no pushes, no rival lasers, no
  // priority ties. executeTurn clones its input, so sharing references to
  // the real board/deck/hand is safe. Online clients get a redacted state
  // with no decks — substitute an empty one; the end-of-turn deal and
  // discard bookkeeping are cut from the preview anyway.
  const solo: GameState = {
    board: state.board,
    robots: [robot],
    decks: { [player]: state.decks[player] ?? { drawPile: [], discardPile: [] } },
    hands: { [player]: state.hands[player] ?? [] },
    turn: state.turn,
    startPlayerIndex: 0,
    winner: null,
  };

  // The seed only feeds the end-of-turn deal, which the preview discards.
  const { events } = executeTurn(solo, { [player]: padded }, 0);

  const cut = events.findIndex(
    (e) =>
      (e.type === 'register-started' && e.register > last) ||
      e.type === 'robot-respawned' ||
      e.type === 'turn-ended',
  );
  return cut === -1 ? events : events.slice(0, cut);
}
