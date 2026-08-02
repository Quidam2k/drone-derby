// The kit's piece list exists twice — `PIECE_NAMES` here and `PIECES` in
// scripts/blender/tiles.py — because one is TypeScript the board instances and
// the other is Python Blender runs. Nothing links them, and the failure is
// silent in the worst way: add a piece to tiles.py and forget the loader and it
// simply never loads; rename one in tiles.py and the loader logs a `missing`
// warning into a console nobody is reading while the board quietly draws
// primitives. Both look exactly like "the art didn't land".
//
// So this reads tiles.py as text and asserts the two lists agree, the same
// crude approach — for the same reason — as BoardView.imports.test.ts.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { PIECE_NAMES } from './tileKit';

const tilesPy = readFileSync(
  fileURLToPath(new URL('../../../scripts/blender/tiles.py', import.meta.url)),
  'utf8',
);

/** The names in tiles.py's `PIECES = [...]` table, in order. */
function piecesInBlenderScript(): string[] {
  const table = tilesPy.match(/^PIECES = \[$([\s\S]*?)^\]$/m);
  if (!table) throw new Error('tiles.py has no PIECES table — did the export shape change?');
  return [...table[1].matchAll(/^\s*\('([a-z_]+)',/gm)].map((m) => m[1]);
}

describe('the tile kit piece list matches tiles.py', () => {
  const blender = piecesInBlenderScript();

  it('parsed a plausible table — the scan itself has to keep working', () => {
    expect(blender.length).toBeGreaterThan(10);
    expect(blender).toContain('floor');
  });

  it('every piece the loader asks for is one tiles.py exports', () => {
    // Direction matters: a name here that tiles.py lacks is a piece that will
    // never load, however healthy the .glb is.
    expect(blender).toEqual(expect.arrayContaining([...PIECE_NAMES]));
  });

  it('every piece tiles.py exports is one the loader asks for', () => {
    // The other direction is wasted bytes in a file every player downloads.
    expect([...PIECE_NAMES]).toEqual(expect.arrayContaining(blender));
  });

  it('the two lists are the same length — no duplicates hiding a mismatch', () => {
    expect(new Set(PIECE_NAMES).size).toBe(PIECE_NAMES.length);
    expect(blender.length).toBe(PIECE_NAMES.length);
  });
});
