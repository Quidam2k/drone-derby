import { useEditorStore } from '../../store/editorStore';

export function ValidationPanel() {
  const { errors, warnings } = useEditorStore((s) => s.validation);
  const { renumberCheckpoints } = useEditorStore.getState();

  // Matches validate.ts numberingErrors: "duplicate checkpoint number N" /
  // "missing checkpoint number N (must run 1..N)".
  const hasNumberingError = errors.some((e) => e.includes('checkpoint number'));

  return (
    <div className="validation-panel" data-testid="validation-panel">
      {errors.length === 0 ? (
        <div className="validation-ok" data-testid="validation-ok">
          ✔ Board is playable
        </div>
      ) : (
        <>
          <h3>Fix before playing</h3>
          <ul className="validation-list">
            {errors.map((e, i) => (
              <li key={i} className="validation-error">
                {e}
              </li>
            ))}
          </ul>
          {hasNumberingError && (
            <button
              onClick={renumberCheckpoints}
              title="Reassign checkpoint numbers 1, 2, 3… in reading order (undoable)"
              data-testid="renumber-flags"
            >
              Renumber flags
            </button>
          )}
        </>
      )}
      {warnings.length > 0 && (
        <ul className="validation-list">
          {warnings.map((w, i) => (
            <li key={i} className="validation-warning">
              {w}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
