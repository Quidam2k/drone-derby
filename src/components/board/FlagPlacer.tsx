// Optional flag re-placement at game creation (tabletop rule: flags move
// from game to game). Collapsed by default so the happy path stays one
// click; expanded, it shows the DOM Board under a transparent hit layer —
// clicks only, no stroke logic (unlike EditorBoard).

import { useState, type CSSProperties } from 'react';
import type { BoardDef, Position } from '../../engine';
import { applyFlagPlacements, checkpointPositions, validateBoard } from '../../engine';
import type { VisualState } from '../replay/visualState';
import { Board, tileFit } from './Board';

const EMPTY_VISUAL: VisualState = { robots: [], register: 0, winner: null };

interface FlagPlacerProps {
  /** The selected board with its printed flags. */
  board: BoardDef;
  /** Custom flag positions in flag order, or null = printed flags (untouched). */
  placements: Position[] | null;
  onChange: (placements: Position[] | null) => void;
}

export function FlagPlacer({ board, placements, onChange }: FlagPlacerProps) {
  const [open, setOpen] = useState(false);
  const effective = placements ?? checkpointPositions(board);

  // The board as this game would play it. Placements from the UI are always
  // paintable (clicks are gated below), so this never throws.
  const preview = applyFlagPlacements(board, effective);
  const { errors } = validateBoard(preview);

  const handleCellClick = (x: number, y: number) => {
    const idx = effective.findIndex((p) => p.x === x && p.y === y);
    if (idx >= 0) {
      // Remove; later flags renumber to close the gap (array order = number).
      onChange(effective.filter((_, i) => i !== idx));
      return;
    }
    // Only plain floor (after the printed flags are stripped) is placeable.
    const stripped = board.tiles[y][x];
    if (stripped.kind !== 'floor' && stripped.kind !== 'checkpoint') return;
    onChange([...effective, { x, y }]);
  };

  return (
    <div className="flag-placer">
      <button
        type="button"
        className="quiet flag-placer-toggle"
        onClick={() => setOpen(!open)}
        data-testid="flag-placer-toggle"
      >
        {open ? '▾' : '▸'} Customize flags
        {placements !== null && ` · custom (${placements.length})`}
      </button>

      {open && (
        <div className="flag-placer-body">
          <p className="setup-hint">
            Click empty floor to add the next flag; click a flag to remove it.
          </p>
          <div className="board-viewport">
            <div
              className="editor-board-wrap"
              style={{ '--tile': tileFit(board) } as CSSProperties}
            >
              <Board board={preview} visual={EMPTY_VISUAL} />
              <div
                className="editor-hit-layer"
                style={{ gridTemplateColumns: `repeat(${board.width}, var(--tile))` }}
              >
                {board.tiles.map((row, y) =>
                  row.map((_, x) => (
                    <div
                      key={`${x},${y}`}
                      className="hit-cell"
                      data-testid={`flag-cell-${x}-${y}`}
                      onClick={() => handleCellClick(x, y)}
                    />
                  )),
                )}
              </div>
            </div>
          </div>
          <div className="flag-placer-bar">
            <span
              className={errors.length > 0 ? 'error-note flag-placer-status' : 'flag-placer-status'}
              data-testid="flag-placer-status"
            >
              {errors.length > 0
                ? errors[0]
                : `${effective.length} flag${effective.length === 1 ? '' : 's'} ✓`}
            </span>
            {placements !== null && (
              <button
                type="button"
                className="quiet"
                onClick={() => onChange(null)}
                data-testid="flag-placer-reset"
              >
                Reset to printed
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
