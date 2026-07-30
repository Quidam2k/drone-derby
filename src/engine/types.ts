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
  /** Globally unique — one shared deck, e.g. "move1-490". */
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

export type PortalColor = 'red' | 'blue' | 'green' | 'purple' | 'orange';

export type TileDef =
  | { kind: 'floor' }
  | {
      kind: 'pit';
      /**
       * Renderer-only art variant (Radioactive's drains are pits with grate
       * art). The engine never reads this field.
       */
      style?: 'drain';
    }
  | {
      kind: 'trapdoor';
      /**
       * Trap-door pit (expansion rule): a covered pit that opens on the
       * listed registers (1-based). While open it is a pit for the ENTIRE
       * register phase — a robot starting the phase on it, or entering it by
       * any means during the phase, falls. Closed, it is plain floor.
       */
      registers: number[];
    }
  | {
      /** Robot ending the TURN here takes 1 damage (register 5's laser segment). */
      kind: 'radiation';
    }
  | {
      /** Robot ending ANY register phase here takes 1 damage (laser segment). */
      kind: 'waste';
    }
  | {
      /**
       * Paired by color: a robot entering a portal during movement-card
       * execution (walked or chain-pushed) relocates to the same-color twin
       * and continues its movement from there. Twin occupied → inert floor.
       */
      kind: 'portal';
      color: PortalColor;
    }
  | {
      /**
       * A robot executing a MOVEMENT card while standing here appears
       * (card squares + 2) forward — Back-Up: 2 forward, per the printed
       * guide — ignoring everything in between. Destination occupied → the
       * teleporter doesn't operate and the card executes normally. Rotate
       * cards are unaffected.
       */
      kind: 'teleporter';
    }
  | {
      /**
       * Repulsor field: a robot that runs into this square during card
       * movement (or is chain-pushed into it) is flung straight back by
       * the moving robot's card value, chain-pushing everything behind it,
       * and the card's remaining movement is lost. Inert to belts/pushers.
       */
      kind: 'repulsor';
    }
  | {
      kind: 'conveyor';
      /** EXIT direction — where a rider is carried next pulse. */
      dir: Direction;
      express: boolean;
      /**
       * Curved belt section. A robot CARRIED onto this tile by a belt (never
       * walked, pushed, or respawned) rotates 90° in the curve's direction.
       * The entry travel direction is derived: rotate(dir, cw ? -1 : +1).
       */
      curve?: 'cw' | 'ccw';
    }
  | { kind: 'gear'; cw: boolean }
  | { kind: 'checkpoint'; n: number }
  | { kind: 'spawn'; n: number }
  | { kind: 'wrench' };

/**
 * A wall sits on one edge of a cell and blocks crossing in both directions:
 * a wall at (x, y) side 'E' blocks moving E out of (x,y) and W out of (x+1,y).
 */
export interface WallDef {
  x: number;
  y: number;
  side: Direction;
  /**
   * One-way wall (expansion rule). 'out' blocks only LEAVING the cell
   * through this edge; 'in' blocks only ENTERING the cell through it.
   * Absent = normal two-way wall. Applies to movement and laser fire alike
   * (both go through wallBlocked).
   */
  oneWay?: 'in' | 'out';
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

/**
 * Wall-mounted pusher piston. Mounted on the `opposite(facing)` edge of its
 * cell; on the registers listed in `registers` (1-based) it shoves the robot
 * in its cell one space in `facing`, with normal chain-push / wall-block /
 * pit-fall rules. Classic variants are registers [1,3,5] and [2,4].
 */
export interface PusherDef {
  pos: Position;
  facing: Direction;
  registers: number[];
}

/**
 * Overhead crusher (expansion rule). On the registers listed (1-based) it
 * slams down during Board Elements step 5 (after gears) and destroys any
 * robot in its cell outright.
 */
export interface CrusherDef {
  pos: Position;
  registers: number[];
}

/**
 * Flamer jet (expansion rule). Active on the registers listed (1-based).
 * Burns 1 damage: per active-flamer square a robot moves onto or through
 * during card movement, per rotate card executed on one, and again at the
 * laser segment for a robot ending the register phase on one.
 */
export interface FlamerDef {
  pos: Position;
  registers: number[];
}

export interface BoardDef {
  name: string;
  width: number;
  height: number;
  /** Row-major: tiles[y][x]. Must be fully populated. */
  tiles: TileDef[][];
  walls: WallDef[];
  lasers: LaserDef[];
  /** Optional so stored boards/states predating pushers stay valid (absent = none). */
  pushers?: PusherDef[];
  /** Optional like pushers (absent = none). */
  crushers?: CrusherDef[];
  /** Optional like pushers (absent = none). */
  flamers?: FlamerDef[];
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
  /**
   * Set when the robot re-entered play at the end of the previous turn
   * (facing N). Gates the one-shot facing choice applied at the start of
   * the next executeTurn, and tells the programming UI to show the facing
   * picker. Cleared by the next executeTurn regardless of any choice.
   * Optional so stored states and old fixtures stay valid (absent = false).
   */
  justRespawned?: boolean;
  /**
   * Powered down for the CURRENT turn (1994 rule, announced while
   * programming the PREVIOUS turn). All damage is removed at the start of
   * the turn, the robot needs no program, executes no registers and fires
   * no laser — but belts, gears, pushes and lasers still affect it. Set at
   * end of turn from TurnChoices.powerDown; cleared when the player wakes
   * it (or by destruction). Optional so stored states stay valid.
   */
  poweredDown?: boolean;
  /** Out of lives. Permanent. */
  eliminated: boolean;
}

/** The single shared 84-card deck all players draw from (board-game rule). */
export interface Deck {
  drawPile: Card[];
  discardPile: Card[];
}

export interface GameState {
  board: BoardDef;
  /** Seat order; fixed for the whole game. */
  robots: RobotState[];
  deck: Deck;
  hands: Record<PlayerId, Card[]>;
  /** 1-based number of the turn currently being programmed/executed. */
  turn: number;
  /** Seat index that wins priority ties this turn; rotates every turn. */
  startPlayerIndex: number;
  winner: PlayerId | null;
}
