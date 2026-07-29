// The switches in eventPresentation are exhaustive, so typecheck already
// forces an entry for every event. What it cannot check is that the entries
// SAY the right thing — these pin the Phase 30 repair pair and the Phase 31
// conveyor bend.

import { describe, expect, it } from 'vitest';
import type { EngineEvent } from '../../../engine';
import { caption, eventDuration } from '../eventPresentation';

describe('repair presentation', () => {
  const repair: EngineEvent = { type: 'repair', player: 'ada', amount: 1, total: 4 };
  const unlocked: EngineEvent = {
    type: 'register-unlocked',
    player: 'ada',
    register: 5,
    card: null,
  };

  it('holds the screen like its mirror event', () => {
    expect(eventDuration(repair)).toBe(
      eventDuration({ type: 'damage', player: 'ada', amount: 1, total: 4 }),
    );
    expect(eventDuration(unlocked)).toBe(
      eventDuration({ type: 'register-locked', player: 'ada', register: 5, card: null }),
    );
  });

  it('captions the repair with the running damage total', () => {
    expect(caption(repair)).toBe('ada repairs 1 damage (4/10)');
    expect(caption(unlocked)).toBe("ada's register 5 unlocks!");
  });
});

describe('conveyor bend presentation', () => {
  const bend: EngineEvent = { type: 'conveyor-rotated', player: 'ada', cw: true, from: 'E', to: 'S' };

  it('holds the screen like the other rotations', () => {
    expect(eventDuration(bend)).toBe(
      eventDuration({ type: 'gear-rotated', player: 'ada', cw: true, from: 'E', to: 'S' }),
    );
    expect(eventDuration(bend)).toBe(380);
  });

  it('captions the swing', () => {
    expect(caption(bend)).toBe('The bend swings ada around');
  });
});
