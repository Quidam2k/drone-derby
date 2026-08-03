// Screen-change beacons. Deliberately NOT a React hook: `useRoute` re-runs on
// every render, so a beacon emitted from there would count renders rather than
// navigations — a plausible number that is wrong, which is worse for a funnel
// than no number at all. This listens to `hashchange` directly, so one emit
// means one navigation.

import { parseHash, type Route } from './route';
import { logFlowEvent } from './telemetry';

/**
 * The countable shape of a route. The name is what the digest buckets on; the
 * id rides along because a `screen` row for a game is only useful if it says
 * WHICH game — that is the join key back to the server's flow rows.
 */
export function screenOf(hash: string): { name: Route['name']; id?: string } {
  const route = parseHash(hash);
  if (route.name === 'game') return { name: 'game', id: route.gameId };
  if (route.name === 'join') return { name: 'join', id: route.code };
  if (route.name === 'editor') return route.boardId ? { name: 'editor', id: route.boardId } : { name: 'editor' };
  return { name: route.name };
}

/** Last emitted screen, so a hash edit that lands on the same route is not a visit. */
let last: string | null = null;
/** Navigation ordinal within this page load — see `emit`. */
let n = 0;

function emit(hash: string): void {
  const screen = screenOf(hash);
  // `#/` and `#` both parse to home; a hashchange between them is not a
  // navigation, and counting it would inflate the denominator.
  const key = `${screen.name}\n${screen.id ?? ''}`;
  if (key === last) return;
  last = key;
  // `n` is not decoration. A round trip home → hotseat → home emits two
  // byte-identical `screen` payloads, and the 5 s dedupe would silently eat
  // the second — the very beacon loss this phase exists to prevent, except
  // the data key cannot see it because the data really is identical. The
  // ordinal makes each navigation distinct, and it doubles as the order the
  // session actually visited things in, which is the thing you want when
  // reading one playtester's path back.
  logFlowEvent('screen', { ...screen, n: ++n });
}

/**
 * Wire the beacon and emit the entry screen. Called once from main.tsx, beside
 * the other install* functions.
 */
export function installScreenBeacon(): void {
  if (typeof window === 'undefined') return;
  emit(window.location.hash);
  window.addEventListener('hashchange', () => emit(window.location.hash));
}

/** Test seam: forget the last-emitted screen and the ordinal. Not used by the app. */
export function resetScreenBeacon(): void {
  last = null;
  n = 0;
}
