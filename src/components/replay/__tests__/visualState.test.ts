import { describe, expect, it } from 'vitest';
import type { GameState } from '../../../engine';
import {
  createGame,
  emptyBoard,
  executeTurn,
  isGameOver,
  provingGrounds,
  RESPAWN_DAMAGE,
  setTile,
  spinCycle,
  type TurnResult,
} from '../../../engine';
import { card, makeState, naiveProgram, robot, run } from '../../../engine/__tests__/helpers';
import { applyEvent, initialVisual, visualAt } from '../visualState';

/** Fold the whole EventLog from prevState and assert it lands exactly on the
 *  engine's output state. This is the contract the replay player relies on. */
function expectFoldMatchesEngine(prevState: GameState, result: TurnResult): void {
  const v = visualAt(initialVisual(prevState), result.events, result.events.length);
  for (const engineRobot of result.state.robots) {
    const visual = v.robots.find((r) => r.player === engineRobot.player)!;
    expect(visual, engineRobot.player).toBeDefined();
    expect(visual.pos, `${engineRobot.player} pos`).toEqual(engineRobot.pos);
    expect(visual.facing, `${engineRobot.player} facing`).toBe(engineRobot.facing);
    expect(visual.damage, `${engineRobot.player} damage`).toBe(engineRobot.damage);
    expect(visual.lives, `${engineRobot.player} lives`).toBe(engineRobot.lives);
    expect(visual.checkpoints, `${engineRobot.player} checkpoints`).toBe(engineRobot.checkpoints);
    expect(visual.visible, `${engineRobot.player} visible`).toBe(
      !engineRobot.destroyed && !engineRobot.eliminated,
    );
    expect(visual.eliminated, `${engineRobot.player} eliminated`).toBe(engineRobot.eliminated);
  }
  expect(v.winner).toBe(result.state.winner);
}

describe('visualState reducer', () => {
  it('does not mutate its input', () => {
    const state = makeState(emptyBoard('t', 5, 5), [robot('alice', 2, 2, 'E')]);
    const initial = initialVisual(state);
    const frozen = JSON.stringify(initial);
    applyEvent(initial, {
      type: 'robot-moved',
      player: 'alice',
      from: { x: 2, y: 2 },
      to: { x: 3, y: 2 },
      pushed: false,
    });
    expect(JSON.stringify(initial)).toBe(frozen);
  });

  it('tracks a scripted push turn step by step and lands on the engine state', () => {
    // alice (E) plays move2 and shoves bob one cell east; bob turns right.
    const state = makeState(emptyBoard('push', 8, 8), [
      robot('alice', 2, 3, 'E'),
      robot('bob', 4, 3, 'N'),
    ]);
    const result = run(state, {
      alice: [card('move2', 800)],
      bob: [card('turnRight', 100)],
    });

    const initial = initialVisual(state);

    // Walk the cursor forward; positions must match each move event as applied.
    let v = initial;
    for (let cursor = 1; cursor <= result.events.length; cursor++) {
      v = applyEvent(v, result.events[cursor - 1]);
      expect(v).toEqual(visualAt(initial, result.events, cursor)); // re-fold agrees
    }

    const midway = result.events.findIndex(
      (e) => e.type === 'robot-moved' && e.player === 'bob',
    );
    const atPush = visualAt(initial, result.events, midway + 1);
    expect(atPush.robots.find((r) => r.player === 'bob')!.pos).toEqual({ x: 5, y: 3 });
    expect(atPush.register).toBe(1);

    expectFoldMatchesEngine(state, result);
  });

  it('handles a pit fall, life loss, and respawn with damage reset', () => {
    const board = emptyBoard('pit', 8, 8);
    board.tiles[3][4] = { kind: 'pit' };
    const state = makeState(board, [robot('alice', 2, 3, 'E'), robot('bob', 6, 6, 'N')]);
    const result = run(state, { alice: [card('move2', 800)] });

    const initial = initialVisual(state);
    const fellAt = result.events.findIndex((e) => e.type === 'robot-fell');
    expect(fellAt).toBeGreaterThan(-1);
    const afterFall = visualAt(initial, result.events, fellAt + 1);
    expect(afterFall.robots.find((r) => r.player === 'alice')!.visible).toBe(false);

    const respawnAt = result.events.findIndex((e) => e.type === 'robot-respawned');
    expect(respawnAt).toBeGreaterThan(-1);
    const afterRespawn = visualAt(initial, result.events, respawnAt + 1);
    const alice = afterRespawn.robots.find((r) => r.player === 'alice')!;
    expect(alice.visible).toBe(true);
    expect(alice.damage).toBe(RESPAWN_DAMAGE);
    expect(alice.lives).toBe(2);

    expectFoldMatchesEngine(state, result);
  });

  it('folds a repair back into the damage counter', () => {
    const board = emptyBoard('wrench', 8, 8);
    board.tiles[3][4] = { kind: 'wrench' };
    const state = makeState(board, [robot('alice', 3, 3, 'E')]);
    state.robots[0].damage = 4;
    const result = run(state, { alice: [card('move1', 500)] }); // ends on the wrench

    const initial = initialVisual(state);
    const repairedAt = result.events.findIndex((e) => e.type === 'repair');
    expect(repairedAt).toBeGreaterThan(-1);
    const before = visualAt(initial, result.events, repairedAt);
    const after = visualAt(initial, result.events, repairedAt + 1);
    expect(before.robots.find((r) => r.player === 'alice')!.damage).toBe(4);
    expect(after.robots.find((r) => r.player === 'alice')!.damage).toBe(3);

    expectFoldMatchesEngine(state, result);
  });

  it('folds a conveyor-rotated into the facing', () => {
    const board = emptyBoard('bend', 8, 8);
    setTile(board, 3, 3, { kind: 'conveyor', dir: 'E', express: false });
    setTile(board, 4, 3, { kind: 'conveyor', dir: 'S', express: false, curve: 'cw' });
    const state = makeState(board, [robot('alice', 3, 3, 'E')]);
    const result = run(state); // idles; the belt carries her around the bend

    const initial = initialVisual(state);
    const bendAt = result.events.findIndex((e) => e.type === 'conveyor-rotated');
    expect(bendAt).toBeGreaterThan(-1);
    const before = visualAt(initial, result.events, bendAt);
    const after = visualAt(initial, result.events, bendAt + 1);
    expect(before.robots.find((r) => r.player === 'alice')!.facing).toBe('E');
    expect(after.robots.find((r) => r.player === 'alice')!.facing).toBe('S');

    expectFoldMatchesEngine(state, result);
  });

  it('stays in lockstep with the engine over a full game on Spin Cycle, crossing curves', () => {
    // Spin Cycle's ring corners are curved sections since Phase 31, so this
    // game exercises conveyor-rotated inside a real log, not just in a rig.
    let state = createGame(spinCycle(), ['alice', 'bob', 'carol'], 7);
    let bends = 0;
    for (let turn = 0; turn < 25 && !isGameOver(state); turn++) {
      const programs = Object.fromEntries(
        state.robots
          .filter((r) => !r.eliminated)
          .map((r) => [r.player, naiveProgram(state, r.player)]),
      );
      const result = executeTurn(state, programs, 7 + state.turn);
      bends += result.events.filter((e) => e.type === 'conveyor-rotated').length;
      expectFoldMatchesEngine(state, result);
      state = result.state;
    }
    expect(bends).toBeGreaterThan(0);
  });

  it('stays in lockstep with the engine over a full game on Proving Grounds', () => {
    let state = createGame(provingGrounds(), ['alice', 'bob', 'carol'], 42);
    for (let turn = 0; turn < 25 && !isGameOver(state); turn++) {
      const programs = Object.fromEntries(
        state.robots
          .filter((r) => !r.eliminated)
          .map((r) => [r.player, naiveProgram(state, r.player)]),
      );
      const result = executeTurn(state, programs, 42 + state.turn);
      expectFoldMatchesEngine(state, result);
      state = result.state;
    }
  });
});
