// Editor store behavior: painting, stroke-grouped undo/redo, edge toggles,
// auto-numbering, resize preservation. Runs in node — localStorage absent,
// persistence is a no-op here.

import { beforeEach, describe, expect, it } from 'vitest';
import { emptyBoard, validateBoard } from '../engine';
import { useEditorStore } from './editorStore';

function store() {
  return useEditorStore.getState();
}

beforeEach(() => {
  const board = emptyBoard('Untitled Board', 10, 10);
  useEditorStore.setState({
    board,
    forkedFrom: null,
    history: [board],
    historyIndex: 0,
    activeTool: 'pit',
    conveyorDir: 'E',
    conveyorExpress: false,
    gearCw: true,
    validation: validateBoard(board),
  });
  store().endStroke();
});

describe('editorStore', () => {
  it('paints tiles and round-trips through undo/redo', () => {
    store().paintTile(2, 3);
    expect(store().board.tiles[3][2]).toEqual({ kind: 'pit' });

    store().setTool('conveyor');
    store().setConveyorDir('N');
    store().setConveyorExpress(true);
    store().paintTile(4, 4);
    expect(store().board.tiles[4][4]).toEqual({ kind: 'conveyor', dir: 'N', express: true });

    store().undo();
    expect(store().board.tiles[4][4]).toEqual({ kind: 'floor' });
    expect(store().board.tiles[3][2]).toEqual({ kind: 'pit' });
    store().undo();
    expect(store().board.tiles[3][2]).toEqual({ kind: 'floor' });

    store().redo();
    store().redo();
    expect(store().board.tiles[3][2]).toEqual({ kind: 'pit' });
    expect(store().board.tiles[4][4]).toEqual({ kind: 'conveyor', dir: 'N', express: true });
  });

  it('painting after undo discards the redo branch', () => {
    store().paintTile(1, 1);
    store().paintTile(2, 2);
    store().undo();
    store().paintTile(3, 3);
    store().redo(); // nothing to redo
    expect(store().board.tiles[2][2]).toEqual({ kind: 'floor' });
    expect(store().board.tiles[1][1]).toEqual({ kind: 'pit' });
    expect(store().board.tiles[3][3]).toEqual({ kind: 'pit' });
  });

  it('groups a drag stroke into a single undo step', () => {
    store().beginStroke();
    store().paintTile(0, 0);
    store().paintTile(1, 0);
    store().paintTile(2, 0);
    store().endStroke();
    store().undo();
    expect(store().board.tiles[0].slice(0, 3)).toEqual([
      { kind: 'floor' },
      { kind: 'floor' },
      { kind: 'floor' },
    ]);
  });

  it('re-painting an identical tile is not an undo step', () => {
    store().paintTile(5, 5);
    const before = store().historyIndex;
    store().paintTile(5, 5);
    expect(store().historyIndex).toBe(before);
  });

  it('auto-numbers checkpoints and spawns with the lowest free number', () => {
    store().setTool('checkpoint');
    store().paintTile(1, 1);
    store().paintTile(2, 1);
    store().paintTile(3, 1);
    expect(store().board.tiles[1].slice(1, 4)).toEqual([
      { kind: 'checkpoint', n: 1 },
      { kind: 'checkpoint', n: 2 },
      { kind: 'checkpoint', n: 3 },
    ]);

    // Erase #2: the gap is refilled by the next paint, others keep numbers.
    store().eraseTile(2, 1);
    store().paintTile(5, 5);
    expect(store().board.tiles[5][5]).toEqual({ kind: 'checkpoint', n: 2 });

    store().setTool('spawn');
    store().paintTile(1, 9);
    expect(store().board.tiles[9][1]).toEqual({ kind: 'spawn', n: 1 });
  });

  it('toggles walls from either side of the edge', () => {
    store().toggleWall(4, 5, 'E');
    expect(store().board.walls).toEqual([{ x: 4, y: 5, side: 'E' }]);
    // Same edge, named from the neighbor: removes it.
    store().toggleWall(5, 5, 'W');
    expect(store().board.walls).toEqual([]);
  });

  it('toggles lasers firing away from the mounted edge', () => {
    store().toggleLaser(3, 3, 'W'); // mounted west, fires east
    expect(store().board.lasers).toEqual([
      { pos: { x: 3, y: 3 }, facing: 'E', strength: 1 },
    ]);
    store().toggleLaser(3, 3, 'W');
    expect(store().board.lasers).toEqual([]);
  });

  it('eraseEdge clears both wall and laser on that edge', () => {
    store().toggleWall(2, 2, 'N');
    store().toggleLaser(2, 2, 'N');
    store().eraseEdge(2, 2, 'N');
    expect(store().board.walls).toEqual([]);
    expect(store().board.lasers).toEqual([]);
  });

  it('resize preserves overlap, floor-fills growth, drops out-of-bounds extras', () => {
    store().paintTile(8, 8);
    store().paintTile(2, 2);
    store().toggleWall(9, 0, 'E');
    store().toggleWall(1, 1, 'N');
    store().setTool('laser');
    store().toggleLaser(0, 9, 'S');
    store().toggleLaser(3, 3, 'E');

    store().resizeBoard(8, 8);
    const b = store().board;
    expect(b.width).toBe(8);
    expect(b.tiles).toHaveLength(8);
    expect(b.tiles[2][2]).toEqual({ kind: 'pit' });
    expect(b.walls).toEqual([{ x: 1, y: 1, side: 'N' }]);
    expect(b.lasers).toEqual([{ pos: { x: 3, y: 3 }, facing: 'W', strength: 1 }]);

    store().resizeBoard(12, 8);
    expect(store().board.tiles[0]).toHaveLength(12);
    expect(store().board.tiles[0][11]).toEqual({ kind: 'floor' });

    // The whole resize dance undoes cleanly.
    store().undo();
    store().undo();
    expect(store().board.width).toBe(10);
    expect(store().board.tiles[8][8]).toEqual({ kind: 'pit' });
  });

  it('clamps resize to the legal range', () => {
    store().resizeBoard(3, 40);
    expect(store().board.width).toBe(6);
    expect(store().board.height).toBe(16);
  });

  it('recomputes validation on every change', () => {
    expect(store().validation.errors.length).toBeGreaterThan(0); // empty board
    store().setTool('spawn');
    store().paintTile(1, 9);
    store().paintTile(3, 9);
    store().setTool('checkpoint');
    store().paintTile(5, 1);
    expect(store().validation.errors).toEqual([]);
  });

  it('reset returns a fresh board but stays undoable', () => {
    store().paintTile(4, 4);
    store().reset();
    expect(store().board.tiles[4][4]).toEqual({ kind: 'floor' });
    store().undo();
    expect(store().board.tiles[4][4]).toEqual({ kind: 'pit' });
  });

  it('loadDraft with attribution records the fork source', () => {
    const source = emptyBoard('Copy of Thumb Test', 8, 8);
    store().loadDraft(source, { name: 'Thumb Test', authorName: 'Bob' });
    expect(store().forkedFrom).toEqual({ name: 'Thumb Test', authorName: 'Bob' });
    expect(store().board.name).toBe('Copy of Thumb Test');
  });

  it('plain loadDraft and reset clear the fork attribution', () => {
    store().loadDraft(emptyBoard('Fork', 8, 8), { name: 'Orig', authorName: 'Ann' });
    store().loadDraft(emptyBoard('Imported', 8, 8));
    expect(store().forkedFrom).toBeNull();

    store().loadDraft(emptyBoard('Fork 2', 8, 8), { name: 'Orig', authorName: 'Ann' });
    store().reset();
    expect(store().forkedFrom).toBeNull();
  });
});
