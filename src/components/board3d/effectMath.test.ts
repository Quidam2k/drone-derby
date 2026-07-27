import { describe, expect, it } from 'vitest';
import {
  BEAM_OVERSHOOT,
  clamp01,
  DIR_STEP,
  ease,
  edgeFall,
  edgeFallDir,
  flashCurve,
  pitFall,
  projectToViewport,
  ROBOT_MUZZLE,
  robotMuzzle,
  segment,
  vecToDir,
} from './effectMath';

describe('clamp01', () => {
  it('clamps both ends and passes the middle through', () => {
    expect(clamp01(-1)).toBe(0);
    expect(clamp01(0)).toBe(0);
    expect(clamp01(0.37)).toBe(0.37);
    expect(clamp01(1)).toBe(1);
    expect(clamp01(9)).toBe(1);
  });

  it('falls back to 0 on junk, so a NaN dt cannot poison a transform', () => {
    expect(clamp01(NaN)).toBe(0);
    expect(clamp01(Infinity)).toBe(0);
  });
});

describe('ease', () => {
  it('spans exactly 0 to 1', () => {
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    expect(ease(-3)).toBe(0);
    expect(ease(3)).toBe(1);
  });

  it('eases OUT — more than half the distance is covered in the first half', () => {
    expect(ease(0.5)).toBeGreaterThan(0.5);
    expect(ease(0.25)).toBeGreaterThan(0.25);
  });

  it('is monotonic', () => {
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = ease(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('flashCurve', () => {
  it('starts dark, ends dark, and peaks at full brightness early', () => {
    expect(flashCurve(0)).toBe(0);
    expect(flashCurve(1)).toBe(0);
    expect(flashCurve(0.12)).toBeCloseTo(1, 10);
  });

  it('rises to the peak then decays, never leaving [0, 1]', () => {
    let peakAt = 0;
    let peak = -1;
    for (let t = 0; t <= 1.0001; t += 0.01) {
      const v = flashCurve(t);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
      if (v > peak) {
        peak = v;
        peakAt = t;
      }
    }
    expect(peak).toBeCloseTo(1, 6);
    expect(peakAt).toBeLessThan(0.2);
  });

  it('decays monotonically after the peak', () => {
    let prev = 2;
    for (let t = 0.2; t <= 1.0001; t += 0.05) {
      const v = flashCurve(t);
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
    }
  });
});

describe('vecToDir', () => {
  it('names the dominant axis, with +Z south', () => {
    expect(vecToDir(0, -1)).toBe('N');
    expect(vecToDir(1, 0)).toBe('E');
    expect(vecToDir(0, 1)).toBe('S');
    expect(vecToDir(-1, 0)).toBe('W');
    expect(vecToDir(-2, 0.5)).toBe('W');
    expect(vecToDir(0.2, 3)).toBe('S');
  });

  it('is null for no movement at all', () => {
    expect(vecToDir(0, 0)).toBeNull();
    expect(vecToDir(1e-9, -1e-9)).toBeNull();
  });

  it('round-trips every DIR_STEP', () => {
    for (const [dir, step] of Object.entries(DIR_STEP)) {
      expect(vecToDir(step.x, step.z)).toBe(dir);
    }
  });
});

describe('pitFall', () => {
  it('starts on the deck at full opacity and ends below it, invisible', () => {
    const start = pitFall(0);
    expect(start.y).toBeCloseTo(0, 12);
    expect(start.opacity).toBe(1);
    expect(start.out).toBe(0);
    const end = pitFall(1);
    expect(end.y).toBeLessThan(-1);
    expect(end.opacity).toBe(0);
  });

  it('drops straight down — a pit is a shaft, not a launch', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) expect(pitFall(t).out).toBe(0);
  });

  it('never rises, and tumbles as it goes', () => {
    let prevY = 1;
    let prevSpin = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const p = pitFall(t);
      expect(p.y).toBeLessThanOrEqual(prevY);
      expect(p.spin).toBeGreaterThanOrEqual(prevSpin);
      prevY = p.y;
      prevSpin = p.spin;
    }
    expect(pitFall(1).tilt).toBeGreaterThan(1);
  });

  it('is already below the deck before the fade starts, so it fades in the hole', () => {
    expect(pitFall(0.42).y).toBeLessThan(-0.3);
    expect(pitFall(0.42).opacity).toBe(1);
  });

  it('clamps past its life rather than continuing to Australia', () => {
    expect(pitFall(4)).toEqual(pitFall(1));
  });
});

describe('edgeFall', () => {
  it('starts on the rim and ends well below the board', () => {
    expect(edgeFall(0).y).toBe(0);
    expect(edgeFall(0).out).toBe(0);
    expect(edgeFall(0).opacity).toBe(1);
    expect(edgeFall(1).y).toBeLessThan(-2);
    expect(edgeFall(1).opacity).toBe(0);
  });

  it('is thrown clear of the rim — a full tile out at least', () => {
    expect(edgeFall(1).out).toBeGreaterThan(1);
    let prev = -1;
    for (let t = 0; t <= 1.0001; t += 0.05) {
      const v = edgeFall(t).out;
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('rises first and only then falls, which is what tells it from a pit', () => {
    expect(edgeFall(0.1)).toMatchObject({ y: expect.any(Number) });
    expect(edgeFall(0.16).y).toBeGreaterThan(0);
    expect(edgeFall(0.5).y).toBeLessThan(0);
    // Monotonic descent from the apex onward.
    let prev = Infinity;
    for (let t = 0.2; t <= 1.0001; t += 0.05) {
      const v = edgeFall(t).y;
      expect(v).toBeLessThan(prev);
      prev = v;
    }
  });

  it('goes further out than a pit ever does', () => {
    expect(edgeFall(0.5).out).toBeGreaterThan(pitFall(0.5).out);
  });
});

describe('edgeFallDir', () => {
  const W = 12;
  const H = 17;

  it('names the single edge an edge cell touches', () => {
    expect(edgeFallDir({ x: 5, y: 0 }, W, H)).toBe('N');
    expect(edgeFallDir({ x: 11, y: 8 }, W, H)).toBe('E');
    expect(edgeFallDir({ x: 5, y: 16 }, W, H)).toBe('S');
    expect(edgeFallDir({ x: 0, y: 8 }, W, H)).toBe('W');
  });

  it('ignores hints when only one edge can be left', () => {
    // A robot backing north off the south edge still goes south.
    expect(edgeFallDir({ x: 5, y: 16 }, W, H, 'N', 'N')).toBe('S');
  });

  it('breaks a corner tie with the first hint that actually leaves the board', () => {
    // Top-left corner touches both N and W.
    expect(edgeFallDir({ x: 0, y: 0 }, W, H, 'W')).toBe('W');
    expect(edgeFallDir({ x: 0, y: 0 }, W, H, 'N')).toBe('N');
    // Bottom-right corner.
    expect(edgeFallDir({ x: 11, y: 16 }, W, H, 'S')).toBe('S');
    expect(edgeFallDir({ x: 11, y: 16 }, W, H, 'E')).toBe('E');
  });

  it('takes the hints in order — facing first, travel as the fallback', () => {
    // Facing north off a corner wins over having last travelled west.
    expect(edgeFallDir({ x: 0, y: 0 }, W, H, 'N', 'W')).toBe('N');
    // A facing that does not leave the board falls through to travel.
    expect(edgeFallDir({ x: 0, y: 0 }, W, H, 'E', 'W')).toBe('W');
    expect(edgeFallDir({ x: 0, y: 0 }, W, H, null, 'W')).toBe('W');
  });

  it('ignores hints that do not leave the board at all', () => {
    // Pushed east into a corner it can only leave to the north or west.
    expect(['N', 'W']).toContain(edgeFallDir({ x: 0, y: 0 }, W, H, 'E', 'S'));
  });

  it('still answers with no hints at all', () => {
    expect(['N', 'W']).toContain(edgeFallDir({ x: 0, y: 0 }, W, H, null, undefined));
    expect(['N', 'W']).toContain(edgeFallDir({ x: 0, y: 0 }, W, H));
  });

  it('handles a one-cell-wide board, where the hint is the only signal', () => {
    expect(edgeFallDir({ x: 0, y: 4 }, 1, 10, 'E')).toBe('E');
    expect(edgeFallDir({ x: 0, y: 4 }, 1, 10, 'W')).toBe('W');
  });

  it('falls back to a hint for an interior cell rather than throwing', () => {
    expect(edgeFallDir({ x: 5, y: 5 }, W, H, 'N')).toBe('N');
    expect(edgeFallDir({ x: 5, y: 5 }, W, H, null, 'E')).toBe('E');
    expect(edgeFallDir({ x: 5, y: 5 }, W, H)).toBe('S');
  });
});

describe('robotMuzzle', () => {
  it('sits ahead of the chassis centre, on the facing', () => {
    const m = robotMuzzle({ x: 4.5, z: 6.5 }, 'N');
    expect(m.x).toBeCloseTo(4.5, 12);
    expect(m.z).toBeCloseTo(6.5 - ROBOT_MUZZLE.along, 12);
    expect(m.y).toBe(ROBOT_MUZZLE.height);
    expect(robotMuzzle({ x: 4.5, z: 6.5 }, 'E').x).toBeCloseTo(4.5 + ROBOT_MUZZLE.along, 12);
    expect(robotMuzzle({ x: 4.5, z: 6.5 }, 'W').x).toBeCloseTo(4.5 - ROBOT_MUZZLE.along, 12);
    expect(robotMuzzle({ x: 4.5, z: 6.5 }, 'S').z).toBeCloseTo(6.5 + ROBOT_MUZZLE.along, 12);
  });

  it('stays inside its own tile, so the barrel never pokes through a wall', () => {
    for (const dir of ['N', 'E', 'S', 'W'] as const) {
      const m = robotMuzzle({ x: 0.5, z: 0.5 }, dir);
      expect(Math.abs(m.x - 0.5)).toBeLessThan(0.5);
      expect(Math.abs(m.z - 0.5)).toBeLessThan(0.5);
    }
  });
});

describe('segment', () => {
  it('gives the midpoint, the length and a unit direction', () => {
    const s = segment({ x: 1, y: 0, z: 0 }, { x: 5, y: 0, z: 0 });
    expect(s.mid).toEqual({ x: 3, y: 0, z: 0 });
    expect(s.length).toBe(4);
    expect(s.dir).toEqual({ x: 1, y: 0, z: 0 });
  });

  it('slopes, which is the whole reason it is 3D — lens height vs turret height', () => {
    const s = segment({ x: 0, y: 0.16, z: 0 }, { x: 0, y: 0.3, z: 3 });
    expect(s.mid.y).toBeCloseTo(0.23, 12);
    expect(s.length).toBeCloseTo(Math.hypot(0.14, 3), 12);
    expect(Math.hypot(s.dir.x, s.dir.y, s.dir.z)).toBeCloseTo(1, 12);
    expect(s.dir.y).toBeGreaterThan(0);
  });

  it('reports a unit direction whatever the axis', () => {
    for (const to of [
      { x: -4, y: 0, z: 0 },
      { x: 0, y: 0, z: -7 },
      { x: 2, y: 1, z: -3 },
    ]) {
      const s = segment({ x: 0, y: 0, z: 0 }, to);
      expect(Math.hypot(s.dir.x, s.dir.y, s.dir.z)).toBeCloseTo(1, 12);
    }
  });

  it('degrades to +X on a zero-length beam instead of producing NaNs', () => {
    const s = segment({ x: 2, y: 1, z: 3 }, { x: 2, y: 1, z: 3 });
    expect(s.length).toBe(0);
    expect(s.dir).toEqual({ x: 1, y: 0, z: 0 });
  });

  it('overshoots by half a tile for a beam that hit nothing', () => {
    // The end of a 3-cell westward beam that hit nothing.
    const s = segment({ x: 5.5, y: 0.3, z: 2.5 }, { x: 2.5 - BEAM_OVERSHOOT, y: 0.3, z: 2.5 });
    expect(s.length).toBeCloseTo(3.5, 12);
    expect(s.dir.x).toBe(-1);
  });
});

describe('projectToViewport', () => {
  const W = 800;
  const H = 600;

  it('maps NDC centre to the middle of the canvas, and flips Y', () => {
    const p = projectToViewport({ x: 0, y: 0, z: 0 }, W, H);
    expect(p).toEqual({ x: 400, y: 300, visible: true });
    // NDC +Y is up; CSS +Y is down.
    expect(projectToViewport({ x: 0, y: 0.5, z: 0 }, W, H).y).toBeLessThan(300);
    expect(projectToViewport({ x: 0.5, y: 0, z: 0 }, W, H).x).toBeGreaterThan(400);
  });

  it('keeps a point at the very rim a margin inside the canvas', () => {
    const m = { x: 96, y: 30 };
    const left = projectToViewport({ x: -1, y: 0, z: 0 }, W, H, m);
    expect(left).toMatchObject({ x: 96, visible: true });
    const right = projectToViewport({ x: 1, y: 0, z: 0 }, W, H, m);
    expect(right).toMatchObject({ x: W - 96, visible: true });
    const bottom = projectToViewport({ x: 0, y: -1, z: 0 }, W, H, m);
    expect(bottom).toMatchObject({ y: H - 30, visible: true });
    const top = projectToViewport({ x: 0, y: 1, z: 0 }, W, H, m);
    expect(top).toMatchObject({ y: 30, visible: true });
  });

  it('culls anything behind the eye rather than clamping it to the wrong edge', () => {
    // Behind the camera the perspective divide flips x/y and pushes z past 1.
    expect(projectToViewport({ x: 0.4, y: 0.2, z: 1.4 }, W, H).visible).toBe(false);
    expect(projectToViewport({ x: 0, y: 0, z: 1 }, W, H).visible).toBe(true);
  });

  it('culls a robot that is off-frame at all — a bubble belongs to a robot you can see', () => {
    expect(projectToViewport({ x: 1.01, y: 0, z: 0 }, W, H).visible).toBe(false);
    expect(projectToViewport({ x: -1.01, y: 0, z: 0 }, W, H).visible).toBe(false);
    expect(projectToViewport({ x: 0, y: 1.01, z: 0 }, W, H).visible).toBe(false);
    expect(projectToViewport({ x: 0, y: -9, z: 0 }, W, H).visible).toBe(false);
    // Exactly on the rim still counts as in shot.
    expect(projectToViewport({ x: 1, y: 1, z: 0 }, W, H).visible).toBe(true);
  });

  it('survives junk coordinates', () => {
    expect(projectToViewport({ x: NaN, y: 0, z: 0 }, W, H).visible).toBe(false);
    expect(projectToViewport({ x: 0, y: Infinity, z: 0 }, W, H).visible).toBe(false);
  });

  it('does not invert the clamp on a canvas smaller than the margin', () => {
    const p = projectToViewport({ x: -1, y: -1, z: 0 }, 20, 10, { x: 40, y: 40 });
    expect(p.x).toBe(10);
    expect(p.y).toBe(5);
    expect(p.visible).toBe(true);
  });
});
