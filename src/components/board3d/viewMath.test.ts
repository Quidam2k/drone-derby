import { describe, expect, it } from 'vitest';
import {
  boardHalfExtents,
  cameraOffset,
  clampView,
  composeDistance,
  DEFAULT_VIEW,
  panOffset,
  TILT_MAX,
  TILT_MIN,
  wrapYaw,
  ZOOM_MAX,
  ZOOM_MIN,
} from './viewMath';

/** 3D-1's hardcoded camera, reproduced here so the guard is independent. */
const ELEVATION_3D1 = (52 * Math.PI) / 180;

describe('wrapYaw', () => {
  it('leaves in-range angles alone', () => {
    expect(wrapYaw(0)).toBe(0);
    expect(wrapYaw(-179)).toBe(-179);
    expect(wrapYaw(179)).toBe(179);
  });

  it('wraps past a half turn in both directions', () => {
    expect(wrapYaw(190)).toBeCloseTo(-170, 10);
    expect(wrapYaw(-190)).toBeCloseTo(170, 10);
    expect(wrapYaw(540)).toBeCloseTo(-180, 10);
  });

  it('wraps repeated turns, which is what a long drag produces', () => {
    expect(wrapYaw(45 + 360 * 7)).toBeCloseTo(45, 8);
    expect(wrapYaw(-45 - 360 * 7)).toBeCloseTo(-45, 8);
  });

  it('falls back to 0 on junk', () => {
    expect(wrapYaw(NaN)).toBe(0);
    expect(wrapYaw(Infinity)).toBe(0);
  });
});

describe('clampView', () => {
  it('passes a legal view straight through', () => {
    expect(clampView({ yaw: 40, tilt: 30, zoom: 1.5 })).toEqual({ yaw: 40, tilt: 30, zoom: 1.5 });
  });

  it('clamps tilt at both ends', () => {
    expect(clampView({ tilt: 0 }).tilt).toBe(TILT_MIN);
    expect(clampView({ tilt: 17.9 }).tilt).toBe(TILT_MIN);
    expect(clampView({ tilt: 90 }).tilt).toBe(TILT_MAX);
    expect(clampView({ tilt: 1000 }).tilt).toBe(TILT_MAX);
  });

  it('clamps zoom at both ends', () => {
    expect(clampView({ zoom: 0 }).zoom).toBe(ZOOM_MIN);
    expect(clampView({ zoom: 100 }).zoom).toBe(ZOOM_MAX);
  });

  it('wraps yaw rather than clamping it — orbiting is unbounded', () => {
    expect(clampView({ yaw: 400 }).yaw).toBeCloseTo(40, 8);
  });

  it('fills omitted fields with the default view', () => {
    expect(clampView({})).toEqual(DEFAULT_VIEW);
  });

  it('survives corrupt persisted settings', () => {
    const junk = { yaw: NaN, tilt: undefined, zoom: 'lots' } as unknown as { yaw: number };
    expect(clampView(junk)).toEqual(DEFAULT_VIEW);
  });
});

describe('composeDistance', () => {
  it('multiplies the directors distance rather than replacing it', () => {
    expect(composeDistance(10, 1)).toBe(10);
    expect(composeDistance(10, 2)).toBe(20);
    expect(composeDistance(10, 0.5)).toBe(5);
    // Two different director framings keep their ratio under the same zoom.
    expect(composeDistance(20, 0.5) / composeDistance(10, 0.5)).toBe(2);
  });

  it('clamps the multiplier and refuses junk distances', () => {
    expect(composeDistance(10, 99)).toBeCloseTo(10 * ZOOM_MAX, 10);
    expect(composeDistance(10, 0)).toBeCloseTo(10 * ZOOM_MIN, 10);
    expect(composeDistance(10, NaN)).toBe(10);
    expect(composeDistance(0, 1)).toBe(1);
  });
});

describe('cameraOffset', () => {
  it('reproduces 3D-1 exactly at the default view', () => {
    const d = 14.25;
    const o = cameraOffset(DEFAULT_VIEW.yaw, DEFAULT_VIEW.tilt, d);
    expect(o.x).toBeCloseTo(0, 12);
    expect(o.y).toBeCloseTo(Math.sin(ELEVATION_3D1) * d, 12);
    expect(o.z).toBeCloseTo(Math.cos(ELEVATION_3D1) * d, 12);
  });

  it('keeps the subject at `distance` whatever the angles', () => {
    for (const yaw of [-180, -90, 0, 37, 90, 179]) {
      for (const tilt of [TILT_MIN, 40, 52, TILT_MAX]) {
        const o = cameraOffset(yaw, tilt, 9);
        expect(Math.hypot(o.x, o.y, o.z)).toBeCloseTo(9, 10);
      }
    }
  });

  it('orbits east as yaw grows, and never dips below the board', () => {
    expect(cameraOffset(90, 52, 10).x).toBeGreaterThan(0);
    expect(cameraOffset(-90, 52, 10).x).toBeLessThan(0);
    expect(cameraOffset(180, 52, 10).z).toBeLessThan(0);
    for (const yaw of [-180, -45, 0, 45, 180]) {
      expect(cameraOffset(yaw, TILT_MIN, 10).y).toBeGreaterThan(0);
    }
  });

  it('approaches straight overhead at max tilt', () => {
    const o = cameraOffset(0, TILT_MAX, 10);
    expect(o.y).toBeGreaterThan(9.9);
    expect(Math.hypot(o.x, o.z)).toBeLessThan(1);
  });
});

describe('boardHalfExtents', () => {
  it('reproduces 3D-1s framing terms at the default view', () => {
    const { halfW, halfH } = boardHalfExtents(12, 17, DEFAULT_VIEW.yaw, DEFAULT_VIEW.tilt);
    expect(halfW).toBeCloseTo(12 / 2, 12);
    expect(halfH).toBeCloseTo((17 * Math.sin(ELEVATION_3D1)) / 2, 12);
  });

  it('swaps the axes at a quarter turn', () => {
    const { halfW, halfH } = boardHalfExtents(12, 17, 90, 52);
    expect(halfW).toBeCloseTo(17 / 2, 10);
    expect(halfH).toBeCloseTo((12 * Math.sin(ELEVATION_3D1)) / 2, 10);
  });

  it('needs more width on the diagonal than square on', () => {
    const square = boardHalfExtents(12, 17, 0, 52);
    const diagonal = boardHalfExtents(12, 17, 45, 52);
    expect(diagonal.halfW).toBeGreaterThan(square.halfW);
  });

  it('flattens toward zero height as the camera drops to the horizon', () => {
    const low = boardHalfExtents(12, 17, 0, TILT_MIN);
    const high = boardHalfExtents(12, 17, 0, TILT_MAX);
    expect(low.halfH).toBeLessThan(high.halfH);
    expect(high.halfH).toBeCloseTo((17 * Math.sin((TILT_MAX * Math.PI) / 180)) / 2, 10);
  });

  it('is symmetric under a half turn', () => {
    const a = boardHalfExtents(12, 17, 30, 52);
    const b = boardHalfExtents(12, 17, -150, 52);
    expect(a.halfW).toBeCloseTo(b.halfW, 10);
    expect(a.halfH).toBeCloseTo(b.halfH, 10);
  });
});

describe('panOffset', () => {
  it('moves the subject opposite the drag, so the board follows the finger', () => {
    const right = panOffset(0, 0.25, 0, 8);
    expect(right.x).toBeCloseTo(-2, 10);
    expect(right.z).toBeCloseTo(0, 10);
    const down = panOffset(0, 0, 0.25, 8);
    expect(down.x).toBeCloseTo(0, 10);
    expect(down.z).toBeCloseTo(-2, 10);
  });

  it('follows the orbited axes, not the world axes', () => {
    // Orbited a quarter turn east, a rightward drag slides the subject south.
    const right = panOffset(90, 0.25, 0, 8);
    expect(right.x).toBeCloseTo(0, 10);
    expect(right.z).toBeCloseTo(2, 10);
  });

  it('scales linearly with the drag and the world scale', () => {
    const a = panOffset(33, 0.1, -0.2, 5);
    const b = panOffset(33, 0.2, -0.4, 5);
    expect(b.x).toBeCloseTo(a.x * 2, 10);
    expect(b.z).toBeCloseTo(a.z * 2, 10);
    const far = panOffset(33, 0.1, -0.2, 10);
    expect(far.x).toBeCloseTo(a.x * 2, 10);
  });
});
