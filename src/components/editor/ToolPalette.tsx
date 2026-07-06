import type { Direction } from '../../engine';
import { useEditorStore, type ToolId } from '../../store/editorStore';

const TOOLS: { id: ToolId; glyph: string; label: string }[] = [
  { id: 'floor', glyph: '▢', label: 'Floor (erase)' },
  { id: 'pit', glyph: '◉', label: 'Pit' },
  { id: 'conveyor', glyph: '→', label: 'Conveyor' },
  { id: 'gear', glyph: '↻', label: 'Gear' },
  { id: 'checkpoint', glyph: '◎', label: 'Checkpoint' },
  { id: 'spawn', glyph: '⌂', label: 'Spawn dock' },
  { id: 'wall', glyph: '▮', label: 'Wall' },
  { id: 'laser', glyph: '✦', label: 'Laser' },
];

const DIR_ARROWS: { dir: Direction; glyph: string }[] = [
  { dir: 'N', glyph: '↑' },
  { dir: 'E', glyph: '→' },
  { dir: 'S', glyph: '↓' },
  { dir: 'W', glyph: '←' },
];

export function ToolPalette() {
  const activeTool = useEditorStore((s) => s.activeTool);
  const conveyorDir = useEditorStore((s) => s.conveyorDir);
  const conveyorExpress = useEditorStore((s) => s.conveyorExpress);
  const gearCw = useEditorStore((s) => s.gearCw);
  const { setTool, setConveyorDir, setConveyorExpress, setGearCw } = useEditorStore.getState();

  return (
    <div className="tool-palette">
      {TOOLS.map((t) => (
        <button
          key={t.id}
          className={`tool-btn${activeTool === t.id ? ' selected' : ''}`}
          onClick={() => setTool(t.id)}
          data-testid={`tool-${t.id}`}
        >
          <span className="tool-glyph">{t.glyph}</span>
          {t.label}
        </button>
      ))}

      {activeTool === 'conveyor' && (
        <div className="tool-options">
          <div className="tool-option-row">
            {DIR_ARROWS.map(({ dir, glyph }) => (
              <button
                key={dir}
                className={conveyorDir === dir ? 'selected' : ''}
                onClick={() => setConveyorDir(dir)}
                title={`belt moves ${dir}`}
                data-testid={`conveyor-dir-${dir}`}
              >
                {glyph}
              </button>
            ))}
          </div>
          <label className="tool-option-row">
            <input
              type="checkbox"
              checked={conveyorExpress}
              onChange={(e) => setConveyorExpress(e.target.checked)}
              data-testid="conveyor-express"
            />
            Express (double speed)
          </label>
        </div>
      )}

      {activeTool === 'gear' && (
        <div className="tool-options">
          <div className="tool-option-row">
            <button
              className={gearCw ? 'selected' : ''}
              onClick={() => setGearCw(true)}
              data-testid="gear-cw"
            >
              ↻ CW
            </button>
            <button
              className={!gearCw ? 'selected' : ''}
              onClick={() => setGearCw(false)}
              data-testid="gear-ccw"
            >
              ↺ CCW
            </button>
          </div>
        </div>
      )}

      {(activeTool === 'wall' || activeTool === 'laser') && (
        <p className="tool-hint">
          Click a cell edge to place {activeTool === 'wall' ? 'a wall on it' : 'an emitter firing across the cell'}. Click again to remove.
        </p>
      )}
      <p className="tool-hint">Right-click erases. Drag to paint.</p>
    </div>
  );
}
