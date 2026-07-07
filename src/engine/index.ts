// Public engine API. Pure and dependency-free; shared verbatim between the
// client (hot-seat, previews, replay) and Convex functions (authoritative
// turn execution). Never import DOM, IO, Date.now, or Math.random here.

export * from './types';
export type { EngineEvent, EventLog } from './events';

export { createGame, STARTING_LIVES } from './setup';
export {
  executeTurn,
  isGameOver,
  RESPAWN_DAMAGE,
  ROBOT_LASER_STRENGTH,
  type TurnResult,
} from './execute';
export {
  buildDeck,
  dealHands,
  drawCards,
  handSize,
  isRegisterLocked,
  lockedRegisterCount,
} from './deck';
export { createRng, shuffle, type Rng } from './rng';
export {
  countCheckpoints,
  DIR_VECTORS,
  DIRECTIONS,
  emptyBoard,
  inBounds,
  opposite,
  rotate,
  samePos,
  setTile,
  spawnPos,
  step,
  tileAt,
  wallBlocked,
} from './board';
export { BUILTIN_BOARDS, provingGrounds, spinCycle } from './boards';
export {
  MAX_BOARD_SIZE,
  MAX_SPAWNS,
  MIN_BOARD_SIZE,
  MIN_SPAWNS,
  validateBoard,
  type BoardValidation,
} from './validate';
