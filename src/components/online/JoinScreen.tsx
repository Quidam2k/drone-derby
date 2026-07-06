// #/join/<code> — where an invite link lands. Shows who's already in,
// asks for a name, joins, and forwards to the game screen.

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { navigate } from '../../services/route';
import { CenterNote, errorMessage, SignInGate, useSavedName } from './common';

export function JoinScreen({ code }: { code: string }) {
  return (
    <SignInGate>
      <JoinInner code={code} />
    </SignInGate>
  );
}

function JoinInner({ code }: { code: string }) {
  const info = useQuery(api.games.gameByInvite, { inviteCode: code });
  const joinGame = useMutation(api.games.joinGame);
  const [name, setName] = useSavedName();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already a member (e.g. clicked the link twice): straight to the game.
  useEffect(() => {
    if (info?.alreadyJoined) navigate(`#/game/${info.gameId}`);
  }, [info?.alreadyJoined, info?.gameId]);

  if (info === undefined) return <CenterNote>Looking up the game…</CenterNote>;
  if (info === null) {
    return (
      <div className="screen center-screen">
        <h1>No game found</h1>
        <p className="setup-hint">The invite code “{code}” doesn't match any game.</p>
        <a className="primary-link" href="#/">
          ‹ Back to the lobby
        </a>
      </div>
    );
  }
  if (info.alreadyJoined) return <CenterNote>Rejoining…</CenterNote>;

  const blocked =
    info.status !== 'lobby'
      ? 'This game has already started.'
      : info.full
        ? 'This game is full (4 players max).'
        : null;

  const join = () => {
    setBusy(true);
    setError(null);
    joinGame({ inviteCode: code, name })
      .then(({ gameId }) => navigate(`#/game/${gameId}`))
      .catch((e: unknown) => {
        setError(errorMessage(e));
        setBusy(false);
      });
  };

  return (
    <div className="screen center-screen join-screen">
      <h1 className="title">Join the derby</h1>
      <p className="subtitle">
        {info.boardName} · {info.playerNames.join(', ')} {info.playerNames.length === 1 ? 'is' : 'are'} in
      </p>
      {blocked ? (
        <>
          <p className="setup-hint">{blocked}</p>
          <a className="primary-link" href="#/">
            ‹ Back to the lobby
          </a>
        </>
      ) : (
        <>
          <input
            value={name}
            placeholder="Your name"
            maxLength={16}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && name.trim() && !busy) join();
            }}
            data-testid="join-name"
          />
          <button
            className="primary big"
            disabled={busy || name.trim().length === 0}
            onClick={join}
            data-testid="join-game"
          >
            Join game
          </button>
          {error && <p className="error-note">{error}</p>}
        </>
      )}
    </div>
  );
}
