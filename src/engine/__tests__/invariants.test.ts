// Property test: play many random-but-legal games and assert the engine's
// structural invariants after every turn. This is the tripwire for changes to
// register locking, repair, power-down, and anything else that moves cards
// between hands, decks, and locked registers.
//
// Deterministic by construction — the only randomness is a seeded mulberry32,
// so a failure reproduces exactly from the reported seed.

import { describe, expect, it } from 'vitest';
import { createGame } from '../setup';
import { executeTurn, isGameOver } from '../execute';
import { provingGrounds, spinCycle } from '../boards';
import { handSize, isRegisterLocked } from '../deck';
import { createRng, shuffle, type Rng } from '../rng';
import { tileAt } from '../board';
import type { BoardDef, GameState, PlayerId, Program } from '../types';

/** A legal program: distinct cards from the hand in the unlocked registers. */
function randomProgram(state: GameState, player: PlayerId, rng: Rng): Program {
  const robot = state.robots.find((r) => r.player === player);
  if (!robot) throw new Error(`no robot for ${player}`);
  const pool = shuffle(state.hands[player], rng);
  const program: Program = [];
  for (let register = 1; register <= 5; register++) {
    if (isRegisterLocked(robot.damage, register)) {
      program.push(null);
      continue;
    }
    // Occasionally leave a slot idle: null registers are legal and exercise a
    // different path through actingOrder/cleanUpCards than a full program.
    program.push(rng() < 0.1 ? null : (pool.shift() ?? null));
  }
  return program;
}

function randomPrograms(state: GameState, rng: Rng): Record<PlayerId, Program> {
  const programs: Record<PlayerId, Program> = {};
  for (const robot of state.robots) {
    if (!robot.eliminated) programs[robot.player] = randomProgram(state, robot.player, rng);
  }
  return programs;
}

/**
 * Every invariant that must hold of a state the engine just produced.
 *
 * A `final` state (game won, or everyone scrapped) skips the between-turns
 * checks: no hand was dealt, robots are not respawned, and the loser may still
 * be lying destroyed where it fell. Card conservation still holds — that is
 * the whole point of running cleanUpCards even on a mid-register win.
 */
function checkInvariants(state: GameState, where: string, final = false): void {
  const occupied = new Map<string, PlayerId>();

  // Cards are conserved globally: the one shared 84-card deck is always fully
  // accounted for across draw pile, discard pile, every hand, and every
  // locked register — and no card id appears in two places at once.
  const ids = [
    ...state.deck.drawPile.map((c) => c.id),
    ...state.deck.discardPile.map((c) => c.id),
    ...Object.values(state.hands).flat().map((c) => c.id),
    ...state.robots.flatMap((r) =>
      r.lockedRegisters.filter((c) => c !== null).map((c) => c!.id),
    ),
  ];
  expect(ids.length, `${where}: card conservation (shared deck)`).toBe(84);
  expect(new Set(ids).size, `${where}: no duplicate card ids`).toBe(84);

  if (final) return; // between-turns checks below don't apply to a won game

  for (const robot of state.robots) {
    if (robot.eliminated) continue;
    const who = `${where} / ${robot.player}`;
    const inHand = state.hands[robot.player].length;

    // Hand size tracks damage, and locked registers hold exactly the cards
    // the damage level says are locked.
    expect(inHand, `${who}: hand size for damage ${robot.damage}`).toBe(handSize(robot.damage));
    for (let register = 1; register <= 5; register++) {
      if (!isRegisterLocked(robot.damage, register)) {
        expect(
          robot.lockedRegisters[register - 1],
          `${who}: register ${register} unlocked at damage ${robot.damage} must hold no card`,
        ).toBeNull();
      }
    }

    // Damage stays in range; a robot at 10 damage should have been destroyed.
    expect(robot.damage, `${who}: damage in range`).toBeGreaterThanOrEqual(0);
    expect(robot.damage, `${who}: damage in range`).toBeLessThan(10);
    expect(robot.lives, `${who}: lives in range`).toBeGreaterThan(0);

    // Robots resting between turns are on the board, not sharing a cell, and
    // never sitting in a pit (falling in kills, and respawn avoids pits).
    expect(robot.destroyed, `${who}: nobody rests destroyed`).toBe(false);
    const cell = `${robot.pos.x},${robot.pos.y}`;
    expect(occupied.has(cell), `${who}: shares ${cell} with ${occupied.get(cell)}`).toBe(false);
    occupied.set(cell, robot.player);
    expect(robot.pos.x, `${who}: on board`).toBeGreaterThanOrEqual(0);
    expect(robot.pos.x, `${who}: on board`).toBeLessThan(state.board.width);
    expect(robot.pos.y, `${who}: on board`).toBeGreaterThanOrEqual(0);
    expect(robot.pos.y, `${who}: on board`).toBeLessThan(state.board.height);
    expect(tileAt(state.board, robot.pos).kind, `${who}: not resting in a pit`).not.toBe('pit');
  }
}

function fuzz(board: BoardDef, players: PlayerId[], games: number, turns: number): void {
  for (let game = 0; game < games; game++) {
    const rng = createRng(0xd20de + game);
    let state = createGame(board, players, 1000 + game);
    checkInvariants(state, `game ${game} / setup`);

    for (let turn = 0; turn < turns; turn++) {
      if (isGameOver(state)) break;
      const before = structuredClone(state);
      const result = executeTurn(state, randomPrograms(state, rng), 5000 + game * 100 + turn);
      expect(state, `game ${game} turn ${turn}: input state mutated`).toEqual(before);
      state = result.state;
      checkInvariants(state, `game ${game} turn ${turn}`, isGameOver(state));
    }
  }
}

describe('engine invariants (fuzz)', () => {
  it('holds across 120 random 3-player games on Proving Grounds', () => {
    fuzz(provingGrounds(), ['alice', 'bob', 'carol'], 120, 40);
  });

  it('holds across 60 random 4-player games on Spin Cycle', () => {
    fuzz(spinCycle(), ['alice', 'bob', 'carol', 'dave'], 60, 40);
  });

  it('holds for a solo game (no pushing, no rival lasers)', () => {
    fuzz(provingGrounds(), ['alice'], 40, 40);
  });
});
