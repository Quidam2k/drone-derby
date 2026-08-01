// Flag (checkpoint) placement at game creation — the tabletop rule that
// flags move from game to game. Pure board-to-board transform shared by the
// client (setup preview, hot-seat) and Convex createGame (authoritative
// re-application on the server's copy of the board).

import type { BoardDef, Position, TileDef } from './types';
import { inBounds } from './board';

/** Positions of the board's checkpoints, sorted by flag number. */
export function checkpointPositions(board: BoardDef): Position[] {
  const flags: { n: number; pos: Position }[] = [];
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const t = board.tiles[y][x];
      if (t.kind === 'checkpoint') flags.push({ n: t.n, pos: { x, y } });
    }
  }
  return flags.sort((a, b) => a.n - b.n).map((f) => f.pos);
}

/**
 * Replace the board's printed flags: strip every checkpoint to plain floor,
 * then paint checkpoint 1..n at `placements` in array order. Never mutates
 * the input.
 *
 * Throws on a target that is off the board, duplicated, or not plain floor
 * (after the strip, so a printed flag's cell is a legal target). validateBoard
 * cannot catch a checkpoint painted over a belt — the result would just be a
 * "valid" board missing a belt — so the strictness lives here. Callers still
 * run validateBoard on the result for everything it CAN see (flag count etc.).
 */
export function applyFlagPlacements(board: BoardDef, placements: Position[]): BoardDef {
  const tiles: TileDef[][] = board.tiles.map((row) =>
    row.map((t) => (t.kind === 'checkpoint' ? { kind: 'floor' } : t)),
  );
  const seen = new Set<string>();
  placements.forEach((p, i) => {
    const flag = `flag ${i + 1}`;
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || !inBounds(board, p)) {
      throw new Error(`${flag} at (${p.x},${p.y}) is off the board`);
    }
    const key = `${p.x},${p.y}`;
    if (seen.has(key)) throw new Error(`${flag} at (${p.x},${p.y}) is on another flag's square`);
    seen.add(key);
    const target = tiles[p.y][p.x];
    if (target.kind !== 'floor') {
      throw new Error(`${flag} at (${p.x},${p.y}) must sit on plain floor, not a ${target.kind}`);
    }
    tiles[p.y][p.x] = { kind: 'checkpoint', n: i + 1 };
  });
  return { ...board, tiles };
}
