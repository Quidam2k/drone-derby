// The headline number for Phase 3D-5, measured rather than eyeballed.
//
// "The camera is calmer" is a property of a whole turn, not of one frame, so it
// cannot be asserted from a screenshot and it cannot honestly be judged by
// watching. This test folds a REAL engine-produced event log through the rule
// 3D-1 shipped (focus the current event, every event) and through the 3D-5
// planner, and counts two things: how many times the camera re-aims, and how
// far the subject travels in tiles.
//
// Each rule is simulated as SHIPPED, clamp included — the old one keeps the
// framing strictly over the board, the new one has the rim overhang that lets
// an edge fall stay on canvas. Comparing raw unclamped centres would flatter
// the new rule.

import { describe, expect, it } from 'vitest';
import {
  BUILTIN_BOARDS,
  createGame,
  createRng,
  executeTurn,
  isGameOver,
  isRegisterLocked,
  shuffle,
  type BoardDef,
  type EngineEvent,
  type EventLog,
  type GameState,
  type PlayerId,
  type Program,
  type Rng,
} from '../../engine';
import { eventDuration } from '../replay/eventPresentation';
import { initialVisual, visualAt } from '../replay/visualState';
import {
  lookaheadWindow,
  MIN_RADIUS,
  planShot,
  shouldReplace,
  type DirectorContext,
  type Shot,
} from './directorMath';

/**
 * The replay clock, in seconds — the REAL one.
 *
 * Until 3D-6 this was a hand-copied table, because `eventDuration` lived in a
 * .tsx component a node test has no business loading. Phase 3D-6 lifted it into
 * ./replay/eventPresentation.ts (a plain .ts, so it imports cleanly here) for
 * the highlight reel's sake, and the copy went with it: the dwell numbers this
 * file measures are only meaningful against the clock the app actually runs.
 */
function seconds(e: EngineEvent): number {
  return eventDuration(e) / 1000;
}

// --------------------------------------------------------------- the old rule
/**
 * `camera.eventFocus` exactly as 3D-1 shipped it: one cell per event, the
 * midpoint of a beam, the acting robot for everything that only names a player,
 * and null for the markers. Kept here rather than in production code — it is
 * the baseline being regressed against, not something the app still runs.
 */
function legacyFocus(
  e: EngineEvent | null,
  robotAt: (p: PlayerId) => { x: number; y: number } | null,
): { x: number; y: number } | null {
  if (!e) return null;
  switch (e.type) {
    case 'robot-moved':
    case 'conveyor-moved':
    case 'robot-teleported':
    case 'repulsed':
      return e.to;
    case 'robot-blocked':
    case 'robot-fell':
    case 'robot-destroyed':
    case 'pusher-fired':
    case 'crusher-crushed':
      return e.at;
    case 'robot-respawned':
      return e.pos;
    case 'laser-fired': {
      const a = e.path[0];
      const b = e.path[e.path.length - 1];
      return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } : null;
    }
    case 'robot-rotated':
    case 'gear-rotated':
    case 'conveyor-rotated':
    case 'damage':
    case 'repair':
    case 'register-locked':
    case 'register-unlocked':
    case 'life-lost':
    case 'player-eliminated':
    case 'checkpoint-claimed':
    case 'game-won':
    case 'card-revealed':
    case 'robot-powered-down':
    case 'robot-powered-up':
      return robotAt(e.player);
    case 'turn-started':
    case 'turn-ended':
    case 'register-started':
      return null;
  }
}

/** camera.focus()'s clamp. `overhang` is 0 for the old rule, 1.5 for 3D-5. */
function clampCentre(
  p: { x: number; y: number },
  radius: number,
  board: BoardDef,
  overhang: number,
): { x: number; y: number } {
  const mx = Math.min(radius, board.width / 2);
  const my = Math.min(radius, board.height / 2);
  const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
  return {
    x: clamp(p.x, mx - overhang, board.width - mx + overhang),
    y: clamp(p.y, my - overhang, board.height - my + overhang),
  };
}

// ------------------------------------------------------------- a real turn
/** A legal program: distinct cards from the hand in the unlocked registers. */
function randomProgram(state: GameState, player: PlayerId, rng: Rng): Program {
  const robot = state.robots.find((r) => r.player === player);
  if (!robot) throw new Error(`no robot for ${player}`);
  const pool = shuffle(state.hands[player], rng);
  const program: Program = [];
  for (let register = 1; register <= 5; register++) {
    program.push(isRegisterLocked(robot.damage, register) ? null : (pool.shift() ?? null));
  }
  return program;
}

interface Turn {
  board: BoardDef;
  prev: GameState;
  events: EventLog;
}

/** Play `turns` turns of a real game and keep each turn's log with its state. */
function playTurns(boardId: string, players: PlayerId[], seed: number, turns: number): Turn[] {
  const board = BUILTIN_BOARDS[boardId].factory();
  let state = createGame(board, players, seed);
  const rng = createRng(seed ^ 0x5f3759df);
  const out: Turn[] = [];
  for (let t = 0; t < turns && !isGameOver(state); t++) {
    const programs: Record<PlayerId, Program> = {};
    for (const robot of state.robots) {
      if (!robot.eliminated) programs[robot.player] = randomProgram(state, robot.player, rng);
    }
    const result = executeTurn(state, programs, seed + t);
    out.push({ board, prev: state, events: result.events });
    state = result.state;
  }
  return out;
}

// --------------------------------------------------------------- the measure
interface Tally {
  /** How many times the camera changed what it was pointing at. */
  cuts: number;
  /** Total distance the subject travelled, in tiles. */
  travel: number;
  events: number;
  /** Seconds the turn takes to replay at 1x. */
  seconds: number;
}

function replaySeconds(events: EventLog): number {
  return events.reduce((a, e) => a + seconds(e), 0);
}

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function contextFor(turn: Turn, cursor: number): DirectorContext {
  const visual = visualAt(initialVisual(turn.prev), turn.events, cursor);
  return {
    width: turn.board.width,
    height: turn.board.height,
    robotAt: (p) => visual.robots.find((r) => r.player === p)?.pos ?? null,
  };
}

/** The whole-board framing both rules fall back to. */
function centreOf(board: BoardDef): { x: number; y: number } {
  return { x: board.width / 2 - 0.5, y: board.height / 2 - 0.5 };
}

/** 3D-1: re-aim on every event that has a place. */
function tallyLegacy(turn: Turn): Tally {
  const home = centreOf(turn.board);
  let at = home;
  let cuts = 0;
  let travel = 0;
  for (let cursor = 0; cursor <= turn.events.length; cursor++) {
    const ctx = contextFor(turn, cursor);
    const raw = legacyFocus(cursor > 0 ? turn.events[cursor - 1] : null, ctx.robotAt);
    const next = raw ? clampCentre(raw, MIN_RADIUS, turn.board, 0) : home;
    if (distance(at, next) > 1e-6) {
      cuts++;
      travel += distance(at, next);
      at = next;
    }
  }
  return { cuts, travel, events: turn.events.length, seconds: replaySeconds(turn.events) };
}

/** 3D-5: plan a shot over a look-ahead window, and hold it. */
function tallyDirector(turn: Turn): Tally {
  const home = centreOf(turn.board);
  let shot: Shot | null = null;
  let at = home;
  let held = 0;
  let cuts = 0;
  let travel = 0;
  for (let cursor = 0; cursor <= turn.events.length; cursor++) {
    const ctx = contextFor(turn, cursor);
    const next = planShot(lookaheadWindow(turn.events, cursor), ctx);
    if (shouldReplace(shot, next, held)) {
      const centre = next ? clampCentre(next, next.radius, turn.board, 1.5) : home;
      if (distance(at, centre) > 1e-6) {
        cuts++;
        travel += distance(at, centre);
        at = centre;
      }
      shot = next;
      held = 0;
    }
    // The event now on screen holds the replay clock for this long.
    if (cursor < turn.events.length) held += seconds(turn.events[cursor]);
  }
  return { cuts, travel, events: turn.events.length, seconds: replaySeconds(turn.events) };
}

function sum(list: Tally[]): Tally {
  return list.reduce(
    (a, t) => ({
      cuts: a.cuts + t.cuts,
      travel: a.travel + t.travel,
      events: a.events + t.events,
      seconds: a.seconds + t.seconds,
    }),
    { cuts: 0, travel: 0, events: 0, seconds: 0 },
  );
}

// ------------------------------------------------------------------- tests
describe('the director, over real engine turns', () => {
  // Grand Circuit is the biggest built-in (12x17, composed) and Pit
  // Archipelago is the one full of falls — between them they cover the
  // long-beam and off-the-rim cases the planner exists for.
  const suites = [
    { id: 'grand-circuit', players: ['ada', 'brie', 'cyd', 'dov'], seed: 20260726 },
    { id: 'pit-archipelago', players: ['ada', 'brie', 'cyd'], seed: 771 },
  ] as const;

  for (const { id, players, seed } of suites) {
    describe(id, () => {
      const turns = playTurns(id, [...players], seed, 6);

      it('produced real, event-dense turns to measure', () => {
        expect(turns.length).toBeGreaterThan(3);
        // The premise of the phase: turns are long. If they were not, chasing
        // every event would be fine and none of this would be needed.
        expect(Math.max(...turns.map((t) => t.events.length))).toBeGreaterThan(50);
      });

      it('re-aims on the order of fifteen times a turn, not once per event', () => {
        for (const turn of turns) {
          const now = tallyDirector(turn);
          // 3D-1 re-aimed up to once per event — 77 times on the densest turn
          // here. The bars are a regression tripwire with headroom, not a
          // target: the planner measures 11-22 per Grand Circuit turn and 6-9
          // per Pit Archipelago turn.
          expect(now.cuts).toBeLessThan(25);
          expect(now.cuts).toBeLessThan(now.events / 3);
        }
      });

      it('holds each shot for over two seconds of replay', () => {
        // The number that actually describes a camera. Events run 0.3-0.9 s, so
        // this is five or more events per shot. Measured: 2.4 s on Grand
        // Circuit, 3.1 s on Pit Archipelago.
        const after = sum(turns.map(tallyDirector));
        expect(after.seconds / after.cuts).toBeGreaterThan(1.8);
      });

      it('cuts the re-aims and the travel against the rule 3D-1 shipped', () => {
        const before = sum(turns.map(tallyLegacy));
        const after = sum(turns.map(tallyDirector));
        expect(after.cuts).toBeLessThan(before.cuts / 3.5);
        expect(after.travel).toBeLessThan(before.travel / 3.5);
      });

      it('never leaves the camera pointing at nothing for a whole register', () => {
        // Calm must not become dead: over a turn the director should be on a
        // real shot for most of the log, not stuck at whole-board framing.
        for (const turn of turns) {
          let onShot = 0;
          for (let cursor = 0; cursor <= turn.events.length; cursor++) {
            if (planShot(lookaheadWindow(turn.events, cursor), contextFor(turn, cursor))) onShot++;
          }
          expect(onShot / (turn.events.length + 1)).toBeGreaterThan(0.6);
        }
      });
    });
  }

  it('holds one subject through a run of card reveals', () => {
    // The symptom that opened the phase: five card-revealed events per
    // register, 450 ms each, each one dragging the camera to a different
    // robot. Count how many re-aims happen while only reveals are on screen.
    const turns = playTurns('grand-circuit', ['ada', 'brie', 'cyd', 'dov'], 20260726, 4);
    let legacyCuts = 0;
    let directorCuts = 0;
    for (const turn of turns) {
      let legacyAt = centreOf(turn.board);
      let shot: Shot | null = null;
      let at = centreOf(turn.board);
      let held = 0;
      for (let cursor = 1; cursor <= turn.events.length; cursor++) {
        const onScreen = turn.events[cursor - 1];
        const ctx = contextFor(turn, cursor);
        const reveal = onScreen.type === 'card-revealed';

        const raw = legacyFocus(onScreen, ctx.robotAt);
        const legacyNext = raw ? clampCentre(raw, MIN_RADIUS, turn.board, 0) : centreOf(turn.board);
        if (distance(legacyAt, legacyNext) > 1e-6) {
          if (reveal) legacyCuts++;
          legacyAt = legacyNext;
        }

        const next = planShot(lookaheadWindow(turn.events, cursor), ctx);
        if (shouldReplace(shot, next, held)) {
          const centre = next ? clampCentre(next, next.radius, turn.board, 1.5) : centreOf(turn.board);
          if (distance(at, centre) > 1e-6 && reveal) directorCuts++;
          at = centre;
          shot = next;
          held = 0;
        }
        held += seconds(onScreen);
      }
    }
    expect(legacyCuts).toBeGreaterThan(20);
    // Not zero: a reveal can be on screen while the look-ahead legitimately
    // re-aims for the moves that follow it. But it must be a small fraction.
    expect(directorCuts).toBeLessThan(legacyCuts / 4);
  });

  it('frames an edge fall past the rim, where the old rule clamped it back', () => {
    const board = BUILTIN_BOARDS['pit-archipelago'].factory();
    const at = { x: 4, y: board.height - 1 };
    const events: EventLog = [{ type: 'robot-fell', player: 'ada', cause: 'edge', at }];
    const ctx: DirectorContext = {
      width: board.width,
      height: board.height,
      robotAt: () => at,
    };
    const shot = planShot(events, ctx)!;
    const now = clampCentre(shot, shot.radius, board, 1.5);
    const before = clampCentre(at, MIN_RADIUS, board, 0);
    // The throw lands ~1.3 tiles south of `at`; the new framing has to be
    // closer to it than the old one, or the robot leaves the canvas.
    const landing = { x: at.x, y: at.y + 1.3 };
    expect(distance(now, landing)).toBeLessThan(distance(before, landing));
    expect(distance(now, landing)).toBeLessThan(shot.radius);
  });
});
