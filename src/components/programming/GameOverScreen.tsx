import type { ReactNode } from 'react';
import type { GameState } from '../../engine';
import { countCheckpoints } from '../../engine';

interface GameOverScreenProps {
  winner: string | null;
  /** Final game state, for the per-player summary; omit to skip it. */
  finalState?: GameState | null;
  onNewGame: () => void;
  /** Extra actions (e.g. the online history browser button). */
  children?: ReactNode;
}

export function GameOverScreen({ winner, finalState, onNewGame, children }: GameOverScreenProps) {
  const target = finalState ? countCheckpoints(finalState.board) : 0;
  return (
    <div className="screen center-screen gameover-screen">
      <h1>{winner ? `🏆 ${winner} wins!` : 'Everyone is scrap. Nobody wins.'}</h1>
      {finalState && (
        <div className="gameover-stats" data-testid="gameover-stats">
          {finalState.robots.map((r, seat) => (
            <div key={r.player} className={`gameover-stat-row${r.eliminated ? ' eliminated' : ''}`}>
              <span className="player-swatch" style={{ background: `var(--player-${seat})` }} />
              <span className="gameover-stat-name">
                {r.player}
                {r.player === winner ? ' 🏆' : r.eliminated ? ' — scrapped' : ''}
              </span>
              <span className="gameover-stat-detail">
                ⚑ {r.checkpoints}/{target} · {r.eliminated ? '♡♡♡' : '♥'.repeat(r.lives) + '♡'.repeat(Math.max(0, 3 - r.lives))}
              </span>
            </div>
          ))}
        </div>
      )}
      <button className="primary big" onClick={onNewGame} data-testid="play-again">
        Play again
      </button>
      {children}
    </div>
  );
}
