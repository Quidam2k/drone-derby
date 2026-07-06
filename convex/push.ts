'use node';

// Web-push delivery. Node runtime (web-push needs Node crypto), scheduled
// with `ctx.scheduler.runAfter(0, internal.push.send, …)` from mutations that
// know the moments: game started, turn executed. Best-effort by design —
// failures never affect game state, dead subscriptions get pruned.
//
// The JSON payload here must match the PushPayload the SW reads in src/sw.ts.

import webpush from 'web-push';
import { v } from 'convex/values';
import { internalAction } from './_generated/server';
import { internal } from './_generated/api';

export const send = internalAction({
  args: {
    userIds: v.array(v.id('users')),
    title: v.string(),
    body: v.string(),
    /** Same-origin path opened on tap, e.g. "/#/game/<id>". */
    url: v.string(),
    /** Notification collapse key (one visible notification per game). */
    tag: v.string(),
  },
  handler: async (ctx, args) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    if (!publicKey || !privateKey) return; // push not configured: no-op

    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? 'mailto:toddcwalker@gmail.com',
      publicKey,
      privateKey,
    );

    const subs = await ctx.runQuery(internal.notifications.forUsers, { userIds: args.userIds });
    const payload = JSON.stringify({
      title: args.title,
      body: args.body,
      url: args.url,
      tag: args.tag,
    });

    await Promise.all(
      subs.map(async (sub) => {
        try {
          await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await ctx.runMutation(internal.notifications.prune, { endpoint: sub.endpoint });
          } else {
            console.error(`push to ${sub.endpoint.slice(0, 60)}… failed:`, err);
          }
        }
      }),
    );
  },
});
