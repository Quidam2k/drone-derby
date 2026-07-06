import { describe, expect, it } from 'vitest';
import type { BoardDef, TileDef } from '../types';
import { emptyBoard, setTile } from '../board';
import { provingGrounds } from '../boards';
import { validateBoard } from '../validate';

/** Minimal playable board: 2 spawns, 1 checkpoint, one hazard (no warnings). */
function playable(): BoardDef {
  const b = emptyBoard('Test', 8, 8);
  setTile(b, 1, 7, { kind: 'spawn', n: 1 });
  setTile(b, 3, 7, { kind: 'spawn', n: 2 });
  setTile(b, 4, 1, { kind: 'checkpoint', n: 1 });
  setTile(b, 4, 4, { kind: 'pit' });
  return b;
}

describe('validateBoard', () => {
  it('passes Proving Grounds with no errors or warnings', () => {
    expect(validateBoard(provingGrounds())).toEqual({ errors: [], warnings: [] });
  });

  it('passes a minimal hand-built board', () => {
    expect(validateBoard(playable())).toEqual({ errors: [], warnings: [] });
  });

  it('rejects out-of-range dimensions', () => {
    const small = emptyBoard('s', 5, 8);
    expect(validateBoard(small).errors.some((e) => e.includes('between'))).toBe(true);
    const big = emptyBoard('b', 8, 17);
    expect(validateBoard(big).errors.some((e) => e.includes('between'))).toBe(true);
  });

  it('rejects a malformed tile grid', () => {
    const b = playable();
    b.tiles = b.tiles.slice(0, 7); // missing a row
    expect(validateBoard(b).errors).toContain('tiles must have exactly 8 rows');

    const c = playable();
    c.tiles[3] = c.tiles[3].slice(0, 7); // short row
    expect(validateBoard(c).errors).toContain('row 3 must have exactly 8 tiles');

    const d = playable();
    d.tiles[2][2] = { kind: 'volcano' } as unknown as TileDef;
    expect(validateBoard(d).errors).toContain('tile (2,2) is not a valid tile');
  });

  it('rejects wrong spawn counts', () => {
    const b = playable();
    setTile(b, 3, 7, { kind: 'floor' }); // down to 1 spawn
    expect(validateBoard(b).errors.some((e) => e.includes('spawn docks'))).toBe(true);

    const c = playable();
    setTile(c, 5, 7, { kind: 'spawn', n: 3 });
    setTile(c, 6, 7, { kind: 'spawn', n: 4 });
    setTile(c, 7, 7, { kind: 'spawn', n: 5 });
    expect(validateBoard(c).errors.some((e) => e.includes('spawn docks'))).toBe(true);
  });

  it('rejects non-contiguous or duplicate numbering', () => {
    const b = playable();
    setTile(b, 3, 7, { kind: 'spawn', n: 3 }); // spawns 1, 3
    expect(validateBoard(b).errors).toContain('missing spawn number 2 (must run 1..2)');

    const c = playable();
    setTile(c, 5, 1, { kind: 'checkpoint', n: 1 }); // duplicate checkpoint 1
    expect(validateBoard(c).errors).toContain('duplicate checkpoint number 1');
  });

  it('rejects a board with no checkpoints', () => {
    const b = playable();
    setTile(b, 4, 1, { kind: 'floor' });
    expect(validateBoard(b).errors).toContain('need at least 1 checkpoint');
  });

  it('rejects out-of-bounds walls and lasers', () => {
    const b = playable();
    b.walls = [{ x: 8, y: 0, side: 'N' }];
    expect(validateBoard(b).errors.some((e) => e.startsWith('wall'))).toBe(true);

    const c = playable();
    c.lasers = [{ pos: { x: 0, y: -1 }, facing: 'S', strength: 1 }];
    expect(validateBoard(c).errors.some((e) => e.startsWith('laser'))).toBe(true);
  });

  it('rejects a laser emitter on a pit', () => {
    const b = playable();
    b.lasers = [{ pos: { x: 4, y: 4 }, facing: 'E', strength: 1 }];
    expect(validateBoard(b).errors).toContain('laser emitter at (4,4) sits on a pit');
  });

  it('warns on a board with no hazards', () => {
    const b = playable();
    setTile(b, 4, 4, { kind: 'floor' }); // remove the pit
    const v = validateBoard(b);
    expect(v.errors).toEqual([]);
    expect(v.warnings.some((w) => w.includes('bland'))).toBe(true);
  });

  it('warns on an express belt that feeds nothing', () => {
    const b = playable();
    setTile(b, 2, 2, { kind: 'conveyor', dir: 'E', express: true });
    const v = validateBoard(b);
    expect(v.errors).toEqual([]);
    expect(v.warnings.some((w) => w.includes('express'))).toBe(true);

    // Chained into another belt: no warning.
    setTile(b, 3, 2, { kind: 'conveyor', dir: 'E', express: false });
    expect(validateBoard(b).warnings.some((w) => w.includes('express'))).toBe(false);
  });

  it('warns when a spawn sits in a laser line, respecting walls', () => {
    const b = playable();
    b.lasers = [{ pos: { x: 1, y: 0 }, facing: 'S', strength: 1 }]; // down column 1 → spawn 1
    expect(validateBoard(b).warnings.some((w) => w.includes('spawn 1'))).toBe(true);

    b.walls = [{ x: 1, y: 3, side: 'S' }]; // wall cuts the beam before the spawn
    expect(validateBoard(b).warnings.some((w) => w.includes('spawn 1'))).toBe(false);
  });
});
