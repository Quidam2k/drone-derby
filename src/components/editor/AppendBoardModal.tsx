// "⬆ Append" source picker: stack a board ABOVE the current draft. The
// draft keeps its spawn docks at the bottom and the run extends northward;
// checkpoints renumber from the docks up (all handled by composeBoards via
// the store's appendBoard). Sources: any built-in, or imported board JSON.

import { useRef, useState } from 'react';
import type { BoardDef } from '../../engine';
import { BUILTIN_BOARDS } from '../../engine';
import { BoardThumb } from '../board/BoardThumb';
import { useEditorStore } from '../../store/editorStore';

export function AppendBoardModal({ onClose }: { onClose: () => void }) {
  const { appendBoard } = useEditorStore.getState();
  const fileInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function pick(source: BoardDef) {
    appendBoard(source); // alerts on an unplayable result; draft unchanged then
    onClose();
  }

  async function importJson(file: File) {
    setImportError(null);
    try {
      const parsed = JSON.parse(await file.text()) as BoardDef;
      // Shape check only — a docks-less "floor" part is a legal source even
      // though it wouldn't validate as a standalone board. Semantic problems
      // surface when composeBoards validates the combined result.
      if (
        !Number.isInteger(parsed.width) ||
        !Number.isInteger(parsed.height) ||
        !Array.isArray(parsed.tiles) ||
        parsed.tiles.length !== parsed.height ||
        parsed.tiles.some((row) => !Array.isArray(row) || row.length !== parsed.width)
      ) {
        setImportError('That file is not valid board JSON.');
        return;
      }
      if (!Array.isArray(parsed.walls)) parsed.walls = [];
      if (!Array.isArray(parsed.lasers)) parsed.lasers = [];
      pick(parsed);
    } catch {
      setImportError('That file is not valid board JSON.');
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="append-modal">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Append a board above</h3>
        <p className="modal-hint">
          The picked board stacks on top of your draft. Your draft keeps its spawn docks;
          checkpoints renumber from the bottom up. Result must stay within 24 tiles tall.
        </p>
        <div className="board-picker">
          {Object.entries(BUILTIN_BOARDS).map(([key, { name, factory }]) => {
            const b = factory();
            return (
              <button
                key={key}
                type="button"
                className="board-option"
                onClick={() => pick(b)}
                data-testid={`append-${key}`}
              >
                <BoardThumb board={b} />
                <span className="board-option-name">{name}</span>
                <span className="board-option-meta">
                  {b.width}×{b.height}
                </span>
              </button>
            );
          })}
        </div>
        <div className="modal-actions">
          <button onClick={() => fileInput.current?.click()}>Import JSON…</button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            data-testid="append-import-file"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importJson(f);
              e.target.value = '';
            }}
          />
          <button onClick={onClose}>Cancel</button>
        </div>
        {importError && <span className="error-note">{importError}</span>}
      </div>
    </div>
  );
}
