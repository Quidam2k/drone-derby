// What a highlight reel picks, measured rather than eyeballed.
//
// The same discipline as ../board3d/directorTurn.test.ts: "the reel shows the
// good bits" is a property of a whole turn, so it is asserted by folding REAL
// engine-produced event logs through `pickBeats` and checking the shape of what
// comes out — every beat contains its peak, beats never overlap, they are
// chronological, the whole thing fits the budget. The two cases that a real log
// cannot reliably produce on demand (a destruction run; a turn of nothing at
// all) are hand-built, because their whole point is that they are specific.

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
  type Card,
  type EventLog,
  type GameState,
  type PlayerId,
  type Program,
  type Rng,
} from '../../engine';
import { interestOf } from '../board3d/directorMath';
import { caption, eventDuration } from './eventPresentation';
import {
  beatSeconds,
  MAX_BEATS,
  MAX_REEL_SECONDS,
  MIN_BEAT_INTEREST,
  pickBeats,
  reelDuration,
  reelSeconds,
  type Beat,
} from './reelMath';

// ------------------------------------------------------------- real turns
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
  events: EventLog;
}

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
    out.push({ board, events: result.events });
    state = result.state;
  }
  return out;
}

const CARD: Card = { id: 'move1-500', type: 'move1', priority: 500 };

// ------------------------------------------------------------------- tests
describe('reelDuration', () => {
  it('stretches peaks and squeezes the connective tissue', () => {
    const destroyed = { type: 'robot-destroyed', player: 'ada', at: { x: 1, y: 1 } } as const;
    const reveal = { type: 'card-revealed', player: 'ada', register: 1, card: CARD } as const;
    // A fall gets its full arc; the run-up that only exists to make it legible
    // goes past faster.
    expect(reelDuration(destroyed)).toBeGreaterThan(eventDuration(destroyed));
    expect(reelDuration(reveal)).toBeLessThan(eventDuration(reveal));
  });

  it('agrees with pickBeats about what a peak is', () => {
    // Both key off `interestOf` against the same floor, so a stretched event is
    // exactly an event that could seed a beat. If these ever disagree the reel
    // lingers on things it did not think were worth showing.
    const blocked = { type: 'robot-blocked', player: 'ada', at: { x: 1, y: 1 }, dir: 'N' } as const;
    const moved = {
      type: 'robot-moved',
      player: 'ada',
      from: { x: 1, y: 1 },
      to: { x: 1, y: 0 },
      pushed: false,
    } as const;
    expect(interestOf(blocked)).toBeGreaterThanOrEqual(MIN_BEAT_INTEREST);
    expect(interestOf(moved)).toBeLessThan(MIN_BEAT_INTEREST);
    expect(reelDuration(blocked)).toBeGreaterThan(eventDuration(blocked));
    expect(reelDuration(moved)).toBeLessThan(eventDuration(moved));
  });
});

describe('pickBeats, on hand-built logs', () => {
  it('merges a laser -> damage -> destroyed -> life-lost run into ONE beat', () => {
    // The engine's death path, verbatim: the cause event, then life-lost. Three
    // of these four score above the floor, and cutting three times through one
    // moment is the noise the merge rule exists to stop.
    const events: EventLog = [
      { type: 'turn-started', turn: 3 },
      { type: 'register-started', register: 1 },
      { type: 'card-revealed', player: 'ada', register: 1, card: CARD },
      {
        type: 'robot-moved',
        player: 'ada',
        from: { x: 4, y: 4 },
        to: { x: 4, y: 3 },
        pushed: true,
      },
      {
        type: 'laser-fired',
        source: 'robot',
        shooter: 'brie',
        path: [
          { x: 1, y: 3 },
          { x: 4, y: 3 },
        ],
        hit: 'ada',
        strength: 1,
      },
      { type: 'damage', player: 'ada', amount: 1, total: 10 },
      { type: 'robot-destroyed', player: 'ada', at: { x: 4, y: 3 } },
      { type: 'life-lost', player: 'ada', remaining: 2 },
      { type: 'turn-ended', turn: 3 },
    ];

    const beats = pickBeats(events);
    expect(beats).toHaveLength(1);
    const [beat] = beats;
    // The destruction (0.9) outranks the laser hit (0.7), so it is the peak and
    // its caption is the reel's headline.
    expect(events[beat.peak].type).toBe('robot-destroyed');
    expect(beat.label).toBe('ada is destroyed!');
    // ...and the push that carried ada into the beam is inside the beat. A
    // destruction with no lead-in is a robot that simply vanishes.
    expect(beat.start).toBeLessThanOrEqual(3);
    expect(beat.end).toBeGreaterThan(6);
  });

  it('returns NOTHING for a turn of reveals, moves and belt pulses', () => {
    // A real outcome, not an edge case: this turn has no highlight, and the
    // button must not appear. Everything here scores under the floor.
    const events: EventLog = [
      { type: 'turn-started', turn: 1 },
      { type: 'register-started', register: 1 },
      { type: 'card-revealed', player: 'ada', register: 1, card: CARD },
      { type: 'card-revealed', player: 'brie', register: 1, card: CARD },
      {
        type: 'robot-moved',
        player: 'ada',
        from: { x: 1, y: 1 },
        to: { x: 1, y: 0 },
        pushed: false,
      },
      { type: 'robot-rotated', player: 'brie', from: 'N', to: 'E' },
      {
        type: 'conveyor-moved',
        player: 'ada',
        from: { x: 1, y: 0 },
        to: { x: 2, y: 0 },
        express: true,
      },
      { type: 'register-locked', player: 'brie', register: 5, card: CARD },
      { type: 'turn-ended', turn: 1 },
    ];
    expect(pickBeats(events)).toEqual([]);
    expect(pickBeats([])).toEqual([]);
  });

  it('keeps the win when the budget forces a cut, and drops a graze instead', () => {
    // The climax of a turn is usually its LAST beat. Capping by chronology
    // would drop `game-won` (1.0) to make room for a laser hit (0.7) that
    // happened first, which is the one failure a highlight reel cannot have.
    const filler = (n: number): EventLog =>
      Array.from({ length: n }, () => ({
        type: 'card-revealed' as const,
        player: 'ada',
        register: 1,
        card: CARD,
      }));
    const events: EventLog = [
      {
        type: 'laser-fired',
        source: 'robot',
        shooter: 'brie',
        path: [{ x: 0, y: 0 }],
        hit: 'ada',
        strength: 1,
      },
      ...filler(20),
      { type: 'checkpoint-claimed', player: 'ada', checkpoint: 1 },
      ...filler(20),
      { type: 'game-won', player: 'ada', reason: 'checkpoints' },
    ];

    // 2.5 s fits exactly one of the three beats (2.16 / 2.45 / 1.37 s).
    expect(pickBeats(events, { maxSeconds: 2.5 }).map((b) => events[b.peak].type)).toEqual([
      'game-won',
    ]);
    // With room for two, the budget is spent on the two best — and the leftover
    // room goes to a beat that fits rather than being wasted on one that
    // doesn't, which is why the cheap laser beats the pricier checkpoint here.
    expect(pickBeats(events, { maxSeconds: 4 }).map((b) => events[b.peak].type)).toEqual([
      'laser-fired',
      'game-won',
    ]);
  });
});

describe('pickBeats, over real engine turns', () => {
  // Grand Circuit is the biggest built-in and Pit Archipelago is the one full
  // of falls — the same two suites the camera director is measured on.
  const suites = [
    { id: 'grand-circuit', players: ['ada', 'brie', 'cyd', 'dov'], seed: 20260726 },
    { id: 'pit-archipelago', players: ['ada', 'brie', 'cyd'], seed: 771 },
  ] as const;

  for (const { id, players, seed } of suites) {
    describe(id, () => {
      const turns = playTurns(id, [...players], seed, 6);
      const picked = turns.map((t) => ({ turn: t, beats: pickBeats(t.events) }));

      it('found real turns with real beats in them — the premise', () => {
        expect(turns.length).toBeGreaterThan(3);
        // If no turn had a highlight the assertions below would all pass
        // vacuously. Most turns of a four-robot game do.
        expect(picked.filter((p) => p.beats.length > 0).length).toBeGreaterThan(2);
      });

      it('every beat contains its peak, in range', () => {
        for (const { turn, beats } of picked) {
          for (const beat of beats) {
            expect(beat.start).toBeGreaterThanOrEqual(0);
            expect(beat.end).toBeLessThanOrEqual(turn.events.length);
            expect(beat.start).toBeLessThanOrEqual(beat.peak);
            expect(beat.peak).toBeLessThan(beat.end);
            expect(interestOf(turn.events[beat.peak])).toBeGreaterThanOrEqual(MIN_BEAT_INTEREST);
            expect(beat.interest).toBe(interestOf(turn.events[beat.peak]));
            expect(beat.label).toBe(caption(turn.events[beat.peak]));
          }
        }
      });

      it('beats are chronological and never overlap', () => {
        // The reel plays each slice then jumps; an overlap would replay events
        // the viewer just watched, which reads as a stutter rather than a cut.
        for (const { beats } of picked) {
          for (let i = 1; i < beats.length; i++) {
            expect(beats[i].start).toBeGreaterThanOrEqual(beats[i - 1].end);
            expect(beats[i].peak).toBeGreaterThan(beats[i - 1].peak);
          }
        }
      });

      it('fits the reel budget, in beats and in seconds', () => {
        for (const { turn, beats } of picked) {
          expect(beats.length).toBeLessThanOrEqual(MAX_BEATS);
          const total = reelSeconds(turn.events, beats);
          // One beat may exceed the budget on its own — a reel of nothing is
          // worse than a reel that runs long — but two must not.
          if (beats.length > 1) expect(total).toBeLessThanOrEqual(MAX_REEL_SECONDS);
          expect(total).toBeLessThanOrEqual(
            MAX_REEL_SECONDS + Math.max(...beats.map((b) => beatSeconds(turn.events, b)), 0),
          );
        }
      });

      it('is shorter than the replay it came from — it is a reel, not a re-run', () => {
        // The point of the feature, measured in the only unit that matters:
        // time on screen. Measured, six turns each — Grand Circuit reels run
        // 2-12 s against 33-42 s of replay (5-33%), Pit Archipelago 9-12 s
        // against 18-28 s (33-58%). The short dense turns are where a reel is
        // least of a saving, and that is where the bar is set.
        for (const { turn, beats } of picked) {
          const replay = turn.events.reduce((a, e) => a + eventDuration(e), 0) / 1000;
          const reel = reelSeconds(turn.events, beats);
          expect(reel).toBeLessThan(replay * 0.65);
          // On a long turn it is a small fraction, not merely a shorter one.
          if (replay > 30) expect(reel).toBeLessThan(replay * 0.4);
        }
      });

      it('gives every beat a run-up where the log has room for one', () => {
        for (const { beats } of picked) {
          for (const beat of beats) {
            // Either the beat starts at the top of the log, or something
            // happens before the peak.
            expect(beat.start === 0 || beat.start < beat.peak).toBe(true);
          }
        }
      });
    });
  }

  it('never lets two beats share an event, even with colliding padding', () => {
    // The default LEAD_IN + LEAD_OUT == MERGE_GAP makes collisions impossible;
    // `opts` can break that identity, so the split rule is what is under test.
    const turns = playTurns('grand-circuit', ['ada', 'brie', 'cyd', 'dov'], 20260726, 6);
    for (const turn of turns) {
      const beats: Beat[] = pickBeats(turn.events, {
        mergeGap: 1,
        leadIn: 9,
        leadOut: 9,
        maxBeats: 99,
        maxSeconds: 999,
      });
      for (let i = 1; i < beats.length; i++) {
        expect(beats[i].start).toBeGreaterThanOrEqual(beats[i - 1].end);
      }
      for (const beat of beats) {
        expect(beat.start).toBeLessThanOrEqual(beat.peak);
        expect(beat.peak).toBeLessThan(beat.end);
      }
    }
  });
});
