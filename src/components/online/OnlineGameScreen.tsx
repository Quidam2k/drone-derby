// #/game/<id> — one online game. Drives the async loop:
//   lobby → (host starts) → per-turn: replay unseen turns oldest-first,
//   then program, then wait for the others; server executes and the next
//   replay appears reactively. ProgrammingView and ReplayPlayer are the
//   same components hot-seat uses — here they run on server state.

import { useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import type { EventLog, GameState, Program } from '../../engine';
import { countCheckpoints } from '../../engine';
import { inviteUrl, navigate } from '../../services/route';
import { Board } from '../board/Board';
import { BoardThumb } from '../board/BoardThumb';
import { PlayerStrip } from '../board/PlayerStrip';
import { initialVisual } from '../replay/visualState';
import { ProgrammingView } from '../programming/ProgrammingView';
import { GameOverScreen } from '../programming/GameOverScreen';
import { ReplayPlayer } from '../replay/ReplayPlayer';
import { CenterNote, errorMessage, SignInGate } from './common';
import { HistoryBrowser } from './HistoryBrowser';
import { NotificationsButton } from './NotificationsButton';

export function OnlineGameScreen({ gameId }: { gameId: string }) {
  return (
    <SignInGate>
      <GameInner gameId={gameId as Id<'games'>} />
    </SignInGate>
  );
}

type GameView = NonNullable<ReturnType<typeof useQuery<typeof api.games.game>>>;

function GameInner({ gameId }: { gameId: Id<'games'> }) {
  const g = useQuery(api.games.game, { gameId });
  const submitProgram = useMutation(api.games.submitProgram);
  const [error, setError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  if (g === undefined) return <CenterNote>Loading game…</CenterNote>;
  if (g === null) {
    return (
      <div className="screen center-screen">
        <h1>Game not found</h1>
        <p className="setup-hint">It may not exist, or you're not one of its players.</p>
        <a className="primary-link" href="#/">
          ‹ Back to the lobby
        </a>
      </div>
    );
  }

  if (g.status === 'lobby') return <GameLobby g={g} />;

  // History is deliberately checked before the unseen-turn catch-up: it never
  // touches markTurnSeen, and closing it drops straight back into that logic.
  const executedThrough = g.currentTurn - 1;
  if (historyOpen && executedThrough >= 1) {
    return (
      <HistoryBrowser
        gameId={g.gameId}
        lastTurn={executedThrough}
        onClose={() => setHistoryOpen(false)}
      />
    );
  }

  // Catch up on turns this player hasn't watched yet, oldest first.
  if (g.myLastSeenTurn < executedThrough) {
    return <TurnReplay gameId={g.gameId} turn={g.myLastSeenTurn + 1} />;
  }

  if (g.status === 'finished') {
    return (
      <GameOverScreen
        winner={g.winner}
        finalState={g.state as GameState}
        onNewGame={() => navigate('#/')}
      >
        {executedThrough >= 1 && (
          <button className="quiet" onClick={() => setHistoryOpen(true)} data-testid="open-history">
            Watch past turns
          </button>
        )}
      </GameOverScreen>
    );
  }

  const state = g.state as GameState; // sanitized: my hand only, no decks
  const myRobot = state.robots[g.mySeat];

  if (myRobot.eliminated || g.mySubmitted) {
    return (
      <WaitingView
        g={g}
        state={state}
        spectating={myRobot.eliminated}
        onHistory={executedThrough >= 1 ? () => setHistoryOpen(true) : undefined}
      />
    );
  }

  const submit = (program: Program, taunt?: string) => {
    setError(null);
    submitProgram({ gameId: g.gameId, program, taunt }).catch((e: unknown) =>
      setError(errorMessage(e)),
    );
  };

  return (
    <>
      {error && <p className="error-note floating">{error}</p>}
      <ProgrammingView key={g.currentTurn} game={state} seat={g.mySeat} onSubmit={submit} />
    </>
  );
}

function GameLobby({ g }: { g: GameView }) {
  const startGame = useMutation(api.games.startGame);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const openSeats = Array.from({ length: 4 - g.players.length }, (_, i) => g.players.length + i);

  return (
    <div className="screen center-screen game-lobby">
      <h1 className="title">Game lobby</h1>
      <p className="subtitle">{g.boardName} · first to all checkpoints wins</p>
      {g.board && <BoardThumb board={g.board} tilePx={14} maxPx={240} />}

      <div className="setup-players">
        {g.players.map((p) => (
          <div key={p.seat} className="setup-row">
            <span className="player-swatch" style={{ background: `var(--player-${p.seat})` }} />
            <span className="lobby-player-name">
              {p.name}
              {p.isHost ? ' ⭐' : ''}
              {p.name === g.myName ? ' (you)' : ''}
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

      <div className="invite-box">
        <span>
          Invite code: <strong data-testid="invite-code">{g.inviteCode}</strong>
        </span>
        <button
          onClick={() => {
            void navigator.clipboard.writeText(inviteUrl(g.inviteCode));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
        >
          {copied ? 'Copied!' : 'Copy invite link'}
        </button>
      </div>

      {g.isHost ? (
        <button
          className="primary big"
          disabled={g.players.length < 2}
          data-testid="start-online-game"
          onClick={() => {
            setError(null);
            startGame({ gameId: g.gameId }).catch((e: unknown) => setError(errorMessage(e)));
          }}
        >
          {g.players.length < 2 ? 'Waiting for players…' : 'Start game'}
        </button>
      ) : (
        <p className="setup-hint">Waiting for {g.players.find((p) => p.isHost)?.name} to start…</p>
      )}
      {error && <p className="error-note">{error}</p>}
      <NotificationsButton />
      <a className="quiet-link" href="#/">
        ‹ Back to the lobby
      </a>
    </div>
  );
}

function TurnReplay({ gameId, turn }: { gameId: Id<'games'>; turn: number }) {
  const data = useQuery(api.games.turn, { gameId, turn });
  const markTurnSeen = useMutation(api.games.markTurnSeen);
  const done = () => void markTurnSeen({ gameId, turn });

  if (data === undefined) return <CenterNote>Loading turn {turn} replay…</CenterNote>;
  if (data === null) {
    // Shouldn't happen (executed turns always have a row) — don't strand the player.
    return (
      <div className="screen center-screen">
        <p className="setup-hint">Turn {turn} replay is unavailable.</p>
        <button className="primary" onClick={done}>
          Skip ahead
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
      onDone={done}
    />
  );
}

function NudgeButton({ g }: { g: GameView }) {
  const nudge = useMutation(api.games.nudge);
  const [note, setNote] = useState<string | null>(null);
  const coolingDown = Date.now() < g.nudgeAvailableAt;

  return (
    <span className="nudge-box">
      <button
        className="quiet"
        disabled={coolingDown}
        title={
          coolingDown
            ? `One nudge per 12h — next at ${new Date(g.nudgeAvailableAt).toLocaleString()}`
            : 'Send a push notification to the players you are waiting on'
        }
        data-testid="nudge-button"
        onClick={() => {
          setNote(null);
          nudge({ gameId: g.gameId })
            .then(() => setNote('Nudge sent!'))
            .catch((e: unknown) => setNote(errorMessage(e)));
        }}
      >
        👉 Nudge {coolingDown ? '(sent)' : ''}
      </button>
      {note && <span className="nudge-note">{note}</span>}
    </span>
  );
}

function WaitingView({
  g,
  state,
  spectating,
  onHistory,
}: {
  g: GameView;
  state: GameState;
  spectating: boolean;
  onHistory?: () => void;
}) {
  const visual = initialVisual(state);
  return (
    <div className="screen waiting-screen">
      <header className="programming-header">
        <h2>
          Turn {g.currentTurn} — {spectating ? 'spectating' : 'program locked in'}
        </h2>
      </header>
      <div className="game-layout">
        <Board board={state.board} visual={visual} />
        <PlayerStrip visual={visual} checkpointTarget={countCheckpoints(state.board)} />
      </div>
      <p className="waiting-note" data-testid="waiting-note">
        {g.waitingOn.length > 0 ? (
          <>
            Waiting on {g.waitingOn.join(', ')} — the replay starts as soon as everyone's in.{' '}
            <NudgeButton g={g} />
          </>
        ) : (
          'Executing the turn…'
        )}
      </p>
      {onHistory && (
        <button className="quiet history-link" onClick={onHistory} data-testid="open-history">
          Watch past turns
        </button>
      )}
      <NotificationsButton />
      <a className="quiet-link" href="#/">
        ‹ Back to the lobby (your program is saved)
      </a>
    </div>
  );
}
