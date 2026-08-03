// Telemetry sink: browsers report crashes, playtest notes and client flow
// events here via the public `log` mutation; game mutations drop server-side
// 'flow' rows via logFlow in ./helpers.ts. Reading happens out-of-band —
// `node scripts/telemetry-digest.mjs [--prod]` for the digest, or
// `npx convex run telemetry:recent [--prod]` for raw rows. Client half:
// src/services/telemetry.ts.

import { v } from 'convex/values';
import { internalMutation, internalQuery, mutation } from './_generated/server';
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

const DIGEST_MAX_ROWS = 4_000;
const DIGEST_VERBATIM_ROWS = 25;
/** Unfinished games inspected for abandonment; each costs one indexed lookup. */
const DIGEST_GAMES_SCANNED = 200;

/**
 * Playtest health report over the last N hours (default 48): errors and 🐞
 * notes verbatim (newest first), counts by kind, the game funnel from the
 * server 'flow' rows, sessions and app versions seen. Pretty-printed by
 * `node scripts/telemetry-digest.mjs [--prod] [--hours N]`.
 */
export const digest = internalQuery({
  args: { hours: v.optional(v.number()), stalledAfterHours: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const hours = args.hours ?? 48;
    const cutoff = Date.now() - hours * 3_600_000;
    // Newest-first, bounded: at friends-playtest volume this is everything;
    // if it ever isn't, the digest covers the newest window and says so.
    const rows = await ctx.db
      .query('telemetry')
      .order('desc')
      .filter((q) => q.gte(q.field('_creationTime'), cutoff))
      .take(DIGEST_MAX_ROWS);

    const countsByKind: Record<string, number> = {};
    const flowCounts: Record<string, number> = {};
    const screenCounts: Record<string, number> = {};
    const sessions = new Set<string>();
    const versions = new Set<string>();
    const games = new Set<string>();
    const errors: unknown[] = [];
    const notes: unknown[] = [];
    // Hot-seat turn failures arrive as kind 'error' from the store's try/catch,
    // not as flow rows, so the hot-seat funnel has to recognise them by message
    // the way the online funnel reads 'turn-error'.
    const HOTSEAT_ERROR_PREFIX = 'hot-seat turn failed';
    let hotseatTurnErrors = 0;

    for (const row of rows) {
      countsByKind[row.kind] = (countsByKind[row.kind] ?? 0) + 1;
      const context = row.context as
        | { sessionId?: string; appVersion?: string; gameId?: string }
        | undefined;
      if (context?.sessionId) sessions.add(context.sessionId);
      if (context?.appVersion) versions.add(context.appVersion);
      if (context?.gameId) games.add(context.gameId);

      const verbatim = {
        at: new Date(row._creationTime).toISOString(),
        kind: row.kind,
        message: row.message,
        data: row.data,
        context: row.context,
      };
      if (row.kind === 'flow') {
        flowCounts[row.message] = (flowCounts[row.message] ?? 0) + 1;
        if (row.message === 'screen') {
          const name = (row.data as { name?: string } | undefined)?.name ?? '(unknown)';
          screenCounts[name] = (screenCounts[name] ?? 0) + 1;
        }
        if (row.message === 'turn-error' && errors.length < DIGEST_VERBATIM_ROWS) {
          errors.push(verbatim);
        }
      } else if (row.kind === 'note') {
        if (notes.length < DIGEST_VERBATIM_ROWS) notes.push(verbatim);
      } else {
        if (row.message.startsWith(HOTSEAT_ERROR_PREFIX)) hotseatTurnErrors++;
        // error / unhandledrejection / react-error — anything not flow/note.
        if (errors.length < DIGEST_VERBATIM_ROWS) errors.push(verbatim);
      }
    }

    /**
     * Abandonment, read from the `games` table rather than from the telemetry
     * rows above. A game started before the digest window emits no row inside
     * it, so counting from telemetry alone would report an abandoned game as
     * absent — under-reporting, which is the one direction that matters here.
     * The tables always know the truth regardless of window.
     */
    const stalledAfterHours = args.stalledAfterHours ?? 24;
    const staleBefore = Date.now() - stalledAfterHours * 3_600_000;
    const liveGames = await ctx.db
      .query('games')
      .order('desc')
      .filter((q) => q.neq(q.field('status'), 'finished'))
      .take(DIGEST_GAMES_SCANNED);

    let lobbyNeverStarted = 0;
    let activeStalled = 0;
    let activeHealthy = 0;
    const stalledSample: unknown[] = [];
    for (const game of liveGames) {
      // Last sign of life: the most recent executed turn, or failing that the
      // moment the game was created.
      const lastTurn = await ctx.db
        .query('turns')
        .withIndex('by_game_turn', (q) => q.eq('gameId', game._id))
        .order('desc')
        .first();
      const lastActivityAt = Math.max(lastTurn?.executedAt ?? 0, game._creationTime);
      const stale = lastActivityAt < staleBefore;
      if (!stale) {
        activeHealthy++;
        continue;
      }
      if (game.status === 'lobby') lobbyNeverStarted++;
      else activeStalled++;
      if (stalledSample.length < DIGEST_VERBATIM_ROWS) {
        stalledSample.push({
          gameId: game._id,
          status: game.status,
          boardName: game.boardName,
          turn: game.currentTurn,
          lastActivity: new Date(lastActivityAt).toISOString(),
        });
      }
    }

    return {
      hours,
      rowsScanned: rows.length,
      truncated: rows.length === DIGEST_MAX_ROWS,
      countsByKind,
      funnel: {
        created: flowCounts['game-created'] ?? 0,
        joined: flowCounts['game-joined'] ?? 0,
        started: flowCounts['game-started'] ?? 0,
        programsSubmitted: flowCounts['program-submitted'] ?? 0,
        turnsExecuted: flowCounts['turn-executed'] ?? 0,
        turnErrors: flowCounts['turn-error'] ?? 0,
        finished: flowCounts['game-finished'] ?? 0,
        nudges: flowCounts['nudge'] ?? 0,
      },
      /**
       * Hot-seat is the mode Todd describes himself using and it emitted
       * nothing at all before P3, so this funnel starts at zero for every
       * window that predates the deploy carrying it.
       */
      hotseatFunnel: {
        started: flowCounts['hotseat-game-started'] ?? 0,
        turnsExecuted: flowCounts['hotseat-turn-executed'] ?? 0,
        turnErrors: hotseatTurnErrors,
        replaysWatched: flowCounts['replay-watched'] ?? 0,
        finished: flowCounts['hotseat-game-finished'] ?? 0,
      },
      abandonment: {
        stalledAfterHours,
        scanned: liveGames.length,
        truncated: liveGames.length === DIGEST_GAMES_SCANNED,
        lobbyNeverStarted,
        activeStalled,
        activeHealthy,
        sample: stalledSample,
      },
      clientFlow: {
        rendererFallbacks: flowCounts['renderer-fallback'] ?? 0,
        pushSubscribeFailures: flowCounts['push-subscribe-failed'] ?? 0,
        pwaInstalls: flowCounts['pwa-installed'] ?? 0,
        swUpdatesApplied: flowCounts['sw-update-applied'] ?? 0,
        webglContextLost: flowCounts['webgl-context-lost'] ?? 0,
      },
      gamesTouched: games.size,
      /**
       * The denominator, and deliberately NOT the same number as sessionsSeen.
       * `appOpens` counts page loads that reported one; `sessionsSeen` counts
       * distinct session ids observed on ANY row, including server rows a
       * client stamped. appOpens < sessionsSeen means rows are arriving from
       * sessions whose own opening beacon never landed, which is a signal in
       * itself rather than a rounding difference.
       */
      appOpens: flowCounts['app-open'] ?? 0,
      sessionsSeen: sessions.size,
      screens: screenCounts,
      versionsSeen: [...versions].sort(),
      errors,
      notes,
    };
  },
});

/**
 * Manual pruning between playtest rounds:
 * `npx convex run telemetry:clear '{"olderThanDays": 7}' [--prod]`.
 * Default 0 wipes everything. Bounded per run — rerun if it reports full.
 */
export const clear = internalMutation({
  args: { olderThanDays: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const cutoff = Date.now() - (args.olderThanDays ?? 0) * 86_400_000;
    const rows = await ctx.db
      .query('telemetry')
      .filter((q) => q.lt(q.field('_creationTime'), cutoff))
      .take(DIGEST_MAX_ROWS);
    for (const row of rows) await ctx.db.delete(row._id);
    return { deleted: rows.length, mayHaveMore: rows.length === DIGEST_MAX_ROWS };
  },
});
