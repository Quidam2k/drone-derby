import type { BoardDef, Direction, PortalColor, Position, TileDef } from './types';

export const DIRECTIONS: Direction[] = ['N', 'E', 'S', 'W'];

export const DIR_VECTORS: Record<Direction, Position> = {
  N: { x: 0, y: -1 },
  E: { x: 1, y: 0 },
  S: { x: 0, y: 1 },
  W: { x: -1, y: 0 },
};

export function opposite(dir: Direction): Direction {
  return { N: 'S', E: 'W', S: 'N', W: 'E' }[dir] as Direction;
}

/** Rotate a facing by quarter turns; positive = clockwise. */
export function rotate(dir: Direction, quarterTurnsCW: number): Direction {
  const i = DIRECTIONS.indexOf(dir);
  return DIRECTIONS[(((i + quarterTurnsCW) % 4) + 4) % 4];
}

export function step(pos: Position, dir: Direction): Position {
  const v = DIR_VECTORS[dir];
  return { x: pos.x + v.x, y: pos.y + v.y };
}

export function samePos(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

export function inBounds(board: BoardDef, pos: Position): boolean {
  return pos.x >= 0 && pos.x < board.width && pos.y >= 0 && pos.y < board.height;
}

export function tileAt(board: BoardDef, pos: Position): TileDef {
  return board.tiles[pos.y][pos.x];
}

/**
 * Is the edge between `from` and the adjacent cell in `dir` blocked by a
 * wall? Checks both the near cell's wall and the far cell's facing wall.
 * One-way walls only count against their blocking direction: 'out' blocks
 * leaving its own cell through the edge, 'in' blocks entering it. Lasers
 * share this check, so a one-way wall passes beams the same way it passes
 * robots.
 */
export function wallBlocked(board: BoardDef, from: Position, dir: Direction): boolean {
  const to = step(from, dir);
  const back = opposite(dir);
  return board.walls.some(
    (w) =>
      // Wall on the near cell: crossing means LEAVING that cell through it.
      (w.x === from.x && w.y === from.y && w.side === dir && w.oneWay !== 'in') ||
      // Wall on the far cell: crossing means ENTERING that cell through it.
      (w.x === to.x && w.y === to.y && w.side === back && w.oneWay !== 'out'),
  );
}

/** The other portal of `color`, or null if there isn't exactly a twin. */
export function twinPortal(board: BoardDef, pos: Position, color: PortalColor): Position | null {
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      if (x === pos.x && y === pos.y) continue;
      const t = board.tiles[y][x];
      if (t.kind === 'portal' && t.color === color) return { x, y };
    }
  }
  return null;
}

/** Highest checkpoint number on the board (the winning target). */
export function countCheckpoints(board: BoardDef): number {
  let max = 0;
  for (const row of board.tiles) {
    for (const t of row) {
      if (t.kind === 'checkpoint' && t.n > max) max = t.n;
    }
  }
  return max;
}

/** Spawn dock position for spawn number n (1-based). */
export function spawnPos(board: BoardDef, n: number): Position | null {
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const t = board.tiles[y][x];
      if (t.kind === 'spawn' && t.n === n) return { x, y };
    }
  }
  return null;
}

/** All-floor board; construction helper for boards and tests. */
export function emptyBoard(name: string, width: number, height: number): BoardDef {
  return {
    name,
    width,
    height,
    tiles: Array.from({ length: height }, () =>
      Array.from({ length: width }, () => ({ kind: 'floor' }) as TileDef),
    ),
    walls: [],
    lasers: [],
    pushers: [],
    crushers: [],
    flamers: [],
  };
}

export function setTile(board: BoardDef, x: number, y: number, tile: TileDef): void {
  board.tiles[y][x] = tile;
}
