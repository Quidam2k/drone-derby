// Telemetry sink: browsers report crashes and playtest notes here via the
// public `log` mutation; reading happens out-of-band (dashboard or
// `npx convex run telemetry:recent [--prod]`). Client half:
// src/services/telemetry.ts.

import { v } from 'convex/values';
import { internalQuery, mutation } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';

const MESSAGE_MAX_CHARS = 2_000;
const DATA_MAX_JSON_CHARS = 8_192;

/**
 * Public and auth-optional — crash reporting must work signed-out and must
 * never throw back at a client that is already in trouble.
 */
export const log = mutation({
  args: {
    kind: v.string(),
    message: v.string(),
    data: v.optional(v.any()),
    context: v.any(),
  },
  handler: async (ctx, args) => {
    try {
      const userId = (await getAuthUserId(ctx)) ?? undefined;

      let data = args.data;
      try {
        if (data !== undefined && JSON.stringify(data).length > DATA_MAX_JSON_CHARS) {
          data = { dropped: 'data exceeded size limit' };
        }
      } catch {
        data = { dropped: 'data was not serializable' };
      }

      await ctx.db.insert('telemetry', {
        kind: args.kind,
        message: args.message.slice(0, MESSAGE_MAX_CHARS),
        data,
        context: args.context,
        userId,
      });
    } catch {
      // Swallow everything — losing a telemetry row beats surfacing a new
      // error to a client that was reporting one.
    }
  },
});

/** Last N entries, newest first. Internal: dashboard/CLI only, not browsers. */
export const recent = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('telemetry')
      .order('desc')
      .take(Math.min(args.limit ?? 50, 200));
  },
});
