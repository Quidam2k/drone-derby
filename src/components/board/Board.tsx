// DOM/CSS-grid board renderer. Input is a VisualState (never GameState) so
// the exact same component serves the live programming view and the replay
// player. Robot elements are absolutely positioned and move via CSS
// transform transitions; transient effects (laser beams, blocked bumps)
// render as overlays keyed off the current replay event.

import { useRef, type CSSProperties } from 'react';
import type { BoardDef, Direction, EngineEvent, EventLog, PlayerId, Position } from '../../engine';
import type { RobotVisual, VisualState } from '../replay/visualState';
import { Tile, type WallSeg } from './Tile';
import { RobotSprite } from './sprites';

const DIR_ANGLE: Record<Direction, number> = { N: 0, E: 90, S: 180, W: 270 };

/**
 * Cumulative rotation angles so a W→N turn animates 90° CW instead of
 * spinning 270° back. Persists across renders per player.
 */
function useSmoothAngles(robots: RobotVisual[]): Record<PlayerId, number> {
  const anglesRef = useRef<Record<PlayerId, number>>({});
  const next: Record<PlayerId, number> = {};
  for (const r of robots) {
    const target = DIR_ANGLE[r.facing];
    const prev = anglesRef.current[r.player] ?? target;
    let delta = (((target - prev) % 360) + 360) % 360;
    if (delta > 180) delta -= 360;
    next[r.player] = prev + delta;
  }
  anglesRef.current = next;
  return next;
}

function cellPx(n: number): string {
  return `calc(var(--tile) * ${n})`;
}

/**
 * Robots are Blender renders with the seat colour baked into the image, so
 * the wrapper carries nothing but the facing rotation now.
 */
function robotBodyStyle(angle: number): CSSProperties {
  return { transform: `rotate(${angle}deg)` };
}

/**
 * Smooth rotation for the single ghost robot. Separate from useSmoothAngles
 * because the ghost shares its player id with a real robot on the board.
 */
function useGhostAngle(ghost: { robot: RobotVisual } | undefined): number {
  const ref = useRef<number | null>(null);
  if (!ghost) {
    ref.current = null;
    return 0;
  }
  const target = DIR_ANGLE[ghost.robot.facing];
  const prev = ref.current ?? target;
  let delta = (((target - prev) % 360) + 360) % 360;
  if (delta > 180) delta -= 360;
  ref.current = prev + delta;
  return ref.current;
}

/**
 * Tile size that fits the whole board in the viewport (52px cap = the
 * desktop size, unchanged there), floored at 24px so tall composed boards
 * stay legible on phones — past the floor, the board pans inside
 * `.board-viewport` instead of shrinking further. Exported so the editor
 * can put the same value on its wrapper, keeping the hit layer aligned
 * with the tiles.
 */
export function tileFit(board: { width: number; height: number }): string {
  return `clamp(24px, min(calc((100vw - 3rem) / ${board.width}), calc((100dvh - 12rem) / ${board.height})), 52px)`;
}

function BeamOverlay({ path }: { path: Position[] }) {
  const xs = path.map((p) => p.x);
  const ys = path.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const horizontal = Math.max(...ys) === minY;
  const style = horizontal
    ? {
        left: cellPx(minX),
        top: `calc(${cellPx(minY + 0.5)} - 2px)`,
        width: cellPx(Math.max(...xs) - minX + 1),
        height: '4px',
      }
    : {
        left: `calc(${cellPx(minX + 0.5)} - 2px)`,
        top: cellPx(minY),
        width: '4px',
        height: cellPx(Math.max(...ys) - minY + 1),
      };
  return <div className="laser-beam" style={style} />;
}

interface BoardProps {
  board: BoardDef;
  visual: VisualState;
  /** Current replay event, for transient overlays. Omit in live views. */
  currentEvent?: EngineEvent | null;
  /** Speech bubbles to draw over robots (replay taunts). */
  bubbles?: { player: PlayerId; text: string }[];
  /** Translucent programming-preview robot, drawn over the live board. */
  ghost?: { robot: RobotVisual; seat: number };
  /**
   * Replay look-ahead: the whole turn's log and the cursor into it. THIS board
   * ignores both — it is declared here because Board3D's props are derived from
   * this type, and its camera director needs to know what is about to happen so
   * it can be framed on the laser before the beam appears rather than setting
   * off toward it as the beam ends (see board3d/directorMath.ts).
   *
   * Optional, and only ReplayPlayer passes them: the live views have no future
   * to look at.
   */
  events?: EventLog;
  cursor?: number;
  /**
   * Highlight-reel framing, when a HighlightReel is what mounted this board.
   * IGNORED HERE too, and declared for the same reason as `events`/`cursor`.
   *
   * `beat` is the index of the beat on screen; when it changes the 3D camera
   * HARD-CUTS instead of easing, which is legitimate only because the reel puts
   * a beat counter on screen to cue it. `until` is the beat's exclusive end, so
   * the camera's look-ahead cannot frame an event the reel never shows.
   */
  reel?: { beat: number; until: number };
}

/** Walls, emitters, pushers, crushers and flamers grouped by `"x,y"` cell key, in Tile-prop shape. */
export function boardCellMaps(board: BoardDef): {
  wallsByCell: Map<string, WallSeg[]>;
  emittersByCell: Map<string, Direction[]>;
  pushersByCell: Map<string, { facing: Direction; registers: number[] }[]>;
  crushersByCell: Map<string, { registers: number[] }[]>;
  flamersByCell: Map<string, { registers: number[] }[]>;
} {
  const wallsByCell = new Map<string, WallSeg[]>();
  for (const w of board.walls) {
    const key = `${w.x},${w.y}`;
    wallsByCell.set(key, [
      ...(wallsByCell.get(key) ?? []),
      { side: w.side, ...(w.oneWay ? { oneWay: w.oneWay } : {}) },
    ]);
  }
  const emittersByCell = new Map<string, Direction[]>();
  for (const l of board.lasers) {
    const key = `${l.pos.x},${l.pos.y}`;
    emittersByCell.set(key, [...(emittersByCell.get(key) ?? []), l.facing]);
  }
  const pushersByCell = new Map<string, { facing: Direction; registers: number[] }[]>();
  for (const p of board.pushers ?? []) {
    const key = `${p.pos.x},${p.pos.y}`;
    pushersByCell.set(key, [
      ...(pushersByCell.get(key) ?? []),
      { facing: p.facing, registers: p.registers },
    ]);
  }
  const crushersByCell = new Map<string, { registers: number[] }[]>();
  for (const c of board.crushers ?? []) {
    const key = `${c.pos.x},${c.pos.y}`;
    crushersByCell.set(key, [...(crushersByCell.get(key) ?? []), { registers: c.registers }]);
  }
  const flamersByCell = new Map<string, { registers: number[] }[]>();
  for (const f of board.flamers ?? []) {
    const key = `${f.pos.x},${f.pos.y}`;
    flamersByCell.set(key, [...(flamersByCell.get(key) ?? []), { registers: f.registers }]);
  }
  return { wallsByCell, emittersByCell, pushersByCell, crushersByCell, flamersByCell };
}

export function Board({ board, visual, currentEvent, bubbles, ghost }: BoardProps) {
  const angles = useSmoothAngles(visual.robots);
  const ghostAngle = useGhostAngle(ghost);
  const { wallsByCell, emittersByCell, pushersByCell, crushersByCell, flamersByCell } =
    boardCellMaps(board);

  return (
    <div className="board-viewport">
      <div
        className="board"
        style={
          {
            gridTemplateColumns: `repeat(${board.width}, var(--tile))`,
            '--tile': tileFit(board),
          } as CSSProperties
        }
        data-testid="board"
      >
        {board.tiles.map((row, y) =>
          row.map((def, x) => (
            <Tile
              key={`${x},${y}`}
              def={def}
              walls={wallsByCell.get(`${x},${y}`) ?? []}
              emitterFacings={emittersByCell.get(`${x},${y}`) ?? []}
              pushers={pushersByCell.get(`${x},${y}`)}
              crushers={crushersByCell.get(`${x},${y}`)}
              flamers={flamersByCell.get(`${x},${y}`)}
            />
          )),
        )}

        <div className="robots-layer">
          {visual.robots.map(
            (r, seat) =>
              r.visible && (
                <div
                  key={r.player}
                  className={`robot ${r.poweredDown ? 'powered-down ' : ''}${currentEvent?.type === 'damage' && currentEvent.player === r.player ? 'damage-flash' : ''}`}
                  data-testid={`robot-${r.player}`}
                  data-x={r.pos.x}
                  data-y={r.pos.y}
                  style={{ transform: `translate(${cellPx(r.pos.x)}, ${cellPx(r.pos.y)})` }}
                >
                  <div className="robot-body" style={robotBodyStyle(angles[r.player])}>
                    <RobotSprite seat={seat} />
                  </div>
                </div>
              ),
          )}

          {ghost && ghost.robot.visible && (
            <div
              className="robot ghost"
              data-testid="robot-ghost"
              data-x={ghost.robot.pos.x}
              data-y={ghost.robot.pos.y}
              style={{
                transform: `translate(${cellPx(ghost.robot.pos.x)}, ${cellPx(ghost.robot.pos.y)})`,
              }}
            >
              <div className="robot-body" style={robotBodyStyle(ghostAngle)}>
                <RobotSprite seat={ghost.seat} />
              </div>
            </div>
          )}

          {bubbles?.map((b) => {
            const robot = visual.robots.find((r) => r.player === b.player);
            if (!robot || !robot.visible) return null;
            return (
              <div
                key={b.player}
                className="speech-bubble"
                data-testid={`bubble-${b.player}`}
                style={{ left: cellPx(robot.pos.x + 0.5), top: cellPx(robot.pos.y) }}
              >
                {b.text}
              </div>
            );
          })}

          {currentEvent?.type === 'laser-fired' && <BeamOverlay path={currentEvent.path} />}
          {(currentEvent?.type === 'robot-blocked' || currentEvent?.type === 'pusher-fired') && (
            <div
              className="bump-flash"
              style={{ left: cellPx(currentEvent.at.x), top: cellPx(currentEvent.at.y) }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
