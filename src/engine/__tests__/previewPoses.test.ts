import { describe, expect, it } from 'vitest';
import { emptyBoard, setTile } from '../board';
import { previewPoses } from '../preview';
import type { BoardDef, Card, GameState, Program, RobotState } from '../types';
import { card, makeState, prog, robot } from './helpers';

/** A solo-ish state with the program's cards in A's hand so validation passes. */
function setup(board: BoardDef, robots: RobotState[], program: Program): GameState {
  const state = makeState(board, robots);
  state.hands['A'] = program.filter((c): c is Card => c !== null);
  return state;
}

const board8 = () => emptyBoard('t', 8, 8);

describe('previewPoses', () => {
  it('moves: one alive pose per register, at the end square', () => {
    const program = prog(card('move1', 500), card('move2', 510));
    const state = setup(board8(), [robot('A', 3, 6, 'N')], program);
    expect(previewPoses(state, 'A', program)).toEqual([
      { register: 1, pos: { x: 3, y: 5 }, facing: 'N', alive: true },
      { register: 2, pos: { x: 3, y: 3 }, facing: 'N', alive: true },
    ]);
  });

  it('turns and U-turn change facing in place', () => {
    const program = prog(card('turnRight', 80), card('turnLeft', 70), card('uTurn', 50));
    const state = setup(board8(), [robot('A', 3, 3, 'N')], program);
    const poses = previewPoses(state, 'A', program);
    expect(poses.map((p) => p.facing)).toEqual(['E', 'N', 'S']);
    for (const p of poses) expect(p.pos).toEqual({ x: 3, y: 3 });
  });

  it('back-up moves one square behind, keeping facing', () => {
    const program = prog(card('backUp', 430));
    const state = setup(board8(), [robot('A', 3, 3, 'N')], program);
    expect(previewPoses(state, 'A', program)).toEqual([
      { register: 1, pos: { x: 3, y: 4 }, facing: 'N', alive: true },
    ]);
  });

  it('a wall stops the move short', () => {
    const board = board8();
    board.walls.push({ x: 2, y: 3, side: 'E' });
    const program = prog(card('move3', 520));
    const state = setup(board, [robot('A', 1, 3, 'E')], program);
    expect(previewPoses(state, 'A', program)[0].pos).toEqual({ x: 2, y: 3 });
  });

  it('a pit ends the ghost: dead pose on the pit, nothing after', () => {
    const board = board8();
    setTile(board, 3, 2, { kind: 'pit' });
    const program = prog(card('move1', 500), card('move2', 510), card('turnLeft', 70));
    const state = setup(board, [robot('A', 3, 4, 'N')], program);
    expect(previewPoses(state, 'A', program)).toEqual([
      { register: 1, pos: { x: 3, y: 3 }, facing: 'N', alive: true },
      { register: 2, pos: { x: 3, y: 2 }, facing: 'N', alive: false },
    ]);
  });

  it('driving off the board edge dies on the last in-bounds square', () => {
    const program = prog(card('move3', 520));
    const state = setup(board8(), [robot('A', 3, 1, 'N')], program);
    expect(previewPoses(state, 'A', program)).toEqual([
      { register: 1, pos: { x: 3, y: 0 }, facing: 'N', alive: false },
    ]);
  });

  it('empty registers get no ghost', () => {
    const program = prog(card('move1', 500), null, card('move1', 510));
    const state = setup(board8(), [robot('A', 3, 6, 'N')], program);
    const poses = previewPoses(state, 'A', program);
    expect(poses.map((p) => p.register)).toEqual([1, 3]);
    expect(poses[1].pos).toEqual({ x: 3, y: 4 });
  });

  it('locked registers get a ghost from their known card', () => {
    const locked = card('move1', 520);
    const program = prog(card('move1', 500));
    const state = setup(
      board8(),
      [robot('A', 3, 6, 'N', { damage: 5, lockedRegisters: [null, null, null, null, locked] })],
      program,
    );
    const poses = previewPoses(state, 'A', program);
    expect(poses.map((p) => p.register)).toEqual([1, 5]);
    expect(poses[1].pos).toEqual({ x: 3, y: 4 });
  });

  it('board elements are included: a belt carries the ghost', () => {
    const board = board8();
    setTile(board, 3, 3, { kind: 'conveyor', dir: 'E', express: false });
    const program = prog(card('move1', 500));
    const state = setup(board, [robot('A', 3, 4, 'N')], program);
    expect(previewPoses(state, 'A', program)[0].pos).toEqual({ x: 4, y: 3 });
  });

  it('nothing placed means no ghosts', () => {
    const state = setup(board8(), [robot('A', 3, 6, 'N')], prog());
    expect(previewPoses(state, 'A', prog())).toEqual([]);
  });

  it('rival robots are ignored — the ghost passes through, no push', () => {
    const program = prog(card('move1', 500));
    const state = setup(board8(), [robot('A', 3, 6, 'N'), robot('B', 3, 5, 'N')], program);
    expect(previewPoses(state, 'A', program)[0].pos).toEqual({ x: 3, y: 5 });
  });
});
