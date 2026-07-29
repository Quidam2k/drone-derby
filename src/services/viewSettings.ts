// Persisted 3D camera preferences: how the player likes to look at the board,
// and whose robot counts as "mine".
//
// Follows audio.ts's isMuted/setMuted precedent exactly — a module-level
// value, a localStorage mirror, and every read and write wrapped so a denied
// or full storage can never break the game. `typeof localStorage` is guarded
// because the vitest environment is node.
//
// This is what makes "watch it again with different settings" work: the view
// outlives the replay, the turn and the reload.
//
// It is a service rather than props on purpose. Board3D's props are derived
// from the DOM <Board>'s, and keeping them identical is what makes the two
// renderers a drop-in swap; threading yaw/tilt/zoom through three call sites
// would break that for no gain. It imports viewMath for the clamps rather
// than restating them — one source of truth for the legal envelope, at the
// cost of ~1 KB of arithmetic in the main chunk.

import type { Renderer } from '../components/board/rendererChoice';
import { clampView, DEFAULT_VIEW, type FollowMode, type View } from '../components/board3d/viewMath';
import type { PlayerId } from '../engine';

export type { FollowMode, Renderer, View };

export interface ViewSettings extends View {
  /**
   * `action` follows whatever the current event points at (3D-1's behaviour),
   * `robot` locks onto the local player's robot, `free` freezes wherever the
   * player panned it.
   */
  follow: FollowMode;
  /**
   * Which board renderer the player wants — Phase 3D-7. Lives here rather than
   * in its own service because it is the same kind of thing as `follow`: a
   * persisted view preference the board overlay flips, subscribed to rather
   * than threaded through props.
   *
   * Only a PREFERENCE. What actually mounts is chooseRenderer's business, and
   * capability beats intent there.
   */
  renderer: Renderer;
}

const KEY = 'dd-view';
const FOLLOW_MODES: readonly FollowMode[] = ['action', 'robot', 'free'];
const RENDERERS: readonly Renderer[] = ['3d', 'dom'];
/** Coalesce the writes a 60 fps drag would otherwise fire at localStorage. */
const WRITE_DELAY_MS = 250;

export const DEFAULT_SETTINGS: ViewSettings = { ...DEFAULT_VIEW, follow: 'action', renderer: '3d' };

let state: ViewSettings = read();
let focusPlayer: PlayerId | null = null;
let writeTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function read(): ViewSettings {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_SETTINGS };
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    const parsed = JSON.parse(raw) as Partial<ViewSettings>;
    return {
      ...clampView(parsed),
      follow: FOLLOW_MODES.includes(parsed?.follow as FollowMode)
        ? (parsed.follow as FollowMode)
        : 'action',
      renderer: RENDERERS.includes(parsed?.renderer as Renderer)
        ? (parsed.renderer as Renderer)
        : DEFAULT_SETTINGS.renderer,
    };
  } catch {
    // Unparseable or unreadable — the default view is always safe.
    return { ...DEFAULT_SETTINGS };
  }
}

function scheduleWrite(): void {
  try {
    if (typeof localStorage === 'undefined' || writeTimer) return;
    writeTimer = setTimeout(() => {
      writeTimer = null;
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch {
        // Quota or access denied — fail silently.
      }
    }, WRITE_DELAY_MS);
  } catch {
    // Never let a preference break a frame.
  }
}

function notify(): void {
  for (const fn of [...listeners]) {
    try {
      fn();
    } catch {
      // One bad listener must not stop the others.
    }
  }
}

/** The current settings. Treat as read-only — mutate through setView. */
export function getView(): ViewSettings {
  return state;
}

/**
 * Merge a patch, clamped. Unchanged values are a no-op: a drag lands here
 * every frame and must not wake React or localStorage for nothing.
 */
export function setView(patch: Partial<ViewSettings>): void {
  const follow =
    patch.follow && FOLLOW_MODES.includes(patch.follow) ? patch.follow : state.follow;
  const renderer =
    patch.renderer && RENDERERS.includes(patch.renderer) ? patch.renderer : state.renderer;
  const next: ViewSettings = { ...clampView({ ...state, ...patch }), follow, renderer };
  // Every field, by name — a field missing from this guard is a change that
  // silently never reaches localStorage or the subscribers.
  if (
    next.yaw === state.yaw &&
    next.tilt === state.tilt &&
    next.zoom === state.zoom &&
    next.follow === state.follow &&
    next.renderer === state.renderer
  ) {
    return;
  }
  state = next;
  scheduleWrite();
  notify();
}

/**
 * Back to 3D-1's angles and automatic following — what ↺ and double-tap do.
 * Deliberately does NOT reset the renderer: ↺ is a camera control, and
 * bouncing a player who chose the DOM board back into 3D is not "reset view".
 */
export function resetView(): void {
  setView({ ...DEFAULT_SETTINGS, renderer: state.renderer });
}

/**
 * Did the 3D scene fail to start this page load? Set by Board3D's catch.
 *
 * NOT persisted, on purpose. A driver hiccup or one bad `.glb` fetch must not
 * permanently downgrade a player who chose 3D, and it must not overwrite their
 * stored preference — which is still '3d' and still what the toggle shows once
 * they reload. Clearing on reload is exactly the right lifetime.
 */
let render3dFailed = false;

export function renderer3dFailed(): boolean {
  return render3dFailed;
}

export function markRenderer3dFailed(): void {
  if (render3dFailed) return;
  render3dFailed = true;
  // Wakes the mounted BoardView, which swaps to the DOM board in place rather
  // than leaving the blank canvas this phase exists to stop.
  notify();
}

/**
 * Whose robot "My robot" means. Published by the screens that know a seat —
 * ProgrammingView from its `seat`, OnlineGameScreen from `g.mySeat`. Null in
 * a hot-seat replay, where pass-and-play has no single local player; the
 * follow control disables itself rather than picking someone arbitrarily.
 */
export function getFocusPlayer(): PlayerId | null {
  return focusPlayer;
}

export function setFocusPlayer(player: PlayerId | null): void {
  if (player === focusPlayer) return;
  focusPlayer = player;
  notify();
}

/** Subscribe to any change above. Returns the unsubscribe. */
export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
