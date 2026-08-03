// Screen flow + hot-seat game state. No router: 'screen' is the state
// machine. Seeding happens HERE (Date.now is fine outside the engine);
// turn seed = initialSeed + turn number so a whole game is reproducible
// from one number.

import { create } from 'zustand';
import type { BoardDef, Direction, EventLog, GameState, PlayerId, Program } from '../engine';
import { createGame, executeTurn, isGameOver, provingGrounds } from '../engine';
import { logFlowEvent, logTelemetry } from '../services/telemetry';

export type Screen = 'setup' | 'handoff' | 'programming' | 'replay' | 'gameover';

const errorText = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * Hot-seat games used to live in memory alone — a reload, a phone locking or a
 * stray refresh erased a game in progress with no way back. The editor already
 * persisted its drafts (editorStore.ts); the actual game did not. `lastTurn` is
 * deliberately NOT saved: its event log and previous state are the bulkiest
 * thing here and all they buy is re-watching one replay, so a resume skips
 * straight to the next handoff instead.
 */
const SAVE_KEY = 'dd-hotseat';
const SAVE_VERSION = 1;

interface SavedGame {
  version: number;
  game: GameState;
  initialSeed: number;
  currentSeat: number;
  pendingPrograms: Record<PlayerId, Program>;
  pendingTaunts: Record<PlayerId, string>;
  pendingFacings: Record<PlayerId, Direction>;
  pendingPowerDown: PlayerId[];
  screen: Screen;
}

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
  /** Respawn facing choices from just-respawned seats, applied at turn start. */
  pendingFacings: Record<PlayerId, Direction>;
  /** Players announcing a power-down (or staying down), applied at turn end. */
  pendingPowerDown: PlayerId[];
  lastTurn: LastTurn | null;
  /**
   * Set when the engine threw executing a turn. The game is left standing so
   * the state is still there to inspect; the UI surfaces this instead of a
   * screen that silently stopped responding.
   */
  turnError: string | null;

  /** Start a hot-seat game; `board` overrides the default (editor test-drives). */
  startGame: (playerNames: string[], board?: BoardDef) => void;
  /** Handoff screen's Ready button: reveal the current seat's hand. */
  beginProgramming: () => void;
  submitProgram: (
    program: Program,
    taunt?: string,
    respawnFacing?: Direction,
    powerDown?: boolean,
  ) => void;
  finishReplay: () => void;
  newGame: () => void;
}

function firstActiveSeat(game: GameState, from = 0): number {
  for (let i = from; i < game.robots.length; i++) {
    if (!game.robots[i].eliminated) return i;
  }
  return -1;
}

function saveGame(s: {
  game: GameState | null;
  initialSeed: number;
  currentSeat: number;
  pendingPrograms: Record<PlayerId, Program>;
  pendingTaunts: Record<PlayerId, string>;
  pendingFacings: Record<PlayerId, Direction>;
  pendingPowerDown: PlayerId[];
  screen: Screen;
}): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (!s.game) return void localStorage.removeItem(SAVE_KEY);
    const saved: SavedGame = {
      version: SAVE_VERSION,
      game: s.game,
      initialSeed: s.initialSeed,
      currentSeat: s.currentSeat,
      pendingPrograms: s.pendingPrograms,
      pendingTaunts: s.pendingTaunts,
      pendingFacings: s.pendingFacings,
      pendingPowerDown: s.pendingPowerDown,
      screen: s.screen,
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saved));
  } catch {
    // Quota, private mode, a serialisation surprise — failing to save a game
    // must never take down the game it was trying to protect.
  }
}

function clearSave(): void {
  try {
    localStorage?.removeItem(SAVE_KEY);
  } catch {
    // Same reasoning as saveGame.
  }
}

/**
 * Restore a game in progress, or null for a clean start. A save taken mid
 * 'replay' resumes at the next handoff (or the game-over screen): the turn had
 * already been applied to `game` before the save, so the only thing lost is
 * re-watching it — exactly what finishReplay would have done next anyway.
 */
function loadSave(): Partial<SavedGame> | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw) as SavedGame;
    if (saved.version !== SAVE_VERSION || !saved.game) return null;
    if (saved.screen !== 'replay') return saved;
    if (!isGameOver(saved.game)) {
      return { ...saved, screen: 'handoff', currentSeat: firstActiveSeat(saved.game) };
    }
    // Reloaded during the winning turn's replay: finishReplay never ran, so its
    // 'hotseat-game-finished' never fired and this completed game would sit in
    // the funnel as an abandoned one. Emitting here needs no extra bookkeeping
    // because the two cases are already distinguishable — a save that reads
    // 'gameover' is one where finishReplay DID run and already reported it.
    logFlowEvent('hotseat-game-finished', {
      turns: saved.game.turn,
      winner: saved.game.winner !== null,
      playerCount: saved.game.robots.length,
      viaResume: true,
    });
    return { ...saved, screen: 'gameover' };
  } catch {
    // A corrupt or half-written save is worth exactly one clean start.
    clearSave();
    return null;
  }
}

const restored = loadSave();

export const useGameStore = create<GameStore>((set, get) => ({
  screen: restored?.screen ?? 'setup',
  game: restored?.game ?? null,
  initialSeed: restored?.initialSeed ?? 0,
  currentSeat: restored?.currentSeat ?? 0,
  pendingPrograms: restored?.pendingPrograms ?? {},
  pendingTaunts: restored?.pendingTaunts ?? {},
  pendingFacings: restored?.pendingFacings ?? {},
  pendingPowerDown: restored?.pendingPowerDown ?? [],
  // Never restored: it holds the previous turn's event log, and a resume goes
  // to the next handoff rather than re-watching a replay.
  lastTurn: null,
  turnError: null,

  startGame: (playerNames, board) => {
    const seed = Date.now() % 1_000_000_000;
    const game = createGame(board ?? provingGrounds(), playerNames, seed);
    set({
      game,
      initialSeed: seed,
      currentSeat: 0,
      pendingPrograms: {},
      pendingTaunts: {},
      pendingFacings: {},
      pendingPowerDown: [],
      lastTurn: null,
      turnError: null,
      screen: 'handoff',
    });
    // Only ever fired from here, which is why a RESUME cannot inflate it: a
    // restored save rehydrates the store directly and never calls startGame.
    // Counting a resume as a new game would deflate every downstream rate —
    // completion most of all, since the same game would be started twice and
    // finished once.
    logFlowEvent('hotseat-game-started', {
      boardName: game.board?.name,
      playerCount: game.robots.length,
      seed,
    });
    saveGame(get());
  },

  beginProgramming: () => {
    set({ screen: 'programming' });
    saveGame(get());
  },

  submitProgram: (program, taunt, respawnFacing, powerDown) => {
    const {
      game,
      currentSeat,
      pendingPrograms,
      pendingTaunts,
      pendingFacings,
      pendingPowerDown,
      initialSeed,
    } = get();
    if (!game) return;
    const player = game.robots[currentSeat].player;
    const programs = { ...pendingPrograms, [player]: program };
    const taunts = taunt ? { ...pendingTaunts, [player]: taunt } : pendingTaunts;
    const facings = respawnFacing
      ? { ...pendingFacings, [player]: respawnFacing }
      : pendingFacings;
    const powerDowns = powerDown ? [...pendingPowerDown, player] : pendingPowerDown;

    const nextSeat = firstActiveSeat(game, currentSeat + 1);
    if (nextSeat !== -1) {
      // More players to program: pass the device (hands stay secret).
      set({
        pendingPrograms: programs,
        pendingTaunts: taunts,
        pendingFacings: facings,
        pendingPowerDown: powerDowns,
        currentSeat: nextSeat,
        screen: 'handoff',
      });
      saveGame(get());
      return;
    }

    // Everyone has submitted — execute the turn.
    const seed = initialSeed + game.turn;
    let result: { state: GameState; events: EventLog };
    const startedAt = Date.now();
    try {
      result = executeTurn(game, programs, seed, {
        respawnFacing: facings,
        powerDown: powerDowns,
      });
    } catch (err) {
      // An engine throw here used to escape into window.onerror, which caught
      // the stack and nothing else — no seed, no board, no programs. Since a
      // hot-seat game lives only in memory, the player's natural response
      // (reload) then destroyed the game and the last of the evidence in one
      // gesture. Capture the exact repro key first, then leave the game
      // standing so the state itself is still there to inspect.
      logTelemetry('error', `hot-seat turn failed: ${errorText(err)}`, {
        seed,
        turn: game.turn,
        boardName: game.board?.name,
        playerCount: game.robots.length,
        programs,
        powerDown: powerDowns,
        respawnFacing: facings,
        stack: err instanceof Error ? err.stack : undefined,
      });
      set({ turnError: errorText(err) });
      return;
    }

    const { state, events } = result;
    // Mirrors the server's 'turn-executed' row so the two modes read the same
    // way in the digest. `turn` is the turn that just ran, matching the seed
    // above — a note filed about "turn 4" names the same turn either way.
    logFlowEvent('hotseat-turn-executed', {
      turn: game.turn,
      ms: Date.now() - startedAt,
      playerCount: game.robots.length,
    });
    set({
      game: state,
      lastTurn: { events, prevState: game, taunts },
      pendingPrograms: {},
      pendingTaunts: {},
      pendingFacings: {},
      pendingPowerDown: [],
      turnError: null,
      screen: 'replay',
    });
    saveGame(get());
  },

  finishReplay: () => {
    const { game } = get();
    if (!game) return;
    // `executeTurn` increments `turn` ONLY when the game did not end (see the
    // `if (!gameEnded)` guard in execute.ts), so the turn just watched is one
    // back on an ongoing game and the current one on the last. Getting this
    // backwards would misname the final turn of every game — the one turn most
    // likely to be the subject of a 🐞 note.
    const over = isGameOver(game);
    const watched = over ? game.turn : game.turn - 1;
    // A replay reaching its end is the signal that someone watched the turn
    // rather than tapping past it — the only read we get on whether the replay
    // is worth the time it takes.
    logFlowEvent('replay-watched', { turn: watched });
    if (over) {
      logFlowEvent('hotseat-game-finished', {
        turns: game.turn,
        winner: game.winner !== null,
        playerCount: game.robots.length,
      });
      set({ screen: 'gameover' });
      saveGame(get());
      return;
    }
    set({ currentSeat: firstActiveSeat(game), screen: 'handoff' });
    saveGame(get());
  },

  newGame: () => {
    clearSave();
    set({
      screen: 'setup',
      game: null,
      currentSeat: 0,
      pendingPrograms: {},
      pendingTaunts: {},
      pendingFacings: {},
      pendingPowerDown: [],
      lastTurn: null,
      turnError: null,
    });
  },
}));
