// Service-worker update prompt.
//
// The build was previously registered with `registerType: 'autoUpdate'`, which
// means a returning player keeps running the PREVIOUS build until some later
// refresh. That is ordinary PWA behaviour and harmless most of the time — but
// during a playtest it silently invalidates the evidence chain: a tester files
// a bug against a build we already fixed, and the appVersion stamp only tells
// us so after someone has chased it. So: notice the new build, say so, and let
// them take it with one tap.
//
// Registration is manual (`injectRegister: null` in vite.config.ts) because
// the injected registration has nowhere to hand the callback.

import { logFlowEvent } from './telemetry';

type Listener = (available: boolean) => void;

const listeners = new Set<Listener>();
let needRefresh = false;
let applyUpdate: ((reload?: boolean) => Promise<void>) | null = null;

function announce(): void {
  for (const listener of listeners) listener(needRefresh);
}

/** Subscribe to "a newer build is waiting". Returns an unsubscribe. */
export function onUpdateAvailable(listener: Listener): () => void {
  listeners.add(listener);
  listener(needRefresh);
  return () => listeners.delete(listener);
}

/** Activate the waiting worker and reload onto the new build. */
export function takeUpdate(): void {
  logFlowEvent('sw-update-applied');
  void applyUpdate?.(true);
}

/**
 * Register the service worker and watch for updates. No-ops when the PWA
 * plugin is disabled (vitest) or the browser has no service worker.
 */
export async function installUpdatePrompt(): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  try {
    const { registerSW } = await import('virtual:pwa-register');
    applyUpdate = registerSW({
      immediate: true,
      onNeedRefresh() {
        needRefresh = true;
        logFlowEvent('sw-update-available');
        announce();
      },
    });
  } catch {
    // No virtual module (dev without the plugin, or a build with it disabled).
    // A missing update prompt must never take the app down with it.
  }
}
