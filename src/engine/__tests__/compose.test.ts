import { describe, expect, it } from 'vitest';
import type { BoardDef } from '../types';
import { emptyBoard, setTile, spawnPos, tileAt } from '../board';
import { dockyard, provingGrounds, spinCycle } from '../boards';
import { composeBoards } from '../compose';
import { validateBoard } from '../validate';

/** A 12-wide docks-less "floor" part with two checkpoints and a hazard. */
function floorPart(): BoardDef {
  const b = emptyBoard('Floor Part', 12, 6);
  setTile(b, 3, 1, { kind: 'checkpoint', n: 1 });
  setTile(b, 8, 4, { kind: 'checkpoint', n: 2 });
  setTile(b, 6, 3, { kind: 'pit' });
  return b;
}

/** A 12-wide docks part: 2 spawns, no checkpoints. */
function docksPart(): BoardDef {
  const b = emptyBoard('Docks Part', 12, 6);
  setTile(b, 4, 5, { kind: 'spawn', n: 1 });
  setTile(b, 7, 5, { kind: 'spawn', n: 2 });
  return b;
}

describe('composeBoards', () => {
  it('offsets tiles, walls, and lasers of lower parts by the height above', () => {
    const board = composeBoards([spinCycle(), dockyard()], 'Test Stack');
    expect(board.width).toBe(12);
    expect(board.height).toBe(17);

    // Spin Cycle (top part, no offset): pit and a ring belt stay put.
    expect(tileAt(board, { x: 6, y: 4 })).toEqual({ kind: 'pit' });
    expect(tileAt(board, { x: 3, y: 3 })).toEqual({ kind: 'conveyor', dir: 'E', express: false });
    expect(board.lasers).toContainEqual({ pos: { x: 0, y: 4 }, facing: 'E', strength: 1 });

    // Dockyard (bottom part): everything shifts down by Spin Cycle's 10 rows.
    expect(spawnPos(board, 1)).toEqual({ x: 2, y: 16 });
    expect(spawnPos(board, 4)).toEqual({ x: 9, y: 16 });
    expect(board.walls).toContainEqual({ x: 3, y: 16, side: 'E' });
    expect(board.walls).toContainEqual({ x: 3, y: 12, side: 'N' });
  });

  it('centers narrower parts and pads them with floor', () => {
    // Proving Grounds is 10 wide over the 12-wide dockyard → x offset 1.
    const board = composeBoards([provingGrounds(), dockyard()], 'Padded');
    expect(board.width).toBe(12);

    // Proving Grounds' checkpoint 1 sits at (8,6) → (9,6) composed.
    expect(tileAt(board, { x: 9, y: 6 })).toEqual({ kind: 'checkpoint', n: 1 });
    // Its lasers shift east by 1 with it.
    expect(board.lasers).toContainEqual({ pos: { x: 1, y: 3 }, facing: 'E', strength: 1 });
    expect(board.walls).toContainEqual({ x: 2, y: 4, side: 'N' });
    // Pad columns are plain floor.
    expect(tileAt(board, { x: 0, y: 3 })).toEqual({ kind: 'floor' });
    expect(tileAt(board, { x: 11, y: 3 })).toEqual({ kind: 'floor' });
  });

  it('keeps spawns only from the bottommost part that has any', () => {
    const board = composeBoards([spinCycle(), dockyard()], 'Docks Win');
    // Spin Cycle's own spawn row (y=9) is stripped to floor.
    expect(tileAt(board, { x: 2, y: 9 })).toEqual({ kind: 'floor' });
    expect(tileAt(board, { x: 9, y: 9 })).toEqual({ kind: 'floor' });
    // Exactly the dockyard's 4 spawns remain.
    const spawns = board.tiles.flat().filter((t) => t.kind === 'spawn');
    expect(spawns).toHaveLength(4);

    // With no spawns below, an upper part's spawns survive instead.
    const cpBottom = emptyBoard('CP Only', 12, 6);
    setTile(cpBottom, 5, 3, { kind: 'checkpoint', n: 1 });
    const upper = composeBoards([spinCycle(), cpBottom], 'Upper Docks');
    expect(tileAt(upper, { x: 2, y: 9 })).toEqual({ kind: 'spawn', n: 1 });
  });

  it('renumbers checkpoints bottom part first, keeping internal order', () => {
    const top = floorPart(); // checkpoints 1 at (3,1), 2 at (8,4)
    const middle = floorPart(); // same layout, 6 rows lower
    const board = composeBoards([top, middle, docksPart()], 'Renumbered');

    // Middle part (bottom-most with checkpoints) claims 1..2.
    expect(tileAt(board, { x: 3, y: 7 })).toEqual({ kind: 'checkpoint', n: 1 });
    expect(tileAt(board, { x: 8, y: 10 })).toEqual({ kind: 'checkpoint', n: 2 });
    // Top part's follow as 3..4, preserving its internal 1→2 order.
    expect(tileAt(board, { x: 3, y: 1 })).toEqual({ kind: 'checkpoint', n: 3 });
    expect(tileAt(board, { x: 8, y: 4 })).toEqual({ kind: 'checkpoint', n: 4 });
  });

  it('throws on an empty part list and on results past the size cap', () => {
    expect(() => composeBoards([], 'Nothing')).toThrow(/at least one part/);
    // 10 + 10 + 7 = 27 tall > 24.
    expect(() => composeBoards([spinCycle(), spinCycle(), dockyard()], 'Too Tall')).toThrow(
      /between/,
    );
  });

  it('throws when the composed board has no checkpoints or no spawns', () => {
    expect(() => composeBoards([docksPart()], 'No CPs')).toThrow(/checkpoint/);
    expect(() => composeBoards([floorPart()], 'No Docks')).toThrow(/spawn/);
  });

  it('produces a board that validates clean', () => {
    const board = composeBoards([spinCycle(), dockyard()], 'Grand Circuit');
    expect(validateBoard(board)).toEqual({ errors: [], warnings: [] });
  });

  it('is deterministic and never mutates its input parts', () => {
    const parts = [spinCycle(), dockyard()];
    const snapshot = structuredClone(parts);
    const a = composeBoards(parts, 'Same');
    const b = composeBoards(parts, 'Same');
    expect(a).toEqual(b);
    expect(parts).toEqual(snapshot);
  });
});
