// Service worker, bundled by vite-plugin-pwa (injectManifest strategy).
// Typechecked by tsconfig.sw.json (WebWorker lib) — excluded from the app
// tsconfig, whose DOM lib conflicts with WebWorker globals.

/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { clientsClaim } from 'workbox-core';

declare let self: ServiceWorkerGlobalScope;

// Precache the built app shell; hash routing means every navigation is
// index.html, so the SPA fallback makes the whole app work offline.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();
registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// autoUpdate flow: new SW takes over immediately.
self.skipWaiting();
clientsClaim();

/** Payload shape sent by convex/push.ts — keep the two in sync. */
interface PushPayload {
  title?: string;
  body?: string;
  /** Same-origin URL to open on tap, e.g. "/#/game/<id>". */
  url?: string;
  /** Collapse key so repeat pushes for one game replace, not stack. */
  tag?: string;
}

self.addEventListener('push', (event) => {
  let data: PushPayload = {};
  try {
    data = (event.data?.json() as PushPayload) ?? {};
  } catch {
    // Non-JSON payload (e.g. DevTools test push) — show the default below.
  }
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Drone Derby', {
      body: data.body ?? '',
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      tag: data.tag,
      data: { url: data.url ?? '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | undefined)?.url ?? '/';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows[0];
      if (existing) {
        await existing.focus();
        // navigate() is flaky across browsers for hash-only changes; the
        // client-side listener in src/services/push.ts does the routing.
        existing.postMessage({ type: 'navigate', url });
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
