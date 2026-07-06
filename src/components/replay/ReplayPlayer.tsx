// EventLog-driven replay. Consumes ONLY the event stream (plus the state the
// turn started from) — in Phase 3 the same component replays turns fetched
// from Convex without running the engine.

import { useEffect, useMemo, useState } from 'react';
import type { EngineEvent, EventLog, GameState } from '../../engine';
import { countCheckpoints } from '../../engine';
import { Board } from '../board/Board';
import { PlayerStrip } from '../board/PlayerStrip';
import { CARD_LABEL } from '../cards';
import { initialVisual, visualAt } from './visualState';

const SPEEDS = [0.5, 1, 2, 4] as const;

/** Milliseconds each event holds the screen at 1× speed. */
function eventDuration(e: EngineEvent): number {
  switch (e.type) {
    case 'turn-started':
    case 'turn-ended':
      return 400;
    case 'register-started':
      return 550;
    case 'card-revealed':
      return 450;
    case 'robot-moved':
    case 'conveyor-moved':
      return 420;
    case 'robot-rotated':
    case 'gear-rotated':
      return 380;
    case 'robot-blocked':
      return 450;
    case 'laser-fired':
      return 550;
    case 'damage':
      return 300;
    case 'register-locked':
      return 600;
    case 'robot-fell':
    case 'robot-destroyed':
    case 'player-eliminated':
      return 750;
    case 'life-lost':
      return 400;
    case 'robot-respawned':
      return 550;
    case 'checkpoint-claimed':
      return 650;
    case 'game-won':
      return 900;
  }
}

function caption(e: EngineEvent): string {
  switch (e.type) {
    case 'turn-started':
      return `Turn ${e.turn} begins`;
    case 'register-started':
      return `Register ${e.register}`;
    case 'card-revealed':
      return `${e.player} reveals ${CARD_LABEL[e.card.type]} (${e.card.priority})`;
    case 'robot-moved':
      return e.pushed ? `${e.player} is pushed` : `${e.player} moves`;
    case 'robot-blocked':
      return `${e.player} bumps into a wall`;
    case 'robot-rotated':
      return `${e.player} rotates`;
    case 'conveyor-moved':
      return e.express ? `Express conveyor carries ${e.player}` : `Conveyor carries ${e.player}`;
    case 'gear-rotated':
      return `Gear spins ${e.player}`;
    case 'laser-fired': {
      const source = e.source === 'board' ? 'Board laser' : `${e.shooter} fires and`;
      return e.hit ? `${source} hits ${e.hit}` : e.source === 'board' ? 'Board laser fires' : `${e.shooter} fires`;
    }
    case 'damage':
      return `${e.player} takes ${e.amount} damage (${e.total}/10)`;
    case 'register-locked':
      return `${e.player}'s register ${e.register} locks!`;
    case 'robot-fell':
      return e.cause === 'pit' ? `${e.player} falls into a pit!` : `${e.player} falls off the board!`;
    case 'robot-destroyed':
      return `${e.player} is destroyed!`;
    case 'life-lost':
      return `${e.player} loses a life (${e.remaining} left)`;
    case 'player-eliminated':
      return `${e.player} is eliminated!`;
    case 'robot-respawned':
      return `${e.player} respawns`;
    case 'checkpoint-claimed':
      return `${e.player} claims checkpoint ${e.checkpoint}!`;
    case 'game-won':
      return e.reason === 'checkpoints'
        ? `${e.player} wins — all checkpoints claimed!`
        : `${e.player} wins — last robot standing!`;
    case 'turn-ended':
      return `Turn ${e.turn} complete`;
  }
}

interface ReplayPlayerProps {
  /** State the turn started from; the replay folds events on top of it. */
  prevState: GameState;
  events: EventLog;
  onDone: () => void;
}

export function ReplayPlayer({ prevState, events, onDone }: ReplayPlayerProps) {
  const initial = useMemo(() => initialVisual(prevState), [prevState]);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1);

  const atEnd = cursor >= events.length;
  const visual = useMemo(() => visualAt(initial, events, cursor), [initial, events, cursor]);
  const currentEvent = cursor > 0 ? events[cursor - 1] : null;

  useEffect(() => {
    if (!playing) return;
    if (cursor >= events.length) {
      setPlaying(false);
      return;
    }
    const t = setTimeout(
      () => setCursor((c) => Math.min(c + 1, events.length)),
      eventDuration(events[cursor]) / speed,
    );
    return () => clearTimeout(t);
  }, [playing, cursor, speed, events]);

  return (
    <div className="screen replay-screen">
      <header className="replay-header">
        <h2>Turn {prevState.turn} replay</h2>
        <span className="register-indicator">
          {visual.register > 0 ? `Register ${visual.register}/5` : 'Starting…'}
        </span>
      </header>

      <div className="game-layout">
        <Board board={prevState.board} visual={visual} currentEvent={currentEvent} />
        <PlayerStrip visual={visual} checkpointTarget={countCheckpoints(prevState.board)} />
      </div>

      <div className="caption" data-testid="replay-caption">
        {currentEvent ? caption(currentEvent) : ' '}
      </div>

      <div className="replay-controls">
        <button onClick={() => setCursor((c) => Math.max(0, c - 1))} title="step back">
          ⏮
        </button>
        <button
          className="play-btn"
          onClick={() => {
            if (atEnd) setCursor(0);
            setPlaying((p) => atEnd || !p);
          }}
          title={playing ? 'pause' : 'play'}
        >
          {playing ? '⏸' : '▶'}
        </button>
        <button
          onClick={() => {
            setPlaying(false);
            setCursor((c) => Math.min(events.length, c + 1));
          }}
          title="step forward"
        >
          ⏭
        </button>
        <button
          onClick={() => {
            setPlaying(false);
            setCursor(events.length);
          }}
          title="skip to end"
        >
          ⏩
        </button>
        <span className="speed-buttons">
          {SPEEDS.map((s) => (
            <button
              key={s}
              className={speed === s ? 'selected' : ''}
              onClick={() => setSpeed(s)}
            >
              {s}×
            </button>
          ))}
        </span>
        <button className="primary continue-btn" disabled={!atEnd} onClick={onDone}>
          Continue
        </button>
      </div>
    </div>
  );
}
