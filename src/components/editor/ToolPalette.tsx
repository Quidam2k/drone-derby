import type { ReactNode } from 'react';
import type { Direction } from '../../engine';
import {
  CheckpointSprite,
  ConveyorSprite,
  EmitterSprite,
  GearSprite,
  PitSprite,
  SpawnSprite,
} from '../board/sprites';
import { useEditorStore, type ToolId } from '../../store/editorStore';

const FLOOR_ICON = (
  <svg className="sprite" viewBox="0 0 52 52" aria-hidden="true">
    <rect x="7" y="7" width="38" height="38" rx="6" fill="none" stroke="currentColor" strokeWidth="3.5" strokeDasharray="7 5" />
  </svg>
);
const WALL_ICON = (
  <svg className="sprite" viewBox="0 0 52 52" aria-hidden="true">
    <rect x="4" y="20" width="44" height="12" rx="3" fill="var(--wall)" />
  </svg>
);

const TOOLS: { id: ToolId; icon: ReactNode; label: string }[] = [
  { id: 'floor', icon: FLOOR_ICON, label: 'Floor (erase)' },
  { id: 'pit', icon: <PitSprite />, label: 'Pit' },
  { id: 'conveyor', icon: <ConveyorSprite dir="E" express={false} />, label: 'Conveyor' },
  { id: 'gear', icon: <GearSprite cw />, label: 'Gear' },
  { id: 'checkpoint', icon: <CheckpointSprite n={1} />, label: 'Checkpoint' },
  { id: 'spawn', icon: <SpawnSprite n={1} />, label: 'Spawn dock' },
  { id: 'wall', icon: WALL_ICON, label: 'Wall' },
  { id: 'laser', icon: <EmitterSprite facing="E" />, label: 'Laser' },
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
          <span className="tool-glyph">{t.icon}</span>
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
