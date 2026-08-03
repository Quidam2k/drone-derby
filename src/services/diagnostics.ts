// Repro key for playtest bug reports.
//
// The audit finding this exists for: a rules mistake that produces the WRONG
// OUTCOME never throws. `turn-executed` looks identical whether the turn was
// right or wrong, so the only channel for "the push looked wrong on turn 4"
// is a 🐞 note — and a note with no state, no seed and no event log is
// unreproducible. Everything below turns that note into a deterministic
// replay.
//
// Layering: this module may import the store; `telemetry.ts` must not, so it
// stays safe to import from anywhere. Nothing here goes near `src/engine/`.

import { useGameStore } from '../store/gameStore';
import { dumpTelemetry, APP_VERSION } from './telemetry';

/** Ring-buffer entries carried along with a note — enough to see the run-up. */
const RECENT_ENTRIES = 15;

export interface ReproKey {
  appVersion: string;
  /** Route hash, e.g. `#/game/abc123` — carries the online gameId already. */
  route: string;
  /** What is actually on screen right now, not what was preferred. */
  renderer: '3d' | 'dom' | 'none';
  /** Hot-seat games live in memory; this is their complete repro key. */
  hotSeat?: {
    seed: number;
    turn: number;
    boardName?: string;
    playerCount: number;
    screen: string;
  };
  /** Tail of the localStorage ring buffer — the run-up to the complaint. */
  recent: unknown[];
}

/**
 * Snapshot of everything needed to reproduce what the player is looking at.
 *
 * Online games need nothing more than the route: `gameId + turn` is already a
 * complete repro because `turns.prevState` and `turns.events` are stored
 * server-side (convex/games.ts). Hot-seat games are memory-only, so the seed
 * has to travel with the report or it is gone the moment they reload.
 */
export function collectRepro(): ReproKey {
  const key: ReproKey = {
    appVersion: APP_VERSION,
    route: typeof location !== 'undefined' ? location.hash : '',
    // Board3D parks the live scene on window; its absence means the DOM board
    // (or no board at all) is what the player is actually looking at.
    renderer:
      typeof window === 'undefined'
        ? 'none'
        : (window as { __board3d?: unknown }).__board3d
          ? '3d'
          : document.querySelector('[data-board]')
            ? 'dom'
            : 'none',
    recent: dumpTelemetry().slice(-RECENT_ENTRIES),
  };

  try {
    const { game, initialSeed, screen } = useGameStore.getState();
    if (game) {
      key.hotSeat = {
        // Mirrors gameStore's own turn seed so the report replays the turn the
        // player is complaining about, not a different one.
        seed: initialSeed + game.turn,
        turn: game.turn,
        boardName: game.board?.name,
        playerCount: game.robots.length,
        screen,
      };
    }
  } catch {
    // A diagnostics failure must never block the bug report it decorates.
  }

  return key;
}
