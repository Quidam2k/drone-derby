import { useRef, useState } from 'react';
import type { BoardDef } from '../../engine';
import { MAX_BOARD_SIZE, MIN_BOARD_SIZE, validateBoard } from '../../engine';
import { navigate } from '../../services/route';
import { useEditorStore } from '../../store/editorStore';
import { useGameStore } from '../../store/gameStore';

function Stepper({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <span className="size-stepper">
      {label}
      <button onClick={() => onChange(value - 1)} disabled={value <= MIN_BOARD_SIZE}>
        −
      </button>
      <span className="size-value" data-testid={`size-${label}`}>
        {value}
      </span>
      <button onClick={() => onChange(value + 1)} disabled={value >= MAX_BOARD_SIZE}>
        +
      </button>
    </span>
  );
}

export function EditorToolbar() {
  const board = useEditorStore((s) => s.board);
  const validation = useEditorStore((s) => s.validation);
  const canUndo = useEditorStore((s) => s.historyIndex > 0);
  const canRedo = useEditorStore((s) => s.historyIndex < s.history.length - 1);
  const { setName, resizeBoard, undo, redo, reset, loadDraft } = useEditorStore.getState();
  const startGame = useGameStore((s) => s.startGame);

  const fileInput = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const hasErrors = validation.errors.length > 0;

  function testDrive() {
    if (hasErrors) return;
    startGame(['Pilot 1', 'Pilot 2'], structuredClone(board));
    navigate('#/hotseat');
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(board, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${board.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'board'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson(file: File) {
    setImportError(null);
    try {
      const parsed = JSON.parse(await file.text()) as BoardDef;
      if (typeof parsed.name !== 'string' || !parsed.name.trim()) parsed.name = 'Imported Board';
      const v = validateBoard(parsed);
      if (v.errors.length > 0) {
        setImportError(`Not a playable board: ${v.errors[0]}`);
        return;
      }
      loadDraft(parsed);
    } catch {
      setImportError('That file is not valid board JSON.');
    }
  }

  return (
    <div className="editor-toolbar">
      <a className="back-link" href="#/">
        ‹ Lobby
      </a>
      <input
        className="board-name"
        value={board.name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        placeholder="Board name"
        data-testid="board-name"
      />

      <Stepper label="W" value={board.width} onChange={(w) => resizeBoard(w, board.height)} />
      <Stepper label="H" value={board.height} onChange={(h) => resizeBoard(board.width, h)} />

      <span className="toolbar-group">
        <button onClick={undo} disabled={!canUndo} title="Undo (Ctrl+Z)" data-testid="undo">
          ↶
        </button>
        <button onClick={redo} disabled={!canRedo} title="Redo (Ctrl+Y)" data-testid="redo">
          ↷
        </button>
      </span>

      <span className="toolbar-group">
        <button onClick={exportJson}>Export JSON</button>
        <button onClick={() => fileInput.current?.click()}>Import JSON</button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          hidden
          data-testid="import-file"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void importJson(f);
            e.target.value = ''; // allow re-importing the same file
          }}
        />
        <button onClick={reset} title="Start over (undoable)">
          Clear
        </button>
      </span>

      <button
        className="primary"
        onClick={testDrive}
        disabled={hasErrors}
        title={hasErrors ? `Fix validation errors first: ${validation.errors[0]}` : 'Play this board hot-seat with 2 pilots'}
        data-testid="test-drive"
      >
        ▶ Test drive
      </button>

      {importError && <span className="error-note">{importError}</span>}
    </div>
  );
}
