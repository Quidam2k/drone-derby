// Level editor (#/editor): toolbar on top, palette | board | validation
// three-panel layout. Everything is local-first — the draft lives in
// localStorage; Convex persistence arrives in Phase 6b.

import { useEffect } from 'react';
import { useEditorStore } from '../../store/editorStore';
import { EditorToolbar } from './EditorToolbar';
import { ToolPalette } from './ToolPalette';
import { EditorBoard } from './EditorBoard';
import { ValidationPanel } from './ValidationPanel';

export function EditorScreen() {
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

  return (
    <div className="screen editor-screen">
      <EditorToolbar />
      <div className="editor-layout">
        <ToolPalette />
        <EditorBoard />
        <ValidationPanel />
      </div>
    </div>
  );
}
