// DOM/CSS-grid board renderer. Input is a VisualState (never GameState) so
// the exact same component serves the live programming view and the replay
// player. Robot elements are absolutely positioned and move via CSS
// transform transitions; transient effects (laser beams, blocked bumps)
// render as overlays keyed off the current replay event.

import { useRef, type CSSProperties } from 'react';
import type { BoardDef, Direction, EngineEvent, PlayerId, Position } from '../../engine';
import type { RobotVisual, VisualState } from '../replay/visualState';
import { Tile } from './Tile';

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
 * Tile size that fits the whole board in the viewport (52px cap = the
 * desktop size, unchanged there). Exported so the editor can put the same
 * value on its wrapper, keeping the hit layer aligned with the tiles.
 */
export function tileFit(board: { width: number; height: number }): string {
  return `min(52px, calc((100vw - 3rem) / ${board.width}), calc((100dvh - 12rem) / ${board.height}))`;
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
}

export function Board({ board, visual, currentEvent, bubbles }: BoardProps) {
  const angles = useSmoothAngles(visual.robots);

  const wallsByCell = new Map<string, Direction[]>();
  for (const w of board.walls) {
    const key = `${w.x},${w.y}`;
    wallsByCell.set(key, [...(wallsByCell.get(key) ?? []), w.side]);
  }
  const emittersByCell = new Map<string, Direction[]>();
  for (const l of board.lasers) {
    const key = `${l.pos.x},${l.pos.y}`;
    emittersByCell.set(key, [...(emittersByCell.get(key) ?? []), l.facing]);
  }

  return (
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
          />
        )),
      )}

      <div className="robots-layer">
        {visual.robots.map(
          (r, seat) =>
            r.visible && (
              <div
                key={r.player}
                className="robot"
                data-testid={`robot-${r.player}`}
                data-x={r.pos.x}
                data-y={r.pos.y}
                style={{ transform: `translate(${cellPx(r.pos.x)}, ${cellPx(r.pos.y)})` }}
              >
                <div
                  className="robot-body"
                  style={{
                    transform: `rotate(${angles[r.player]}deg)`,
                    background: `var(--player-${seat})`,
                  }}
                >
                  <span className="robot-nose">▲</span>
                </div>
              </div>
            ),
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
        {currentEvent?.type === 'robot-blocked' && (
          <div
            className="bump-flash"
            style={{ left: cellPx(currentEvent.at.x), top: cellPx(currentEvent.at.y) }}
          />
        )}
      </div>
    </div>
  );
}
