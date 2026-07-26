// Pointer/touch/wheel gestures on the 3D canvas, translated into view deltas.
//
// Deliberately NOT OrbitControls. OrbitControls wants to own the camera's
// position *and* its distance from the target — which is precisely the half
// this phase hands to the director — so adopting it would mean fighting it
// every frame. A hundred-odd lines of Pointer Events costs less than that
// argument, adds nothing to an already 171 KB chunk, and gives mouse and
// touch one code path instead of two.
//
// This module never touches the camera. It emits deltas; scene.ts decides
// what they mean.

export interface ViewControlHandlers {
  /** Degrees to add to yaw and tilt. */
  orbit(dYawDeg: number, dTiltDeg: number): void;
  /** Multiplier on the zoom multiplier: >1 pulls back, <1 moves in. */
  zoom(factor: number): void;
  /** Drag as a fraction of viewport height; moves the subject, not the eye. */
  pan(dxFrac: number, dyFrac: number): void;
  /** Double-click / double-tap: back to the default view and auto-follow. */
  reset(): void;
}

/** A full-width drag sweeps half a turn — enough to get behind a wall. */
const YAW_PER_WIDTH = 180;
/** Tilt is a shorter range than yaw, so a full-height drag overshoots it. */
const TILT_PER_HEIGHT = 120;
/** Chosen so one notch of a typical mouse wheel is a ~15% distance step. */
const WHEEL_SENSITIVITY = 0.0015;
/** Firefox reports wheel deltas in lines, not pixels. */
const LINE_HEIGHT_PX = 16;
const DOUBLE_TAP_MS = 320;
const DOUBLE_TAP_PX = 24;
/**
 * Pixels the two-finger centre must move *from where the pinch started*
 * before it counts as a pan.
 *
 * Net displacement, not accumulated travel: the two pointers report their
 * moves in separate events, so mid-frame the centre is computed from one
 * updated and one stale finger and swings half the step each way. A spreading
 * pinch therefore racks up travel while going nowhere. Without this, every
 * pinch-to-zoom would drop auto-follow into `free` — and zoom is a viewpoint
 * change, which the director is supposed to survive.
 */
const PINCH_PAN_DEADZONE_PX = 10;

export interface ViewControls {
  dispose(): void;
}

export function attachViewControls(
  canvas: HTMLCanvasElement,
  handlers: ViewControlHandlers,
): ViewControls {
  const pointers = new Map<number, { x: number; y: number }>();
  let gesture: 'none' | 'orbit' | 'pan' | 'pinch' = 'none';
  let pinchSpan = 0;
  let pinchCx = 0;
  let pinchCy = 0;
  /** Where the two-finger centre started, for the pan deadzone. */
  let pinchStartCx = 0;
  let pinchStartCy = 0;
  let pinchPanning = false;
  let tapTime = 0;
  let tapX = 0;
  let tapY = 0;
  /** Squared drag distance of the current gesture — a tap must not orbit. */
  let travel = 0;

  const width = () => canvas.clientWidth || 1;
  const height = () => canvas.clientHeight || 1;

  function twoPointers(): [{ x: number; y: number }, { x: number; y: number }] | null {
    const [a, b] = [...pointers.values()];
    return a && b ? [a, b] : null;
  }

  function onPointerDown(e: PointerEvent): void {
    // Capture so a drag that leaves the canvas keeps orbiting, and so the
    // matching up/cancel always arrives.
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      // Some browsers refuse capture for already-captured ids; harmless.
    }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    travel = 0;
    if (pointers.size >= 2) {
      const two = twoPointers();
      if (two) {
        gesture = 'pinch';
        pinchSpan = Math.hypot(two[0].x - two[1].x, two[0].y - two[1].y);
        pinchCx = (two[0].x + two[1].x) / 2;
        pinchCy = (two[0].y + two[1].y) / 2;
        pinchStartCx = pinchCx;
        pinchStartCy = pinchCy;
        pinchPanning = false;
      }
    } else {
      // Right-drag (and ctrl-drag, the trackpad idiom) pans; left-drag orbits.
      gesture = e.button === 2 || e.ctrlKey ? 'pan' : 'orbit';
    }
    // Stops the canvas from starting a text selection or a native drag.
    e.preventDefault();
  }

  function onPointerMove(e: PointerEvent): void {
    const prev = pointers.get(e.pointerId);
    if (!prev) return;
    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    prev.x = e.clientX;
    prev.y = e.clientY;
    travel += dx * dx + dy * dy;

    if (gesture === 'pinch') {
      const two = twoPointers();
      if (!two) return;
      const span = Math.hypot(two[0].x - two[1].x, two[0].y - two[1].y) || 1;
      const cx = (two[0].x + two[1].x) / 2;
      const cy = (two[0].y + two[1].y) / 2;
      // Fingers spreading (span grows) means moving in, so the multiplier
      // shrinks — the reciprocal of the span ratio.
      if (pinchSpan > 0) handlers.zoom(pinchSpan / span);
      // Two fingers sliding together pan, which is the same gesture as a
      // right-drag; the two-finger centre is what the player is dragging.
      // Held back until the centre has genuinely moved off where it started,
      // so a pinch stays a zoom and keeps the director following.
      if (!pinchPanning) {
        pinchPanning = Math.hypot(cx - pinchStartCx, cy - pinchStartCy) > PINCH_PAN_DEADZONE_PX;
      }
      if (pinchPanning) handlers.pan((cx - pinchCx) / height(), (cy - pinchCy) / height());
      pinchSpan = span;
      pinchCx = cx;
      pinchCy = cy;
      return;
    }
    if (gesture === 'orbit') {
      // Negative yaw for a rightward drag so the board turns *with* the
      // finger rather than away from it (the OrbitControls convention).
      handlers.orbit((-dx / width()) * YAW_PER_WIDTH, (dy / height()) * TILT_PER_HEIGHT);
      return;
    }
    if (gesture === 'pan') {
      handlers.pan(dx / height(), dy / height());
    }
  }

  function endPointer(e: PointerEvent): void {
    pointers.delete(e.pointerId);
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
      // Already released.
    }
    if (pointers.size === 1) {
      // Lifting one finger out of a pinch drops back to orbiting with the
      // other; its stored position is current, so nothing jumps.
      gesture = 'orbit';
      pinchSpan = 0;
    } else if (pointers.size === 0) {
      gesture = 'none';
      pinchSpan = 0;
    }
  }

  function onPointerUp(e: PointerEvent): void {
    const wasTap = travel < DOUBLE_TAP_PX * DOUBLE_TAP_PX && pointers.size === 1;
    endPointer(e);
    // Mouse double-clicks arrive as a `dblclick`; touch has to be timed here.
    if (e.pointerType !== 'touch' || !wasTap) return;
    const near = Math.hypot(e.clientX - tapX, e.clientY - tapY) < DOUBLE_TAP_PX;
    if (near && e.timeStamp - tapTime < DOUBLE_TAP_MS) {
      tapTime = 0;
      handlers.reset();
      return;
    }
    tapTime = e.timeStamp;
    tapX = e.clientX;
    tapY = e.clientY;
  }

  function onWheel(e: WheelEvent): void {
    e.preventDefault();
    const px = e.deltaMode === 1 ? e.deltaY * LINE_HEIGHT_PX : e.deltaY;
    // Exponential so zooming is symmetric: n notches out then n back in
    // lands exactly where it started.
    handlers.zoom(Math.exp(px * WHEEL_SENSITIVITY));
  }

  function onContextMenu(e: MouseEvent): void {
    // Right-drag is the pan gesture; a context menu mid-pan is never wanted.
    e.preventDefault();
  }

  function onDoubleClick(e: MouseEvent): void {
    e.preventDefault();
    handlers.reset();
  }

  canvas.addEventListener('pointerdown', onPointerDown);
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerup', onPointerUp);
  canvas.addEventListener('pointercancel', endPointer);
  // Not passive: the whole point is to stop the page scrolling under a zoom.
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('dblclick', onDoubleClick);

  return {
    dispose() {
      canvas.removeEventListener('pointerdown', onPointerDown);
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerup', onPointerUp);
      canvas.removeEventListener('pointercancel', endPointer);
      canvas.removeEventListener('wheel', onWheel);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('dblclick', onDoubleClick);
      pointers.clear();
    },
  };
}
