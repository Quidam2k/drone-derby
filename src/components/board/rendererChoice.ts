// Which board renderer a screen gets — Phase 3D-7, the cutover.
//
// Fourth module in the ./viewMath, ./effectMath, ./directorMath pattern: plain
// data in, plain data out, no DOM, unit tested in the node environment. The
// decision lives here rather than inline in BoardView so the precedence order
// is asserted in a table instead of being reasoned about at a call site.
//
// Until now the choice was `board3dEnabled() ? Board3D : Board`, evaluated once
// at import in four files. That is enough for a URL flag, which cannot change
// during a session. It cannot express a cutover: a preference the player flips
// mid-game, and a fallback that engages when the machine can't draw WebGL or
// the scene throws.

/** The two board renderers. `dom` is the CSS-grid board, permanent. */
export type Renderer = '3d' | 'dom';

export interface RendererInputs {
  /** `?render=3d` / `?render=dom` from the URL, or null. */
  override: Renderer | null;
  /** The player's persisted choice (viewSettings.renderer). */
  preference: Renderer;
  /** Does this browser give us a WebGL2 context at all? */
  webgl2: boolean;
  /** Has the 3D scene thrown this page load? (Not persisted — see viewSettings.) */
  failed: boolean;
}

/**
 * `render=3d` or `render=dom` anywhere in the URL — query string or after the
 * hash, since routing here is hash-based. Generalises 3D-1's regex, which only
 * knew `3d`. `dom` wins if somehow both appear, matching chooseRenderer's rule
 * that the escape hatch always works.
 */
export function parseRenderOverride(href: string): Renderer | null {
  if (/[?&]render=dom(?:$|[&#/])/.test(href)) return 'dom';
  if (/[?&]render=3d(?:$|[&#/])/.test(href)) return '3d';
  return null;
}

/**
 * The whole spec of the cutover, in four lines and in this order:
 *
 *   1. An explicit `?render=dom` always wins. A debug escape hatch that can be
 *      overruled is not an escape hatch.
 *   2. Capability beats intent. No WebGL2, or a scene that already threw, and
 *      3D is off no matter what anyone asked for — forcing it is the blank
 *      canvas this phase exists to stop.
 *   3. An explicit `?render=3d` beats the stored preference.
 *   4. Otherwise the preference, which now defaults to '3d'. That default IS
 *      the cutover.
 */
export function chooseRenderer({ override, preference, webgl2, failed }: RendererInputs): Renderer {
  if (override === 'dom') return 'dom';
  if (failed || !webgl2) return 'dom';
  if (override === '3d') return '3d';
  return preference;
}
