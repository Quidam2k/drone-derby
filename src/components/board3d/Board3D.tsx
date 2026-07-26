// WebGL board renderer — Phase 3D-1 spike, behind ?render=3d.
//
// Deliberately the SAME props as the DOM <Board>, so it is a drop-in swap at
// the three call sites (ProgrammingView, ReplayPlayer, OnlineGameScreen)
// rather than a rewrite of the app. The props type is derived from Board
// itself so the two cannot drift apart without a typecheck failure.
//
// React owns exactly one thing here: the <canvas> element. Everything else is
// imperative three.js in ./scene, reached through a dynamic import so `three`
// lands in its own chunk and the lobby/editor/gallery never download it.
//
// Not yet rendered (3D-4 owns event parity): speech bubbles, the bump flash,
// fall/respawn animation and the checkpoint pop. Damage flashes and laser
// beams are here so the side-by-side look comparison is fair.
//
// Phase 3D-2 adds the camera overlay: plain DOM buttons layered over the
// canvas, which is also the pattern 3D-4 needs for speech bubbles projected
// from world coordinates. The gestures themselves live in ./controls and
// never come near React.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import {
  getFocusPlayer,
  getView,
  resetView,
  setView,
  subscribe,
  type FollowMode,
} from '../../services/viewSettings';
import { tileFit, type Board } from '../board/Board';
import type { BoardScene, BoardSceneInput } from './scene';

type BoardProps = Parameters<typeof Board>[0];

/**
 * sin(camera elevation) — how much of its depth the board keeps once tilted.
 * Mirrors ELEVATION in ./camera.ts, duplicated rather than imported because
 * that module pulls in `three` and this one must stay in the main chunk.
 */
const SQUASH = 0.788;
/** Tiles of headroom above the board for robot height and the far rim. */
const HEADROOM = 1.5;

/**
 * `?render=3d` anywhere in the URL — query string or after the hash, since
 * routing here is hash-based. Default off; the DOM board stays the default
 * renderer and is not modified by any of this.
 */
export function board3dEnabled(): boolean {
  if (typeof window === 'undefined') return false;
  return /[?&]render=3d(?:$|[&#/])/.test(window.location.href);
}

const FOLLOW_LABELS: { mode: FollowMode; label: string; title: string }[] = [
  { mode: 'action', label: 'Action', title: 'Follow whatever is happening' },
  { mode: 'robot', label: 'My robot', title: "Lock the view to your robot's area" },
  { mode: 'free', label: 'Free', title: 'Leave the camera where you put it' },
];

/**
 * The follow toggle Todd asked for, plus a way back to the default view.
 * Only `follow` and the local player can change what this renders, so it
 * subscribes rather than re-rendering on every frame of a drag — the yaw and
 * tilt a gesture writes 60 times a second never reach React at all.
 */
function ViewControls() {
  const [follow, setFollow] = useState<FollowMode>(() => getView().follow);
  const [me, setMe] = useState(() => getFocusPlayer());

  useEffect(() => {
    const sync = () => {
      setFollow(getView().follow);
      setMe(getFocusPlayer());
    };
    // Re-read before subscribing. The useState initialisers ran during render,
    // and the screen we are replacing clears its seat in its effect *cleanup*
    // — which lands between the two. Without this catch-up, a hot-seat replay
    // inherits the last programmer as "me" and wrongly offers the lock.
    sync();
    return subscribe(sync);
  }, []);

  return (
    <div className="board-3d-controls" data-testid="board-3d-controls">
      <div className="follow-seg" role="group" aria-label="Camera follow">
        {FOLLOW_LABELS.map(({ mode, label, title }) => {
          // Pass-and-play has no single local player during a replay, so
          // there is no "my robot" to lock onto. Say why rather than
          // following someone arbitrary.
          const noLocal = mode === 'robot' && !me;
          return (
            <button
              key={mode}
              type="button"
              className={follow === mode ? 'selected' : ''}
              aria-pressed={follow === mode}
              disabled={noLocal}
              title={noLocal ? 'No local player on this screen (pass-and-play replay)' : title}
              data-testid={`follow-${mode}`}
              onClick={() => setView({ follow: mode })}
            >
              {label}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        className="reset-view"
        title="Reset the view"
        aria-label="Reset the view"
        data-testid="reset-view"
        onClick={() => resetView()}
      >
        ↺
      </button>
    </div>
  );
}

export function Board3D({ board, visual, currentEvent, ghost }: BoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<BoardScene | null>(null);
  // The scene loads asynchronously (four .glb fetches); props that arrive
  // before it is ready are held here and applied the moment it exists.
  const inputRef = useRef<BoardSceneInput>({ board, visual, currentEvent, ghost });
  inputRef.current = { board, visual, currentEvent, ghost };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let scene: BoardScene | null = null;

    void (async () => {
      try {
        const { createBoardScene } = await import('./scene');
        if (cancelled) return;
        scene = await createBoardScene(canvas, inputRef.current);
        if (cancelled) {
          scene.dispose();
          return;
        }
        sceneRef.current = scene;
        scene.update(inputRef.current);
        (window as unknown as { __board3d?: BoardScene }).__board3d = scene;
      } catch (err) {
        console.error('[board3d] failed to start', err);
      }
    })();

    return () => {
      cancelled = true;
      scene?.dispose();
      sceneRef.current = null;
      delete (window as unknown as { __board3d?: BoardScene }).__board3d;
    };
  }, []);

  useEffect(() => {
    sceneRef.current?.update({ board, visual, currentEvent, ghost });
  });

  // Sized off the DOM board's own tileFit(), so the 3D board is exactly as
  // wide as the 2D one would be and the rest of the screen (hand, registers,
  // player strip) lays out identically. Tilting the board costs it depth, so
  // it needs less height than the DOM grid, not more. Inline rather than a
  // stylesheet rule: the spike touches no existing CSS.
  const tile = tileFit(board);
  const rows = (board.height * SQUASH + HEADROOM).toFixed(2);
  const style: CSSProperties = {
    width: `calc(${tile} * ${board.width})`,
    height: `calc(${tile} * ${rows})`,
    overflow: 'hidden',
    // The overlay positions against this box.
    position: 'relative',
  };

  return (
    <div className="board-viewport" style={style} data-testid="board-3d">
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          // Without this a one-finger orbit scrolls the page out from under
          // the gesture on a phone — the browser claims the touch first.
          touchAction: 'none',
        }}
        aria-hidden="true"
      />
      <ViewControls />
    </div>
  );
}
