import { useEffect, useRef, useState } from 'react';
import { useConvexAuth, useMutation, useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import type { BoardDef } from '../../engine';
import { MAX_BOARD_SIZE, MIN_BOARD_SIZE, validateBoard } from '../../engine';
import { convex } from '../../services/convex';
import { navigate } from '../../services/route';
import { useEditorStore } from '../../store/editorStore';
import { useGameStore } from '../../store/gameStore';
import { errorMessage, useSavedName } from '../online/common';
import { markBoardHydrated } from './EditorScreen';

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

/**
 * "Save online" — only rendered when Convex is configured (it uses Convex
 * hooks, which need the provider). Signs the user in anonymously on first
 * save; the first save mints an id and moves the URL to #/editor/<id> so
 * later saves update in place.
 */
function SaveOnlineButton({ boardId }: { boardId?: string }) {
  const board = useEditorStore((s) => s.board);
  const validation = useEditorStore((s) => s.validation);
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const save = useMutation(api.boards.save);
  const [busy, setBusy] = useState(false);
  /** Save requested but we're still waiting for the auth token to land. */
  const [pendingAuth, setPendingAuth] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const hasErrors = validation.errors.length > 0;

  async function doSave() {
    try {
      const { boardId: savedId } = await save({
        boardId: boardId as Id<'boards'> | undefined,
        board,
      });
      setNote({ ok: true, text: 'Saved ✓' });
      noteTimer.current = setTimeout(() => setNote(null), 2500);
      if (!boardId) {
        // Mark hydrated first so the boards.get subscription that mounts on
        // navigate doesn't reload the board over any brand-new edits.
        markBoardHydrated(savedId);
        navigate(`#/editor/${savedId}`);
      }
    } catch (e) {
      setNote({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  // First-ever save: signIn() resolves before the client carries the token,
  // so wait for isAuthenticated to flip before actually saving.
  useEffect(() => {
    if (pendingAuth && isAuthenticated) {
      setPendingAuth(false);
      void doSave();
    }
    // doSave is recreated per render; the flags fully describe when to run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingAuth, isAuthenticated]);

  async function onSave() {
    setBusy(true);
    setNote(null);
    clearTimeout(noteTimer.current);
    if (isAuthenticated) {
      await doSave();
      return;
    }
    try {
      setPendingAuth(true);
      await signIn('anonymous');
    } catch (e) {
      setPendingAuth(false);
      setNote({ ok: false, text: errorMessage(e) });
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => void onSave()}
        disabled={hasErrors || busy}
        title={
          hasErrors
            ? `Fix validation errors first: ${validation.errors[0]}`
            : 'Save this board to your account for online games'
        }
        data-testid="save-online"
      >
        {busy ? 'Saving…' : boardId ? 'Save' : 'Save online'}
      </button>
      {note && (
        <span className={note.ok ? 'save-note' : 'error-note'} data-testid="save-note">
          {note.text}
        </span>
      )}
    </>
  );
}

/**
 * Publish / unpublish a cloud-saved board to the public gallery. Publishes
 * the server copy (save first to include fresh edits); the byline comes
 * from the saved display name — re-publish to update it.
 */
function PublishButton({ boardId }: { boardId: string }) {
  const info = useQuery(api.boards.get, { boardId: boardId as Id<'boards'> });
  const publish = useMutation(api.boards.publish);
  const unpublish = useMutation(api.boards.unpublish);
  const [savedName] = useSavedName();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Loading, or missing/foreign board — CloudBoardLoader already shows that error.
  if (!info) return null;
  const published = info.publishedAt !== null;

  async function toggle() {
    setBusy(true);
    setNote(null);
    clearTimeout(noteTimer.current);
    try {
      if (published) {
        await unpublish({ boardId: boardId as Id<'boards'> });
        setNote({ ok: true, text: 'Removed from gallery' });
      } else {
        await publish({
          boardId: boardId as Id<'boards'>,
          authorName: savedName.trim() || 'anonymous',
        });
        setNote({ ok: true, text: 'Published ✓' });
      }
      noteTimer.current = setTimeout(() => setNote(null), 2500);
    } catch (e) {
      setNote({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        onClick={() => void toggle()}
        disabled={busy}
        title={
          published
            ? 'Remove this board from the public gallery'
            : 'Share the saved copy of this board in the public gallery'
        }
        data-testid="publish-toggle"
      >
        {busy ? 'Working…' : published ? 'Unpublish' : 'Publish'}
      </button>
      {note && (
        <span className={note.ok ? 'save-note' : 'error-note'} data-testid="publish-note">
          {note.text}
        </span>
      )}
    </>
  );
}

export function EditorToolbar({ boardId }: { boardId?: string }) {
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

      {convex && <SaveOnlineButton boardId={boardId} />}
      {convex && boardId && <PublishButton boardId={boardId} />}

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
