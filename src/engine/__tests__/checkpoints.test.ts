import { describe, expect, it } from 'vitest';
import { emptyBoard, setTile } from '../board';
import { card, eventsOf, makeState, prog, robot, robotOf, run } from './helpers';

const twoCheckpointBoard = () => {
  const b = emptyBoard('cp', 10, 10);
  setTile(b, 5, 4, { kind: 'checkpoint', n: 1 });
  setTile(b, 5, 2, { kind: 'checkpoint', n: 2 });
  return b;
};

describe('checkpoints', () => {
  it('claims checkpoints in numerical order across registers', () => {
    const s = makeState(twoCheckpointBoard(), [robot('a', 5, 5, 'N')]);
    const r = run(s, { a: prog(card('move1', 500), card('move2', 700)) });
    expect(eventsOf(r.events, 'checkpoint-claimed')).toMatchObject([
      { player: 'a', checkpoint: 1 },
      { player: 'a', checkpoint: 2 },
    ]);
    // claiming the last checkpoint wins immediately
    expect(r.state.winner).toBe('a');
    expect(eventsOf(r.events, 'game-won')).toMatchObject([{ player: 'a', reason: 'checkpoints' }]);
    // nothing but turn-ended after the win
    expect(r.events[r.events.length - 1].type).toBe('turn-ended');
    expect(r.events[r.events.length - 2].type).toBe('game-won');
  });

  it('does not claim checkpoints out of order, but still updates the archive', () => {
    const s = makeState(twoCheckpointBoard(), [robot('a', 5, 3, 'N')]);
    const r = run(s, { a: prog(card('move1', 500)) }); // ends on checkpoint 2 first
    expect(eventsOf(r.events, 'checkpoint-claimed')).toHaveLength(0);
    expect(robotOf(r, 'a').checkpoints).toBe(0);
    expect(robotOf(r, 'a').archive).toEqual({ x: 5, y: 2 });
    expect(r.state.winner).toBeNull();
  });

  it('passing over a checkpoint mid-move does not claim it', () => {
    const s = makeState(twoCheckpointBoard(), [robot('a', 5, 5, 'N')]);
    const r = run(s, { a: prog(card('move2', 700)) }); // crosses (5,4), ends (5,3)
    expect(eventsOf(r.events, 'checkpoint-claimed')).toHaveLength(0);
    expect(robotOf(r, 'a').checkpoints).toBe(0);
  });
});
