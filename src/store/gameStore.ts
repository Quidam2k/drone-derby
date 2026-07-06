// Screen flow + hot-seat game state. No router: 'screen' is the state
// machine. Seeding happens HERE (Date.now is fine outside the engine);
// turn seed = initialSeed + turn number so a whole game is reproducible
// from one number.

import { create } from 'zustand';
import type { EventLog, GameState, PlayerId, Program } from '../engine';
import { createGame, executeTurn, isGameOver, provingGrounds } from '../engine';

export type Screen = 'setup' | 'handoff' | 'programming' | 'replay' | 'gameover';

interface LastTurn {
  events: EventLog;
  /** State the turn started from — the replay folds events on top of this. */
  prevState: GameState;
  /** Speech-bubble lines submitted with this turn's programs. */
  taunts: Record<PlayerId, string>;
}

interface GameStore {
  screen: Screen;
  game: GameState | null;
  initialSeed: number;
  /** Seat index currently programming (or about to, on the handoff screen). */
  currentSeat: number;
  pendingPrograms: Record<PlayerId, Program>;
  pendingTaunts: Record<PlayerId, string>;
  lastTurn: LastTurn | null;

  startGame: (playerNames: string[]) => void;
  /** Handoff screen's Ready button: reveal the current seat's hand. */
  beginProgramming: () => void;
  submitProgram: (program: Program, taunt?: string) => void;
  finishReplay: () => void;
  newGame: () => void;
}

function firstActiveSeat(game: GameState, from = 0): number {
  for (let i = from; i < game.robots.length; i++) {
    if (!game.robots[i].eliminated) return i;
  }
  return -1;
}

export const useGameStore = create<GameStore>((set, get) => ({
  screen: 'setup',
  game: null,
  initialSeed: 0,
  currentSeat: 0,
  pendingPrograms: {},
  pendingTaunts: {},
  lastTurn: null,

  startGame: (playerNames) => {
    const seed = Date.now() % 1_000_000_000;
    const game = createGame(provingGrounds(), playerNames, seed);
    set({
      game,
      initialSeed: seed,
      currentSeat: 0,
      pendingPrograms: {},
      pendingTaunts: {},
      lastTurn: null,
      screen: 'handoff',
    });
  },

  beginProgramming: () => set({ screen: 'programming' }),

  submitProgram: (program, taunt) => {
    const { game, currentSeat, pendingPrograms, pendingTaunts, initialSeed } = get();
    if (!game) return;
    const player = game.robots[currentSeat].player;
    const programs = { ...pendingPrograms, [player]: program };
    const taunts = taunt ? { ...pendingTaunts, [player]: taunt } : pendingTaunts;

    const nextSeat = firstActiveSeat(game, currentSeat + 1);
    if (nextSeat !== -1) {
      // More players to program: pass the device (hands stay secret).
      set({
        pendingPrograms: programs,
        pendingTaunts: taunts,
        currentSeat: nextSeat,
        screen: 'handoff',
      });
      return;
    }

    // Everyone has submitted — execute the turn.
    const { state, events } = executeTurn(game, programs, initialSeed + game.turn);
    set({
      game: state,
      lastTurn: { events, prevState: game, taunts },
      pendingPrograms: {},
      pendingTaunts: {},
      screen: 'replay',
    });
  },

  finishReplay: () => {
    const { game } = get();
    if (!game) return;
    if (isGameOver(game)) {
      set({ screen: 'gameover' });
      return;
    }
    set({ currentSeat: firstActiveSeat(game), screen: 'handoff' });
  },

  newGame: () =>
    set({
      screen: 'setup',
      game: null,
      currentSeat: 0,
      pendingPrograms: {},
      pendingTaunts: {},
      lastTurn: null,
    }),
}));
