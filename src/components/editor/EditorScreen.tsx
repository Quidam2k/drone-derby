// Level editor (#/editor): toolbar on top, palette | board | validation
// three-panel layout. Local-first — the draft lives in localStorage; with a
// backend configured, boards can also be saved online and reopened at
// #/editor/<boardId> (which requires sign-in, since boards are creator-only).

import { useEffect } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import { convex } from '../../services/convex';
import { SignInGate } from '../online/common';
import { useEditorStore } from '../../store/editorStore';
import { EditorToolbar } from './EditorToolbar';
import { ToolPalette } from './ToolPalette';
import { EditorBoard } from './EditorBoard';
import { ValidationPanel } from './ValidationPanel';

/**
 * The cloud board already hydrated into the local draft. Guards against the
 * boards.get subscription clobbering fresh edits — both on re-renders and
 * right after a first "Save online" navigates to #/editor/<newId> (the
 * toolbar marks the id hydrated before navigating).
 */
let hydratedBoardId: string | null = null;
export function markBoardHydrated(boardId: string): void {
  hydratedBoardId = boardId;
}

/** Fetches a cloud board once per boardId and loads it into the editor. */
function CloudBoardLoader({ boardId }: { boardId: string }) {
  const result = useQuery(api.boards.get, { boardId: boardId as Id<'boards'> });

  useEffect(() => {
    if (result && hydratedBoardId !== boardId) {
      markBoardHydrated(boardId);
      useEditorStore.getState().loadDraft(result.board);
    }
  }, [result, boardId]);

  if (result === null) {
    return (
      <p className="error-note">
        That board wasn't found — it may have been deleted.{' '}
        <a href="#/editor">Back to the editor</a>
      </p>
    );
  }
  return null;
}

export function EditorScreen({ boardId }: { boardId?: string }) {
  const { undo, redo } = useEditorStore.getState();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.target instanceof HTMLInputElement) return; // let inputs keep their own undo
      const key = e.key.toLowerCase();
      if (key === 'z' && e.shiftKey) redo();
      else if (key === 'z') undo();
      else if (key === 'y') redo();
      else return;
      e.preventDefault();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const cloud = convex !== null && boardId !== undefined;
  const body = (
    <div className="screen editor-screen">
      <EditorToolbar boardId={cloud ? boardId : undefined} />
      {cloud && <CloudBoardLoader boardId={boardId} />}
      <div className="editor-layout">
        <ToolPalette />
        <EditorBoard />
        <ValidationPanel />
      </div>
    </div>
  );
  return cloud ? <SignInGate>{body}</SignInGate> : body;
}
