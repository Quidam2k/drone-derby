// The turn's best moments, back to back — Phase 3D-6.
//
// Its own component rather than a mode on ReplayPlayer, because almost nothing
// about it is the same: a different clock (./reelMath's `reelDuration`, which
// stretches peaks and squeezes connective tissue), different controls (no step,
// no speed — just ↺ and ✕), a different camera (tight, and it hard-cuts), and a
// beat counter instead of a register indicator. What it DOES share is
// everything that matters for correctness: the same `BoardView`, the same
// `visualAt`, the same `PlayerStrip`, the same captions and the same sounds.
//
// The whole reel is possible because `visualAt(initial, events, n)` re-folds
// from zero for any cursor. Jumping the cursor from the end of one beat to the
// start of another is exactly as safe as scrubbing backwards has been since
// Phase 2 — so a reel needs no engine change, no event change and no new state
// model. It is a SUBSEQUENCE of the replay, not a speed-up of it.
//
// It must be worth watching on the DOM board, which since 3D-7 is the fallback
// rather than the default: the best bits with a caption and a counter carry it,
// and the 3D camera makes it better rather than viable.

import { useEffect, useMemo, useState } from 'react';
import type { EventLog, GameState } from '../../engine';
import { countCheckpoints } from '../../engine';
import { isMuted, playForEvent, setMuted } from '../../services/audio';
import { BoardView } from '../board/BoardView';
import { PlayerStrip } from '../board/PlayerStrip';
import { caption } from './eventPresentation';
import { reelDuration, type Beat } from './reelMath';
import { initialVisual, visualAt } from './visualState';

interface HighlightReelProps {
  /** State the turn started from — the fold's origin, as in the replay. */
  prevState: GameState;
  events: EventLog;
  /**
   * Non-empty, and the caller's business: ReplayPlayer runs `pickBeats` to
   * decide whether to offer the reel at all, so it hands over what it already
   * computed rather than making this component score the log a second time.
   */
  beats: Beat[];
  onClose: () => void;
}

export function HighlightReel({ prevState, events, beats, onClose }: HighlightReelProps) {
  const initial = useMemo(() => initialVisual(prevState), [prevState]);
  const [beatIndex, setBeatIndex] = useState(0);
  // `cursor` counts events APPLIED, so `start + 1` puts the beat's first event
  // on screen with its whole lead-up already folded in underneath.
  const [cursor, setCursor] = useState(() => beats[0].start + 1);
  const [playing, setPlaying] = useState(true);
  const [muted, setMutedLocal] = useState(() => isMuted());

  const beat = beats[beatIndex];
  const visual = useMemo(() => visualAt(initial, events, cursor), [initial, events, cursor]);
  const currentEvent = events[cursor - 1] ?? null;

  // The reel clock. Advance through this beat's slice, then JUMP to the next
  // beat's first event — the hard cut the live director is not allowed to make,
  // earned here because the counter changes with it so the viewer is cued.
  useEffect(() => {
    if (!playing) return;
    const t = setTimeout(() => {
      if (cursor < beat.end) {
        setCursor(cursor + 1);
      } else if (beatIndex + 1 < beats.length) {
        setBeatIndex(beatIndex + 1);
        setCursor(beats[beatIndex + 1].start + 1);
      } else {
        setPlaying(false);
      }
    }, reelDuration(events[cursor - 1]));
    return () => clearTimeout(t);
  }, [playing, cursor, beatIndex, beat, beats, events]);

  useEffect(() => {
    if (currentEvent) playForEvent(currentEvent);
  }, [cursor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function restart(): void {
    setBeatIndex(0);
    setCursor(beats[0].start + 1);
    setPlaying(true);
  }

  return (
    <div className="screen replay-screen reel-screen" data-testid="highlight-reel">
      <header className="replay-header">
        <h2>Turn {prevState.turn} highlights</h2>
        <span className="reel-counter" data-testid="reel-counter">
          {beatIndex + 1} / {beats.length}
        </span>
      </header>

      <div className="game-layout">
        {/* `reel` is the only prop the replay doesn't pass. It tells the 3D
            director two things: frame TIGHT (a reel has no obligation to keep
            everyone's robot findable — that obligation is the whole difference
            between a reel and the live camera), and cut hard when `beat`
            changes. `until` keeps the look-ahead inside this beat, or the
            camera would frame an event the reel never shows. The DOM board
            ignores all of it. */}
        <BoardView
          board={prevState.board}
          visual={visual}
          currentEvent={currentEvent}
          events={events}
          cursor={cursor}
          reel={{ beat: beatIndex, until: beat.end }}
        />
        <PlayerStrip visual={visual} checkpointTarget={countCheckpoints(prevState.board)} />
      </div>

      {/* Two lines, and they do different jobs: the beat's headline holds for
          the whole beat so the moment has a name, while the caption tracks each
          event exactly as it does in the replay. */}
      <div className="reel-title" data-testid="reel-title">
        {beat.label}
      </div>
      <div className="caption" data-testid="reel-caption">
        {currentEvent ? caption(currentEvent) : ' '}
      </div>

      <div className="replay-controls reel-controls">
        <button onClick={restart} title="watch again" data-testid="reel-again">
          ↺
        </button>
        <button
          className="mute-btn"
          onClick={() => {
            const next = !muted;
            setMuted(next);
            setMutedLocal(next);
          }}
          title={muted ? 'unmute' : 'mute'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
        <button className="primary" onClick={onClose} title="back to the replay" data-testid="reel-close">
          ✕
        </button>
      </div>
    </div>
  );
}
