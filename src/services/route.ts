// Hash-based navigation — no router dependency. Routes:
//   #/            lobby (or hot-seat when Convex is not configured)
//   #/hotseat     pass & play on this device
//   #/game/<id>   online game screen
//   #/join/<code> join via invite link

import { useSyncExternalStore } from 'react';

export type Route =
  | { name: 'home' }
  | { name: 'hotseat' }
  | { name: 'game'; gameId: string }
  | { name: 'join'; code: string };

export function parseHash(hash: string): Route {
  const [head, arg] = hash.replace(/^#\/?/, '').split('/');
  if (head === 'hotseat') return { name: 'hotseat' };
  if (head === 'game' && arg) return { name: 'game', gameId: arg };
  if (head === 'join' && arg) return { name: 'join', code: arg };
  return { name: 'home' };
}

function subscribe(cb: () => void): () => void {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash);
  return parseHash(hash);
}

export function navigate(to: string): void {
  window.location.hash = to;
}

export function inviteUrl(code: string): string {
  return `${location.origin}${location.pathname}#/join/${code}`;
}
