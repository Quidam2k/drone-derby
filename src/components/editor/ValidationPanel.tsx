import { useEditorStore } from '../../store/editorStore';

export function ValidationPanel() {
  const { errors, warnings } = useEditorStore((s) => s.validation);

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
