// Browser push plumbing. The server half is convex/notifications.ts (storage)
// and convex/push.ts (delivery); NotificationsButton owns the UI flow.

export function pushSupported(): boolean {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}

/** VAPID keys are base64url; PushManager wants the raw bytes. */
function urlBase64ToUint8Array(base64url: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64url.length % 4)) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

/**
 * The SW registration, or null when none is active — e.g. `npm run dev`,
 * where vite-plugin-pwa doesn't register one. (Don't use .ready here: it
 * never resolves in that case.)
 */
async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!pushSupported()) return null;
  return (await navigator.serviceWorker.getRegistration()) ?? null;
}

export async function getExistingSubscription(): Promise<PushSubscription | null> {
  const reg = await registration();
  return reg ? await reg.pushManager.getSubscription() : null;
}

/**
 * Must be called from a user gesture (iOS requirement). Throws with a
 * human-readable message when permission is refused or the SW is missing.
 */
export async function subscribeToPush(
  vapidPublicKey: string,
): Promise<{ endpoint: string; keys: { p256dh: string; auth: string } }> {
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications were not allowed');
  const reg = await registration();
  if (!reg) throw new Error('No service worker — use the installed/built app, not the dev server');
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  });
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    await sub.unsubscribe();
    throw new Error('Browser returned an incomplete push subscription');
  }
  return { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } };
}

/** Returns the unsubscribed endpoint so the server row can be deleted too. */
export async function unsubscribeFromPush(): Promise<string | null> {
  const sub = await getExistingSubscription();
  if (!sub) return null;
  await sub.unsubscribe();
  return sub.endpoint;
}

/**
 * When a notification is tapped with a window already open, the SW focuses
 * it and posts {type:'navigate', url} (see src/sw.ts) — route it here.
 */
export function listenForSwMessages(): void {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
    const data = event.data as { type?: string; url?: string } | null;
    if (data?.type === 'navigate' && typeof data.url === 'string' && data.url.startsWith('/')) {
      window.location.href = data.url;
    }
  });
}
