// Push subscription bookkeeping (V8 runtime). The actual sending lives in
// convex/push.ts — a "use node" action, because web-push needs Node crypto.

import { v } from 'convex/values';
import { internalMutation, internalQuery, mutation, query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';

const keysValidator = v.object({ p256dh: v.string(), auth: v.string() });

/**
 * Null until VAPID keys are configured (`npx convex env set VAPID_PUBLIC_KEY …`);
 * the client hides its notifications UI in that case.
 */
export const vapidPublicKey = query({
  args: {},
  handler: async () => process.env.VAPID_PUBLIC_KEY ?? null,
});

/** Upsert by endpoint: re-subscribing or switching users just rebinds the row. */
export const subscribe = mutation({
  args: { endpoint: v.string(), keys: keysValidator },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) throw new Error('Not signed in');
    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { userId, keys: args.keys });
    } else {
      await ctx.db.insert('pushSubscriptions', { userId, ...args });
    }
  },
});

export const unsubscribe = mutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return;
    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .unique();
    if (existing && existing.userId === userId) await ctx.db.delete(existing._id);
  },
});

export const forUsers = internalQuery({
  args: { userIds: v.array(v.id('users')) },
  handler: async (ctx, args) => {
    const out: { endpoint: string; keys: { p256dh: string; auth: string } }[] = [];
    for (const userId of new Set(args.userIds)) {
      const subs = await ctx.db
        .query('pushSubscriptions')
        .withIndex('by_user', (q) => q.eq('userId', userId))
        .collect();
      out.push(...subs.map((s) => ({ endpoint: s.endpoint, keys: s.keys })));
    }
    return out;
  },
});

/** Called from the send action when a push service reports the sub dead (404/410). */
export const prune = internalMutation({
  args: { endpoint: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_endpoint', (q) => q.eq('endpoint', args.endpoint))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});
