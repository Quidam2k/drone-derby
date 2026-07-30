// Multi-board composition: stack part boards edge-to-edge vertically into
// one larger BoardDef (factory floor above, docks below). Pure and
// dependency-free like the rest of the engine — composition is purely a
// BoardDef concern; turn execution never knows a board was composed.

import type { BoardDef, TileDef } from './types';
import { emptyBoard } from './board';
import { validateBoard } from './validate';

/**
 * Stack `parts` top-to-bottom (`parts[0]` is the northmost) into one board.
 *
 * - Spawns are kept ONLY from the bottommost part that has any (the docks);
 *   spawns in upper parts are stripped — that's the point of composing a
 *   run on top of an existing floor.
 * - Checkpoints renumber bottom part first, then upward, preserving each
 *   part's internal order, so the race flows out of the docks northward.
 * - Narrower parts are centered and padded with floor; walls and lasers
 *   are offset along with their part.
 *
 * Throws if `parts` is empty or the composed board fails `validateBoard`
 * (size outside 6..24, bad spawn count, no checkpoints, …).
 */
export function composeBoards(parts: BoardDef[], name: string): BoardDef {
  if (parts.length === 0) {
    throw new Error('composeBoards needs at least one part board');
  }

  const width = Math.max(...parts.map((p) => p.width));
  const board = emptyBoard(
    name,
    width,
    parts.reduce((sum, p) => sum + p.height, 0),
  );

  // The bottommost part with any spawn keeps them; every other part's
  // spawns become plain floor.
  const spawnOwner = parts.reduce(
    (owner, p, i) =>
      p.tiles.some((row) => row.some((t) => t.kind === 'spawn')) ? i : owner,
    -1,
  );

  // New checkpoint numbers start after all checkpoints of the parts BELOW
  // (higher index = further south = earlier in the race).
  const cpCounts = parts.map(
    (p) => p.tiles.flat().filter((t) => t.kind === 'checkpoint').length,
  );

  let yOff = 0;
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const xOff = Math.floor((width - part.width) / 2);
    const cpOffset = cpCounts.slice(i + 1).reduce((a, b) => a + b, 0);

    // Rank this part's checkpoints by their internal numbers, then shift
    // the whole block up past everything south of it.
    const cpNumbers = part.tiles
      .flat()
      .filter((t) => t.kind === 'checkpoint')
      .map((t) => t.n)
      .sort((a, b) => a - b);
    const renumber = new Map(cpNumbers.map((n, rank) => [n, cpOffset + rank + 1]));

    for (let y = 0; y < part.height; y++) {
      for (let x = 0; x < part.width; x++) {
        const t = part.tiles[y][x];
        if (t.kind === 'floor') continue;
        if (t.kind === 'spawn' && i !== spawnOwner) continue;
        const copy: TileDef =
          t.kind === 'checkpoint'
            ? { kind: 'checkpoint', n: renumber.get(t.n) ?? t.n }
            : { ...t };
        board.tiles[yOff + y][xOff + x] = copy;
      }
    }

    for (const w of part.walls) {
      board.walls.push({ ...w, x: w.x + xOff, y: w.y + yOff });
    }
    for (const l of part.lasers) {
      board.lasers.push({
        pos: { x: l.pos.x + xOff, y: l.pos.y + yOff },
        facing: l.facing,
        strength: l.strength,
      });
    }
    for (const p of part.pushers ?? []) {
      (board.pushers ??= []).push({
        pos: { x: p.pos.x + xOff, y: p.pos.y + yOff },
        facing: p.facing,
        registers: [...p.registers],
      });
    }
    for (const c of part.crushers ?? []) {
      (board.crushers ??= []).push({
        pos: { x: c.pos.x + xOff, y: c.pos.y + yOff },
        registers: [...c.registers],
      });
    }
    for (const f of part.flamers ?? []) {
      (board.flamers ??= []).push({
        pos: { x: f.pos.x + xOff, y: f.pos.y + yOff },
        registers: [...f.registers],
      });
    }

    yOff += part.height;
  }

  const { errors } = validateBoard(board);
  if (errors.length > 0) {
    throw new Error(`Can't compose "${name}": ${errors[0]}`);
  }
  return board;
}
