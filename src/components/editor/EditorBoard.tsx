// The draft board, rendered by the real game Board component (WYSIWYG) with
// a transparent interaction layer on top: one hit zone per cell for tile
// tools, plus four edge strips per cell for the wall/laser tools.

import { useEffect, type CSSProperties } from 'react';
import type { Direction } from '../../engine';
import type { VisualState } from '../replay/visualState';
import { Board, tileFit } from '../board/Board';
import { useEditorStore } from '../../store/editorStore';

const EMPTY_VISUAL: VisualState = { robots: [], register: 0, winner: null };

const EDGES: Direction[] = ['N', 'E', 'S', 'W'];

export function EditorBoard() {
  const board = useEditorStore((s) => s.board);
  const activeTool = useEditorStore((s) => s.activeTool);
  const { paintTile, eraseTile, toggleWall, toggleLaser, eraseEdge, beginStroke, endStroke } =
    useEditorStore.getState();

  const edgeMode = activeTool === 'wall' || activeTool === 'laser';

  // A drag that ends outside the board must still close the stroke.
  useEffect(() => {
    window.addEventListener('mouseup', endStroke);
    return () => window.removeEventListener('mouseup', endStroke);
  }, [endStroke]);

  return (
    <div
      className="editor-board-wrap"
      style={{ '--tile': tileFit(board) } as CSSProperties}
      onContextMenu={(e) => e.preventDefault()}
    >
      <Board board={board} visual={EMPTY_VISUAL} />
      <div
        className="editor-hit-layer"
        style={{ gridTemplateColumns: `repeat(${board.width}, var(--tile))` }}
      >
        {board.tiles.map((row, y) =>
          row.map((_, x) => (
            <div
              key={`${x},${y}`}
              className="hit-cell"
              data-testid={`cell-${x}-${y}`}
              onMouseDown={(e) => {
                if (edgeMode || e.button !== 0) return;
                beginStroke();
                paintTile(x, y);
              }}
              onMouseEnter={(e) => {
                if (!edgeMode && e.buttons === 1) paintTile(x, y);
              }}
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
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      if (e.button !== 0) return;
                      if (activeTool === 'wall') toggleWall(x, y, side);
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
  );
}
