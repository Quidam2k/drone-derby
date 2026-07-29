// EventLog-driven replay. Consumes ONLY the event stream (plus the state the
// turn started from) — in Phase 3 the same component replays turns fetched
// from Convex without running the engine.

import { useEffect, useMemo, useState } from 'react';
import type { EventLog, GameState } from '../../engine';
import { countCheckpoints } from '../../engine';
import { playForEvent, isMuted, setMuted } from '../../services/audio';
import { BoardView } from '../board/BoardView';
import { PlayerStrip } from '../board/PlayerStrip';
import { caption, eventDuration } from './eventPresentation';
import { HighlightReel } from './HighlightReel';
import { pickBeats } from './reelMath';
import { tauntWindows, visibleTaunts } from './taunts';
import { initialVisual, visualAt } from './visualState';

const SPEEDS = [0.5, 1, 2, 4] as const;

interface ReplayPlayerProps {
  /** State the turn started from; the replay folds events on top of it. */
  prevState: GameState;
  events: EventLog;
  /** Speech-bubble lines by player, shown when each robot first acts. */
  taunts?: Record<string, string>;
  onDone: () => void;
}

export function ReplayPlayer({ prevState, events, taunts, onDone }: ReplayPlayerProps) {
  const initial = useMemo(() => initialVisual(prevState), [prevState]);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<number>(1);
  const [muted, setMutedLocal] = useState(() => isMuted());
  const [reelOpen, setReelOpen] = useState(false);

  // The reel's beats are picked HERE because the answer decides whether the
  // button exists at all: a turn of nothing but reveals, moves and belt pulses
  // has no highlight, and `pickBeats` returning [] is the honest outcome to
  // render rather than an edge case to paper over.
  const beats = useMemo(() => pickBeats(events), [events]);

  const atEnd = cursor >= events.length;
  const visual = useMemo(() => visualAt(initial, events, cursor), [initial, events, cursor]);
  const currentEvent = cursor > 0 ? events[cursor - 1] : null;
  const windows = useMemo(() => tauntWindows(events), [events]);
  const bubbles = taunts ? visibleTaunts(taunts, windows, cursor) : undefined;

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

  // Play sound for the current event.
  useEffect(() => {
    if (currentEvent) {
      playForEvent(currentEvent);
    }
  }, [cursor]);

  // The reel REPLACES this screen rather than layering over it, and that is
  // load-bearing in 3D: two mounted BoardViews would be two WebGL
  // contexts, two copies of the tile kit, and a `window.__board3d` probe
  // pointing at whichever won the race. ReplayPlayer stays mounted, so cursor,
  // speed and mute are all exactly where they were when ✕ comes back.
  if (reelOpen) {
    return (
      <HighlightReel
        prevState={prevState}
        events={events}
        beats={beats}
        onClose={() => setReelOpen(false)}
      />
    );
  }

  return (
    <div className="screen replay-screen">
      <header className="replay-header">
        <h2>Turn {prevState.turn} replay</h2>
        <span className="register-indicator">
          {visual.register > 0 ? `Register ${visual.register}/5` : 'Starting…'}
        </span>
      </header>

      <div className="game-layout">
        {/* `events` + `cursor` are the 3D camera director's look-ahead: in a
            replay the whole turn already exists, so it can be framed on the
            laser before the beam appears instead of chasing it. The DOM board
            ignores both. */}
        <BoardView
          board={prevState.board}
          visual={visual}
          currentEvent={currentEvent}
          bubbles={bubbles}
          events={events}
          cursor={cursor}
        />
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
        {/* Online can re-watch older turns from HistoryBrowser; hot-seat had
            no way back at all. With the 3D camera persisting yaw/tilt/zoom,
            watching the same turn again from a different angle is the point. */}
        <button
          onClick={() => {
            setCursor(0);
            setPlaying(true);
          }}
          title="watch again"
          data-testid="watch-again"
        >
          ↺
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
        <button
          className="mute-btn"
          onClick={() => {
            const newMuted = !muted;
            setMuted(newMuted);
            setMutedLocal(newMuted);
          }}
          title={muted ? 'unmute' : 'mute'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        {/* One edit, three screens: hot-seat, online catch-up and
            HistoryBrowser all mount this player and all already hold the whole
            EventLog, so they inherit the reel without knowing it exists. */}
        {beats.length > 0 && (
          <button
            className="reel-btn"
            onClick={() => {
              setPlaying(false);
              setReelOpen(true);
            }}
            title={`Watch the ${beats.length} best moments of this turn`}
            data-testid="highlights"
          >
            ★ Highlights
          </button>
        )}
        <button className="primary continue-btn" disabled={!atEnd} onClick={onDone}>
          Continue
        </button>
      </div>
    </div>
  );
}
