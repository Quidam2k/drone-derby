import { Fragment, type ReactNode } from 'react';
import type { Direction, PortalColor } from '../../engine';
import {
  CheckpointSprite,
  ConveyorSprite,
  CrusherSprite,
  DrainSprite,
  EmitterSprite,
  FlamerSprite,
  GearSprite,
  PitSprite,
  PortalSprite,
  PusherSprite,
  RadiationSprite,
  RepulsorSprite,
  SpawnSprite,
  TeleporterSprite,
  TrapdoorSprite,
  WasteSprite,
  WrenchSprite,
} from '../board/sprites';
import { useEditorStore, type ToolId } from '../../store/editorStore';
import { TOOL_SECTIONS } from './editorHotkeys';

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

/** One icon per tool; sections/labels/hotkeys live in editorHotkeys.ts. */
const TOOL_ICONS: Record<ToolId, ReactNode> = {
  floor: FLOOR_ICON,
  pit: <PitSprite />,
  drain: <DrainSprite />,
  trapdoor: <TrapdoorSprite registers={[1, 3, 5]} />,
  radiation: <RadiationSprite />,
  waste: <WasteSprite />,
  portal: <PortalSprite color="red" />,
  teleporter: <TeleporterSprite />,
  repulsor: <RepulsorSprite />,
  conveyor: <ConveyorSprite dir="E" express={false} />,
  gear: <GearSprite cw />,
  checkpoint: <CheckpointSprite n={1} />,
  spawn: <SpawnSprite n={1} />,
  wrench: <WrenchSprite />,
  crusher: <CrusherSprite registers={[1, 3, 5]} />,
  flamer: <FlamerSprite registers={[1, 3, 5]} />,
  wall: WALL_ICON,
  laser: <EmitterSprite facing="E" />,
  pusher: <PusherSprite facing="N" registers={[1, 3, 5]} />,
  eraser: ERASER_ICON,
};

const PORTAL_COLORS: PortalColor[] = ['red', 'blue', 'green', 'purple', 'orange'];

/** Tools sharing the 1/3/5 vs 2/4 register-schedule preset. */
const SCHEDULED_TOOLS: ToolId[] = ['trapdoor', 'crusher', 'flamer'];

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
  const fixtureOdd = useEditorStore((s) => s.fixtureOdd);
  const portalColor = useEditorStore((s) => s.portalColor);
  const wallOneWay = useEditorStore((s) => s.wallOneWay);
  const {
    setTool,
    setConveyorDir,
    setConveyorExpress,
    setConveyorCurve,
    setGearCw,
    setPusherOdd,
    setFixtureOdd,
    setPortalColor,
    setWallOneWay,
  } = useEditorStore.getState();

  return (
    <div className="tool-palette">
      {TOOL_SECTIONS.map((section) => (
        <Fragment key={section.title}>
          {/* Kept as flat flex children: the mobile row hides the labels and
              scroll-snaps straight across the buttons. */}
          <div className="tool-section-label">{section.title}</div>
          {section.tools.map((t) => (
            <button
              key={t.id}
              className={`tool-btn${activeTool === t.id ? ' selected' : ''}`}
              onClick={() => setTool(t.id)}
              title={`${t.label} — press ${t.key.toUpperCase()}`}
              data-testid={`tool-${t.id}`}
            >
              <span className="tool-glyph">{TOOL_ICONS[t.id]}</span>
              {t.label}
              <kbd className="tool-key">{t.key.toUpperCase()}</kbd>
            </button>
          ))}
        </Fragment>
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

      {SCHEDULED_TOOLS.includes(activeTool) && (
        <div className="tool-options">
          <div className="tool-option-row">
            <button
              className={fixtureOdd ? 'selected' : ''}
              onClick={() => setFixtureOdd(true)}
              title="active on registers 1, 3 and 5"
              data-testid="fixture-odd"
            >
              1 3 5
            </button>
            <button
              className={!fixtureOdd ? 'selected' : ''}
              onClick={() => setFixtureOdd(false)}
              title="active on registers 2 and 4"
              data-testid="fixture-even"
            >
              2 4
            </button>
          </div>
        </div>
      )}

      {activeTool === 'portal' && (
        <div className="tool-options">
          <div className="tool-option-row">
            {PORTAL_COLORS.map((c) => (
              <button
                key={c}
                className={portalColor === c ? 'selected' : ''}
                onClick={() => setPortalColor(c)}
                title={`${c} portal pair`}
                data-testid={`portal-color-${c}`}
              >
                {c}
              </button>
            ))}
          </div>
          <p className="tool-hint">Portals work in same-color pairs — place exactly two.</p>
        </div>
      )}

      {activeTool === 'wall' && (
        <div className="tool-options">
          <div className="tool-option-row">
            <button
              className={wallOneWay === null ? 'selected' : ''}
              onClick={() => setWallOneWay(null)}
              title="blocks both directions"
              data-testid="wall-solid"
            >
              Solid
            </button>
            <button
              className={wallOneWay === 'out' ? 'selected' : ''}
              onClick={() => setWallOneWay('out')}
              title="one-way: blocks leaving the clicked cell through this edge"
              data-testid="wall-oneway-out"
            >
              1-way out
            </button>
            <button
              className={wallOneWay === 'in' ? 'selected' : ''}
              onClick={() => setWallOneWay('in')}
              title="one-way: blocks entering the clicked cell through this edge"
              data-testid="wall-oneway-in"
            >
              1-way in
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
