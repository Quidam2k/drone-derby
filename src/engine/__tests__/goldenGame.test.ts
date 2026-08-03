// Golden-game regression harness (phase P4).
//
// A wrong-outcome rules bug is invisible at runtime by construction: nothing
// throws, and `turn-executed` logs the same row whether the turn was right or
// wrong. This drives a full 18-turn game through the engine and pins every
// event and every robot state against a checked-in fixture, so a rule that
// moves is caught by CI instead of by a playtester's raised eyebrow.
//
// READ THIS BEFORE REGENERATING THE FIXTURE.
// The fixture is generated from the engine, so it can only ever say "nothing
// changed" — never "the rules are correct". If it fails, the useful question is
// WHICH rule moved and whether that was intended. `npm run golden:update` is
// deliberately a separate, explicit command and NOT a vitest snapshot: `-u`
// makes blessing a golden a reflex, and a golden you can bless by muscle memory
// is not a tripwire. Regenerating to make the suite green throws away the only
// warning you were going to get.
//
// The waypoint assertions below are the half that CAN judge correctness: each
// names a specific rule from docs/game_mechanics_md.md and a human can check it
// by reading. Nobody can check a 119 KB JSON blob.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createGame, executeTurn } from '../index';
import type { Direction } from '../types';
import {
  GOLDEN_MAX_TURNS,
  GOLDEN_PLAYERS,
  GOLDEN_SEED,
  goldenBoard,
  programFor,
  runGoldenGame,
  type GoldenGame,
} from './goldenGame';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(HERE, '__fixtures__', 'golden-game.json');

const actual = runGoldenGame();

// `npm run golden:update` sets this. Writing happens here rather than in a
// separate script so the fixture and the assertion can never drift apart.
if (process.env.GOLDEN_UPDATE) {
  mkdirSync(dirname(FIXTURE), { recursive: true });
  writeFileSync(FIXTURE, JSON.stringify(actual, null, 2) + '\n');
}

describe('golden game — regression tripwire', () => {
  const expected = JSON.parse(readFileSync(FIXTURE, 'utf8')) as GoldenGame;

  it('was generated from the same setup the fixture records', () => {
    // A fixture from a different seed or board would "pass" the turn loop below
    // only by accident, and every later assertion would be meaningless.
    expect({ seed: actual.seed, board: actual.board, players: actual.players }).toEqual({
      seed: expected.seed,
      board: expected.board,
      players: expected.players,
    });
  });

  it('replays turn for turn, event for event', () => {
    expect(actual.turns.length).toBe(expected.turns.length);

    // Compared turn by turn, and within a turn event by event, so a failure
    // names the register that moved instead of diffing 119 KB of JSON.
    for (let i = 0; i < expected.turns.length; i++) {
      const a = actual.turns[i];
      const e = expected.turns[i];
      if (JSON.stringify(a) === JSON.stringify(e)) continue;

      for (let j = 0; j < Math.max(a.events.length, e.events.length); j++) {
        if (JSON.stringify(a.events[j]) !== JSON.stringify(e.events[j])) {
          throw new Error(
            `Turn ${e.turn}, event ${j} changed:\n` +
              `  expected ${JSON.stringify(e.events[j])}\n` +
              `  actual   ${JSON.stringify(a.events[j])}\n` +
              `A rule moved. Find out which one before running golden:update.`,
          );
        }
      }
      // Same events, different outcome — a state-application bug rather than
      // an event-emission one.
      expect({ turn: a.turn, robots: a.robots }).toEqual({ turn: e.turn, robots: e.robots });
    }
  });

  it('ends where the fixture says it ends', () => {
    expect(actual.final).toEqual(expected.final);
  });

  it('reaches a real ending rather than running out the turn cap', () => {
    // If the game ever stops ending on its own, the golden quietly becomes a
    // test of the first GOLDEN_MAX_TURNS turns of an unfinished game.
    expect(actual.final.over).toBe(true);
    expect(actual.turns.length).toBeLessThan(GOLDEN_MAX_TURNS);
    expect(actual.final.winner).toBe('Cy');
  });
});

describe('golden game — invariants that hold whatever the fixture says', () => {
  it('conserves all 84 cards at every turn', () => {
    // One shared deck is a board-game rule, not an implementation detail. A
    // leak shows up much later as a mysteriously short hand.
    for (const turn of actual.turns) {
      expect(turn.cardCount, `turn ${turn.turn}`).toBe(84);
    }
  });

  it('is deterministic — the same game twice is the same game', () => {
    expect(runGoldenGame()).toEqual(actual);
  });

  it('never mutates the state handed to it', () => {
    const state = createGame(goldenBoard(), GOLDEN_PLAYERS, GOLDEN_SEED);
    const before = JSON.stringify(state);
    const programs = Object.fromEntries(
      state.robots.map((r) => [r.player, programFor(state, r.player)]),
    );
    executeTurn(state, programs, GOLDEN_SEED + state.turn);
    expect(JSON.stringify(state)).toBe(before);
  });
});

/**
 * Waypoints. Each names a rule and checks it against the game that actually
 * ran — these are what a human can verify against docs/game_mechanics_md.md,
 * and they are why a green golden means something beyond "unchanged".
 */
describe('golden game — rule waypoints', () => {
  const events = actual.turns.flatMap((t) => t.events.map((e) => ({ turn: t.turn, e })));
  const all = <T extends string>(type: T) => events.filter((x) => x.e.type === type);
  const CLOCKWISE: Direction[] = ['N', 'E', 'S', 'W'];

  it('pushes a robot: the shove is marked, and it moves exactly one cell', () => {
    const pushes = events.filter((x) => x.e.type === 'robot-moved' && x.e.pushed);
    expect(pushes.length).toBeGreaterThan(0);
    for (const { e } of pushes) {
      if (e.type !== 'robot-moved') continue;
      const dist = Math.abs(e.to.x - e.from.x) + Math.abs(e.to.y - e.from.y);
      // A push is one cell in one cardinal direction. Two would mean a shove
      // was applied twice; zero would mean it was emitted without moving.
      expect(dist, JSON.stringify(e)).toBe(1);
    }
  });

  it('fires a pusher, and shoves the robot standing on it in the pusher direction', () => {
    const pushers = all('pusher-fired');
    expect(pushers.length).toBeGreaterThan(0);
    for (const { turn, e } of pushers) {
      if (e.type !== 'pusher-fired') continue;
      const step = { N: [0, -1], E: [1, 0], S: [0, 1], W: [-1, 0] }[e.dir];
      const want = { x: e.at.x + step[0], y: e.at.y + step[1] };
      const moved = actual.turns
        .find((t) => t.turn === turn)!
        .events.some(
          (m) =>
            m.type === 'robot-moved' &&
            m.player === e.player &&
            m.from.x === e.at.x &&
            m.from.y === e.at.y &&
            m.to.x === want.x &&
            m.to.y === want.y,
        );
      // A pusher that fires without moving anyone is the exact bug the PA
      // animation would have made *look* correct.
      expect(moved, `pusher at ${JSON.stringify(e.at)} dir ${e.dir} on turn ${turn}`).toBe(true);
    }
  });

  it('turns a robot the way the gear says: cw is one step clockwise', () => {
    const gears = all('gear-rotated');
    expect(gears.length).toBeGreaterThan(0);
    for (const { e } of gears) {
      if (e.type !== 'gear-rotated') continue;
      const from = CLOCKWISE.indexOf(e.from);
      const want = CLOCKWISE[(from + (e.cw ? 1 : 3)) % 4];
      // Backwards here would spin every robot against the arrows painted on
      // the tile — visibly wrong, and silently wrong in the state.
      expect(e.to, JSON.stringify(e)).toBe(want);
    }
  });

  it('carries a robot one cell per belt pulse, express or not', () => {
    const belts = all('conveyor-moved');
    expect(belts.length).toBeGreaterThan(0);
    expect(belts.some((x) => x.e.type === 'conveyor-moved' && x.e.express)).toBe(true);
    for (const { e } of belts) {
      if (e.type !== 'conveyor-moved') continue;
      const dist = Math.abs(e.to.x - e.from.x) + Math.abs(e.to.y - e.from.y);
      // An express belt moves twice by pulsing twice, not by emitting one
      // double-length move — the replay animates per pulse.
      expect(dist, JSON.stringify(e)).toBe(1);
    }
  });

  it('claims a checkpoint and credits it to the robot in the same turn', () => {
    const claims = all('checkpoint-claimed');
    expect(claims.length).toBeGreaterThan(0);
    for (const { turn, e } of claims) {
      if (e.type !== 'checkpoint-claimed') continue;
      const after = actual.turns.find((t) => t.turn === turn)!.robots.find(
        (r) => r.player === e.player,
      )!;
      // An event without the state change behind it would show a player a
      // checkpoint they did not get — the wrong-outcome class exactly.
      expect(after.checkpoints, `${e.player} on turn ${turn}`).toBeGreaterThanOrEqual(
        e.checkpoint,
      );
    }
  });

  it('costs a life every time a robot falls, and respawns it or eliminates it', () => {
    const falls = all('robot-fell');
    expect(falls.length).toBeGreaterThan(0);
    for (const { turn, e } of falls) {
      if (e.type !== 'robot-fell') continue;
      const inTurn = actual.turns.find((t) => t.turn === turn)!.events;
      expect(
        inTurn.some((x) => x.type === 'life-lost' && x.player === e.player),
        `fall by ${e.player} on turn ${turn} cost no life`,
      ).toBe(true);
      // A robot that falls and neither comes back nor leaves the game would be
      // stuck off-board forever.
      expect(
        inTurn.some(
          (x) =>
            (x.type === 'robot-respawned' || x.type === 'player-eliminated') &&
            x.player === e.player,
        ),
        `fall by ${e.player} on turn ${turn} neither respawned nor eliminated`,
      ).toBe(true);
    }
  });

  it('keeps locked registers equal to damage over 4, and releases them on repair', () => {
    // The rule: the 5th point of damage locks register 5, the 6th locks 4, and
    // so on; repair unlocks in reverse. So at any settled point the count of
    // locked registers is exactly max(0, damage - 4).
    //
    // NOTE the earlier version of this waypoint asserted "damage >= 5 whenever
    // a register-locked event fires" and FAILED — not because the engine was
    // wrong but because end-of-turn repair on a wrench can drop the damage back
    // below 5 before the snapshot is taken, so the assertion was reading the
    // wrong instant. The rule below holds at the instant actually recorded.
    expect(all('register-locked').length).toBeGreaterThan(0);
    for (const turn of actual.turns) {
      for (const r of turn.robots) {
        if (r.destroyed || r.eliminated) continue;
        expect(r.lockedCount, `${r.player} on turn ${turn.turn} (damage ${r.damage})`).toBe(
          Math.max(0, r.damage - 4),
        );
      }
    }
  });

  it('ends the game the moment one robot is left standing', () => {
    const won = all('game-won');
    expect(won).toHaveLength(1);
    const { e } = won[0];
    if (e.type !== 'game-won') throw new Error('unreachable');
    expect(e.reason).toBe('last-standing');
    const survivors = actual.final.robots.filter((r) => !r.eliminated);
    expect(survivors.map((r) => r.player)).toEqual([e.player]);
  });
});
