import { describe, expect, it } from 'vitest';
import type { BoardDef } from '../types';
import { emptyBoard, setTile } from '../board';
import { BUILTIN_BOARDS } from '../boards';
import { validateBoard } from '../validate';
import { applyFlagPlacements, checkpointPositions } from '../placement';

/** 8×8 with 2 spawns, 2 printed flags, and a pit/belt to trip on. */
function board(): BoardDef {
  const b = emptyBoard('Test', 8, 8);
  setTile(b, 1, 7, { kind: 'spawn', n: 1 });
  setTile(b, 3, 7, { kind: 'spawn', n: 2 });
  setTile(b, 4, 1, { kind: 'checkpoint', n: 1 });
  setTile(b, 6, 3, { kind: 'checkpoint', n: 2 });
  setTile(b, 4, 4, { kind: 'pit' });
  setTile(b, 2, 2, { kind: 'conveyor', dir: 'E', express: false });
  return b;
}

describe('checkpointPositions', () => {
  it('returns checkpoint tiles sorted by flag number', () => {
    // Printed flag 2 sits earlier in row-major order than flag 1 here.
    const b = emptyBoard('Order', 8, 8);
    setTile(b, 1, 1, { kind: 'checkpoint', n: 2 });
    setTile(b, 6, 6, { kind: 'checkpoint', n: 1 });
    expect(checkpointPositions(b)).toEqual([
      { x: 6, y: 6 },
      { x: 1, y: 1 },
    ]);
  });
});

describe('applyFlagPlacements', () => {
  it('strips printed flags and paints new ones numbered by array order', () => {
    const out = applyFlagPlacements(board(), [
      { x: 7, y: 0 },
      { x: 0, y: 0 },
      { x: 5, y: 5 },
    ]);
    expect(out.tiles[1][4]).toEqual({ kind: 'floor' });
    expect(out.tiles[3][6]).toEqual({ kind: 'floor' });
    expect(out.tiles[0][7]).toEqual({ kind: 'checkpoint', n: 1 });
    expect(out.tiles[0][0]).toEqual({ kind: 'checkpoint', n: 2 });
    expect(out.tiles[5][5]).toEqual({ kind: 'checkpoint', n: 3 });
    expect(validateBoard(out).errors).toEqual([]);
  });

  it('never mutates the input board', () => {
    const b = board();
    const snapshot = structuredClone(b);
    applyFlagPlacements(b, [{ x: 0, y: 0 }]);
    expect(b).toEqual(snapshot);
  });

  it('round-trips the printed flags of every built-in board unchanged', () => {
    for (const [key, { factory }] of Object.entries(BUILTIN_BOARDS)) {
      const b = factory();
      expect(applyFlagPlacements(b, checkpointPositions(b)), key).toEqual(b);
    }
  });

  it('accepts a printed flag square as a target (strip happens first)', () => {
    const out = applyFlagPlacements(board(), [{ x: 6, y: 3 }]);
    expect(out.tiles[3][6]).toEqual({ kind: 'checkpoint', n: 1 });
    expect(checkpointPositions(out)).toEqual([{ x: 6, y: 3 }]);
  });

  it('supports 1 through 6 flags', () => {
    for (let n = 1; n <= 6; n++) {
      const placements = Array.from({ length: n }, (_, i) => ({ x: i, y: 0 }));
      const out = applyFlagPlacements(board(), placements);
      expect(checkpointPositions(out)).toEqual(placements);
      expect(validateBoard(out).errors).toEqual([]);
    }
  });

  it('throws on an out-of-bounds or fractional target', () => {
    expect(() => applyFlagPlacements(board(), [{ x: 8, y: 0 }])).toThrow(/off the board/);
    expect(() => applyFlagPlacements(board(), [{ x: -1, y: 3 }])).toThrow(/off the board/);
    expect(() => applyFlagPlacements(board(), [{ x: 1.5, y: 3 }])).toThrow(/off the board/);
  });

  it('throws on a target that is not plain floor', () => {
    expect(() => applyFlagPlacements(board(), [{ x: 4, y: 4 }])).toThrow(/not a pit/);
    expect(() => applyFlagPlacements(board(), [{ x: 2, y: 2 }])).toThrow(/not a conveyor/);
    expect(() => applyFlagPlacements(board(), [{ x: 1, y: 7 }])).toThrow(/not a spawn/);
  });

  it('throws on duplicate positions', () => {
    expect(() =>
      applyFlagPlacements(board(), [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ]),
    ).toThrow(/another flag/);
  });
});
