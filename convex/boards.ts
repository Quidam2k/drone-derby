// Custom board persistence (level editor "Save online"). Boards are gated
// server-side by the same pure validateBoard the editor uses live — only
// playable boards get saved. All access is creator-only in 6b; sharing is
// a later phase.

import { v } from 'convex/values';
import { mutation, query } from './_generated/server';
import { getAuthUserId } from '@convex-dev/auth/server';
import { requireUserId } from './helpers';
import { validateBoard } from '../src/engine';
import type { BoardDef } from '../src/engine';

const MAX_BOARDS_PER_USER = 50;
const NAME_MAX_LENGTH = 40;

/** Insert a new board, or update one of the caller's own when boardId given. */
export const save = mutation({
  args: { boardId: v.optional(v.id('boards')), board: v.any() },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);

    const board = args.board as BoardDef;
    const name = typeof board.name === 'string' ? board.name.trim() : '';
    if (name.length === 0 || name.length > NAME_MAX_LENGTH) {
      throw new Error(`Board name must be 1–${NAME_MAX_LENGTH} characters`);
    }
    board.name = name;

    const { errors } = validateBoard(board);
    if (errors.length > 0) throw new Error(`Board is not playable: ${errors[0]}`);

    if (args.boardId) {
      const existing = await ctx.db.get(args.boardId);
      if (!existing || existing.createdBy !== userId) throw new Error('Board not found');
      await ctx.db.patch(args.boardId, { name, board, updatedAt: Date.now() });
      return { boardId: args.boardId };
    }

    const mine = await ctx.db
      .query('boards')
      .withIndex('by_creator', (q) => q.eq('createdBy', userId))
      .collect();
    if (mine.length >= MAX_BOARDS_PER_USER) {
      throw new Error(`Board limit reached (${MAX_BOARDS_PER_USER}) — delete an old one first`);
    }

    const boardId = await ctx.db.insert('boards', {
      name,
      createdBy: userId,
      board,
      updatedAt: Date.now(),
    });
    return { boardId };
  },
});

export const remove = mutation({
  args: { boardId: v.id('boards') },
  handler: async (ctx, args) => {
    const userId = await requireUserId(ctx);
    const board = await ctx.db.get(args.boardId);
    if (!board || board.createdBy !== userId) throw new Error('Board not found');
    await ctx.db.delete(args.boardId);
  },
});

/** Light summaries of the caller's boards, newest-edited first. */
export const myBoards = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return [];
    const boards = await ctx.db
      .query('boards')
      .withIndex('by_creator', (q) => q.eq('createdBy', userId))
      .collect();
    return boards
      .map((b) => {
        const def = b.board as BoardDef;
        return {
          boardId: b._id,
          name: b.name,
          width: def.width,
          height: def.height,
          updatedAt: b.updatedAt,
        };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  },
});

/** Full BoardDef of one of the caller's own boards; null if missing/foreign. */
export const get = query({
  args: { boardId: v.id('boards') },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) return null;
    const board = await ctx.db.get(args.boardId);
    if (!board || board.createdBy !== userId) return null;
    return { boardId: board._id, name: board.name, board: board.board as BoardDef };
  },
});
