// Home screen when a backend is configured: sign-in, your async games with
// whose-move status, create/join online games, and the pass & play escape
// hatch (which needs no server at all).

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { api } from '../../../convex/_generated/api';
import { navigate } from '../../services/route';
import { errorMessage, SignInGate, useSavedName } from './common';

export function LobbyScreen() {
  return (
    <SignInGate>
      <LobbyInner />
    </SignInGate>
  );
}

type GameSummary = NonNullable<ReturnType<typeof useQuery<typeof api.games.myGames>>>[number];

function gameNote(g: GameSummary): string {
  if (g.status === 'lobby') return 'in the lobby — waiting to start';
  if (g.status === 'finished') return g.winner ? `${g.winner} won` : 'everyone was scrapped';
  if (g.unseenTurns > 0) return `${g.unseenTurns} turn${g.unseenTurns > 1 ? 's' : ''} to watch`;
  if (g.waitingOn.includes(g.myName)) return 'your move!';
  return g.waitingOn.length > 0 ? `waiting on ${g.waitingOn.join(', ')}` : 'executing…';
}

function LobbyInner() {
  const games = useQuery(api.games.myGames);
  const createGame = useMutation(api.games.createGame);
  const { signOut } = useAuthActions();
  const [name, setName] = useSavedName();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = () => {
    setBusy(true);
    setError(null);
    createGame({ name })
      .then(({ gameId }) => navigate(`#/game/${gameId}`))
      .catch((e: unknown) => setError(errorMessage(e)))
      .finally(() => setBusy(false));
  };

  return (
    <div className="screen lobby-screen">
      <header className="lobby-header">
        <h1 className="title">Drone Derby</h1>
        <button className="quiet" onClick={() => void signOut()}>
          Sign out
        </button>
      </header>

      <div className="lobby-actions">
        <div className="lobby-card">
          <h3>New online game</h3>
          <input
            value={name}
            placeholder="Your name"
            maxLength={16}
            onChange={(e) => setName(e.target.value)}
            data-testid="lobby-name"
          />
          <button
            className="primary"
            disabled={busy || name.trim().length === 0}
            onClick={create}
            data-testid="create-game"
          >
            Create game
          </button>
        </div>

        <div className="lobby-card">
          <h3>Join with a code</h3>
          <input
            value={code}
            placeholder="Invite code"
            maxLength={12}
            onChange={(e) => setCode(e.target.value)}
            data-testid="join-code-input"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && code.trim()) navigate(`#/join/${code.trim().toLowerCase()}`);
            }}
          />
          <button
            disabled={code.trim().length === 0}
            onClick={() => navigate(`#/join/${code.trim().toLowerCase()}`)}
            data-testid="join-code-go"
          >
            Join
          </button>
        </div>

        <div className="lobby-card">
          <h3>Pass &amp; play</h3>
          <p className="lobby-card-note">2–4 players on this device.</p>
          <button onClick={() => navigate('#/hotseat')} data-testid="hotseat-link">
            Start hot-seat game
          </button>
        </div>
      </div>

      {error && <p className="error-note">{error}</p>}

      <section className="game-list">
        <h3>Your games</h3>
        {games === undefined ? (
          <p className="setup-hint">Loading…</p>
        ) : games.length === 0 ? (
          <p className="setup-hint">No online games yet — create one and share the invite link.</p>
        ) : (
          games.map((g) => (
            <button
              key={g.gameId}
              className="game-row"
              onClick={() => navigate(`#/game/${g.gameId}`)}
              data-testid={`game-row-${g.gameId}`}
            >
              <span className={`status-chip status-${g.status}`}>{g.status}</span>
              <span className="game-row-players">{g.playerNames.join(', ')}</span>
              <span className="game-row-note">{gameNote(g)}</span>
            </button>
          ))
        )}
      </section>
    </div>
  );
}
