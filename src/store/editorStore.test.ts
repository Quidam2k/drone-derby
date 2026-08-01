// Editor store behavior: painting, stroke-grouped undo/redo, edge toggles,
// auto-numbering, resize preservation. Runs in node — localStorage absent,
// persistence is a no-op here.

import { beforeEach, describe, expect, it } from 'vitest';
import { BUILTIN_BOARDS, emptyBoard, validateBoard } from '../engine';
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

  it('toggles pushers shoving away from the mounted edge; re-variant replaces', () => {
    store().togglePusher(3, 3, 'W', [1, 3, 5]); // mounted west, shoves east
    expect(store().board.pushers).toEqual([
      { pos: { x: 3, y: 3 }, facing: 'E', registers: [1, 3, 5] },
    ]);
    // Same mount, other variant: replaced, not stacked.
    store().togglePusher(3, 3, 'W', [2, 4]);
    expect(store().board.pushers).toEqual([
      { pos: { x: 3, y: 3 }, facing: 'E', registers: [2, 4] },
    ]);
    // Same mount, same variant: removed.
    store().togglePusher(3, 3, 'W', [2, 4]);
    expect(store().board.pushers).toEqual([]);
  });

  it('eraseEdge clears wall, laser and pusher on that edge', () => {
    store().toggleWall(2, 2, 'N');
    store().toggleLaser(2, 2, 'N');
    store().togglePusher(2, 2, 'N', [1, 3, 5]);
    store().eraseEdge(2, 2, 'N');
    expect(store().board.walls).toEqual([]);
    expect(store().board.lasers).toEqual([]);
    expect(store().board.pushers).toEqual([]);
  });

  it('resize preserves overlap, floor-fills growth, drops out-of-bounds extras', () => {
    store().paintTile(8, 8);
    store().paintTile(2, 2);
    store().toggleWall(9, 0, 'E');
    store().toggleWall(1, 1, 'N');
    store().setTool('laser');
    store().toggleLaser(0, 9, 'S');
    store().toggleLaser(3, 3, 'E');
    store().togglePusher(9, 2, 'N', [2, 4]);
    store().togglePusher(4, 4, 'W', [1, 3, 5]);

    store().resizeBoard(8, 8);
    const b = store().board;
    expect(b.width).toBe(8);
    expect(b.tiles).toHaveLength(8);
    expect(b.tiles[2][2]).toEqual({ kind: 'pit' });
    expect(b.walls).toEqual([{ x: 1, y: 1, side: 'N' }]);
    expect(b.lasers).toEqual([{ pos: { x: 3, y: 3 }, facing: 'W', strength: 1 }]);
    expect(b.pushers).toEqual([{ pos: { x: 4, y: 4 }, facing: 'E', registers: [1, 3, 5] }]);

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
    expect(store().board.height).toBe(24);
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

  it('renumberCheckpoints closes gaps in reading order and is undoable', () => {
    store().setTool('checkpoint');
    store().paintTile(5, 0); // 1
    store().paintTile(1, 2); // 2
    store().paintTile(8, 7); // 3
    store().eraseTile(1, 2); // leaves 1, 3 — "missing checkpoint number 2"
    expect(store().validation.errors.some((e) => e.includes('checkpoint number'))).toBe(true);

    store().renumberCheckpoints();
    expect(store().board.tiles[0][5]).toEqual({ kind: 'checkpoint', n: 1 });
    expect(store().board.tiles[7][8]).toEqual({ kind: 'checkpoint', n: 2 });
    expect(store().validation.errors.some((e) => e.includes('checkpoint number'))).toBe(false);

    store().undo();
    expect(store().board.tiles[7][8]).toEqual({ kind: 'checkpoint', n: 3 });
  });

  it('renumberCheckpoints reassigns by reading order, not by old numbers', () => {
    store().setTool('checkpoint');
    store().paintTile(0, 5); // 1, but LATER in reading order than the next
    store().paintTile(9, 1); // 2
    store().renumberCheckpoints();
    expect(store().board.tiles[1][9]).toEqual({ kind: 'checkpoint', n: 1 });
    expect(store().board.tiles[5][0]).toEqual({ kind: 'checkpoint', n: 2 });
  });

  it('renumberCheckpoints on a correct board is a no-op (no undo step)', () => {
    store().setTool('checkpoint');
    store().paintTile(1, 1);
    store().paintTile(2, 1);
    const before = store().historyIndex;
    store().renumberCheckpoints();
    expect(store().historyIndex).toBe(before);
  });

  it('loading a template is one undo step with a "Copy of" name', () => {
    const { name, factory } = BUILTIN_BOARDS['spin-cycle'];
    const lengthBefore = store().history.length;
    // What TemplateBoardModal does on pick:
    store().loadDraft({ ...factory(), name: `Copy of ${name}` });
    expect(store().board.name).toBe('Copy of Spin Cycle');
    expect(store().forkedFrom).toBeNull();
    expect(store().history.length).toBe(lengthBefore + 1);
    store().undo();
    expect(store().board.name).toBe('Untitled Board');
  });

  it('eraser tool can be selected', () => {
    store().setTool('eraser');
    expect(store().activeTool).toBe('eraser');
  });

  it('painting with eraser erases a previously painted tile', () => {
    store().setTool('pit');
    store().paintTile(3, 3);
    expect(store().board.tiles[3][3]).toEqual({ kind: 'pit' });

    store().setTool('eraser');
    store().paintTile(3, 3);
    expect(store().board.tiles[3][3]).toEqual({ kind: 'floor' });
  });

  it('eraser stroke is one undo step', () => {
    store().setTool('pit');
    store().paintTile(1, 1);
    store().paintTile(2, 2);

    store().setTool('eraser');
    store().beginStroke();
    store().paintTile(1, 1);
    store().paintTile(2, 2);
    store().endStroke();

    store().undo();
    expect(store().board.tiles[1][1]).toEqual({ kind: 'pit' });
    expect(store().board.tiles[2][2]).toEqual({ kind: 'pit' });
  });
});
