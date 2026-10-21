// Ghost preview for the programming screen: run one player's turn-so-far on
// a solo copy of the state so board effects — belts (express order), gears,
// walls, pits, board lasers, checkpoints — play out as engine truth. Other
// robots are EXCLUDED, not frozen: their programs are unknown, so a predicted
// push would usually be wrong. The ghost may pass through them.

import type { Card, Direction, GameState, PlayerId, Position, Program } from './types';
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
 *
 * `respawnFacing` rides executeTurn's TurnChoices for a just-respawned robot:
 * the ghost turns to the picked facing before register 1, so the preview
 * aims the way the picker points.
 */
export function previewProgram(
  state: GameState,
  player: PlayerId,
  program: Program,
  respawnFacing?: Direction,
): EventLog {
  const robot = state.robots.find((r) => r.player === player);
  // A powered-down robot executes nothing, so there is nothing to preview.
  if (!robot || robot.destroyed || robot.eliminated || robot.poweredDown || isGameOver(state)) {
    return [];
  }

  const padded: (Card | null)[] = Array.from({ length: 5 }, (_, i) => program[i] ?? null);
  let last = 0;
  for (let r = 1; r <= 5; r++) {
    if (isRegisterLocked(robot.damage, r) || padded[r - 1] !== null) last = r;
  }
  if (last === 0) return [];

  // Solo state: only this robot exists — no pushes, no rival lasers, no
  // priority ties. executeTurn clones its input, so sharing references to
  // the real board/deck/hand is safe. Online clients get a redacted state
  // with an emptied deck — substitute one if it's missing entirely; the
  // end-of-turn deal and discard bookkeeping are cut from the preview anyway.
  const solo: GameState = {
    board: state.board,
    robots: [robot],
    deck: state.deck ?? { drawPile: [], discardPile: [] },
    hands: { [player]: state.hands[player] ?? [] },
    turn: state.turn,
    startPlayerIndex: 0,
    winner: null,
  };

  // The seed only feeds the end-of-turn deal, which the preview discards.
  const { events } = executeTurn(
    solo,
    { [player]: padded },
    0,
    respawnFacing !== undefined ? { respawnFacing: { [player]: respawnFacing } } : undefined,
  );

  const cut = events.findIndex(
    (e) =>
      (e.type === 'register-started' && e.register > last) ||
      e.type === 'robot-respawned' ||
      e.type === 'turn-ended',
  );
  return cut === -1 ? events : events.slice(0, cut);
}

/** Where the ghost stands at the end of one programmed register. */
export interface GhostPose {
  register: number;
  pos: Position;
  facing: Direction;
  /** False on the register the ghost dies in: `pos` is the death square. */
  alive: boolean;
}

/**
 * One pose per programmed register (hand-placed or locked): the robot's
 * square and facing once that register's board effects have run. Empty
 * registers get no ghost — the robot idles there, though belts still carry
 * it. Poses stop after the register the ghost dies in.
 */
export function previewPoses(
  state: GameState,
  player: PlayerId,
  program: Program,
  respawnFacing?: Direction,
): GhostPose[] {
  const events = previewProgram(state, player, program, respawnFacing);
  const robot = state.robots.find((r) => r.player === player);
  if (!robot || events.length === 0) return [];

  const programmed = (r: number) => isRegisterLocked(robot.damage, r) || (program[r - 1] ?? null) !== null;
  const poses: GhostPose[] = [];
  let pos = robot.pos;
  let facing = robot.facing;
  let register = 0;
  const close = () => {
    if (register > 0 && programmed(register)) poses.push({ register, pos, facing, alive: true });
  };

  for (const e of events) {
    if ('player' in e && e.player !== player) continue;
    switch (e.type) {
      case 'register-started':
        close();
        register = e.register;
        break;
      case 'robot-moved':
      case 'conveyor-moved':
      case 'robot-teleported':
      case 'repulsed':
        pos = e.to;
        break;
      case 'robot-rotated':
      case 'gear-rotated':
      case 'conveyor-rotated':
        facing = e.to;
        break;
      case 'robot-fell':
      case 'robot-destroyed':
        if (register > 0) poses.push({ register, pos: e.at, facing, alive: false });
        return poses;
    }
  }
  close();
  return poses;
}
