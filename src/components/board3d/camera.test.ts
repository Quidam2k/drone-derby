// The promises CameraDirector's Phase 49 flourishes make that a screenshot
// cannot check.
//
//  1. THE SWEEP IS NOT THE PLAYER'S CAMERA. `winFlourish()` must leave
//     `currentView()` bit-identical and `cuts()` unchanged. If the orbit were
//     written into `view.yaw` it would fight the viewpoint ease and would leave
//     the player's persisted camera permanently rotated after a win — and the
//     board would look fine in every screenshot while it happened.
//  2. EVERYTHING SETTLES. `step()` has to report `false` again, with the yaw
//     offset at exactly 0 and the projection at exactly the resting FOV. This
//     is the on-demand render loop's sleep guarantee, and it is unobservable in
//     the app because every builtin board has conveyors and never settles.
//
// `three` runs fine in the node environment — a PerspectiveCamera is plain
// maths — so the director is driven directly rather than through a canvas.

import { describe, expect, it } from 'vitest';

import type { BoardDef } from '../../engine';
import { CameraDirector, cellShot } from './camera';
import { WHIP_DISTANCE } from './directorMath';
import { FOV_WIDEN_DEG, ORBIT_SECONDS } from './flourishMath';

const FRAME = 1 / 60;
/** The resting FOV, which camera.ts keeps private. */
const REST_FOV = 20;

function board(width = 12, height = 12): BoardDef {
  return {
    id: 'test',
    name: 'Test',
    width,
    height,
    tiles: [],
    walls: [],
    checkpoints: [],
    starts: [],
  } as unknown as BoardDef;
}

/** Run the director until it reports it has stopped, or give up. */
function settle(d: CameraDirector, maxFrames = 3000): number {
  let frames = 0;
  while (d.step(FRAME) && frames < maxFrames) frames++;
  return frames;
}

describe('winFlourish', () => {
  it('does not touch the player viewpoint or count as a re-aim', () => {
    const d = new CameraDirector(board(), 1.6);
    d.setView({ yaw: 37, tilt: 44, zoom: 1.3 });
    settle(d);

    const before = d.currentView();
    const cuts = d.cuts();
    const hardCuts = d.hardCuts();
    const shot = d.currentShot();

    d.winFlourish();
    // Mid-sweep is the interesting moment: the camera is visibly elsewhere and
    // the player's numbers must still be untouched.
    for (let t = 0; t < ORBIT_SECONDS / 2; t += FRAME) d.step(FRAME);

    expect(d.currentView()).toEqual(before);
    expect(d.cuts()).toBe(cuts);
    expect(d.hardCuts()).toBe(hardCuts);
    expect(d.currentShot()).toEqual(shot);
    expect(d.subject()).toEqual({ x: 6 - 0.5, y: 6 - 0.5 });
  });

  it('actually moves the camera, then puts it back EXACTLY', () => {
    const d = new CameraDirector(board(), 1.6);
    settle(d);
    const rest = d.camera.position.clone();

    d.winFlourish();
    d.step(ORBIT_SECONDS / 2);
    expect(d.flourishDegrees()).toBeGreaterThan(20);
    expect(d.camera.position.distanceTo(rest)).toBeGreaterThan(1);

    settle(d);
    expect(d.flourishDegrees()).toBe(0);
    expect(d.camera.position.x).toBe(rest.x);
    expect(d.camera.position.y).toBe(rest.y);
    expect(d.camera.position.z).toBe(rest.z);
  });

  it('holds the render loop open for the sweep and then lets it sleep', () => {
    const d = new CameraDirector(board(), 1.6);
    settle(d);
    expect(d.step(FRAME)).toBe(false);

    d.winFlourish();
    // Live for the whole orbit — a flourish that stopped reporting movement
    // would freeze halfway through, on whichever board happens to have no belts.
    for (let t = 0; t < ORBIT_SECONDS - FRAME; t += FRAME) {
      expect(d.step(FRAME)).toBe(true);
    }
    const frames = settle(d, 240);
    expect(frames).toBeLessThan(240);
    expect(d.step(FRAME)).toBe(false);
  });

  it('is refused under reduced motion — the camera never moves at all', () => {
    const d = new CameraDirector(board(), 1.6);
    d.setStill(true);
    settle(d);
    const rest = d.camera.position.clone();

    d.winFlourish();
    for (let t = 0; t < ORBIT_SECONDS; t += FRAME) {
      expect(d.flourishDegrees()).toBe(0);
      expect(d.step(FRAME)).toBe(false);
    }
    expect(d.camera.position).toEqual(rest);
  });

  it('is cancelled by turning reduced motion on mid-sweep', () => {
    const d = new CameraDirector(board(), 1.6);
    settle(d);
    d.winFlourish();
    d.step(ORBIT_SECONDS / 2);
    expect(d.flourishDegrees()).toBeGreaterThan(0);

    d.setStill(true);
    expect(d.flourishDegrees()).toBe(0);
    settle(d);
    expect(d.step(FRAME)).toBe(false);
  });

  it('is cancelled by a board change, not carried into the next board', () => {
    const d = new CameraDirector(board(), 1.6);
    settle(d);
    d.winFlourish();
    d.step(ORBIT_SECONDS / 3);

    d.setBoard(board(16, 16));
    expect(d.flourishDegrees()).toBe(0);
    settle(d);
    expect(d.step(FRAME)).toBe(false);
  });

  it('survives a NaN dt rather than staying live forever', () => {
    // A NaN accumulator would compare false against ORBIT_SECONDS for the rest
    // of the page's life: the loop would never sleep again.
    const d = new CameraDirector(board(), 1.6);
    settle(d);
    d.winFlourish();
    d.step(Number.NaN);
    expect(Number.isFinite(d.flourishDegrees())).toBe(true);
    expect(settle(d, 600)).toBeLessThan(600);
  });
});

describe('the FOV widen', () => {
  it('rests at exactly the resting FOV', () => {
    const d = new CameraDirector(board(), 1.6);
    settle(d);
    expect(d.camera.fov).toBe(REST_FOV);
  });

  it('opens on a cross-board whip and closes exactly as the shot lands', () => {
    const d = new CameraDirector(board(20, 20), 1.6);
    settle(d);
    expect(d.camera.fov).toBe(REST_FOV);

    // A re-aim from the middle of the board to its far corner: well past
    // WHIP_DISTANCE, so the widen starts at its maximum.
    d.focus(cellShot({ x: 19, y: 19 }));
    d.step(FRAME);
    expect(d.camera.fov).toBeGreaterThan(REST_FOV);
    expect(d.camera.fov).toBeLessThanOrEqual(REST_FOV + FOV_WIDEN_DEG + 1e-9);

    let peak = d.camera.fov;
    let prev = d.camera.fov;
    for (let i = 0; i < 600 && d.step(FRAME); i++) {
      // Monotonic decay: `travel` only shrinks as the ease closes, so the widen
      // must never re-open mid-flight and read as a lens breathing.
      expect(d.camera.fov).toBeLessThanOrEqual(prev + 1e-9);
      peak = Math.max(peak, d.camera.fov);
      prev = d.camera.fov;
    }
    expect(peak).toBeGreaterThan(REST_FOV + FOV_WIDEN_DEG / 2);
    expect(d.camera.fov).toBe(REST_FOV);
  });

  it('barely opens for a nudge — a two-tile move is not a whip', () => {
    const d = new CameraDirector(board(20, 20), 1.6);
    d.focus(cellShot({ x: 9, y: 9 }));
    settle(d);

    d.focus(cellShot({ x: 11, y: 9 }));
    d.step(FRAME);
    expect(d.camera.fov).toBeLessThan(REST_FOV + (FOV_WIDEN_DEG * 3) / WHIP_DISTANCE);
    settle(d);
    expect(d.camera.fov).toBe(REST_FOV);
  });

  it('does not widen under reduced motion', () => {
    const d = new CameraDirector(board(20, 20), 1.6);
    d.setStill(true);
    settle(d);
    // `focus()` coerces to the whole board while still, so nothing re-aims —
    // but assert the lens directly, since that is the promise.
    d.focus(cellShot({ x: 19, y: 19 }));
    for (let i = 0; i < 120; i++) {
      d.step(FRAME);
      expect(d.camera.fov).toBe(REST_FOV);
    }
  });

  it('leaves the resting framing alone — fit() solves from the resting FOV', () => {
    // The trap the phase plan called the risky half: if `fit()` used the LIVE
    // fov the camera would pull IN by exactly as much as the lens opened and
    // the effect would cancel. Same shot, once whipped into and once snapped
    // straight onto — the settled poses have to agree.
    const a = new CameraDirector(board(20, 20), 1.6);
    a.focus(cellShot({ x: 19, y: 19 }));
    settle(a);

    const b = new CameraDirector(board(20, 20), 1.6);
    b.cutTo(cellShot({ x: 19, y: 19 }));
    settle(b);

    expect(a.camera.position.x).toBeCloseTo(b.camera.position.x, 9);
    expect(a.camera.position.y).toBeCloseTo(b.camera.position.y, 9);
    expect(a.camera.position.z).toBeCloseTo(b.camera.position.z, 9);
  });

  it('does not move the pull-back AT ALL when only the subject changes', () => {
    // The assertion that actually pins the resting-vs-live split, and the one
    // an equality-at-rest check cannot make: a whip between two shots of the
    // SAME radius asks for the same pull-back at both ends, so the distance
    // must be flat across the whole flight. Feed `fit()` the live fov instead
    // and it wants less pull-back while the lens is open and more as it closes
    // — the camera dips in and drifts back out, cancelling the widen on screen
    // and leaving the settled pose looking perfectly correct.
    //
    // `target.y` is always 0, so the private pull-back is recoverable from the
    // camera's height and the (settled, constant) tilt.
    const d = new CameraDirector(board(20, 20), 1.6);
    d.focus(cellShot({ x: 2, y: 10 }));
    settle(d);
    const height = () => d.camera.position.y;
    const flat = height();

    d.focus(cellShot({ x: 17, y: 10 }));
    let widened = false;
    for (let i = 0; i < 600 && d.step(FRAME); i++) {
      widened = widened || d.camera.fov > REST_FOV;
      expect(height()).toBeCloseTo(flat, 9);
    }
    expect(widened).toBe(true);
    expect(height()).toBeCloseTo(flat, 9);
    expect(d.camera.fov).toBe(REST_FOV);
  });
});
