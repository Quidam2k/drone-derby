import { describe, expect, it } from 'vitest';
import { emptyBoard, setTile } from '../board';
import { isGameOver } from '../execute';
import { card, eventsOf, makeState, prog, robot, robotOf, run } from './helpers';

describe('pits, lives, respawn', () => {
  it('falling in a pit cancels remaining movement, costs a life, respawns at archive', () => {
    const b = emptyBoard('pits', 10, 10);
    setTile(b, 5, 3, { kind: 'pit' });
    const s = makeState(b, [robot('a', 5, 5, 'N')]);
    const r = run(s, { a: prog(card('move3', 800)) });
    // steps: (5,4), then (5,3) = pit → dead; third step never happens
    expect(eventsOf(r.events, 'robot-moved')).toHaveLength(2);
    expect(eventsOf(r.events, 'robot-fell')).toMatchObject([
      { player: 'a', cause: 'pit', at: { x: 5, y: 3 } },
    ]);
    const a = robotOf(r, 'a');
    expect(a.lives).toBe(2);
    expect(a.damage).toBe(2);
    expect(a.pos).toEqual({ x: 5, y: 5 });
    expect(eventsOf(r.events, 'robot-respawned')).toMatchObject([
      { player: 'a', pos: { x: 5, y: 5 }, facing: 'N' },
    ]);
  });

  it('a robot with one life left is eliminated permanently', () => {
    const b = emptyBoard('pits', 10, 10);
    setTile(b, 5, 4, { kind: 'pit' });
    const s = makeState(b, [robot('a', 5, 5, 'N', { lives: 1 })]);
    const r = run(s, { a: prog(card('move1', 500)) });
    expect(eventsOf(r.events, 'player-eliminated')).toMatchObject([{ player: 'a' }]);
    expect(eventsOf(r.events, 'robot-respawned')).toHaveLength(0);
    expect(robotOf(r, 'a').eliminated).toBe(true);
    // sole player eliminated → game over with no winner
    expect(r.state.winner).toBeNull();
    expect(isGameOver(r.state)).toBe(true);
  });

  it('last robot standing wins when the other player is eliminated', () => {
    const b = emptyBoard('pits', 10, 10);
    setTile(b, 5, 4, { kind: 'pit' });
    const s = makeState(b, [robot('a', 5, 5, 'N', { lives: 1 }), robot('b', 0, 0, 'N')]);
    const r = run(s, { a: prog(card('move1', 500)) });
    expect(r.state.winner).toBe('b');
    expect(eventsOf(r.events, 'game-won')).toMatchObject([
      { player: 'b', reason: 'last-standing' },
    ]);
  });

  it('respawns at the last-touched checkpoint, not the original spawn', () => {
    const b = emptyBoard('pits', 10, 10);
    setTile(b, 5, 4, { kind: 'checkpoint', n: 1 });
    setTile(b, 0, 0, { kind: 'checkpoint', n: 2 }); // so claiming 1 doesn't win
    setTile(b, 5, 2, { kind: 'pit' });
    const s = makeState(b, [robot('a', 5, 5, 'N')]);
    const r = run(s, {
      // reg 1: onto checkpoint 1 (archive moves there); reg 2: into the pit
      a: prog(card('move1', 500), card('move2', 700)),
    });
    expect(eventsOf(r.events, 'checkpoint-claimed')).toMatchObject([
      { player: 'a', checkpoint: 1 },
    ]);
    expect(robotOf(r, 'a').pos).toEqual({ x: 5, y: 4 });
    expect(robotOf(r, 'a').checkpoints).toBe(1); // claims survive death
  });

  it('respawn on an occupied archive picks the nearest free cell deterministically', () => {
    const b = emptyBoard('pits', 10, 10);
    setTile(b, 6, 5, { kind: 'pit' });
    const s = makeState(b, [robot('a', 5, 5, 'E'), robot('b', 4, 5, 'E')]);
    const r = run(s, {
      // a walks into the pit; b then walks onto a's archive cell (5,5)
      a: prog(card('move1', 600)),
      b: prog(null, card('move1', 500)),
    });
    expect(robotOf(r, 'b').pos).toEqual({ x: 5, y: 5 });
    // nearest free non-pit cell by Manhattan distance, scanning N row first
    expect(robotOf(r, 'a').pos).toEqual({ x: 5, y: 4 });
  });
});
