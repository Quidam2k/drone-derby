// "New from template…" picker: replace the draft with a copy of a built-in
// board. loadDraft commits, so the swap is a single undo step; templates
// aren't gallery forks, so attribution clears.

import { BUILTIN_BOARDS } from '../../engine';
import { BoardThumb } from '../board/BoardThumb';
import { useEditorStore } from '../../store/editorStore';

export function TemplateBoardModal({ onClose }: { onClose: () => void }) {
  const { loadDraft } = useEditorStore.getState();

  return (
    <div className="modal-backdrop" onClick={onClose} data-testid="template-modal">
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>New from template</h3>
        <p className="modal-hint">
          Start from a copy of a built-in board. Replaces the current draft (one undo step).
        </p>
        <div className="board-picker">
          {Object.entries(BUILTIN_BOARDS).map(([key, { name, factory }]) => {
            const b = factory();
            return (
              <button
                key={key}
                type="button"
                className="board-option"
                onClick={() => {
                  loadDraft({ ...b, name: `Copy of ${name}` });
                  onClose();
                }}
                data-testid={`template-${key}`}
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
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
