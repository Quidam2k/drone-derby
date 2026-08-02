import { describe, expect, it } from 'vitest';

import { WHIP_DISTANCE } from './directorMath';
import {
  FOV_WIDEN_DEG,
  ORBIT_PEAK_RAD,
  ORBIT_SECONDS,
  fovWiden,
  orbitYaw,
} from './flourishMath';

describe('orbitYaw', () => {
  it('is EXACTLY zero at both ends and past them', () => {
    // The loop-sleep guarantee. Math.sin(Math.PI) is 1.2e-16, not 0, and this
    // offset is composed onto the player's yaw every frame — so an end that is
    // merely close leaves the camera permanently a hair rotated and the render
    // loop permanently awake. Neither is visible in the browser.
    expect(orbitYaw(0)).toBe(0);
    expect(orbitYaw(ORBIT_SECONDS)).toBe(0);
    expect(orbitYaw(ORBIT_SECONDS + 1)).toBe(0);
    expect(orbitYaw(ORBIT_SECONDS * 10)).toBe(0);
    expect(orbitYaw(-1)).toBe(0);
  });

  it('sweeps out to its peak at the midpoint', () => {
    expect(orbitYaw(ORBIT_SECONDS / 2)).toBeCloseTo(ORBIT_PEAK_RAD, 12);
  });

  it('comes back the way it went — symmetric about the midpoint', () => {
    for (let t = 0; t <= ORBIT_SECONDS / 2; t += 0.01) {
      expect(orbitYaw(t)).toBeCloseTo(orbitYaw(ORBIT_SECONDS - t), 12);
    }
  });

  it('stays WELL clear of a full revolution', () => {
    // The design constraint, asserted rather than trusted: past a quarter turn
    // the sweep starts showing the far rim and the backs of the tiles, and a
    // full one is a bug report rather than a victory lap.
    expect(ORBIT_PEAK_RAD).toBeLessThan(Math.PI / 4);
    for (let t = 0; t <= ORBIT_SECONDS; t += 0.005) {
      expect(Math.abs(orbitYaw(t))).toBeLessThanOrEqual(ORBIT_PEAK_RAD);
    }
  });

  it('only ever sweeps one way, so it reads as a move and not a wobble', () => {
    for (let t = 0; t <= ORBIT_SECONDS; t += 0.005) {
      expect(orbitYaw(t)).toBeGreaterThanOrEqual(0);
    }
  });

  it('degrades to no orbit rather than a NaN camera matrix', () => {
    expect(orbitYaw(Number.NaN)).toBe(0);
    expect(orbitYaw(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe('fovWiden', () => {
  it('is EXACTLY zero for a camera that is not re-aiming', () => {
    // Same guarantee, and the reason `step()` can skip updateProjectionMatrix()
    // on a settled camera: the widen has to be 0, not 1e-16, or every frame
    // rebuilds the projection for a lens that did not move.
    expect(fovWiden(0)).toBe(0);
    expect(fovWiden(-1)).toBe(0);
    expect(fovWiden(Number.NaN)).toBe(0);
    expect(fovWiden(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it('reaches its full widen at the whip threshold and never past it', () => {
    expect(fovWiden(WHIP_DISTANCE)).toBeCloseTo(FOV_WIDEN_DEG, 12);
    expect(fovWiden(WHIP_DISTANCE * 5)).toBeCloseTo(FOV_WIDEN_DEG, 12);
    expect(fovWiden(1e6)).toBeCloseTo(FOV_WIDEN_DEG, 12);
  });

  it('shares ONE definition of a whip with easeTau', () => {
    // Half the ramp is half the widen, on the same denominator the ease uses.
    expect(fovWiden(WHIP_DISTANCE / 2)).toBeCloseTo(FOV_WIDEN_DEG / 2, 12);
  });

  it('grows monotonically with travel', () => {
    let prev = -1;
    for (let d = 0; d <= WHIP_DISTANCE * 2; d += 0.1) {
      const w = fovWiden(d);
      expect(w).toBeGreaterThanOrEqual(prev);
      expect(w).toBeLessThanOrEqual(FOV_WIDEN_DEG);
      prev = w;
    }
  });

  it('is a nudge on a 20-degree lens, not a new lens', () => {
    // If this ever grows past a few degrees the board visibly changes size
    // mid-whip, which reads as a rendering fault rather than as speed.
    expect(FOV_WIDEN_DEG).toBeLessThan(4);
  });
});
