// The player-facing board — Phase 3D-7, the cutover.
//
// One component, one decision, four call sites. Until now each of
// ReplayPlayer, ProgrammingView, HighlightReel and OnlineGameScreen carried its
// own `const BoardView = board3dEnabled() ? Board3D : Board`, evaluated once at
// import. That works for a URL flag, which cannot change mid-session. It cannot
// express what shipping 3D to everyone needs:
//
//   - a preference the player can flip DURING a game, and
//   - a fallback that engages when the machine has no WebGL2 or the scene
//     throws — which as an opt-in flag was a blank canvas nobody saw, and as
//     the default would be a white screen where the game should be.
//
// So the choice becomes a subscription, the same pattern ViewControls already
// uses for follow mode: viewSettings holds the preference and the failure flag,
// this subscribes, and `chooseRenderer` (pure, ./rendererChoice) resolves them
// against the URL and the machine's capability.
//
// The props are `Parameters<typeof Board>[0]`, forwarded verbatim. That is what
// keeps the two renderers a drop-in swap, and this phase adds no field to it.
//
// The editor does NOT come through here — EditorBoard imports `Board`
// directly, and must, because `document.elementFromPoint` over a tilted canvas
// cannot find a cell. BoardThumb is DOM/SVG for the same reason.

import { useEffect, useState } from 'react';
import {
  getView,
  renderer3dFailed,
  setView,
  subscribe,
  type Renderer,
} from '../../services/viewSettings';
import { Board3D } from '../board3d/Board3D';
import { Board } from './Board';
import { chooseRenderer, parseRenderOverride } from './rendererChoice';

type BoardProps = Parameters<typeof Board>[0];

/**
 * Both read once at module level: neither the URL flag nor the GPU can change
 * within a session, and probing a canvas per render would be absurd.
 */
const OVERRIDE = typeof window === 'undefined' ? null : parseRenderOverride(window.location.href);

/**
 * The only impure part of the decision: a throwaway context request. three
 * r185 targets WebGL2, so a WebGL1-only machine is a DOM-board machine — there
 * is no half-3D to fall back to.
 */
const WEBGL2 = ((): boolean => {
  try {
    if (typeof document === 'undefined') return false;
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    // Some locked-down browsers throw rather than returning null.
    return false;
  }
})();

function resolve(): Renderer {
  return chooseRenderer({
    override: OVERRIDE,
    preference: getView().renderer,
    webgl2: WEBGL2,
    failed: renderer3dFailed(),
  });
}

const CHOICES: { renderer: Renderer; label: string; title: string }[] = [
  { renderer: '3d', label: '3D', title: 'Render the board in 3D' },
  { renderer: 'dom', label: '2D', title: 'Render the flat board — lighter on old devices' },
];

/**
 * Top-left, opposite Board3D's camera strip (top-right) so the two can never
 * collide, and OUTSIDE `.board-viewport` — that box scrolls on a panned
 * composed board, and a fallback you have to scroll to find is not a fallback.
 *
 * It deliberately does not live in ViewControls: that strip only exists inside
 * Board3D, so putting it there would strand a player on the DOM board with no
 * way back.
 */
function RendererToggle({ renderer }: { renderer: Renderer }) {
  // A player can be ON the DOM board while their stored preference says 3d
  // (no WebGL2, or the scene threw). The toggle shows what is on screen and
  // says why the other option is out of reach.
  const reason = !WEBGL2
    ? "3D isn't available on this device (no WebGL2)"
    : renderer3dFailed()
      ? "The 3D board failed to start on this page — reload to try again"
      : OVERRIDE === 'dom'
        ? 'Forced off by ?render=dom in the URL'
        : null;

  return (
    <div className="board-overlay-controls board-view-controls" data-testid="renderer-toggle">
      <div className="renderer-seg" role="group" aria-label="Board renderer">
        {CHOICES.map((c) => {
          const blocked = c.renderer === '3d' && reason !== null;
          return (
            <button
              key={c.renderer}
              type="button"
              className={renderer === c.renderer ? 'selected' : ''}
              aria-pressed={renderer === c.renderer}
              disabled={blocked}
              title={blocked ? reason : c.title}
              data-testid={`renderer-${c.renderer}`}
              onClick={() => setView({ renderer: c.renderer })}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function BoardView(props: BoardProps) {
  const [renderer, setRenderer] = useState<Renderer>(resolve);

  useEffect(() => {
    const sync = () => setRenderer(resolve());
    // Catch up before subscribing: the scene can fail, or another board can
    // flip the preference, between this component's render and its effect.
    sync();
    return subscribe(sync);
  }, []);

  return (
    <div className="board-view" data-testid="board-view" data-renderer={renderer}>
      {renderer === '3d' ? <Board3D {...props} /> : <Board {...props} />}
      <RendererToggle renderer={renderer} />
    </div>
  );
}
