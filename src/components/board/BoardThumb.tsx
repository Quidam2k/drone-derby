// Miniature live board render for pickers and lobbies: the real Tile
// renderer at a tiny fixed --tile, so thumbnails inherit sprites (and any
// future art) for free. Decorative only — no robots, no interaction.

import type { CSSProperties } from 'react';
import type { BoardDef } from '../../engine';
import { boardCellMaps } from './Board';
import { Tile } from './Tile';

interface BoardThumbProps {
  board: BoardDef;
  /** Per-tile pixel cap; shrinks further so the thumb stays within maxPx wide. */
  tilePx?: number;
  maxPx?: number;
}

export function BoardThumb({ board, tilePx = 8, maxPx = 160 }: BoardThumbProps) {
  const { wallsByCell, emittersByCell } = boardCellMaps(board);
  return (
    <div
      className="board board-thumb"
      aria-hidden
      style={
        {
          gridTemplateColumns: `repeat(${board.width}, var(--tile))`,
          '--tile': `min(${tilePx}px, calc(${maxPx}px / ${board.width}))`,
        } as CSSProperties
      }
    >
      {board.tiles.map((row, y) =>
        row.map((def, x) => (
          <Tile
            key={`${x},${y}`}
            def={def}
            walls={wallsByCell.get(`${x},${y}`) ?? []}
            emitterFacings={emittersByCell.get(`${x},${y}`) ?? []}
          />
        )),
      )}
    </div>
  );
}

export interface BoardOption {
  value: string;
  name: string;
  board: BoardDef;
  /** Extra note after the size, e.g. 'built-in'. */
  badge?: string;
}

interface BoardPickerProps {
  options: BoardOption[];
  value: string;
  onChange: (value: string) => void;
}

/** Radio-style cards with live thumbnails; replaces the old bare <select>s. */
export function BoardPicker({ options, value, onChange }: BoardPickerProps) {
  return (
    <div className="board-picker" role="radiogroup" aria-label="Board" data-testid="board-picker">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className="board-option"
          onClick={() => onChange(o.value)}
          data-testid={`board-option-${o.value}`}
        >
          <BoardThumb board={o.board} />
          <span className="board-option-name">{o.name}</span>
          <span className="board-option-meta">
            {o.board.width}×{o.board.height}
            {o.badge ? ` · ${o.badge}` : ''}
          </span>
        </button>
      ))}
    </div>
  );
}
