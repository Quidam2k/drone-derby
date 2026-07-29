// WebGL board renderer — Phase 3D-1 spike, the DEFAULT board since 3D-7.
//
// Deliberately the SAME props as the DOM <Board>, so it is a drop-in swap
// inside ../board/BoardView (which is now the only thing that mounts either)
// rather than a rewrite of the app. The props type is derived from Board
// itself so the two cannot drift apart without a typecheck failure.
//
// React owns exactly one thing here: the <canvas> element. Everything else is
// imperative three.js in ./scene, reached through a dynamic import so `three`
// lands in its own chunk and the lobby/editor/gallery never download it.
//
// Phase 3D-2 adds the camera overlay: plain DOM buttons layered over the
// canvas. The gestures themselves live in ./controls and never come near React.
//
// Phase 3D-4 closes the event-parity hole the spike shipped with, and reuses
// that overlay pattern for speech bubbles: a canvas cannot draw DOM text, so the
// bubbles stay DOM and the scene reports each robot's screen-space anchor once
// per frame. Those numbers are written STRAIGHT ONTO REFS — no React state per
// frame, the same discipline ViewControls follows for the camera.
//
// Phase 3D-5 adds two props and nothing else: `events` + `cursor`, the replay
// look-ahead its camera director needs to be framed on the laser before the
// beam appears rather than chasing it. Both are declared on the DOM board's
// BoardProps (which this type derives from) and ignored there.
//
// Phase 3D-6 adds one more the same way: `reel`, present only while a
// HighlightReel is driving this board. It buys the two things a reel may do and
// the live camera may not — frame tight, and hard-cut on a beat boundary.
//
// Phase 3D-7 makes this the default renderer and moves the choice out to
// ../board/BoardView. The only change here is the failure path: a scene that
// throws now SAYS SO — to viewSettings, so the mounted BoardView swaps in the
// DOM board on the spot, and to telemetry, so how often this happens in the
// field is a number rather than a guess.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { logTelemetry } from '../../services/telemetry';
import {
  getFocusPlayer,
  getView,
  markRenderer3dFailed,
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
    <div
      className="board-overlay-controls board-3d-controls"
      data-testid="board-3d-controls"
    >
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

// EVERY prop on BoardProps has to be destructured here and every scene prop
// forwarded below. 3D-4 shipped with four of five destructured, which silently
// dropped `bubbles` — no typecheck catches an unused prop, so Board3D.props.test
// asserts the two lists agree instead.
export function Board3D({
  board,
  visual,
  currentEvent,
  bubbles,
  ghost,
  events,
  cursor,
  reel,
}: BoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<BoardScene | null>(null);
  // The scene loads asynchronously (four .glb fetches); props that arrive
  // before it is ready are held here and applied the moment it exists.
  const inputRef = useRef<BoardSceneInput>({
    board,
    visual,
    currentEvent,
    ghost,
    events,
    cursor,
    reel,
  });
  inputRef.current = { board, visual, currentEvent, ghost, events, cursor, reel };
  /** Live bubble elements by player, written to by the scene's frame callback. */
  const bubbleRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    let scene: BoardScene | null = null;

    void (async () => {
      try {
        const { createBoardScene } = await import('./scene');
        if (cancelled) return;
        scene = await createBoardScene(canvas, inputRef.current, {
          // Once per rendered frame. Deliberately imperative: a setState here
          // would re-render the whole board on every frame of a camera fly-in.
          onAnchors(list) {
            for (const a of list) {
              const el = bubbleRefs.current.get(a.player);
              if (!el) continue;
              if (!a.visible) {
                el.style.visibility = 'hidden';
                continue;
              }
              el.style.left = `${a.x}px`;
              el.style.top = `${a.y}px`;
              el.style.visibility = 'visible';
            }
          },
        });
        if (cancelled) {
          scene.dispose();
          return;
        }
        sceneRef.current = scene;
        scene.update(inputRef.current);
        (window as unknown as { __board3d?: BoardScene }).__board3d = scene;
      } catch (err) {
        console.error('[board3d] failed to start', err);
        // No context, a dead driver, a corrupt .glb — whatever it was, this
        // canvas is never going to draw. Leaving it blank was tolerable while
        // 3D was opt-in; as the default it is a white screen where the game
        // should be, so hand the player back the DOM board.
        logTelemetry('error', '[board3d] scene failed to start', {
          error: err instanceof Error ? err.message : String(err),
          stack: err instanceof Error ? err.stack : undefined,
        });
        markRenderer3dFailed();
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
    sceneRef.current?.update({ board, visual, currentEvent, ghost, events, cursor, reel });
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
      {/* Bubbles start hidden and are positioned by the first frame after this
          commit (scene.update() always requests one). Rendering them at 0,0 for
          that one frame would be a visible flash in the corner. */}
      <div className="board-3d-bubbles" data-testid="board-3d-bubbles">
        {bubbles?.map((b) => (
          <div
            key={b.player}
            className="speech-bubble"
            data-testid={`bubble-${b.player}`}
            style={{ visibility: 'hidden' }}
            ref={(el) => {
              if (el) bubbleRefs.current.set(b.player, el);
              else bubbleRefs.current.delete(b.player);
            }}
          >
            {b.text}
          </div>
        ))}
      </div>
      <ViewControls />
    </div>
  );
}
