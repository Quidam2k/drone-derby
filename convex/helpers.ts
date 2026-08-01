// Small helpers shared across Convex modules.

import { getAuthUserId } from '@convex-dev/auth/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Id } from './_generated/dataModel';

export async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error('Not signed in');
  return userId;
}

const FLOW_DATA_MAX_JSON_CHARS = 2_048;

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
      context: { source: 'server', ...(gameId ? { gameId } : {}) },
      userId: (await getAuthUserId(ctx)) ?? undefined,
    });
  } catch {
    // Losing a breadcrumb beats breaking the mutation that dropped it.
  }
}
