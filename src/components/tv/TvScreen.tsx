// #/tv/<code> is the shared big-screen view, with no sign-in.
// The invite code is the key to the game's public state and replays.
// Plays each new turn once in order, skipping the backlog on first load.
// The camera never follows a seat.

import { useEffect, useState } from 'react';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { EventLog, GameState } from '../../engine';
import { countCheckpoints } from '../../engine';
import { inviteUrl } from '../../services/route';
import { setFocusPlayer } from '../../services/viewSettings';
import { BoardView } from '../board/BoardView';
import { BoardThumb } from '../board/BoardThumb';
import { PlayerStrip } from '../board/PlayerStrip';
import { initialVisual } from '../replay/visualState';
import { ReplayPlayer } from '../replay/ReplayPlayer';
import { GameOverScreen } from '../programming/GameOverScreen';
import { CenterNote } from '../online/common';
import { timerLabel, TurnTimer } from '../online/TurnTimer';
import { QrCode } from './QrCode';

export function TvScreen({ code }: { code: string }) {
  const g = useQuery(api.games.tvGame, { inviteCode: code });
  const [played, setPlayed] = useState<number | null>(null);

  useEffect(() => setFocusPlayer(null));

  useEffect(() => {
    if (played === null && g && g.status !== 'lobby') {
      setPlayed(g.currentTurn - 1);
    }
  }, [g, played]);

  if (g === undefined) return <CenterNote>Connecting to the game…</CenterNote>;
  if (g === null) {
    return (
      <div className="screen center-screen">
        <h1>No game for code {code}</h1>
        <a className="primary-link" href="#/">
          ‹ Back to the lobby
        </a>
      </div>
    );
  }

  if (g.status === 'lobby') {
    const openSeats = Array.from({ length: Math.max(0, g.seats - g.players.length) }, (_, i) =>
      g.players.length + i,
    );

    return (
      <div className="screen center-screen tv-screen tv-lobby">
        <h1 className="title brand">Drone Derby</h1>
        <p className="subtitle">{g.boardName} · join on your phone</p>

        <div className="tv-join">
          <QrCode text={inviteUrl(g.inviteCode)} size={280} />
          <div className="tv-join-text">
            <p>Scan to join, or enter code</p>
            <strong className="tv-code" data-testid="tv-invite-code">
              {g.inviteCode}
            </strong>
            <p className="setup-hint">
              {g.turnTimerMs ? `Turn timer: ${timerLabel(g.turnTimerMs)}` : 'Untimed turns'}
            </p>
          </div>
        </div>

        <div className="setup-players">
          {g.players.map((p) => (
            <div key={p.seat} className="setup-row">
              <span className="player-swatch" style={{ background: `var(--player-${p.seat})` }} />
              <span className="lobby-player-name">
                {p.name}
                {p.isHost ? ' ⭐' : ''}
              </span>
            </div>
          ))}
          {openSeats.map((seat) => (
            <div key={seat} className="setup-row open-seat">
              <span className="player-swatch" style={{ background: 'var(--panel-2)' }} />
              <span className="lobby-player-name">open seat</span>
            </div>
          ))}
        </div>

        {g.board && <BoardThumb board={g.board} tilePx={14} maxPx={240} />}
        <p className="setup-hint">The host starts the game from their phone.</p>
      </div>
    );
  }

  if (played !== null && played < g.currentTurn - 1) {
    return <TvTurn code={code} turn={played + 1} onDone={() => setPlayed(played + 1)} />;
  }

  if (g.status === 'finished') {
    return (
      <GameOverScreen winner={g.winner} finalState={g.state as GameState | null}>
        <p className="setup-hint">Start a new game from a phone, then open its TV link.</p>
      </GameOverScreen>
    );
  }

  const state = g.state as GameState;
  const visual = initialVisual(state);

  return (
    <div className="screen tv-screen tv-active">
      <header className="programming-header tv-header">
        <h2>Turn {g.currentTurn}</h2>
        <TurnTimer deadline={g.turnDeadline} className="tv-timer" />
        <span className="tv-code-small">
          Join: <strong>{g.inviteCode}</strong>
        </span>
      </header>

      <div className="game-layout">
        <BoardView board={state.board} visual={visual} />
        <PlayerStrip visual={visual} checkpointTarget={countCheckpoints(state.board)} />
      </div>

      <div className="tv-status" data-testid="tv-status">
        {g.players.map((p) => (
          <span key={p.seat} className={`tv-player${p.submitted ? ' ready' : ''}`}>
            <span className="player-swatch" style={{ background: `var(--player-${p.seat})` }} />
            {p.name}
            {state.robots[p.seat]?.eliminated ? ' — out' : p.submitted ? ' ✓' : ' ⏳'}
          </span>
        ))}
      </div>
      <p className="waiting-note">
        {g.waitingOn.length > 0 ? `Waiting on ${g.waitingOn.join(', ')}` : 'Executing the turn…'}
      </p>
    </div>
  );
}

function TvTurn({ code, turn, onDone }: { code: string; turn: number; onDone: () => void }) {
  const data = useQuery(api.games.tvTurn, { inviteCode: code, turn });

  useEffect(() => {
    if (data === null) onDone();
  }, [data, onDone]);

  if (data === undefined || data === null) return <CenterNote>Loading turn {turn}…</CenterNote>;

  return (
    <ReplayPlayer
      key={turn}
      prevState={data.prevState as GameState}
      events={data.events as EventLog}
      taunts={data.taunts}
      onDone={onDone}
      autoContinue
    />
  );
}
