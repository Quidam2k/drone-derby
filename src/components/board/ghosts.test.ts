import { describe, expect, it } from 'vitest';
import type { GhostPose } from '../../engine';
import { ghostMarks } from './ghosts';

const pose = (register: number, x: number, y: number, facing: GhostPose['facing'], alive = true): GhostPose => ({
  register,
  pos: { x, y },
  facing,
  alive,
});

describe('ghostMarks', () => {
  it('one mark per register on distinct squares', () => {
    const marks = ghostMarks([pose(1, 3, 5, 'N'), pose(2, 3, 3, 'N')]);
    expect(marks.map((m) => m.label)).toEqual(['1', '2']);
  });

  it('registers ending on the same square share one badge, latest facing wins', () => {
    const marks = ghostMarks([pose(1, 3, 5, 'N'), pose(2, 3, 5, 'E'), pose(3, 3, 5, 'S')]);
    expect(marks).toEqual([{ pos: { x: 3, y: 5 }, facing: 'S', label: '1·2·3', alive: true }]);
  });

  it('the death square stays its own mark even where a live ghost stood', () => {
    const marks = ghostMarks([pose(1, 3, 3, 'N'), pose(2, 3, 3, 'N', false)]);
    expect(marks.map((m) => [m.label, m.alive])).toEqual([
      ['1', true],
      ['2', false],
    ]);
  });
});
