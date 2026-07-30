// Phase 39/40: the authentic transcribed boards. Each test asserts the
// exact element census counted off the photographs — a transcription
// regression net, not a rules test. If an edit here changes a count, check
// the photo crops before "fixing" the number.

import { describe, expect, it } from 'vitest';
import type { BoardDef, Direction, TileDef } from '../types';
import { BUILTIN_BOARDS } from '../boards';
import { gearBox, pinwheel, reactorCore, shakeNBake } from '../authentic';
import { validateBoard } from '../validate';

function census(board: BoardDef): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of board.tiles) {
    for (const t of row) {
      const key = t.kind === 'pit' && t.style === 'drain' ? 'drain' : t.kind;
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  return counts;
}

function tileAt(board: BoardDef, x: number, y: number): TileDef {
  return board.tiles[y][x];
}

describe('Reactor Core (transcribed)', () => {
  const board = reactorCore();

  it('matches the photographed element census', () => {
    expect(census(board)).toEqual({
      radiation: 58, // everything not carved out below
      // Ten rest pockets + four walled core cells, minus the pocket at
      // (2,2) that carries our checkpoint 2.
      floor: 13,
      waste: 34,
      drain: 4,
      teleporter: 4,
      conveyor: 24,
      wrench: 4,
      checkpoint: 3,
    });
  });

  it('places the four teleporters at the belt terminals', () => {
    for (const [x, y] of [[3, 3], [8, 3], [3, 8], [8, 8]] as const) {
      expect(tileAt(board, x, y).kind).toBe('teleporter');
    }
  });

  it('has 16 one-way walls and the 8-segment core shell', () => {
    expect(board.walls.filter((w) => w.oneWay).length).toBe(16);
    expect(board.walls.filter((w) => !w.oneWay).length).toBe(8);
    // Every one-way is stored red-side with 'out' (transcription convention).
    expect(board.walls.every((w) => !w.oneWay || w.oneWay === 'out')).toBe(true);
  });

  it('the core is sealed: nothing can enter the 2×2', () => {
    const shell = board.walls.filter((w) => !w.oneWay);
    expect(shell).toHaveLength(8);
    for (const [x, y] of [[5, 5], [6, 5], [5, 6], [6, 6]] as const) {
      const sides = shell.filter((w) => w.x === x && w.y === y).map((w) => w.side);
      expect(sides.length).toBe(2); // each corner cell carries 2 outer edges
    }
  });

  it('all belts are normal speed (no express printed on this board)', () => {
    for (const row of board.tiles) {
      for (const t of row) {
        if (t.kind === 'conveyor') expect(t.express).toBe(false);
      }
    }
  });

  it('has no lasers, pushers, crushers or flamers', () => {
    expect(board.lasers).toHaveLength(0);
    expect(board.pushers ?? []).toHaveLength(0);
    expect(board.crushers ?? []).toHaveLength(0);
    expect(board.flamers ?? []).toHaveLength(0);
  });

  it('composes with the dockyard into a valid 12×19 built-in', () => {
    const composed = BUILTIN_BOARDS['reactor-core'].factory();
    expect(composed.width).toBe(12);
    expect(composed.height).toBe(19);
    expect(validateBoard(composed).errors).toEqual([]);
  });
});

describe('Gear Box (transcribed)', () => {
  const board = gearBox();

  it('matches the photographed element census', () => {
    expect(census(board)).toEqual({
      pit: 12, // includes both cells of the printed double-wide chasm
      repulsor: 11,
      teleporter: 3,
      gear: 20,
      conveyor: 45,
      wrench: 4,
      checkpoint: 3,
      floor: 144 - 12 - 11 - 3 - 20 - 45 - 4 - 3,
    });
  });

  it('the gear cluster meshes: adjacent cluster gears counter-rotate', () => {
    for (let y = 0; y < 12; y++) {
      for (let x = 0; x < 11; x++) {
        const a = board.tiles[y][x];
        const b = board.tiles[y][x + 1];
        if (a.kind === 'gear' && b.kind === 'gear') expect(a.cw).not.toBe(b.cw);
      }
    }
    for (let y = 0; y < 11; y++) {
      for (let x = 0; x < 12; x++) {
        const a = board.tiles[y][x];
        const b = board.tiles[y + 1][x];
        if (a.kind === 'gear' && b.kind === 'gear') expect(a.cw).not.toBe(b.cw);
      }
    }
  });

  it('mounts five lasers, two of them double-strength', () => {
    expect(board.lasers).toHaveLength(5);
    expect(board.lasers.filter((l) => l.strength === 2)).toHaveLength(2);
    // Every laser on this board fires east.
    expect(board.lasers.every((l) => l.facing === 'E')).toBe(true);
  });

  it('the (8,8) laser cage is walled on both beam ends', () => {
    const sides = board.walls
      .filter((w) => w.x === 8 && w.y === 8)
      .map((w) => w.side)
      .sort();
    expect(sides).toEqual(['E', 'W']);
  });

  it('has plain two-way walls only — no one-ways printed on this board', () => {
    expect(board.walls.every((w) => !w.oneWay)).toBe(true);
  });

  it('belt spirals feed the teleporters and the rims, all at normal speed', () => {
    for (const row of board.tiles) {
      for (const t of row) {
        if (t.kind === 'conveyor') expect(t.express).toBe(false);
      }
    }
    // (10,11) carries N into the (10,10) teleporter.
    expect(tileAt(board, 10, 11)).toMatchObject({ kind: 'conveyor', dir: 'N' });
    expect(tileAt(board, 10, 10).kind).toBe('teleporter');
  });

  it('composes with the dockyard into a valid 12×19 built-in', () => {
    const composed = BUILTIN_BOARDS['gear-box'].factory();
    expect(composed.width).toBe(12);
    expect(composed.height).toBe(19);
    expect(validateBoard(composed).errors).toEqual([]);
  });
});

const OPPOSITE: Record<Direction, Direction> = { N: 'S', S: 'N', E: 'W', W: 'E' };

/**
 * Both Pinwheel and Shake 'n' Bake print with exact 180° rotational
 * symmetry. Checkpoints are ours (not printed), so they count as floor.
 */
function expectRotationallySymmetric(board: BoardDef) {
  const kindOf = (t: TileDef) => (t.kind === 'checkpoint' ? 'floor' : t.kind);
  for (let y = 0; y < 12; y++) {
    for (let x = 0; x < 12; x++) {
      const a = board.tiles[y][x];
      const b = board.tiles[11 - y][11 - x];
      expect(kindOf(b), `(${x},${y}) vs its mirror`).toBe(kindOf(a));
      if (a.kind === 'conveyor' && b.kind === 'conveyor') {
        expect(b.dir, `belt dir at mirror of (${x},${y})`).toBe(OPPOSITE[a.dir]);
        expect(b.express).toBe(a.express);
        // 180° rotation preserves chirality: curves keep their handedness.
        expect(b.curve).toBe(a.curve);
      }
    }
  }
}

describe('Pinwheel (transcribed)', () => {
  const board = pinwheel();

  it('matches the photographed element census', () => {
    expect(census(board)).toEqual({
      radiation: 16, // two 4×2 corner blocks
      waste: 6, // one 3-cell pool per radiation corner
      portal: 2, // the purple pair
      conveyor: 44, // four 10-cell spokes + four express corner singles
      trapdoor: 8,
      gear: 2,
      wrench: 2,
      checkpoint: 3,
      floor: 61, // includes the two chop shops, cut to floor
    });
  });

  it('is 180°-rotationally symmetric like the printed board', () => {
    expectRotationallySymmetric(board);
  });

  it('spins counterclockwise: all four spoke curves turn left', () => {
    const curves: [number, number, Direction][] = [
      [6, 3, 'N'], [8, 6, 'E'], [3, 5, 'W'], [5, 8, 'S'],
    ];
    for (const [x, y, dir] of curves) {
      expect(tileAt(board, x, y)).toMatchObject({
        kind: 'conveyor', dir, express: false, curve: 'ccw',
      });
    }
  });

  it('schedules the eight trap-doors as printed', () => {
    const schedule: Record<string, number[]> = {};
    board.tiles.forEach((row, y) => row.forEach((t, x) => {
      if (t.kind === 'trapdoor') schedule[`${x},${y}`] = t.registers;
    }));
    expect(schedule).toEqual({
      '3,4': [1, 5], '4,4': [3], '7,3': [2], '7,4': [4],
      '4,7': [2], '4,8': [4], '7,7': [1], '8,7': [3, 5],
    });
  });

  it('burns both squares of each printed flame', () => {
    expect(board.flamers).toEqual([
      { pos: { x: 5, y: 1 }, registers: [1, 2, 4] },
      { pos: { x: 5, y: 2 }, registers: [1, 2, 4] },
      { pos: { x: 6, y: 9 }, registers: [2, 4, 5] },
      { pos: { x: 6, y: 10 }, registers: [2, 4, 5] },
    ]);
  });

  it('crosses two double lasers behind the chop shops', () => {
    expect(board.lasers).toEqual([
      { pos: { x: 6, y: 4 }, facing: 'E', strength: 2 },
      { pos: { x: 5, y: 7 }, facing: 'W', strength: 2 },
    ]);
    // Only the four mounts — no other walls and no one-ways on this board.
    expect(board.walls).toHaveLength(4);
    expect(board.walls.every((w) => !w.oneWay)).toBe(true);
  });

  it('composes with the dockyard into a valid 12×19 built-in', () => {
    const composed = BUILTIN_BOARDS['pinwheel'].factory();
    expect(composed.width).toBe(12);
    expect(composed.height).toBe(19);
    expect(validateBoard(composed).errors).toEqual([]);
  });
});

describe("Shake 'n' Bake (transcribed)", () => {
  const board = shakeNBake();

  it('matches the photographed element census', () => {
    expect(census(board)).toEqual({
      conveyor: 52, // twelve express lines with six printed curves
      portal: 4, // blue pair + orange pair
      trapdoor: 8,
      wrench: 2,
      checkpoint: 3,
      floor: 75, // includes the two chop shops, cut to floor
    });
  });

  it('is 180°-rotationally symmetric like the printed board', () => {
    expectRotationallySymmetric(board);
  });

  it('every belt on the board is express', () => {
    for (const row of board.tiles) {
      for (const t of row) {
        if (t.kind === 'conveyor') expect(t.express).toBe(true);
      }
    }
  });

  it('links the quadrants with a blue and an orange portal pair', () => {
    expect(tileAt(board, 2, 1)).toMatchObject({ kind: 'portal', color: 'blue' });
    expect(tileAt(board, 9, 10)).toMatchObject({ kind: 'portal', color: 'blue' });
    expect(tileAt(board, 10, 2)).toMatchObject({ kind: 'portal', color: 'orange' });
    expect(tileAt(board, 1, 9)).toMatchObject({ kind: 'portal', color: 'orange' });
  });

  it('schedules the eight trap-doors as printed', () => {
    const schedule: Record<string, number[]> = {};
    board.tiles.forEach((row, y) => row.forEach((t, x) => {
      if (t.kind === 'trapdoor') schedule[`${x},${y}`] = t.registers;
    }));
    expect(schedule).toEqual({
      '3,1': [1, 5], '4,1': [2, 3, 4],
      '10,3': [1, 2, 4], '10,4': [2, 3, 5],
      '1,7': [1, 2, 4], '1,8': [2, 3, 5],
      '7,10': [1, 3, 5], '8,10': [2, 4],
    });
  });

  it('the oven is never cold: some flamer burns on every register', () => {
    expect(board.flamers).toHaveLength(4);
    for (let r = 1; r <= 5; r++) {
      expect(board.flamers!.some((f) => f.registers.includes(r)), `register ${r}`).toBe(true);
    }
  });

  it('all twelve one-way walls open inward (red side stored, none plain)', () => {
    expect(board.walls).toHaveLength(12);
    expect(board.walls.every((w) => w.oneWay === 'out')).toBe(true);
    // The four oven doors sit on the flamer cells themselves.
    const doors = [
      { x: 5, y: 5, side: 'N' }, { x: 6, y: 5, side: 'E' },
      { x: 5, y: 6, side: 'W' }, { x: 6, y: 6, side: 'S' },
    ];
    for (const d of doors) {
      expect(board.walls).toContainEqual({ ...d, oneWay: 'out' });
    }
  });

  it('has no lasers, gears, pits or crushers — heat does the work', () => {
    expect(board.lasers).toHaveLength(0);
    expect(board.crushers ?? []).toHaveLength(0);
    const kinds = census(board);
    expect(kinds.gear).toBeUndefined();
    expect(kinds.pit).toBeUndefined();
  });

  it('composes with the dockyard into a valid 12×19 built-in', () => {
    const composed = BUILTIN_BOARDS['shake-n-bake'].factory();
    expect(composed.width).toBe(12);
    expect(composed.height).toBe(19);
    expect(validateBoard(composed).errors).toEqual([]);
  });
});
