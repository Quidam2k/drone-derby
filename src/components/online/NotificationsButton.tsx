// "Enable notifications" toggle. Renders nothing until it can actually work:
// push supported, VAPID key configured on the server, permission not denied.

import { useEffect, useState } from 'react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import {
  getExistingSubscription,
  pushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from '../../services/push';
import { errorMessage } from './common';

export function NotificationsButton() {
  const vapidKey = useQuery(api.notifications.vapidPublicKey);
  const save = useMutation(api.notifications.subscribe);
  const remove = useMutation(api.notifications.unsubscribe);
  const [enabled, setEnabled] = useState<boolean | null>(null); // null: still checking
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getExistingSubscription().then((sub) => setEnabled(sub !== null));
  }, []);

  // Self-heal: rebind an existing browser subscription to the current user
  // (covers a cleared backend or a different guest signing in on this device).
  useEffect(() => {
    if (!vapidKey || !enabled) return;
    void getExistingSubscription().then((sub) => {
      const json = sub?.toJSON();
      if (json?.endpoint && json.keys?.p256dh && json.keys?.auth) {
        void save({
          endpoint: json.endpoint,
          keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
        }).catch(() => undefined);
      }
    });
  }, [vapidKey, enabled, save]);

  if (!pushSupported() || !vapidKey || enabled === null) return null;
  if (Notification.permission === 'denied') return null;

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (enabled) {
        const endpoint = await unsubscribeFromPush();
        if (endpoint) await remove({ endpoint });
        setEnabled(false);
      } else {
        const sub = await subscribeToPush(vapidKey);
        await save(sub);
        setEnabled(true);
      }
    } catch (e: unknown) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="notifications-toggle">
      <button
        className="quiet"
        disabled={busy}
        onClick={() => void toggle()}
        data-testid="notifications-toggle"
        title={enabled ? 'Turn off turn notifications on this device' : 'Get notified when it’s your move'}
      >
        {enabled ? '🔔 Notifications on' : '🔕 Enable notifications'}
      </button>
      {error && <span className="error-note">{error}</span>}
    </span>
  );
}
