import type { ReactNode } from 'react';
import type { Direction } from '../../engine';
import {
  CheckpointSprite,
  ConveyorSprite,
  EmitterSprite,
  GearSprite,
  PitSprite,
  PusherSprite,
  SpawnSprite,
  WrenchSprite,
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
const ERASER_ICON = (
  <svg className="sprite" viewBox="0 0 52 52" aria-hidden="true">
    <rect x="8" y="8" width="28" height="28" rx="3" fill="none" stroke="currentColor" strokeWidth="3" />
    <line x1="16" y1="16" x2="28" y2="28" stroke="currentColor" strokeWidth="2.5" />
    <line x1="28" y1="16" x2="16" y2="28" stroke="currentColor" strokeWidth="2.5" />
  </svg>
);

const TOOLS: { id: ToolId; icon: ReactNode; label: string }[] = [
  { id: 'floor', icon: FLOOR_ICON, label: 'Floor (erase)' },
  { id: 'pit', icon: <PitSprite />, label: 'Pit' },
  { id: 'conveyor', icon: <ConveyorSprite dir="E" express={false} />, label: 'Conveyor' },
  { id: 'gear', icon: <GearSprite cw />, label: 'Gear' },
  { id: 'checkpoint', icon: <CheckpointSprite n={1} />, label: 'Checkpoint' },
  { id: 'spawn', icon: <SpawnSprite n={1} />, label: 'Spawn dock' },
  { id: 'wrench', icon: <WrenchSprite />, label: 'Repair (wrench)' },
  { id: 'wall', icon: WALL_ICON, label: 'Wall' },
  { id: 'laser', icon: <EmitterSprite facing="E" />, label: 'Laser' },
  { id: 'pusher', icon: <PusherSprite facing="N" registers={[1, 3, 5]} />, label: 'Pusher' },
  { id: 'eraser', icon: ERASER_ICON, label: 'Eraser' },
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
  const conveyorCurve = useEditorStore((s) => s.conveyorCurve);
  const gearCw = useEditorStore((s) => s.gearCw);
  const pusherOdd = useEditorStore((s) => s.pusherOdd);
  const { setTool, setConveyorDir, setConveyorExpress, setConveyorCurve, setGearCw, setPusherOdd } =
    useEditorStore.getState();

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
          <div className="tool-option-row">
            <button
              className={conveyorCurve === null ? 'selected' : ''}
              onClick={() => setConveyorCurve(null)}
              title="straight belt"
              data-testid="conveyor-straight"
            >
              Straight
            </button>
            <button
              className={conveyorCurve === 'ccw' ? 'selected' : ''}
              onClick={() => setConveyorCurve('ccw')}
              title="curved belt: riders carried in turn left"
              data-testid="conveyor-curve-ccw"
            >
              ↺ left
            </button>
            <button
              className={conveyorCurve === 'cw' ? 'selected' : ''}
              onClick={() => setConveyorCurve('cw')}
              title="curved belt: riders carried in turn right"
              data-testid="conveyor-curve-cw"
            >
              ↻ right
            </button>
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

      {activeTool === 'pusher' && (
        <div className="tool-options">
          <div className="tool-option-row">
            <button
              className={pusherOdd ? 'selected' : ''}
              onClick={() => setPusherOdd(true)}
              title="fires on registers 1, 3 and 5"
              data-testid="pusher-odd"
            >
              1 3 5
            </button>
            <button
              className={!pusherOdd ? 'selected' : ''}
              onClick={() => setPusherOdd(false)}
              title="fires on registers 2 and 4"
              data-testid="pusher-even"
            >
              2 4
            </button>
          </div>
        </div>
      )}

      {(activeTool === 'wall' || activeTool === 'laser' || activeTool === 'pusher') && (
        <p className="tool-hint">
          Click a cell edge to place{' '}
          {activeTool === 'wall'
            ? 'a wall on it'
            : activeTool === 'laser'
              ? 'an emitter firing across the cell'
              : 'a pusher shoving across the cell'}
          . Click again to remove.
        </p>
      )}
      <p className="tool-hint">Right-click erases. Drag to paint.</p>
    </div>
  );
}
