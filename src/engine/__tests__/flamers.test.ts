// Phase 36: flamer jets (expansion rule). Active on their printed
// registers. Burns: 1 per active-flamer square a robot moves onto or
// through during card movement (walked or chain-pushed), 1 for executing a
// rotate card on one, and 1 more at the laser segment for ending the
// register phase on one. Belt and pusher movement is Board Elements — no
// move-through burn (printed timing).

import { describe, expect, it } from 'vitest';
import { composeBoards } from '../compose';
import { emptyBoard, setTile } from '../board';
import { validateBoard } from '../validate';
import { card, eventsOf, makeState, robot, robotOf, run } from './helpers';

function flamerBurns(result: ReturnType<typeof run>, player: string): number {
  return eventsOf(result.events, 'damage').filter(
    (e) => e.source === 'flamer' && e.player === player,
  ).length;
}

describe('flamers', () => {
  it('moving through an active flamer burns 1; ending the phase elsewhere adds nothing', () => {
    const board = emptyBoard('t', 6, 6);
    board.flamers = [{ pos: { x: 3, y: 2 }, registers: [1] }];
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [card('move2', 700)],
    });

    expect(flamerBurns(result, 'a')).toBe(1);
    expect(robotOf(result, 'a').pos).toEqual({ x: 4, y: 2 });
  });

  it('ending the register phase on an active flamer burns again: move-on + end-phase = 2', () => {
    const board = emptyBoard('t', 6, 6);
    board.flamers = [{ pos: { x: 3, y: 2 }, registers: [1] }];
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [card('move1', 500)],
    });

    expect(flamerBurns(result, 'a')).toBe(2);
  });

  it('an inactive flamer burns nothing', () => {
    const board = emptyBoard('t', 6, 6);
    board.flamers = [{ pos: { x: 3, y: 2 }, registers: [3] }];
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [card('move2', 700)],
    });

    expect(flamerBurns(result, 'a')).toBe(0);
  });

  it('executing a rotate card on an active flamer burns 1', () => {
    const board = emptyBoard('t', 6, 6);
    board.flamers = [{ pos: { x: 2, y: 2 }, registers: [1] }];
    const result = run(makeState(board, [robot('a', 2, 2)]), {
      a: [card('turnLeft', 100)],
    });

    // Rotate burn + end-of-phase burn.
    expect(flamerBurns(result, 'a')).toBe(2);
  });

  it('idling on an active flamer burns only the end-of-phase point', () => {
    const board = emptyBoard('t', 6, 6);
    board.flamers = [{ pos: { x: 2, y: 2 }, registers: [1] }];
    const result = run(makeState(board, [robot('a', 2, 2)]));

    const perRegister = eventsOf(result.events, 'damage').filter((e) => e.source === 'flamer');
    expect(perRegister).toHaveLength(1); // active register 1 only
  });

  it('a chain-pushed robot crossing an active flamer burns too', () => {
    const board = emptyBoard('t', 6, 6);
    board.flamers = [{ pos: { x: 3, y: 2 }, registers: [1] }];
    const result = run(makeState(board, [robot('a', 1, 2, 'E'), robot('b', 2, 2)]), {
      a: [card('move2', 700)],
    });

    // Step 1 shoves b onto the flamer (1 burn); step 2 shoves b off while a
    // walks onto it (1 burn), and a then ends the phase there (1 more).
    expect(flamerBurns(result, 'b')).toBe(1);
    expect(flamerBurns(result, 'a')).toBe(2);
    expect(robotOf(result, 'a').pos).toEqual({ x: 3, y: 2 });
  });

  it('a belt delivering a robot onto an active flamer causes no move-through burn — only end-of-phase', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 2, 2, { kind: 'conveyor', dir: 'E', express: false });
    board.flamers = [{ pos: { x: 3, y: 2 }, registers: [1] }];
    const result = run(makeState(board, [robot('a', 2, 2)]));

    expect(flamerBurns(result, 'a')).toBe(1);
  });

  it('validation and composition treat flamers like the other scheduled fixtures', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 0, 0, { kind: 'spawn', n: 1 });
    setTile(board, 1, 0, { kind: 'spawn', n: 2 });
    setTile(board, 5, 5, { kind: 'checkpoint', n: 1 });
    board.flamers = [{ pos: { x: 3, y: 3 }, registers: [7] }];
    expect(validateBoard(board).errors.some((e) => e.includes('flamer'))).toBe(true);

    const top = emptyBoard('top', 6, 6);
    setTile(top, 5, 5, { kind: 'checkpoint', n: 1 });
    top.flamers = [{ pos: { x: 1, y: 2 }, registers: [1, 2, 4] }];
    const dock = emptyBoard('dock', 6, 2);
    setTile(dock, 1, 1, { kind: 'spawn', n: 1 });
    setTile(dock, 4, 1, { kind: 'spawn', n: 2 });
    const composed = composeBoards([top, dock], 'combo');
    expect(composed.flamers).toEqual([{ pos: { x: 1, y: 2 }, registers: [1, 2, 4] }]);
  });
});
