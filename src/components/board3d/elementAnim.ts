/**
 * Board elements performing their own action: a pusher extending, a gear
 * turning, a crusher pressing, a belt lurching as it carries someone.
 *
 * Pure — no three, no DOM, no clock, matching the `*Math.ts` convention next
 * door. This module owns the TIMING and the POSE CURVES; `boardMesh.ts` owns
 * the geometry a pose is written to, and `scene.ts` owns when one fires.
 *
 * THE INVARIANT THIS MODULE EXISTS TO GUARANTEE: `step` reports `live: false`
 * as soon as the last animation has had its settled pose written. `scene.ts`'s
 * render loop re-arms on `moving || belts()`, so an element animation that
 * never released would hold the loop awake forever. A board that never sleeps
 * is a battery and heat regression on the phone a playtester is holding, and
 * it is invisible to every instrument this cascade shipped — the P1
 * `webglcontextlost` alarm would not catch it. That makes it a defect, not a
 * tuning issue, so `elementAnim.test.ts` asserts the release rather than
 * trusting an eyeball. The same discipline `stepFlame` already states in
 * scene.ts: "a held pose that is never released is a flamer left permanently
 * twice its size."
 *
 * TRANSIENT vs CUMULATIVE poses — the one subtlety worth reading:
 * - A pusher and a crusher RETURN. Their pose is a 0 → 1 → 0 fraction of a
 *   full throw, and their rest is 0.
 * - A gear and a belt have MOVED. Their pose is cumulative — total radians
 *   turned, total extra tiles travelled — and it settles at a NEW constant.
 *   Snapping either back to a canonical zero on the last frame would be a
 *   visible jump backwards, and for the gear it would additionally assume the
 *   kit's model happens to be 45°-symmetric, which is a bet on the art rather
 *   than on the code.
 * So "at rest" here means THE VALUE STOPS CHANGING — not that it returns to
 * zero. Both flavours satisfy the release invariant identically.
 */

export type ElementKind = 'pusher' | 'gear' | 'crusher' | 'belt';

/**
 * Each animation fits inside the beat its event already occupies — the same
 * 0.26-0.72s vocabulary the rigs and the flame already use (RECOIL_SECONDS
 * 0.26, FLAME_SECONDS 0.45, DROP_SECONDS 0.42). Nothing here changes register
 * or turn pacing; pacing is not ours to change.
 */
export const PUSHER_SECONDS = 0.4;
export const GEAR_SECONDS = 0.46;
export const CRUSHER_SECONDS = 0.44;
export const BELT_SECONDS = 0.42;

const DURATION: Record<ElementKind, number> = {
  pusher: PUSHER_SECONDS,
  gear: GEAR_SECONDS,
  crusher: CRUSHER_SECONDS,
  belt: BELT_SECONDS,
};

/** A gear turns exactly a quarter — a rule, not a look, so it lives here. */
export const GEAR_TURN = Math.PI / 2;
/**
 * Extra tiles of belt travel one carry adds on top of the ambient scroll.
 * Under a tile, so the surge reads as the belt hurrying rather than as the
 * chevrons teleporting to the next cell.
 */
export const BELT_SURGE = 0.5;

/** Fraction of a pusher's cycle spent throwing out; the rest draws back. */
const PUSHER_OUT = 0.34;
/** Crusher: descend, hold at the bottom, retract. Fractions of the cycle. */
const CRUSHER_DOWN = 0.38;
const CRUSHER_HOLD = 0.16;

function clamp01(u: number): number {
  return u < 0 ? 0 : u > 1 ? 1 : u;
}

function easeOut(u: number): number {
  const v = clamp01(u);
  return 1 - (1 - v) * (1 - v);
}

function easeInOut(u: number): number {
  const v = clamp01(u);
  return v < 0.5 ? 2 * v * v : 1 - 2 * (1 - v) * (1 - v);
}

/**
 * The piston: out hard, drawn back at leisure. The asymmetry is the whole
 * read — a symmetric in-out looks like a breath, not a shove.
 */
export function pusherExtension(p: number): number {
  const u = clamp01(p);
  return u < PUSHER_OUT ? easeOut(u / PUSHER_OUT) : 1 - easeInOut((u - PUSHER_OUT) / (1 - PUSHER_OUT));
}

/** The press: down, held on the robot, then lifted. */
export function crusherPress(p: number): number {
  const u = clamp01(p);
  if (u < CRUSHER_DOWN) return easeOut(u / CRUSHER_DOWN);
  if (u < CRUSHER_DOWN + CRUSHER_HOLD) return 1;
  return 1 - easeInOut((u - CRUSHER_DOWN - CRUSHER_HOLD) / (1 - CRUSHER_DOWN - CRUSHER_HOLD));
}

/**
 * The phase on a transient element's OUTWARD leg that is already at `value`.
 *
 * Both outward legs are `easeOut`, which is monotonic there, so this inverts
 * exactly: easeOut(v) = 1-(1-v)² ⇒ v = 1-√(1-value). It exists for one case,
 * and that case is real — the same pusher firing on two consecutive registers
 * while the replay is running faster than the 0.4s throw. Restarting the curve
 * at zero would flick the piston back into its housing before shoving again.
 */
function outwardPhase(kind: ElementKind, value: number): number {
  const leg = kind === 'crusher' ? CRUSHER_DOWN : PUSHER_OUT;
  return leg * (1 - Math.sqrt(1 - clamp01(value)));
}

/** A cumulative element's progress from where it was to where it lands. */
export function cumulative(from: number, to: number, p: number, ease: (u: number) => number): number {
  return from + (to - from) * ease(clamp01(p));
}

export interface ElementPose {
  kind: ElementKind;
  x: number;
  y: number;
  /**
   * `pusher`/`crusher`: 0..1 of a full throw — boardMesh scales it into world
   * units, because how far is geometry. `gear`: cumulative radians (negative
   * is clockwise, matching DIR_YAW where N=0 and E=-π/2). `belt`: cumulative
   * extra tiles of travel.
   */
  value: number;
}

export interface ElementStep {
  /** Poses to write this frame, including the final settling write. */
  poses: ElementPose[];
  /** False the moment the last animation has settled. See the header. */
  live: boolean;
}

export interface ElementAnimator {
  /** `cw` is read only by `gear`; the other kinds ignore it. */
  fire(kind: ElementKind, x: number, y: number, cw?: boolean): void;
  step(dt: number): ElementStep;
  live(): boolean;
}

export function createElementAnimator(): ElementAnimator {
  interface Active {
    kind: ElementKind;
    x: number;
    y: number;
    t: number;
    dur: number;
    from: number;
    to: number;
  }

  /** One animation per element at a time; a re-fire replaces it in place. */
  const active = new Map<string, Active>();
  /**
   * Where each cumulative element has settled, kept between animations so a
   * gear's second quarter-turn starts from its first rather than from zero.
   */
  const settled = new Map<string, number>();

  const key = (kind: ElementKind, x: number, y: number) => `${kind}:${x},${y}`;

  function poseOf(a: Active): number {
    const p = a.dur > 0 ? a.t / a.dur : 1;
    switch (a.kind) {
      case 'pusher':
        return pusherExtension(p);
      case 'crusher':
        return crusherPress(p);
      case 'gear':
        return cumulative(a.from, a.to, p, easeInOut);
      case 'belt':
        return cumulative(a.from, a.to, p, easeOut);
    }
  }

  function fire(kind: ElementKind, x: number, y: number, cw = true): void {
    const k = key(kind, x, y);
    const running = active.get(k);
    // Re-firing mid-animation continues from where the element actually IS.
    // Two pushers on the same cell in consecutive registers is legal, and
    // restarting from the stored rest would snap the geometry backwards.
    const from = running ? poseOf(running) : (settled.get(k) ?? 0);
    const dur = DURATION[kind];
    let to = from;
    let t = 0;
    if (kind === 'gear') to = from + (cw ? -GEAR_TURN : GEAR_TURN);
    else if (kind === 'belt') to = from + BELT_SURGE;
    // A transient element's curve carries no `from`, so continuity has to come
    // from where in the curve it restarts: seek to the outward-leg phase that
    // is already at the current extension.
    else if (from > 0) t = dur * outwardPhase(kind, from);
    active.set(k, { kind, x, y, t, dur, from, to });
  }

  function step(dt: number): ElementStep {
    const poses: ElementPose[] = [];
    if (!active.size) return { poses, live: false };
    for (const [k, a] of active) {
      a.t += dt;
      if (a.t >= a.dur) {
        // The releasing frame still WRITES — the settled pose is exactly the
        // declared end value, never whatever the curve happened to evaluate
        // to one frame short of it. Then the animation is dropped, which is
        // what lets the render loop go back to sleep.
        const end = a.kind === 'gear' || a.kind === 'belt' ? a.to : 0;
        if (a.kind === 'gear' || a.kind === 'belt') settled.set(k, end);
        poses.push({ kind: a.kind, x: a.x, y: a.y, value: end });
        active.delete(k);
      } else {
        poses.push({ kind: a.kind, x: a.x, y: a.y, value: poseOf(a) });
      }
    }
    return { poses, live: active.size > 0 };
  }

  return { fire, step, live: () => active.size > 0 };
}
