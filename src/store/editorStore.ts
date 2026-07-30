// Level-editor state: the draft board, active tool, snapshot undo/redo, and
// live validation. The draft auto-saves to localStorage (debounced) so no
// account is needed; Phase 6b adds Convex persistence on top.

import { create } from 'zustand';
import type { BoardDef, BoardValidation, Direction, PortalColor, TileDef } from '../engine';
import {
  MAX_BOARD_SIZE,
  MIN_BOARD_SIZE,
  composeBoards,
  emptyBoard,
  opposite,
  validateBoard,
} from '../engine';

export type ToolId =
  | 'floor'
  | 'pit'
  | 'drain'
  | 'trapdoor'
  | 'radiation'
  | 'waste'
  | 'portal'
  | 'teleporter'
  | 'repulsor'
  | 'conveyor'
  | 'gear'
  | 'checkpoint'
  | 'spawn'
  | 'wrench'
  | 'crusher'
  | 'flamer'
  | 'wall'
  | 'laser'
  | 'pusher'
  | 'eraser';

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
  /** null = straight belt; 'cw'/'ccw' = curved section (dir stays the exit). */
  conveyorCurve: 'cw' | 'ccw' | null;
  gearCw: boolean;
  /** True = classic 1/3/5 pusher; false = 2/4. */
  pusherOdd: boolean;
  /** Shared schedule preset for trap-doors, crushers and flamers (1/3/5 vs 2/4). */
  fixtureOdd: boolean;
  /** Pair color the portal tool paints. */
  portalColor: PortalColor;
  /** Wall tool variant: null = solid; 'out'/'in' = one-way relative to the clicked cell. */
  wallOneWay: 'in' | 'out' | null;
  validation: BoardValidation;
  /** Snapshot history; history[historyIndex] === current board. */
  history: BoardDef[];
  historyIndex: number;

  setTool: (tool: ToolId) => void;
  setConveyorDir: (dir: Direction) => void;
  setConveyorExpress: (express: boolean) => void;
  setConveyorCurve: (curve: 'cw' | 'ccw' | null) => void;
  setGearCw: (cw: boolean) => void;
  setPusherOdd: (odd: boolean) => void;
  setFixtureOdd: (odd: boolean) => void;
  setPortalColor: (color: PortalColor) => void;
  setWallOneWay: (oneWay: 'in' | 'out' | null) => void;
  setName: (name: string) => void;

  /** Apply the active tile tool at (x,y); no-op for wall/laser tools. */
  paintTile: (x: number, y: number) => void;
  /** Force a cell back to floor (right-click erase, any tool). */
  eraseTile: (x: number, y: number) => void;
  /**
   * Add/remove a wall on the given cell edge (both edge representations).
   * `oneWay` is relative to the clicked cell; same edge with the same
   * variant removes, a different variant replaces.
   */
  toggleWall: (x: number, y: number, side: Direction, oneWay?: 'in' | 'out' | null) => void;
  /** Add/remove a laser emitter mounted on the given cell edge, firing inward. */
  toggleLaser: (x: number, y: number, side: Direction) => void;
  /**
   * Add/remove a pusher mounted on the given cell edge, shoving inward.
   * Same mount with the same registers removes; different registers replace.
   */
  togglePusher: (x: number, y: number, side: Direction, registers: number[]) => void;
  /** Remove any wall, laser and pusher on the given cell edge (right-click erase). */
  eraseEdge: (x: number, y: number, side: Direction) => void;
  resizeBoard: (width: number, height: number) => void;
  /** Stack `source` ABOVE the current draft (the draft keeps its docks). */
  appendBoard: (source: BoardDef) => void;

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
    conveyorCurve: null,
    gearCw: true,
    pusherOdd: true,
    fixtureOdd: true,
    portalColor: 'red',
    wallOneWay: null,
    validation: validateBoard(initial),
    history: [initial],
    historyIndex: 0,

    setTool: (activeTool) => set({ activeTool }),
    setConveyorDir: (conveyorDir) => set({ conveyorDir }),
    setConveyorExpress: (conveyorExpress) => set({ conveyorExpress }),
    setConveyorCurve: (conveyorCurve) => set({ conveyorCurve }),
    setGearCw: (gearCw) => set({ gearCw }),
    setPusherOdd: (pusherOdd) => set({ pusherOdd }),
    setFixtureOdd: (fixtureOdd) => set({ fixtureOdd }),
    setPortalColor: (portalColor) => set({ portalColor }),
    setWallOneWay: (wallOneWay) => set({ wallOneWay }),

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
      const {
        activeTool,
        conveyorDir,
        conveyorExpress,
        conveyorCurve,
        gearCw,
        fixtureOdd,
        portalColor,
        board,
      } = get();
      if (activeTool === 'eraser') {
        get().eraseTile(x, y);
        return;
      }
      const schedule = fixtureOdd ? [1, 3, 5] : [2, 4];
      // Crushers and flamers are cell FIXTURES (separate arrays), painted by
      // cell like tiles: ensure one is present with the current schedule.
      if (activeTool === 'crusher' || activeTool === 'flamer') {
        update((draft) => {
          const list =
            activeTool === 'crusher' ? (draft.crushers ??= []) : (draft.flamers ??= []);
          const i = list.findIndex((c) => c.pos.x === x && c.pos.y === y);
          if (i >= 0 && JSON.stringify(list[i].registers) === JSON.stringify(schedule)) {
            return false; // already there in this variant (drag dedupe)
          }
          if (i >= 0) list[i] = { pos: { x, y }, registers: [...schedule] };
          else list.push({ pos: { x, y }, registers: [...schedule] });
        });
        return;
      }
      let tile: TileDef;
      switch (activeTool) {
        case 'floor':
          tile = { kind: 'floor' };
          break;
        case 'pit':
          tile = { kind: 'pit' };
          break;
        case 'drain':
          tile = { kind: 'pit', style: 'drain' };
          break;
        case 'trapdoor':
          tile = { kind: 'trapdoor', registers: [...schedule] };
          break;
        case 'radiation':
          tile = { kind: 'radiation' };
          break;
        case 'waste':
          tile = { kind: 'waste' };
          break;
        case 'portal':
          tile = { kind: 'portal', color: portalColor };
          break;
        case 'teleporter':
          tile = { kind: 'teleporter' };
          break;
        case 'repulsor':
          tile = { kind: 'repulsor' };
          break;
        case 'conveyor':
          // Straight belts stay `curve`-less so painted tiles deep-equal the
          // built-in boards' (paintTile dedupes via JSON compare).
          tile = conveyorCurve
            ? { kind: 'conveyor', dir: conveyorDir, express: conveyorExpress, curve: conveyorCurve }
            : { kind: 'conveyor', dir: conveyorDir, express: conveyorExpress };
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
        case 'wrench':
          tile = { kind: 'wrench' };
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
        let changed = false;
        if (draft.tiles[y][x].kind !== 'floor') {
          draft.tiles[y][x] = { kind: 'floor' };
          changed = true;
        }
        // Cell fixtures go with the tile on a right-click erase.
        for (const list of [draft.crushers, draft.flamers]) {
          const i = (list ?? []).findIndex((c) => c.pos.x === x && c.pos.y === y);
          if (i >= 0) {
            list!.splice(i, 1);
            changed = true;
          }
        }
        return changed;
      }),

    toggleWall: (x, y, side, oneWay = null) =>
      update((draft) => {
        const i = edgeWallIndex(draft, x, y, side);
        if (i < 0) {
          draft.walls.push(oneWay ? { x, y, side, oneWay } : { x, y, side });
          return;
        }
        // The stored wall may sit on the neighbor cell's representation, in
        // which case its oneWay meaning flips relative to the clicked cell.
        const w = draft.walls[i];
        const storedOnClicked = w.x === x && w.y === y && w.side === side;
        const effective = !w.oneWay
          ? null
          : storedOnClicked
            ? w.oneWay
            : w.oneWay === 'in'
              ? 'out'
              : 'in';
        draft.walls.splice(i, 1);
        if (effective !== oneWay) {
          // Different variant: replace (normalized onto the clicked cell).
          draft.walls.push(oneWay ? { x, y, side, oneWay } : { x, y, side });
        }
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

    togglePusher: (x, y, side, registers) =>
      update((draft) => {
        // The pusher mounts on `side` and shoves across the cell, away from it.
        const facing = opposite(side);
        const pushers = (draft.pushers ??= []);
        const i = pushers.findIndex((p) => p.pos.x === x && p.pos.y === y && p.facing === facing);
        if (i >= 0 && JSON.stringify(pushers[i].registers) === JSON.stringify(registers)) {
          pushers.splice(i, 1); // same mount, same variant: remove
        } else if (i >= 0) {
          pushers[i] = { pos: { x, y }, facing, registers: [...registers] }; // re-variant
        } else {
          pushers.push({ pos: { x, y }, facing, registers: [...registers] });
        }
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
        const pi = (draft.pushers ?? []).findIndex(
          (p) => p.pos.x === x && p.pos.y === y && p.facing === facing,
        );
        if (pi >= 0) {
          draft.pushers!.splice(pi, 1);
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
        pushers: (board.pushers ?? [])
          .filter((p) => p.pos.x < w && p.pos.y < h)
          .map((p) => ({ ...p, pos: { ...p.pos }, registers: [...p.registers] })),
        crushers: (board.crushers ?? [])
          .filter((c) => c.pos.x < w && c.pos.y < h)
          .map((c) => ({ pos: { ...c.pos }, registers: [...c.registers] })),
        flamers: (board.flamers ?? [])
          .filter((f) => f.pos.x < w && f.pos.y < h)
          .map((f) => ({ pos: { ...f.pos }, registers: [...f.registers] })),
      };
      commit(next);
    },

    appendBoard: (source) => {
      // Compose [source, current]: the draft stays the bottom part, so its
      // spawns/docks survive and the run extends northward. One undo step.
      const { board } = get();
      try {
        commit(composeBoards([source, board], board.name));
      } catch (e) {
        if (typeof alert === 'function') alert(e instanceof Error ? e.message : String(e));
      }
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
