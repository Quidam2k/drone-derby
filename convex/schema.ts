import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';
import { authTables } from '@convex-dev/auth/server';

// GameState / EventLog / Program are the engine's JSON types; they're stored
// opaquely (v.any) — the engine is the schema authority, and queries are
// responsible for stripping secrets (hands/decks) before returning state.
export default defineSchema({
  ...authTables,

  games: defineTable({
    boardName: v.string(),
    seed: v.number(),
    status: v.union(v.literal('lobby'), v.literal('active'), v.literal('finished')),
    inviteCode: v.string(),
    createdBy: v.id('users'),
    /** 1-based turn currently being programmed; 0 while in the lobby. */
    currentTurn: v.number(),
    winner: v.optional(v.union(v.string(), v.null())),
    /** Current authoritative engine GameState; absent until the host starts. */
    state: v.optional(v.any()),
    /**
     * BoardDef snapshot taken at createGame for custom-board games; absent
     * means the built-in board. Later edits/deletes of the source board
     * never touch this game.
     */
    board: v.optional(v.any()),
    /** When the last nudge push went out — rate-limits games.nudge. */
    lastNudgeAt: v.optional(v.number()),
  }).index('by_inviteCode', ['inviteCode']),

  /** Player-made boards (level editor). `board` is an engine BoardDef. */
  boards: defineTable({
    name: v.string(),
    createdBy: v.id('users'),
    board: v.any(),
    updatedAt: v.number(),
  }).index('by_creator', ['createdBy']),

  players: defineTable({
    gameId: v.id('games'),
    userId: v.id('users'),
    /** Display name; doubles as the engine PlayerId — unique within a game. */
    name: v.string(),
    seat: v.number(),
    /** Last executed turn this player has watched; drives auto-replay. */
    lastSeenTurn: v.number(),
  })
    .index('by_game', ['gameId'])
    .index('by_user', ['userId'])
    .index('by_game_user', ['gameId', 'userId']),

  turns: defineTable({
    gameId: v.id('games'),
    turn: v.number(),
    /** GameState the turn started from — exactly what ReplayPlayer needs. */
    prevState: v.any(),
    /** EventLog emitted by executeTurn. */
    events: v.any(),
    /** Speech-bubble lines submitted with this turn's programs, by player name. */
    taunts: v.optional(v.any()),
    executedAt: v.number(),
  }).index('by_game_turn', ['gameId', 'turn']),

  pushSubscriptions: defineTable({
    userId: v.id('users'),
    /** Push-service URL; the natural dedupe key (one row per browser). */
    endpoint: v.string(),
    /** Encryption keys from PushSubscription.toJSON(), as web-push wants them. */
    keys: v.object({ p256dh: v.string(), auth: v.string() }),
  })
    .index('by_user', ['userId'])
    .index('by_endpoint', ['endpoint']),

  submissions: defineTable({
    gameId: v.id('games'),
    turn: v.number(),
    playerId: v.id('players'),
    /** Server-validated Program; never returned by queries to other players. */
    program: v.any(),
    /** Optional speech-bubble line, shown over the robot in the turn replay. */
    taunt: v.optional(v.string()),
  })
    .index('by_game_turn', ['gameId', 'turn'])
    .index('by_game_turn_player', ['gameId', 'turn', 'playerId']),
});
