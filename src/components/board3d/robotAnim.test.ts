import { describe, expect, it } from 'vitest';

import {
  FULL_SPEED,
  gait,
  gaitPhase,
  hoverPose,
  motionEnvelope,
  thrustGlow,
  treadOffset,
  wheelSpin,
} from './robotAnim';

describe('treadOffset', () => {
  const SPACING = 0.067;

  it('is zero where the strip lines up with itself', () => {
    expect(treadOffset(0, SPACING)).toBe(0);
    expect(treadOffset(SPACING, SPACING)).toBeCloseTo(0, 12);
    expect(treadOffset(SPACING * 12, SPACING)).toBeCloseTo(0, 12);
  });

  it('scrolls proportionally inside one rib gap', () => {
    expect(treadOffset(SPACING / 4, SPACING)).toBeCloseTo(SPACING / 4, 12);
    expect(treadOffset(SPACING * 3.5, SPACING)).toBeCloseTo(SPACING / 2, 12);
  });

  it('scrolls BACKWARDS when the robot reverses — the whole point of a positive modulo', () => {
    // A plain `%` would give -SPACING/4 here, which is the same pose as
    // +3/4 of a gap in the other direction: the treads would visibly jump.
    expect(treadOffset(-SPACING / 4, SPACING)).toBeCloseTo(SPACING * 0.75, 12);
    expect(treadOffset(-SPACING, SPACING)).toBeCloseTo(0, 12);
  });

  it('never leaves the gap, so the strip can never walk off the pod', () => {
    for (let d = -5; d <= 5; d += 0.013) {
      const off = treadOffset(d, SPACING);
      expect(off).toBeGreaterThanOrEqual(0);
      expect(off).toBeLessThan(SPACING);
    }
  });

  it('degrades to a static tread rather than a NaN transform', () => {
    expect(treadOffset(Number.NaN, SPACING)).toBe(0);
    expect(treadOffset(1, 0)).toBe(0);
    expect(treadOffset(1, -1)).toBe(0);
  });
});

describe('gait', () => {
  const STRIDE = 0.085;
  const LIFT = 0.07;

  it('starts planted and fully forward', () => {
    const g = gait(0, STRIDE, LIFT);
    expect(g.forward).toBeCloseTo(STRIDE, 12);
    expect(g.lift).toBe(0);
  });

  it('keeps the grounded half on the deck and lifts only the swinging half', () => {
    for (let p = 0; p < Math.PI; p += 0.05) expect(gait(p, STRIDE, LIFT).lift).toBe(0);
    for (let p = Math.PI + 0.05; p < Math.PI * 2 - 0.05; p += 0.05) {
      expect(gait(p, STRIDE, LIFT).lift).toBeGreaterThan(0);
    }
    // Highest at the middle of the swing, and back down before it lands.
    expect(gait(Math.PI * 1.5, STRIDE, LIFT).lift).toBeCloseTo(LIFT, 12);
    expect(gait(Math.PI * 2, STRIDE, LIFT).lift).toBeCloseTo(0, 12);
  });

  it('the two tripods are exact opposites, so three feet are always down', () => {
    for (let p = 0; p < Math.PI * 2; p += 0.1) {
      const a = gait(p, STRIDE, LIFT);
      const b = gait(p + Math.PI, STRIDE, LIFT);
      expect(a.forward).toBeCloseTo(-b.forward, 12);
      expect(Math.min(a.lift, b.lift)).toBe(0);
    }
  });

  it('does not slip: over its stance a foot slides back exactly as far as the body moves', () => {
    // The claim gaitPhase's constant exists to make true. Walk the body
    // forward through one whole stance half and check the foot came back the
    // same distance, in the body's frame.
    const start = gait(gaitPhase(0, STRIDE), STRIDE, LIFT).forward;
    const travelled = 2 * STRIDE; // pi of phase, by construction
    const end = gait(gaitPhase(travelled, STRIDE), STRIDE, LIFT).forward;
    expect(gaitPhase(travelled, STRIDE)).toBeCloseTo(Math.PI, 12);
    expect(end - start).toBeCloseTo(-travelled, 12);
  });

  it('reverses with the robot', () => {
    expect(gaitPhase(-1, STRIDE)).toBeCloseTo(-gaitPhase(1, STRIDE), 12);
  });

  it('degrades to the rest pose rather than a NaN transform', () => {
    expect(gait(Number.NaN, STRIDE, LIFT)).toEqual({ forward: 0, lift: 0 });
    expect(gaitPhase(Number.NaN, STRIDE)).toBe(0);
    expect(gaitPhase(1, 0)).toBe(0);
  });
});

describe('wheelSpin', () => {
  const R = 0.175;

  it('rolls without slip — a full turn covers the circumference', () => {
    expect(wheelSpin(2 * Math.PI * R, R)).toBeCloseTo(Math.PI * 2, 12);
    expect(wheelSpin(0, R)).toBe(0);
  });

  it('turns the other way in reverse', () => {
    expect(wheelSpin(-1, R)).toBeCloseTo(-wheelSpin(1, R), 12);
  });

  it('degrades to a static wheel', () => {
    expect(wheelSpin(1, 0)).toBe(0);
    expect(wheelSpin(Number.NaN, R)).toBe(0);
  });
});

describe('motionEnvelope', () => {
  it('is 0 at rest, 1 at full speed, and clamped past it', () => {
    expect(motionEnvelope(0)).toBe(0);
    expect(motionEnvelope(FULL_SPEED)).toBe(1);
    expect(motionEnvelope(FULL_SPEED * 4)).toBe(1);
    expect(motionEnvelope(-2)).toBe(0);
    expect(motionEnvelope(Number.NaN)).toBe(0);
  });
});

describe('hoverPose', () => {
  it('is dead level at rest, whatever the clock says', () => {
    // The render loop's sleep depends on this: a bob that never quite reached
    // zero would keep requesting frames for the life of the page.
    for (const t of [0, 0.37, 12.5, 1e4]) {
      expect(hoverPose(0, t)).toEqual({ bob: 0, pitch: 0 });
    }
  });

  it('bobs and squats under way', () => {
    const quarter = 1 / (1.7 * 4); // a quarter of the bob period
    expect(hoverPose(FULL_SPEED, quarter).bob).toBeGreaterThan(0);
    expect(hoverPose(FULL_SPEED, quarter * 3).bob).toBeLessThan(0);
    expect(hoverPose(FULL_SPEED, 0).pitch).toBeGreaterThan(0);
  });

  it('scales with speed, so it fades in and out with the ease', () => {
    const fast = hoverPose(FULL_SPEED, 0.1);
    const slow = hoverPose(FULL_SPEED / 3, 0.1);
    expect(Math.abs(slow.bob)).toBeLessThan(Math.abs(fast.bob));
    expect(slow.pitch).toBeCloseTo(fast.pitch / 3, 12);
  });

  it('stays small enough not to sink the chassis into the deck', () => {
    for (let t = 0; t < 3; t += 0.01) {
      expect(Math.abs(hoverPose(FULL_SPEED, t).bob)).toBeLessThanOrEqual(0.06);
    }
  });

  it('degrades to level rather than a NaN transform', () => {
    expect(hoverPose(FULL_SPEED, Number.NaN)).toEqual({ bob: 0, pitch: 0 });
  });
});

describe('thrustGlow', () => {
  it('returns the modelled resting intensity EXACTLY at rest', () => {
    // Not "close to": a settled robot has to look like its .glb, and this is
    // also the value setStill and the powered-down restore hand back.
    for (const t of [0, 0.4, 91.25]) expect(thrustGlow(0, t, 7)).toBe(7);
  });

  it('never dims below rest and never runs away', () => {
    for (let t = 0; t < 2; t += 0.005) {
      const g = thrustGlow(FULL_SPEED, t, 7);
      expect(g).toBeGreaterThanOrEqual(7);
      expect(g).toBeLessThanOrEqual(7 * 2);
    }
  });

  it('brightens with speed', () => {
    expect(thrustGlow(FULL_SPEED, 0, 7)).toBeGreaterThan(thrustGlow(FULL_SPEED / 4, 0, 7));
  });

  it('degrades to the resting intensity', () => {
    expect(thrustGlow(FULL_SPEED, Number.NaN, 7)).toBe(7);
  });
});
