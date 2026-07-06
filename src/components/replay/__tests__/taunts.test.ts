import { describe, expect, it } from 'vitest';
import { emptyBoard } from '../../../engine';
import { card, makeState, robot, run } from '../../../engine/__tests__/helpers';
import { tauntWindows, visibleTaunts } from '../taunts';

describe('taunt speech bubbles', () => {
  const state = makeState(emptyBoard('taunt', 8, 8), [
    robot('alice', 2, 3, 'E'),
    robot('bob', 4, 5, 'N'),
  ]);
  const result = run(state, {
    alice: [card('move1', 800)],
    bob: [card('turnRight', 100)],
  });

  it('opens each window at that player\'s first card reveal', () => {
    const windows = tauntWindows(result.events);
    const aliceReveal = result.events.findIndex(
      (e) => e.type === 'card-revealed' && e.player === 'alice',
    );
    const bobReveal = result.events.findIndex(
      (e) => e.type === 'card-revealed' && e.player === 'bob',
    );
    expect(aliceReveal).toBeGreaterThan(-1);
    expect(bobReveal).toBeGreaterThan(-1);
    expect(windows.alice.from).toBe(aliceReveal + 1);
    expect(windows.bob.from).toBe(bobReveal + 1);
    expect(windows.alice.to).toBeLessThanOrEqual(result.events.length);
  });

  it('shows a bubble only inside its window and only for taunting players', () => {
    const windows = tauntWindows(result.events);
    const taunts = { alice: 'eat my dust' };

    expect(visibleTaunts(taunts, windows, 0)).toEqual([]);
    expect(visibleTaunts(taunts, windows, windows.alice.from)).toEqual([
      { player: 'alice', text: 'eat my dust' },
    ]);
    expect(visibleTaunts(taunts, windows, windows.alice.to + 1)).toEqual([]);
    // bob never taunted, so his window produces nothing.
    expect(visibleTaunts(taunts, windows, windows.bob.from).some((b) => b.player === 'bob')).toBe(
      false,
    );
  });

  it('ignores taunts from players with no reveal in the log', () => {
    const windows = tauntWindows(result.events);
    expect(visibleTaunts({ ghost: 'boo' }, windows, 1)).toEqual([]);
  });
});
