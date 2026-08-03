// Small helpers shared across Convex modules.

import { getAuthUserId } from '@convex-dev/auth/server';
import { v } from 'convex/values';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';

export async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error('Not signed in');
  return userId;
}

const FLOW_DATA_MAX_JSON_CHARS = 2_048;

/**
 * Build stamp + page-load id of the client that triggered a mutation. The
 * server cannot know either, so the client sends them: without this a client
 * crash cannot be joined to the server turn that caused it, and a server-side
 * error cannot be attributed to the deploy that produced it. Optional so an
 * older cached bundle keeps working — losing the stamp beats rejecting the
 * mutation.
 */
export const clientStampValidator = v.optional(
  v.object({ appVersion: v.string(), sessionId: v.string() }),
);

export type ClientStamp = { appVersion: string; sessionId: string } | undefined;

/**
 * Server-side game-flow breadcrumb into the shared `telemetry` table
 * (kind 'flow'). Fire-and-forget semantics inside a mutation: the whole
 * body is try/caught so a telemetry hiccup can never fail — or roll back
 * feelings about — the gameplay mutation it decorates. Callers must never
 * pass hands or decks in `data`.
 */
export async function logFlow(
  ctx: MutationCtx,
  event: string,
  data?: Record<string, unknown>,
  gameId?: Id<'games'>,
  client?: ClientStamp,
): Promise<void> {
  try {
    let clean: unknown = data;
    try {
      if (clean !== undefined && JSON.stringify(clean).length > FLOW_DATA_MAX_JSON_CHARS) {
        clean = { dropped: 'data exceeded size limit' };
      }
    } catch {
      clean = { dropped: 'data was not serializable' };
    }
    await ctx.db.insert('telemetry', {
      kind: 'flow',
      message: event,
      data: clean,
      // appVersion/sessionId are spread flat so a server row's context has the
      // same shape as a client row's — the digest and any join key read one
      // field name, not two.
      context: { source: 'server', ...(gameId ? { gameId } : {}), ...(client ?? {}) },
      userId: (await getAuthUserId(ctx)) ?? undefined,
    });
  } catch {
    // Losing a breadcrumb beats breaking the mutation that dropped it.
  }
}
