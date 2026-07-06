// Core engine types. The engine is pure and dependency-free: no DOM, no IO,
// no Date/Math.random. All randomness flows through the seeded RNG in rng.ts.

export type Direction = 'N' | 'E' | 'S' | 'W';

export interface Position {
  x: number; // 0 = west edge, grows eastward
  y: number; // 0 = north edge, grows southward
}

export type CardType =
  | 'move1'
  | 'move2'
  | 'move3'
  | 'backUp'
  | 'turnLeft'
  | 'turnRight'
  | 'uTurn';

export interface Card {
  /** Unique within one player's deck, e.g. "move1-490". */
  id: string;
  type: CardType;
  priority: number;
}

export type PlayerId = string;

/**
 * A programmed register set for one turn. Exactly 5 slots.
 * - Slots covered by a locked register are ignored (the locked card runs).
 * - `null` in an unlocked slot means the robot idles that register
 *   (used by tests, and later for AFK auto-submits).
 */
export type Program = (Card | null)[];

export type TileDef =
  | { kind: 'floor' }
  | { kind: 'pit' }
  | { kind: 'conveyor'; dir: Direction; express: boolean }
  | { kind: 'gear'; cw: boolean }
  | { kind: 'checkpoint'; n: number }
  | { kind: 'spawn'; n: number };

/**
 * A wall sits on one edge of a cell and blocks crossing in both directions:
 * a wall at (x, y) side 'E' blocks moving E out of (x,y) and W out of (x+1,y).
 */
export interface WallDef {
  x: number;
  y: number;
  side: Direction;
}

/**
 * Wall-mounted board laser. The beam starts in the emitter's own cell and
 * travels along `facing` until it hits a robot, a wall edge, or leaves the
 * board. Each hit deals `strength` damage per firing.
 */
export interface LaserDef {
  pos: Position;
  facing: Direction;
  strength: number;
}

export interface BoardDef {
  name: string;
  width: number;
  height: number;
  /** Row-major: tiles[y][x]. Must be fully populated. */
  tiles: TileDef[][];
  walls: WallDef[];
  lasers: LaserDef[];
}

export interface RobotState {
  player: PlayerId;
  pos: Position;
  facing: Direction;
  /** 0–9 while operating; reaching 10 destroys the robot. */
  damage: number;
  lives: number;
  /** Highest checkpoint claimed so far; next target is checkpoints + 1. */
  checkpoints: number;
  /** Respawn point: last checkpoint tile ended on, else the spawn dock. */
  archive: Position;
  /**
   * Cards held by locked registers, index 0 = register 1. A register r
   * (1-based) is locked iff damage >= 5 and r > 5 - (damage - 4); locking
   * proceeds from register 5 downward. Entries outside the locked range are
   * ignored. A locked slot may hold null if the robot idled when it locked.
   */
  lockedRegisters: (Card | null)[];
  /** Fell/was destroyed this turn; respawns at end of turn if lives remain. */
  destroyed: boolean;
  /** Out of lives. Permanent. */
  eliminated: boolean;
}

export interface PlayerDeck {
  drawPile: Card[];
  discardPile: Card[];
}

export interface GameState {
  board: BoardDef;
  /** Seat order; fixed for the whole game. */
  robots: RobotState[];
  decks: Record<PlayerId, PlayerDeck>;
  hands: Record<PlayerId, Card[]>;
  /** 1-based number of the turn currently being programmed/executed. */
  turn: number;
  /** Seat index that wins priority ties this turn; rotates every turn. */
  startPlayerIndex: number;
  winner: PlayerId | null;
}
