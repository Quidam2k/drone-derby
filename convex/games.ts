// Multiplayer game lifecycle. The pure engine in ../src/engine runs here
// verbatim (Convex bundles it); the server is authoritative — clients only
// ever see sanitized state (own hand, no decks) and the public EventLog.

import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import type { MutationCtx, QueryCtx } from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { getAuthUserId } from '@convex-dev/auth/server';
import {
  createGame as engineCreateGame,
  executeTurn,
  isGameOver,
  isRegisterLocked,
  provingGrounds,
} from '../src/engine';
import type { Card, GameState, PlayerId, Program } from '../src/engine';

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 4;
const BOARD_NAME = 'Proving Grounds';

const cardValidator = v.object({
  id: v.string(),
  type: v.union(
    v.literal('move1'),
    v.literal('move2'),
    v.literal('move3'),
    v.literal('backUp'),
    v.literal('turnLeft'),
    v.literal('turnRight'),
    v.literal('uTurn'),
  ),
  priority: v.number(),
});
const programValidator = v.array(v.union(v.null(), cardValidator));

// ---------------------------------------------------------------------------
// Helpers

async function requireUserId(ctx: QueryCtx | MutationCtx): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx);
  if (userId === null) throw new Error('Not signed in');
  return userId;
}

async function playerFor(
  ctx: QueryCtx | MutationCtx,
  gameId: Id<'games'>,
  userId: Id<'users'>,
): Promise<Doc<'players'> | null> {
  return await ctx.db
    .query('players')
    .withIndex('by_game_user', (q) => q.eq('gameId', gameId).eq('userId', userId))
    .unique();
}

async function gamePlayers(
  ctx: QueryCtx | MutationCtx,
  gameId: Id<'games'>,
): Promise<Doc<'players'>[]> {
  const players = await ctx.db
    .query('players')
    .withIndex('by_game', (q) => q.eq('gameId', gameId))
    .collect();
  return players.sort((a, b) => a.seat - b.seat);
}

async function turnSubmissions(
  ctx: QueryCtx | MutationCtx,
  gameId: Id<'games'>,
  turn: number,
): Promise<Doc<'submissions'>[]> {
  return await ctx.db
    .query('submissions')
    .withIndex('by_game_turn', (q) => q.eq('gameId', gameId).eq('turn', turn))
    .collect();
}

/**
 * Strip secrets from an engine GameState before it leaves the server:
 * decks are server-only, and only the caller's own hand survives. The
 * board renderer and ReplayPlayer only read robots/board/winner, and
 * ProgrammingView only reads the caller's hand, so nothing else is needed.
 */
function sanitizeState(state: GameState, myName: PlayerId | null): GameState {
  const hands: Record<PlayerId, Card[]> = {};
  if (myName !== null && state.hands[myName]) hands[myName] = state.hands[myName];
  return { ...state, decks: {}, hands };
}

/** Names of not-yet-submitted, still-alive players for the current turn. */
function waitingOnNames(
  state: GameState,
  players: Doc<'players'>[],
  submissions: Doc<'submissions'>[],
): string[] {
  const submitted = new Set(submissions.map((s) => s.playerId));
  return players
    .filter((p) => {
      const robot = state.robots.find((r) => r.player === p.name);
      return robot && !robot.eliminated && !submitted.has(p._id);
    })
    .map((p) => p.name);
}

function cleanName(raw: string): string {
  const name = raw.trim();
  if (name.length === 0 || name.length > 16) {
    throw new Error('Name must be 1–16 characters');
  }
  return name;
}

// Unambiguous lowercase alphabet (no 0/o, 1/l/i) for invite codes.
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789';

function randomInviteCode(): string {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

// ---------------------------------------------------------------------------
// Mutations

export const createGame = mutation({
  args: { name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const name = cleanName(args.name);

    let inviteCode = randomInviteCode();
    while (
      await ctx.db
        .query('games')
        .withIndex('by_inviteCode', (q) => q.eq('inviteCode', inviteCode))
        .unique()
    ) {
      inviteCode = randomInviteCode();
    }

    const gameId = await ctx.db.insert('games', {
      boardName: BOARD_NAME,
      seed: Math.floor(Math.random() * 1_000_000_000),
      status: 'lobby',
      inviteCode,
      createdBy: userId,
      currentTurn: 0,
    });
    await ctx.db.insert('players', { gameId, userId, name, seat: 0, lastSeenTurn: 0 });
    return { gameId, inviteCode };
  },
});

export const joinGame = mutation({
  args: { inviteCode: v.string(), name: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const game = await ctx.db
      .query('games')
      .withIndex('by_inviteCode', (q) => q.eq('inviteCode', args.inviteCode.toLowerCase().trim()))
      .unique();
    if (!game) throw new Error('No game found for that invite code');

    // Already in the game (any status): just go there.
    const existing = await playerFor(ctx, game._id, userId);
    if (existing) return { gameId: game._id };

    if (game.status !== 'lobby') throw new Error('That game has already started');
    const players = await gamePlayers(ctx, game._id);
    if (players.length >= MAX_PLAYERS) throw new Error('That game is full (4 players max)');

    const name = cleanName(args.name);
    if (players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      throw new Error(`The name "${name}" is taken in this game`);
    }

    await ctx.db.insert('players', {
      gameId: game._id,
      userId,
      name,
      seat: players.length,
      lastSeenTurn: 0,
    });
    return { gameId: game._id };
  },
});

export const startGame = mutation({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error('Game not found');
    if (game.createdBy !== userId) throw new Error('Only the host can start the game');
    if (game.status !== 'lobby') throw new Error('Game already started');

    const players = await gamePlayers(ctx, game._id);
    if (players.length < MIN_PLAYERS) throw new Error('Need at least 2 players');

    const state = engineCreateGame(
      provingGrounds(),
      players.map((p) => p.name),
      game.seed,
    );
    await ctx.db.patch(game._id, { status: 'active', currentTurn: 1, state });
  },
});

export const submitProgram = mutation({
  args: { gameId: v.id('games'), program: programValidator },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const game = await ctx.db.get(args.gameId);
    if (!game || game.status !== 'active' || !game.state) {
      throw new Error('Game is not accepting programs');
    }
    const me = await playerFor(ctx, game._id, userId);
    if (!me) throw new Error('You are not in this game');

    const state = game.state as GameState;
    const robot = state.robots.find((r) => r.player === me.name);
    if (!robot || robot.eliminated) throw new Error('Your robot is out of the game');

    // Rebuild the program from the server-held hand: the client only chooses
    // WHICH cards go where; card contents come from our copy. Locked slots
    // are forced to null (the engine plays the locked card regardless).
    if (args.program.length !== 5) throw new Error('Program must have 5 registers');
    const hand = state.hands[me.name] ?? [];
    const used = new Set<string>();
    const program: Program = args.program.map((slot, i) => {
      if (isRegisterLocked(robot.damage, i + 1) || slot === null) return null;
      const card = hand.find((c) => c.id === slot.id);
      if (!card) throw new Error(`Card ${slot.id} is not in your hand`);
      if (used.has(card.id)) throw new Error(`Card ${slot.id} used twice`);
      used.add(card.id);
      return card;
    });

    const turn = game.currentTurn;
    const prior = await ctx.db
      .query('submissions')
      .withIndex('by_game_turn_player', (q) =>
        q.eq('gameId', game._id).eq('turn', turn).eq('playerId', me._id),
      )
      .unique();
    if (prior) {
      await ctx.db.patch(prior._id, { program });
    } else {
      await ctx.db.insert('submissions', { gameId: game._id, turn, playerId: me._id, program });
    }

    // Last active player in? Execute the turn authoritatively.
    const players = await gamePlayers(ctx, game._id);
    const submissions = await turnSubmissions(ctx, game._id, turn);
    if (waitingOnNames(state, players, submissions).length > 0) return;

    const byPlayerId = new Map(players.map((p) => [p._id, p.name]));
    const programs: Record<PlayerId, Program> = {};
    for (const sub of submissions) {
      const name = byPlayerId.get(sub.playerId);
      if (name !== undefined) programs[name] = sub.program as Program;
    }

    const result = executeTurn(state, programs, game.seed + turn);
    await ctx.db.insert('turns', {
      gameId: game._id,
      turn,
      prevState: state,
      events: result.events,
      executedAt: Date.now(),
    });
    const finished = isGameOver(result.state);
    await ctx.db.patch(game._id, {
      state: result.state,
      currentTurn: turn + 1,
      ...(finished ? { status: 'finished' as const, winner: result.state.winner } : {}),
    });
  },
});

export const markTurnSeen = mutation({
  args: { gameId: v.id('games'), turn: v.number() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const game = await ctx.db.get(args.gameId);
    if (!game) throw new Error('Game not found');
    const me = await playerFor(ctx, game._id, userId);
    if (!me) throw new Error('You are not in this game');
    const seen = Math.min(Math.max(me.lastSeenTurn, args.turn), game.currentTurn - 1);
    if (seen !== me.lastSeenTurn) await ctx.db.patch(me._id, { lastSeenTurn: seen });
  },
});

// ---------------------------------------------------------------------------
// Queries

export const myGames = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const memberships = await ctx.db
      .query('players')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .collect();

    const out = [];
    for (const me of memberships) {
      const game = await ctx.db.get(me.gameId);
      if (!game) continue;
      const players = await gamePlayers(ctx, game._id);
      let waitingOn: string[] = [];
      if (game.status === 'active' && game.state) {
        const submissions = await turnSubmissions(ctx, game._id, game.currentTurn);
        waitingOn = waitingOnNames(game.state as GameState, players, submissions);
      }
      out.push({
        gameId: game._id,
        createdAt: game._creationTime,
        boardName: game.boardName,
        status: game.status,
        currentTurn: game.currentTurn,
        playerNames: players.map((p) => p.name),
        myName: me.name,
        winner: game.winner ?? null,
        waitingOn,
        unseenTurns: Math.max(0, game.currentTurn - 1 - me.lastSeenTurn),
      });
    }
    return out.sort((a, b) => b.createdAt - a.createdAt);
  },
});

/** Public lobby preview for the #/join/<code> page (pre-membership). */
export const gameByInvite = query({
  args: { inviteCode: v.string() },
  handler: async (ctx, args) => {
    const game = await ctx.db
      .query('games')
      .withIndex('by_inviteCode', (q) => q.eq('inviteCode', args.inviteCode.toLowerCase().trim()))
      .unique();
    if (!game) return null;
    const players = await gamePlayers(ctx, game._id);
    const userId = await getAuthUserId(ctx);
    return {
      gameId: game._id,
      boardName: game.boardName,
      status: game.status,
      playerNames: players.map((p) => p.name),
      full: players.length >= MAX_PLAYERS,
      alreadyJoined: userId !== null && players.some((p) => p.userId === userId),
    };
  },
});

/** Everything one member needs to render a game; hands are caller-scoped. */
export const game = query({
  args: { gameId: v.id('games') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const game = await ctx.db.get(args.gameId);
    if (!game) return null;
    const me = await playerFor(ctx, game._id, userId);
    if (!me) return null;

    const players = await gamePlayers(ctx, game._id);
    const state = game.state as GameState | undefined;
    const submissions =
      game.status === 'active'
        ? await turnSubmissions(ctx, game._id, game.currentTurn)
        : [];
    const submitted = new Set(submissions.map((s) => s.playerId));

    return {
      gameId: game._id,
      boardName: game.boardName,
      status: game.status,
      inviteCode: game.inviteCode,
      currentTurn: game.currentTurn,
      winner: game.winner ?? null,
      isHost: game.createdBy === userId,
      mySeat: me.seat,
      myName: me.name,
      myLastSeenTurn: me.lastSeenTurn,
      mySubmitted: submitted.has(me._id),
      players: players.map((p) => ({
        name: p.name,
        seat: p.seat,
        isHost: p.userId === game.createdBy,
        submitted: submitted.has(p._id),
      })),
      waitingOn: state ? waitingOnNames(state, players, submissions) : [],
      state: state ? sanitizeState(state, me.name) : null,
    };
  },
});

/** One executed turn for replay; prevState is sanitized (no hands/decks). */
export const turn = query({
  args: { gameId: v.id('games'), turn: v.number() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const me = await playerFor(ctx, args.gameId, userId);
    if (!me) return null;

    const row = await ctx.db
      .query('turns')
      .withIndex('by_game_turn', (q) => q.eq('gameId', args.gameId).eq('turn', args.turn))
      .unique();
    if (!row) return null;
    return {
      turn: row.turn,
      executedAt: row.executedAt,
      events: row.events,
      prevState: sanitizeState(row.prevState as GameState, null),
    };
  },
});
