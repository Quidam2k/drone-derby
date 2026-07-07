// Level-editor state: the draft board, active tool, snapshot undo/redo, and
// live validation. The draft auto-saves to localStorage (debounced) so no
// account is needed; Phase 6b adds Convex persistence on top.

import { create } from 'zustand';
import type { BoardDef, BoardValidation, Direction, TileDef } from '../engine';
import {
  MAX_BOARD_SIZE,
  MIN_BOARD_SIZE,
  emptyBoard,
  opposite,
  validateBoard,
} from '../engine';

export type ToolId =
  | 'floor'
  | 'pit'
  | 'conveyor'
  | 'gear'
  | 'checkpoint'
  | 'spawn'
  | 'wall'
  | 'laser';

/** "Forked from X by Y" byline snapshot; rides beside the draft, not in BoardDef. */
export interface ForkAttribution {
  name: string;
  authorName: string;
}

const DRAFT_KEY = 'droneDerby.editorDraft';
const HISTORY_CAP = 50;
const SAVE_DEBOUNCE_MS = 400;

function clone(board: BoardDef): BoardDef {
  return structuredClone(board);
}

function freshBoard(): BoardDef {
  return emptyBoard('Untitled Board', 10, 10);
}

/** Lowest positive number not yet used by checkpoints/spawns of `kind`. */
function nextFreeNumber(board: BoardDef, kind: 'checkpoint' | 'spawn'): number {
  const used = new Set<number>();
  for (const row of board.tiles) {
    for (const t of row) {
      if (t.kind === kind) used.add(t.n);
    }
  }
  let n = 1;
  while (used.has(n)) n++;
  return n;
}

let saveTimer: ReturnType<typeof setTimeout> | undefined;

function persistDraft(board: BoardDef, forkedFrom: ForkAttribution | null): void {
  if (typeof localStorage === 'undefined') return; // node test runs
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ board, forkedFrom }));
    } catch {
      // Storage full/blocked — the in-memory draft still works.
    }
  }, SAVE_DEBOUNCE_MS);
}

function loadDraftFromStorage(): { board: BoardDef; forkedFrom: ForkAttribution | null } | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { board?: BoardDef; forkedFrom?: ForkAttribution | null };
    const board = parsed.board;
    // Trust the grid shape only; semantic errors are fine in a draft.
    if (!board || !Array.isArray(board.tiles) || board.tiles.length !== board.height) return null;
    if (board.tiles.some((row) => !Array.isArray(row) || row.length !== board.width)) return null;
    return { board, forkedFrom: parsed.forkedFrom ?? null };
  } catch {
    return null;
  }
}

interface EditorStore {
  board: BoardDef;
  /** Set when the draft was forked from a gallery board; saved with new boards. */
  forkedFrom: ForkAttribution | null;
  activeTool: ToolId;
  /** Options for the parameterized tools. */
  conveyorDir: Direction;
  conveyorExpress: boolean;
  gearCw: boolean;
  validation: BoardValidation;
  /** Snapshot history; history[historyIndex] === current board. */
  history: BoardDef[];
  historyIndex: number;

  setTool: (tool: ToolId) => void;
  setConveyorDir: (dir: Direction) => void;
  setConveyorExpress: (express: boolean) => void;
  setGearCw: (cw: boolean) => void;
  setName: (name: string) => void;

  /** Apply the active tile tool at (x,y); no-op for wall/laser tools. */
  paintTile: (x: number, y: number) => void;
  /** Force a cell back to floor (right-click erase, any tool). */
  eraseTile: (x: number, y: number) => void;
  /** Add/remove a wall on the given cell edge (both edge representations). */
  toggleWall: (x: number, y: number, side: Direction) => void;
  /** Add/remove a laser emitter mounted on the given cell edge, firing inward. */
  toggleLaser: (x: number, y: number, side: Direction) => void;
  /** Remove any wall and laser on the given cell edge (right-click erase). */
  eraseEdge: (x: number, y: number, side: Direction) => void;
  resizeBoard: (width: number, height: number) => void;

  /** Group the paints of one drag into a single undo step. */
  beginStroke: () => void;
  endStroke: () => void;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  loadDraft: (board: BoardDef, forkedFrom?: ForkAttribution | null) => void;
}

/** True when a wall matching this edge exists in either cell's representation. */
function edgeWallIndex(board: BoardDef, x: number, y: number, side: Direction): number {
  return board.walls.findIndex((w) => {
    if (w.x === x && w.y === y && w.side === side) return true;
    const nx = x + (side === 'E' ? 1 : side === 'W' ? -1 : 0);
    const ny = y + (side === 'S' ? 1 : side === 'N' ? -1 : 0);
    return w.x === nx && w.y === ny && w.side === opposite(side);
  });
}

export const useEditorStore = create<EditorStore>((set, get) => {
  const stored = loadDraftFromStorage();
  const initial = stored?.board ?? freshBoard();
  const initialForkedFrom = stored?.forkedFrom ?? null;

  let inStroke = false;
  let strokeDirty = false;

  /** Install a new board snapshot: history push (or in-stroke replace),
      revalidate, persist. */
  function commit(board: BoardDef): void {
    const { history, historyIndex } = get();
    let nextHistory: BoardDef[];
    let nextIndex: number;
    if (inStroke && strokeDirty) {
      // Later paints of the same drag replace the stroke's snapshot.
      nextHistory = [...history.slice(0, historyIndex), board];
      nextIndex = historyIndex;
    } else {
      nextHistory = [...history.slice(0, historyIndex + 1), board];
      if (nextHistory.length > HISTORY_CAP) nextHistory = nextHistory.slice(1);
      nextIndex = nextHistory.length - 1;
      strokeDirty = inStroke;
    }
    set({
      board,
      history: nextHistory,
      historyIndex: nextIndex,
      validation: validateBoard(board),
    });
    persistDraft(board, get().forkedFrom);
  }

  /** Clone the board, let `mutate` change it, and commit if it did. */
  function update(mutate: (draft: BoardDef) => boolean | void): void {
    const draft = clone(get().board);
    if (mutate(draft) === false) return;
    commit(draft);
  }

  return {
    board: initial,
    forkedFrom: initialForkedFrom,
    activeTool: 'pit',
    conveyorDir: 'E',
    conveyorExpress: false,
    gearCw: true,
    validation: validateBoard(initial),
    history: [initial],
    historyIndex: 0,

    setTool: (activeTool) => set({ activeTool }),
    setConveyorDir: (conveyorDir) => set({ conveyorDir }),
    setConveyorExpress: (conveyorExpress) => set({ conveyorExpress }),
    setGearCw: (gearCw) => set({ gearCw }),

    setName: (name) => {
      // Renaming shouldn't spam undo history: mutate in place + revalidate.
      const board = { ...get().board, name };
      const { history, historyIndex } = get();
      const nextHistory = history.slice();
      nextHistory[historyIndex] = board;
      set({ board, history: nextHistory });
      persistDraft(board, get().forkedFrom);
    },

    paintTile: (x, y) => {
      const { activeTool, conveyorDir, conveyorExpress, gearCw, board } = get();
      let tile: TileDef;
      switch (activeTool) {
        case 'floor':
          tile = { kind: 'floor' };
          break;
        case 'pit':
          tile = { kind: 'pit' };
          break;
        case 'conveyor':
          tile = { kind: 'conveyor', dir: conveyorDir, express: conveyorExpress };
          break;
        case 'gear':
          tile = { kind: 'gear', cw: gearCw };
          break;
        case 'checkpoint':
          tile = { kind: 'checkpoint', n: nextFreeNumber(board, 'checkpoint') };
          break;
        case 'spawn':
          tile = { kind: 'spawn', n: nextFreeNumber(board, 'spawn') };
          break;
        default:
          return; // wall/laser place via edges
      }
      update((draft) => {
        if (JSON.stringify(draft.tiles[y][x]) === JSON.stringify(tile)) return false;
        // Drag-painting checkpoints/spawns would stamp the same number
        // across cells; painting over the same kind keeps its number.
        if (
          (tile.kind === 'checkpoint' || tile.kind === 'spawn') &&
          draft.tiles[y][x].kind === tile.kind
        ) {
          return false;
        }
        draft.tiles[y][x] = tile;
      });
    },

    eraseTile: (x, y) =>
      update((draft) => {
        if (draft.tiles[y][x].kind === 'floor') return false;
        draft.tiles[y][x] = { kind: 'floor' };
      }),

    toggleWall: (x, y, side) =>
      update((draft) => {
        const i = edgeWallIndex(draft, x, y, side);
        if (i >= 0) draft.walls.splice(i, 1);
        else draft.walls.push({ x, y, side });
      }),

    toggleLaser: (x, y, side) =>
      update((draft) => {
        // The emitter mounts on `side` and fires across the cell, away from it.
        const facing = opposite(side);
        const i = draft.lasers.findIndex(
          (l) => l.pos.x === x && l.pos.y === y && l.facing === facing,
        );
        if (i >= 0) draft.lasers.splice(i, 1);
        else draft.lasers.push({ pos: { x, y }, facing, strength: 1 });
      }),

    eraseEdge: (x, y, side) =>
      update((draft) => {
        let changed = false;
        for (let i = edgeWallIndex(draft, x, y, side); i >= 0; i = edgeWallIndex(draft, x, y, side)) {
          draft.walls.splice(i, 1);
          changed = true;
        }
        const facing = opposite(side);
        const li = draft.lasers.findIndex(
          (l) => l.pos.x === x && l.pos.y === y && l.facing === facing,
        );
        if (li >= 0) {
          draft.lasers.splice(li, 1);
          changed = true;
        }
        return changed;
      }),

    resizeBoard: (width, height) => {
      const w = Math.max(MIN_BOARD_SIZE, Math.min(MAX_BOARD_SIZE, Math.round(width)));
      const h = Math.max(MIN_BOARD_SIZE, Math.min(MAX_BOARD_SIZE, Math.round(height)));
      const { board } = get();
      if (w === board.width && h === board.height) return;
      const next: BoardDef = {
        name: board.name,
        width: w,
        height: h,
        tiles: Array.from({ length: h }, (_, y) =>
          Array.from({ length: w }, (_, x): TileDef => {
            const old = board.tiles[y]?.[x];
            return old ? structuredClone(old) : { kind: 'floor' };
          }),
        ),
        walls: board.walls.filter((wl) => wl.x < w && wl.y < h).map((wl) => ({ ...wl })),
        lasers: board.lasers
          .filter((l) => l.pos.x < w && l.pos.y < h)
          .map((l) => ({ ...l, pos: { ...l.pos } })),
      };
      commit(next);
    },

    beginStroke: () => {
      inStroke = true;
      strokeDirty = false;
    },
    endStroke: () => {
      inStroke = false;
      strokeDirty = false;
    },

    undo: () => {
      const { history, historyIndex } = get();
      if (historyIndex === 0) return;
      const board = history[historyIndex - 1];
      set({ board, historyIndex: historyIndex - 1, validation: validateBoard(board) });
      persistDraft(board, get().forkedFrom);
    },

    redo: () => {
      const { history, historyIndex } = get();
      if (historyIndex >= history.length - 1) return;
      const board = history[historyIndex + 1];
      set({ board, historyIndex: historyIndex + 1, validation: validateBoard(board) });
      persistDraft(board, get().forkedFrom);
    },

    reset: () => {
      // Attribution follows the draft's origin, not undo history: a fresh
      // board is nobody's fork. Set before commit so the persist sees it.
      set({ forkedFrom: null });
      commit(freshBoard());
    },

    loadDraft: (board, forkedFrom) => {
      set({ forkedFrom: forkedFrom ?? null });
      commit(clone(board));
    },
  };
});
