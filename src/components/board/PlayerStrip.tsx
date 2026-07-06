import { lockedRegisterCount } from '../../engine';
import type { VisualState } from '../replay/visualState';

interface PlayerStripProps {
  visual: VisualState;
  /** Total checkpoints on the board (the winning target). */
  checkpointTarget: number;
  /** Seat index to highlight (the player currently acting), if any. */
  activeSeat?: number;
}

export function PlayerStrip({ visual, checkpointTarget, activeSeat }: PlayerStripProps) {
  return (
    <div className="player-strip">
      {visual.robots.map((r, seat) => (
        <div
          key={r.player}
          className={`player-card${seat === activeSeat ? ' active' : ''}${r.eliminated ? ' eliminated' : ''}`}
        >
          <div className="player-name">
            <span className="player-swatch" style={{ background: `var(--player-${seat})` }} />
            {r.player}
            {r.eliminated && <span className="player-out"> — out</span>}
          </div>
          <div className="player-stats">
            <span className="stat" title="lives">
              {'♥'.repeat(r.lives)}
              {'♡'.repeat(Math.max(0, 3 - r.lives))}
            </span>
            <span className="stat" title="checkpoints">
              ⚑ {r.checkpoints}/{checkpointTarget}
            </span>
            {lockedRegisterCount(r.damage) > 0 && (
              <span className="stat locked-stat" title="locked registers">
                🔒{lockedRegisterCount(r.damage)}
              </span>
            )}
          </div>
          <div className="damage-pips" title={`damage ${r.damage}/10`}>
            {Array.from({ length: 10 }, (_, i) => (
              <span key={i} className={`pip${i < r.damage ? ' hit' : ''}`} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
