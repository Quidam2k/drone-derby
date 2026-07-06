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
  }).index('by_inviteCode', ['inviteCode']),

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
    executedAt: v.number(),
  }).index('by_game_turn', ['gameId', 'turn']),

  submissions: defineTable({
    gameId: v.id('games'),
    turn: v.number(),
    playerId: v.id('players'),
    /** Server-validated Program; never returned by queries to other players. */
    program: v.any(),
  })
    .index('by_game_turn', ['gameId', 'turn'])
    .index('by_game_turn_player', ['gameId', 'turn', 'playerId']),
});
