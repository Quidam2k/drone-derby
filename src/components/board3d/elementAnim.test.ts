import { describe, expect, it } from 'vitest';
import {
  BELT_SECONDS,
  BELT_SURGE,
  createElementAnimator,
  CRUSHER_SECONDS,
  crusherPress,
  GEAR_SECONDS,
  GEAR_TURN,
  PUSHER_SECONDS,
  pusherExtension,
} from './elementAnim';

/** Longest of the four, so "drive past this" drains everything. */
const LONGEST = Math.max(PUSHER_SECONDS, GEAR_SECONDS, CRUSHER_SECONDS, BELT_SECONDS);

/** Run at a steady 60fps for `seconds`, collecting every pose written. */
function run(
  anim: ReturnType<typeof createElementAnimator>,
  seconds: number,
): { poses: { kind: string; x: number; y: number; value: number }[]; live: boolean } {
  const dt = 1 / 60;
  const poses: { kind: string; x: number; y: number; value: number }[] = [];
  let live = false;
  for (let t = 0; t < seconds; t += dt) {
    const s = anim.step(dt);
    poses.push(...s.poses);
    live = s.live;
  }
  return { poses, live };
}

describe('elementAnim — the release invariant', () => {
  // This is the render-on-demand guard. scene.ts's loop re-arms on
  // `moving || belts()`, so an animation that never reports live:false holds
  // the loop awake forever — a battery and heat regression on a playtester's
  // phone that no instrument in this cascade would catch. If the release in
  // `step` were removed, every assertion in this block fails.
  it('goes quiet after the last animation settles', () => {
    const anim = createElementAnimator();
    anim.fire('pusher', 1, 1);
    anim.fire('gear', 2, 2, true);
    anim.fire('crusher', 3, 3);
    anim.fire('belt', 4, 4);
    expect(anim.live()).toBe(true);

    const { live } = run(anim, LONGEST + 0.2);
    expect(live).toBe(false);
    expect(anim.live()).toBe(false);
  });

  it('writes nothing at all once quiet — no idle cost', () => {
    const anim = createElementAnimator();
    anim.fire('pusher', 1, 1);
    run(anim, PUSHER_SECONDS + 0.2);

    const after = anim.step(1 / 60);
    expect(after.poses).toEqual([]);
    expect(after.live).toBe(false);
  });

  it('is quiet from construction — an untouched board never wakes', () => {
    const anim = createElementAnimator();
    expect(anim.live()).toBe(false);
    expect(anim.step(1 / 60)).toEqual({ poses: [], live: false });
  });

  it('still WRITES the settled pose on the releasing frame', () => {
    // The other half of the flame's rule: stopping is not enough, the last
    // write has to be the resting pose. A pusher that stops mid-throw is a
    // piston left permanently sticking out of its housing.
    const anim = createElementAnimator();
    anim.fire('pusher', 5, 6);
    const { poses } = run(anim, PUSHER_SECONDS + 0.2);
    const last = poses[poses.length - 1];
    expect(last).toEqual({ kind: 'pusher', x: 5, y: 6, value: 0 });
  });

  it('rests a crusher back at the top too', () => {
    const anim = createElementAnimator();
    anim.fire('crusher', 0, 0);
    const { poses } = run(anim, CRUSHER_SECONDS + 0.2);
    expect(poses[poses.length - 1].value).toBe(0);
  });
});

describe('elementAnim — cumulative elements settle rather than snap back', () => {
  it('lands a gear exactly a quarter turn on, clockwise being negative', () => {
    // Negative because DIR_YAW has N=0 and E=-PI/2, so a clockwise turn is a
    // decreasing yaw. Getting this backwards would spin every gear the wrong
    // way — against the arrows painted on the tile.
    const anim = createElementAnimator();
    anim.fire('gear', 1, 1, true);
    const { poses } = run(anim, GEAR_SECONDS + 0.2);
    expect(poses[poses.length - 1].value).toBeCloseTo(-GEAR_TURN, 10);

    anim.fire('gear', 2, 2, false);
    const ccw = run(anim, GEAR_SECONDS + 0.2);
    expect(ccw.poses[ccw.poses.length - 1].value).toBeCloseTo(GEAR_TURN, 10);
  });

  it('accumulates across turns instead of restarting from zero', () => {
    // A gear turning a second quarter must carry on from the first. Restarting
    // would snap the wheel back 90 degrees on the frame the second turn began.
    const anim = createElementAnimator();
    anim.fire('gear', 1, 1, true);
    run(anim, GEAR_SECONDS + 0.05);
    anim.fire('gear', 1, 1, true);
    const { poses } = run(anim, GEAR_SECONDS + 0.05);
    expect(poses[poses.length - 1].value).toBeCloseTo(-2 * GEAR_TURN, 10);
  });

  it('never winds a gear backwards mid-turn', () => {
    const anim = createElementAnimator();
    anim.fire('gear', 1, 1, true);
    const { poses } = run(anim, GEAR_SECONDS + 0.05);
    for (let i = 1; i < poses.length; i++) {
      expect(poses[i].value).toBeLessThanOrEqual(poses[i - 1].value + 1e-12);
    }
  });

  it('surges a belt forward and leaves it there', () => {
    const anim = createElementAnimator();
    anim.fire('belt', 3, 4);
    const { poses } = run(anim, BELT_SECONDS + 0.2);
    expect(poses[poses.length - 1].value).toBeCloseTo(BELT_SURGE, 10);
    // Monotonic: chevrons that stepped backwards would read as a stutter.
    for (let i = 1; i < poses.length; i++) {
      expect(poses[i].value).toBeGreaterThanOrEqual(poses[i - 1].value - 1e-12);
    }
  });

  it('keeps the surge under a whole tile so it reads as hurry, not teleport', () => {
    expect(BELT_SURGE).toBeLessThan(1);
  });
});

describe('elementAnim — pose curves', () => {
  it('throws the piston out fast and draws it back slowly', () => {
    expect(pusherExtension(0)).toBe(0);
    expect(pusherExtension(1)).toBe(0);
    // Fully out well before halfway, which is what makes it read as a shove
    // rather than as a breath.
    expect(pusherExtension(0.34)).toBeCloseTo(1, 6);
    expect(pusherExtension(0.2)).toBeGreaterThan(pusherExtension(0.7));
  });

  it('presses the crusher down, holds it, then lifts', () => {
    expect(crusherPress(0)).toBe(0);
    expect(crusherPress(1)).toBe(0);
    expect(crusherPress(0.45)).toBe(1);
    expect(crusherPress(0.5)).toBe(1);
  });

  it('clamps outside its window rather than running away', () => {
    expect(pusherExtension(-1)).toBe(0);
    expect(pusherExtension(4)).toBe(0);
    expect(crusherPress(-1)).toBe(0);
    expect(crusherPress(4)).toBe(0);
  });

  it('re-firing mid-throw continues from where the piston actually is', () => {
    // Two pushers can fire on the same cell in consecutive registers. Snapping
    // to 0 first would be a visible flick before the second shove.
    const anim = createElementAnimator();
    anim.fire('pusher', 1, 1);
    const partial = run(anim, PUSHER_SECONDS * 0.15);
    const mid = partial.poses[partial.poses.length - 1].value;
    expect(mid).toBeGreaterThan(0);

    anim.fire('pusher', 1, 1);
    const next = anim.step(1 / 60);
    // The refire seeks into the outward leg rather than restarting it, so the
    // piston keeps going out from `mid` instead of flicking back to 0.
    expect(next.poses[0].value).toBeGreaterThanOrEqual(mid);
  });

  it('a long frame cannot overshoot past rest', () => {
    // A tab restored after being backgrounded hands over a huge dt. The
    // animation must land on rest, not somewhere past it.
    const anim = createElementAnimator();
    anim.fire('pusher', 1, 1);
    anim.fire('gear', 2, 2, true);
    const s = anim.step(30);
    expect(s.live).toBe(false);
    expect(s.poses.find((p) => p.kind === 'pusher')?.value).toBe(0);
    expect(s.poses.find((p) => p.kind === 'gear')?.value).toBeCloseTo(-GEAR_TURN, 10);
  });
});
