import { describe, expect, it } from 'vitest';
import { emptyBoard } from '../board';
import { card, eventsOf, makeState, prog, robot, robotOf, run } from './helpers';

describe('priority ordering', () => {
  it('the higher-priority card moves first', () => {
    const b = emptyBoard('prio', 10, 10);
    // face-off: whoever moves second pushes the other back
    const s = makeState(b, [robot('a', 2, 5, 'E'), robot('b', 4, 5, 'W')]);
    const r = run(s, {
      a: prog(card('move1', 500)),
      b: prog(card('move1', 600)),
    });
    // b (600) moves first into (3,5); a (500) then pushes b back to (4,5)
    expect(robotOf(r, 'a').pos).toEqual({ x: 3, y: 5 });
    expect(robotOf(r, 'b').pos).toEqual({ x: 4, y: 5 });
    const revealed = eventsOf(r.events, 'card-revealed');
    expect(revealed.map((e) => e.player)).toEqual(['b', 'a']);
  });

  it('breaks priority ties by seat order from startPlayerIndex', () => {
    const b = emptyBoard('prio', 10, 10);
    const s = makeState(b, [robot('a', 2, 5, 'N'), robot('b', 6, 5, 'N')]);
    const r = run(s, {
      a: prog(card('move1', 500)),
      b: prog(card('move1', 500)),
    });
    expect(eventsOf(r.events, 'robot-moved').map((e) => e.player)).toEqual(['a', 'b']);
  });

  it('rotates the tie-break as startPlayerIndex advances', () => {
    const b = emptyBoard('prio', 10, 10);
    const s = makeState(b, [robot('a', 2, 5, 'N'), robot('b', 6, 5, 'N')]);
    s.startPlayerIndex = 1;
    const r = run(s, {
      a: prog(card('move1', 500)),
      b: prog(card('move1', 500)),
    });
    expect(eventsOf(r.events, 'robot-moved').map((e) => e.player)).toEqual(['b', 'a']);
    // and it advances for the next turn
    expect(r.state.startPlayerIndex).toBe(0);
  });
});
