// Browse and replay any executed turn of an online game. Read-only: it
// mounts the same ReplayPlayer the auto-catch-up uses but NEVER calls
// markTurnSeen, so watching history can't disturb the unseen-turn logic.

import { useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import type { EventLog, GameState } from '../../engine';
import { ReplayPlayer } from '../replay/ReplayPlayer';
import { CenterNote } from './common';

interface HistoryBrowserProps {
  gameId: Id<'games'>;
  /** Highest executed turn (games.currentTurn - 1). */
  lastTurn: number;
  onClose: () => void;
}

export function HistoryBrowser({ gameId, lastTurn, onClose }: HistoryBrowserProps) {
  const [viewing, setViewing] = useState<number | null>(null);

  if (viewing !== null) {
    return <HistoryReplay gameId={gameId} turn={viewing} onDone={() => setViewing(null)} />;
  }

  return (
    <div className="screen center-screen history-screen">
      <h1 className="title">Turn history</h1>
      <p className="subtitle">Watch any turn again — it won't affect your game.</p>
      <div className="history-list" data-testid="history-list">
        {Array.from({ length: lastTurn }, (_, i) => i + 1).map((turn) => (
          <button
            key={turn}
            className="history-turn"
            onClick={() => setViewing(turn)}
            data-testid={`history-turn-${turn}`}
          >
            Turn {turn} ▶
          </button>
        ))}
      </div>
      <button className="primary" onClick={onClose} data-testid="history-close">
        Back to the game
      </button>
    </div>
  );
}

function HistoryReplay({
  gameId,
  turn,
  onDone,
}: {
  gameId: Id<'games'>;
  turn: number;
  onDone: () => void;
}) {
  const data = useQuery(api.games.turn, { gameId, turn });

  if (data === undefined) return <CenterNote>Loading turn {turn}…</CenterNote>;
  if (data === null) {
    return (
      <div className="screen center-screen">
        <p className="setup-hint">Turn {turn} replay is unavailable.</p>
        <button className="primary" onClick={onDone}>
          Back to history
        </button>
      </div>
    );
  }
  return (
    <ReplayPlayer
      key={turn}
      prevState={data.prevState as GameState}
      events={data.events as EventLog}
      taunts={data.taunts}
      onDone={onDone}
    />
  );
}
