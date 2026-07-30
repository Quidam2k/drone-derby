// Phase 35: radioactive waste and radiation floors (Radioactive expansion).
// Both burn during the printed Resolve Laser Fire segment: waste burns a
// robot ending ANY register phase on it (1 damage per phase); a radiation
// floor burns a robot ending the TURN on it (register 5 only). The waste
// option-card draw is cut with the option deck, by design.

import { describe, expect, it } from 'vitest';
import { emptyBoard, setTile } from '../board';
import type { EngineEvent, EventLog } from '../events';
import { card, eventsOf, makeState, robot, robotOf, run } from './helpers';

function registersOf(events: EventLog, type: EngineEvent['type']): number[] {
  const out: number[] = [];
  let register = 0;
  for (const e of events) {
    if (e.type === 'register-started') register = e.register;
    else if (e.type === type) out.push(register);
  }
  return out;
}

describe('radioactive waste floors', () => {
  it('burns 1 damage every register phase the robot ends on it', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 2, 2, { kind: 'waste' });
    const result = run(makeState(board, [robot('a', 2, 2)]));

    const burns = eventsOf(result.events, 'damage').filter((e) => e.source === 'waste');
    expect(burns).toHaveLength(5);
    expect(registersOf(result.events, 'damage')).toEqual([1, 2, 3, 4, 5]);
    expect(robotOf(result, 'a').damage).toBe(5);
  });

  it('only phases ENDED on the waste count', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 2, 2, { kind: 'waste' });
    // Ends register 1 on the waste, walks off in register 2.
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [null, card('move1', 500)],
    });

    const burns = eventsOf(result.events, 'damage').filter((e) => e.source === 'waste');
    expect(burns).toHaveLength(1);
    expect(robotOf(result, 'a').damage).toBe(1);
  });

  it('burns after the lasers within the segment', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 2, 2, { kind: 'waste' });
    board.lasers = [{ pos: { x: 5, y: 5 }, facing: 'N', strength: 1 }];
    const result = run(makeState(board, [robot('a', 2, 2)]));

    const types = result.events.map((e) => e.type);
    expect(types.indexOf('damage')).toBeGreaterThan(types.indexOf('laser-fired'));
  });

  it('a robot at 9 damage dies to the burn', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 2, 2, { kind: 'waste' });
    const result = run(makeState(board, [robot('a', 2, 2, 'N', { damage: 9 })]));

    expect(eventsOf(result.events, 'robot-destroyed')[0]).toMatchObject({ player: 'a' });
  });

  it('burns a powered-down robot too', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 2, 2, { kind: 'waste' });
    const result = run(makeState(board, [robot('a', 2, 2, 'N', { poweredDown: true })]));

    // Power-down repair cleared nothing (0 damage), then 5 phases of burn.
    expect(robotOf(result, 'a').damage).toBe(5);
  });
});

describe('radiation floors', () => {
  it('burns only the robot that ends the TURN on it — register 5, source radiation', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 2, 2, { kind: 'radiation' });
    const result = run(makeState(board, [robot('a', 2, 2)]));

    const burns = eventsOf(result.events, 'damage').filter((e) => e.source === 'radiation');
    expect(burns).toHaveLength(1);
    expect(registersOf(result.events, 'damage')).toEqual([5]);
    expect(robotOf(result, 'a').damage).toBe(1);
  });

  it('leaving before register 5 avoids the burn', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 2, 2, { kind: 'radiation' });
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [null, null, null, card('move1', 500)],
    });

    expect(eventsOf(result.events, 'damage')).toHaveLength(0);
    expect(robotOf(result, 'a').damage).toBe(0);
  });

  it('arriving during register 5 still burns', () => {
    const board = emptyBoard('t', 6, 6);
    setTile(board, 3, 2, { kind: 'radiation' });
    const result = run(makeState(board, [robot('a', 2, 2, 'E')]), {
      a: [null, null, null, null, card('move1', 500)],
    });

    const burns = eventsOf(result.events, 'damage').filter((e) => e.source === 'radiation');
    expect(burns).toHaveLength(1);
  });
});
