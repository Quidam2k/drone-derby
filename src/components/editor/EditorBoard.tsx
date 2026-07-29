// The draft board, rendered by the real game Board component (WYSIWYG) with
// a transparent interaction layer on top: one hit zone per cell for tile
// tools, plus four edge strips per cell for the wall/laser tools.

import { useRef, type CSSProperties } from 'react';
import type { Direction } from '../../engine';
import type { VisualState } from '../replay/visualState';
import { Board, tileFit } from '../board/Board';
import { useEditorStore } from '../../store/editorStore';

const EMPTY_VISUAL: VisualState = { robots: [], register: 0, winner: null };

const EDGES: Direction[] = ['N', 'E', 'S', 'W'];

export function EditorBoard() {
  const board = useEditorStore((s) => s.board);
  const activeTool = useEditorStore((s) => s.activeTool);
  const pusherOdd = useEditorStore((s) => s.pusherOdd);
  const { paintTile, eraseTile, toggleWall, toggleLaser, togglePusher, eraseEdge, beginStroke, endStroke } =
    useEditorStore.getState();

  const edgeMode = activeTool === 'wall' || activeTool === 'laser' || activeTool === 'pusher';
  const layerRef = useRef<HTMLDivElement>(null);
  const strokeActiveRef = useRef(false);
  const lastPaintedRef = useRef<string | null>(null);

  // Helper to extract cell coords from element's data attributes.
  function getCellCoords(el: Element): { x: number; y: number } | null {
    const x = el.getAttribute('data-x');
    const y = el.getAttribute('data-y');
    if (x === null || y === null) return null;
    return { x: parseInt(x, 10), y: parseInt(y, 10) };
  }

  // Find the hit-cell element containing the point, if any.
  function findCellAt(clientX: number, clientY: number): Element | null {
    const el = document.elementFromPoint(clientX, clientY);
    if (el === null) return null;
    // Walk up to find a hit-cell with data-x/data-y.
    let current: Element | null = el;
    while (current && current !== layerRef.current) {
      if (current.classList.contains('hit-cell')) return current;
      current = current.parentElement;
    }
    return null;
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (edgeMode) return; // edge mode uses per-element handlers
    if (e.button !== 0) return; // only left button / touch
    if (strokeActiveRef.current) return; // second touch mustn't split the stroke

    const layer = layerRef.current;
    if (!layer) return;

    layer.setPointerCapture(e.pointerId);
    strokeActiveRef.current = true;
    lastPaintedRef.current = null;
    beginStroke();

    const cell = findCellAt(e.clientX, e.clientY);
    if (cell) {
      const coords = getCellCoords(cell);
      if (coords) {
        const key = `${coords.x},${coords.y}`;
        lastPaintedRef.current = key;
        paintTile(coords.x, coords.y);
      }
    }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!strokeActiveRef.current || edgeMode) return;
    // Only paint while left button is held (for mouse; touch always has buttons === 1).
    if (e.buttons !== 1) return;

    const cell = findCellAt(e.clientX, e.clientY);
    if (cell) {
      const coords = getCellCoords(cell);
      if (coords) {
        const key = `${coords.x},${coords.y}`;
        // Deduplicate: don't repaint the same cell within one drag.
        if (lastPaintedRef.current !== key) {
          lastPaintedRef.current = key;
          paintTile(coords.x, coords.y);
        }
      }
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!strokeActiveRef.current) return;
    const layer = layerRef.current;
    if (layer) {
      try {
        layer.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if capture was not active.
      }
    }
    strokeActiveRef.current = false;
    lastPaintedRef.current = null;
    endStroke();
  }

  function handlePointerCancel(e: React.PointerEvent<HTMLDivElement>) {
    if (!strokeActiveRef.current) return;
    const layer = layerRef.current;
    if (layer) {
      try {
        layer.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore if capture was not active.
      }
    }
    strokeActiveRef.current = false;
    lastPaintedRef.current = null;
    endStroke();
  }

  return (
    // The editor pans board + hit layer together: this outer viewport is the
    // scroller, and CSS neutralizes the Board's own nested .board-viewport so
    // the absolutely-positioned hit layer never drifts from the tiles.
    <div className="board-viewport">
      <div
        className="editor-board-wrap"
        style={{ '--tile': tileFit(board) } as CSSProperties}
        onContextMenu={(e) => e.preventDefault()}
      >
        <Board board={board} visual={EMPTY_VISUAL} />
        <div
          ref={layerRef}
          className="editor-hit-layer"
          style={{ gridTemplateColumns: `repeat(${board.width}, var(--tile))` }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
        >
          {board.tiles.map((row, y) =>
            row.map((_, x) => (
              <div
                key={`${x},${y}`}
                className="hit-cell"
                data-x={x}
                data-y={y}
                data-testid={`cell-${x}-${y}`}
                onContextMenu={(e) => {
                  e.preventDefault();
                  eraseTile(x, y);
                }}
              >
                {edgeMode &&
                  EDGES.map((side) => (
                    <div
                      key={side}
                      className={`hit-edge hit-edge-${side.toLowerCase()}`}
                      data-testid={`edge-${x}-${y}-${side}`}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        if (e.button !== 0) return;
                        if (activeTool === 'wall') toggleWall(x, y, side);
                        else if (activeTool === 'pusher')
                          togglePusher(x, y, side, pusherOdd ? [1, 3, 5] : [2, 4]);
                        else toggleLaser(x, y, side);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        eraseEdge(x, y, side);
                      }}
                    />
                  ))}
              </div>
            )),
          )}
        </div>
      </div>
    </div>
  );
}
