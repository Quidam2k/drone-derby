import { describe, expect, it } from 'vitest';

import {
  FLAME_PEAK,
  FLAME_REST,
  FLAME_SECONDS,
  KEY_REST,
  NUDGES,
  flameScale,
  mixHex,
  nudgeCurve,
  nudgeLight,
  startNudge,
  stepNudge,
  type NudgeKind,
} from './lightMath';

const KINDS = Object.keys(NUDGES) as NudgeKind[];

describe('nudgeCurve', () => {
  it('is exactly zero at both ends and past them', () => {
    // The loop-sleep guarantee. Math.sin(Math.PI) is 1.2e-16, not 0, so this
    // has to come from a branch — see the module header.
    expect(nudgeCurve(0, 0.5)).toBe(0);
    expect(nudgeCurve(0.5, 0.5)).toBe(0);
    expect(nudgeCurve(0.7, 0.5)).toBe(0);
    expect(nudgeCurve(-1, 0.5)).toBe(0);
  });

  it('rises to exactly 1 at the midpoint and never leaves [0, 1]', () => {
    expect(nudgeCurve(0.25, 0.5)).toBeCloseTo(1, 12);
    for (let t = 0; t <= 0.5; t += 0.001) {
      const k = nudgeCurve(t, 0.5);
      expect(k).toBeGreaterThanOrEqual(0);
      expect(k).toBeLessThanOrEqual(1);
    }
  });

  it('is symmetric about the midpoint — it comes back the way it went', () => {
    for (let t = 0; t <= 0.25; t += 0.01) {
      expect(nudgeCurve(t, 0.5)).toBeCloseTo(nudgeCurve(0.5 - t, 0.5), 12);
    }
  });

  it('degrades to no nudge rather than a NaN intensity', () => {
    expect(nudgeCurve(Number.NaN, 0.5)).toBe(0);
    expect(nudgeCurve(0.2, 0)).toBe(0);
    expect(nudgeCurve(0.2, -1)).toBe(0);
    expect(nudgeCurve(0.2, Number.NaN)).toBe(0);
  });
});

describe('mixHex', () => {
  it('returns each end bit-exactly', () => {
    expect(mixHex(0xfff2dc, 0xff5a4a, 0)).toBe(0xfff2dc);
    expect(mixHex(0xfff2dc, 0xff5a4a, -1)).toBe(0xfff2dc);
    expect(mixHex(0xfff2dc, 0xff5a4a, 1)).toBe(0xff5a4a);
    expect(mixHex(0xfff2dc, 0xff5a4a, 2)).toBe(0xff5a4a);
  });

  it('blends per channel', () => {
    expect(mixHex(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mixHex(0xff0000, 0x0000ff, 0.5)).toBe(0x800080);
  });

  it('stays inside 24 bits for every blend', () => {
    for (let k = 0; k <= 1; k += 0.01) {
      const c = mixHex(0xffffff, 0x000000, k);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(0xffffff);
    }
  });

  it('degrades to the start colour', () => {
    expect(mixHex(0xfff2dc, 0xff5a4a, Number.NaN)).toBe(0xfff2dc);
  });
});

describe('nudgeLight', () => {
  it('is the resting key with no nudge at all', () => {
    expect(nudgeLight(null)).toEqual({
      intensity: KEY_REST.intensity,
      color: KEY_REST.color,
    });
  });

  it.each(KINDS)('%s lands EXACTLY back on the resting key when it expires', (kind) => {
    // This IS the loop-sleep guarantee, per kind. Phase 47 proved this class of
    // bug is invisible in the browser: every builtin board has belts, so the
    // scene never settles there and a light stuck a hair off rest is unseeable.
    const n = startNudge(kind);
    n.t = NUDGES[kind].life;
    expect(nudgeLight(n)).toEqual({ intensity: KEY_REST.intensity, color: KEY_REST.color });
    n.t = NUDGES[kind].life * 4;
    expect(nudgeLight(n)).toEqual({ intensity: KEY_REST.intensity, color: KEY_REST.color });
  });

  it.each(KINDS)('%s starts on the resting key too, so nothing pops in', (kind) => {
    expect(nudgeLight(startNudge(kind))).toEqual({
      intensity: KEY_REST.intensity,
      color: KEY_REST.color,
    });
  });

  it('dips on damage and destruction, lifts on a laser and a win', () => {
    for (const kind of ['damage', 'destroyed'] as const) {
      const n = startNudge(kind);
      n.t = NUDGES[kind].life / 2;
      expect(nudgeLight(n).intensity).toBeLessThan(KEY_REST.intensity);
    }
    for (const kind of ['laser', 'win'] as const) {
      const n = startNudge(kind);
      n.t = NUDGES[kind].life / 2;
      expect(nudgeLight(n).intensity).toBeGreaterThan(KEY_REST.intensity);
    }
  });

  it('destruction is the planned 20% dim at its deepest', () => {
    const n = startNudge('destroyed');
    n.t = NUDGES.destroyed.life / 2;
    expect(nudgeLight(n).intensity).toBeCloseTo(KEY_REST.intensity * 0.8, 10);
  });

  it('tints red on damage only, and never all the way to red', () => {
    const n = startNudge('damage');
    n.t = NUDGES.damage.life / 2;
    const { color } = nudgeLight(n);
    expect(color).not.toBe(KEY_REST.color);
    expect(color).not.toBe(NUDGES.damage.tint);
    // Green and blue drop toward the red tint; red is already at 0xff on both.
    expect((color >> 8) & 0xff).toBeLessThan((KEY_REST.color >> 8) & 0xff);
    expect(color & 0xff).toBeLessThan(KEY_REST.color & 0xff);
  });

  it.each(KINDS)('%s never asks three.js for a negative intensity', (kind) => {
    const n = startNudge(kind);
    for (let t = 0; t <= NUDGES[kind].life; t += 0.005) {
      n.t = t;
      expect(nudgeLight(n).intensity).toBeGreaterThanOrEqual(0);
    }
  });

  it('the win nudge still peaks where the pre-48 flourish did', () => {
    // scene.ts used to hard-code KEY_INTENSITY 2.4 -> KEY_PEAK 3.7 over 0.8s.
    const n = startNudge('win');
    n.t = NUDGES.win.life / 2;
    expect(nudgeLight(n).intensity).toBeCloseTo(3.7, 10);
    expect(NUDGES.win.life).toBe(0.8);
  });

  it('the laser pulse is exactly the beam punch, so the two read as one flash', () => {
    expect(NUDGES.laser.life).toBe(0.14);
  });
});

describe('stepNudge', () => {
  it.each(KINDS)('%s reports dead within its life, at scene.ts’s clamped dt', (kind) => {
    const n = startNudge(kind);
    let live = true;
    let frames = 0;
    // MAX_DT in scene.ts. A backgrounded tab advances in 0.05 steps, and this
    // is the step size that has to reach the end.
    while (live && frames < 1000) {
      live = stepNudge(n, 0.05);
      frames++;
    }
    expect(live).toBe(false);
    expect(frames).toBeLessThanOrEqual(Math.ceil(NUDGES[kind].life / 0.05) + 1);
    expect(nudgeLight(n)).toEqual({ intensity: KEY_REST.intensity, color: KEY_REST.color });
  });

  it('is live for at least one frame at 60fps, so a nudge is never invisible', () => {
    for (const kind of KINDS) expect(stepNudge(startNudge(kind), 1 / 60)).toBe(true);
  });

  it('a NaN dt freezes the nudge rather than killing the clock', () => {
    const n = startNudge('win');
    stepNudge(n, Number.NaN);
    expect(n.t).toBe(0);
  });
});

describe('flameScale', () => {
  it('is EXACTLY the modelled rest scale outside a burst', () => {
    // Same guarantee as the nudges: the flame instance is written back into the
    // board's InstancedMesh, so "nearly 1" is a flamer left permanently a few
    // percent too big.
    expect(flameScale(0)).toBe(FLAME_REST);
    expect(flameScale(FLAME_SECONDS)).toBe(FLAME_REST);
    expect(flameScale(FLAME_SECONDS * 3)).toBe(FLAME_REST);
    expect(flameScale(-1)).toBe(FLAME_REST);
    expect(flameScale(Number.NaN)).toBe(FLAME_REST);
  });

  it('leaps almost at once — a burner has no wind-up', () => {
    expect(flameScale(FLAME_SECONDS * 0.12)).toBeCloseTo(FLAME_PEAK, 10);
    expect(flameScale(FLAME_SECONDS * 0.06)).toBeGreaterThan(FLAME_REST * 1.4);
  });

  it('decays monotonically after the peak and never overshoots', () => {
    let prev = FLAME_PEAK;
    for (let t = FLAME_SECONDS * 0.12; t < FLAME_SECONDS; t += 0.005) {
      const s = flameScale(t);
      expect(s).toBeLessThanOrEqual(prev + 1e-12);
      expect(s).toBeGreaterThanOrEqual(FLAME_REST);
      expect(s).toBeLessThanOrEqual(FLAME_PEAK);
      prev = s;
    }
  });
});
