// Pure board validation, shared by the level editor (live feedback, import
// gate) and — in Phase 6b — Convex's server-side save gate. Deterministic,
// zero dependencies outside the engine. A board is playable iff errors is
// empty; warnings are advisory only.

import type { BoardDef, Direction, Position, TileDef } from './types';
import { DIRECTIONS, inBounds, opposite, step, wallBlocked } from './board';

export const MIN_BOARD_SIZE = 6;
export const MAX_BOARD_SIZE = 24;
export const MIN_SPAWNS = 2;
export const MAX_SPAWNS = 4;

export interface BoardValidation {
  errors: string[];
  warnings: string[];
}

const TILE_KINDS = new Set([
  'floor',
  'pit',
  'trapdoor',
  'radiation',
  'waste',
  'portal',
  'teleporter',
  'repulsor',
  'conveyor',
  'gear',
  'checkpoint',
  'spawn',
  'wrench',
]);

const PORTAL_COLORS = new Set(['red', 'blue', 'green', 'purple', 'orange']);

function isDirection(d: unknown): d is Direction {
  return DIRECTIONS.includes(d as Direction);
}

/** Register schedules (pushers, trap-doors, crushers): non-empty, 1–5. */
function badRegisters(regs: unknown): boolean {
  return (
    !Array.isArray(regs) ||
    regs.length === 0 ||
    regs.some((r) => !Number.isInteger(r) || r < 1 || r > 5)
  );
}

/** Structural sanity of one tile; malformed tiles come from JSON imports. */
function tileError(t: TileDef, x: number, y: number): string | null {
  const at = `tile (${x},${y})`;
  if (!t || typeof t !== 'object' || !TILE_KINDS.has(t.kind)) {
    return `${at} is not a valid tile`;
  }
  if (t.kind === 'pit' && t.style !== undefined && t.style !== 'drain') {
    return `${at}: pit style must be "drain" or absent`;
  }
  if (t.kind === 'trapdoor' && badRegisters(t.registers)) {
    return `${at}: trap-door needs registers from 1–5 (e.g. [1,3,5])`;
  }
  if (t.kind === 'portal' && !PORTAL_COLORS.has(t.color)) {
    return `${at}: portal needs a color (red, blue, green, purple, orange)`;
  }
  if (t.kind === 'conveyor' && (!isDirection(t.dir) || typeof t.express !== 'boolean')) {
    return `${at}: conveyor needs a direction and an express flag`;
  }
  if (t.kind === 'conveyor' && t.curve !== undefined && t.curve !== 'cw' && t.curve !== 'ccw') {
    return `${at}: conveyor curve must be "cw" or "ccw"`;
  }
  if (t.kind === 'gear' && typeof t.cw !== 'boolean') {
    return `${at}: gear needs a spin direction`;
  }
  if ((t.kind === 'checkpoint' || t.kind === 'spawn') && !Number.isInteger(t.n)) {
    return `${at}: ${t.kind} needs an integer number`;
  }
  return null;
}

/** "checkpoints"/"spawns" numbered 1..n, unique and contiguous. */
function numberingErrors(label: string, numbers: number[]): string[] {
  const errors: string[] = [];
  const seen = new Set<number>();
  for (const n of numbers) {
    if (seen.has(n)) errors.push(`duplicate ${label} number ${n}`);
    seen.add(n);
  }
  for (let n = 1; n <= numbers.length; n++) {
    if (!seen.has(n)) errors.push(`missing ${label} number ${n} (must run 1..${numbers.length})`);
  }
  return errors;
}

/** Cells a board laser's beam covers, ignoring robots (emitter cell included). */
function beamPath(board: BoardDef, pos: Position, facing: Direction): Position[] {
  const path: Position[] = [];
  let cur = pos;
  while (inBounds(board, cur)) {
    path.push(cur);
    if (wallBlocked(board, cur, facing)) break;
    cur = step(cur, facing);
  }
  return path;
}

export function validateBoard(board: BoardDef): BoardValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (
    !Number.isInteger(board.width) ||
    !Number.isInteger(board.height) ||
    board.width < MIN_BOARD_SIZE ||
    board.width > MAX_BOARD_SIZE ||
    board.height < MIN_BOARD_SIZE ||
    board.height > MAX_BOARD_SIZE
  ) {
    errors.push(
      `board must be between ${MIN_BOARD_SIZE}×${MIN_BOARD_SIZE} and ` +
        `${MAX_BOARD_SIZE}×${MAX_BOARD_SIZE} (got ${board.width}×${board.height})`,
    );
  }

  if (!Array.isArray(board.tiles) || board.tiles.length !== board.height) {
    errors.push(`tiles must have exactly ${board.height} rows`);
    return { errors, warnings }; // grid unusable — nothing below is meaningful
  }
  for (let y = 0; y < board.tiles.length; y++) {
    if (!Array.isArray(board.tiles[y]) || board.tiles[y].length !== board.width) {
      errors.push(`row ${y} must have exactly ${board.width} tiles`);
      return { errors, warnings };
    }
  }

  const spawns: number[] = [];
  const checkpoints: number[] = [];
  const portalCounts = new Map<string, number>();
  let hazards = 0;
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const t = board.tiles[y][x];
      const err = tileError(t, x, y);
      if (err) {
        errors.push(err);
        continue;
      }
      if (t.kind === 'spawn') spawns.push(t.n);
      if (t.kind === 'checkpoint') checkpoints.push(t.n);
      if (t.kind === 'portal') {
        portalCounts.set(t.color, (portalCounts.get(t.color) ?? 0) + 1);
      }
      if (
        t.kind === 'pit' ||
        t.kind === 'trapdoor' ||
        t.kind === 'radiation' ||
        t.kind === 'waste' ||
        t.kind === 'repulsor' ||
        t.kind === 'conveyor' ||
        t.kind === 'gear'
      ) {
        hazards++;
      }
    }
  }

  if (spawns.length < MIN_SPAWNS || spawns.length > MAX_SPAWNS) {
    errors.push(`need ${MIN_SPAWNS}–${MAX_SPAWNS} spawn docks (got ${spawns.length})`);
  }
  errors.push(...numberingErrors('spawn', spawns));

  if (checkpoints.length === 0) {
    errors.push('need at least 1 checkpoint');
  }
  errors.push(...numberingErrors('checkpoint', checkpoints));

  for (const [color, count] of portalCounts) {
    if (count !== 2) {
      errors.push(`portals come in pairs: ${color} has ${count} (needs exactly 2)`);
    }
  }

  if (!Array.isArray(board.walls)) {
    errors.push('walls must be a list');
  } else {
    for (const w of board.walls) {
      if (!w || !inBounds(board, { x: w.x, y: w.y }) || !isDirection(w.side)) {
        errors.push(`wall at (${w?.x},${w?.y}) side ${w?.side} is out of bounds or malformed`);
        continue;
      }
      if (w.oneWay !== undefined && w.oneWay !== 'in' && w.oneWay !== 'out') {
        errors.push(`wall at (${w.x},${w.y}) side ${w.side}: oneWay must be "in" or "out"`);
      }
    }
  }

  if (!Array.isArray(board.lasers)) {
    errors.push('lasers must be a list');
  } else {
    for (const l of board.lasers) {
      if (!l?.pos || !inBounds(board, l.pos) || !isDirection(l.facing) || !(l.strength >= 1)) {
        errors.push(
          `laser at (${l?.pos?.x},${l?.pos?.y}) is out of bounds or malformed`,
        );
        continue;
      }
      const tile = board.tiles[l.pos.y][l.pos.x];
      if (tile && tile.kind === 'pit') {
        errors.push(`laser emitter at (${l.pos.x},${l.pos.y}) sits on a pit`);
      }
    }
  }

  if (board.pushers !== undefined && !Array.isArray(board.pushers)) {
    errors.push('pushers must be a list');
  } else {
    for (const p of board.pushers ?? []) {
      if (!p?.pos || !inBounds(board, p.pos) || !isDirection(p.facing)) {
        errors.push(`pusher at (${p?.pos?.x},${p?.pos?.y}) is out of bounds or malformed`);
        continue;
      }
      if (badRegisters(p.registers)) {
        errors.push(
          `pusher at (${p.pos.x},${p.pos.y}) needs registers from 1–5 (e.g. [1,3,5])`,
        );
        continue;
      }
      const tile = board.tiles[p.pos.y][p.pos.x];
      if (tile && tile.kind === 'pit') {
        errors.push(`pusher at (${p.pos.x},${p.pos.y}) sits on a pit`);
      }
    }
  }

  if (board.crushers !== undefined && !Array.isArray(board.crushers)) {
    errors.push('crushers must be a list');
  } else {
    for (const c of board.crushers ?? []) {
      if (!c?.pos || !inBounds(board, c.pos)) {
        errors.push(`crusher at (${c?.pos?.x},${c?.pos?.y}) is out of bounds or malformed`);
        continue;
      }
      if (badRegisters(c.registers)) {
        errors.push(
          `crusher at (${c.pos.x},${c.pos.y}) needs registers from 1–5 (e.g. [2,4])`,
        );
        continue;
      }
      const tile = board.tiles[c.pos.y][c.pos.x];
      if (tile && tile.kind === 'pit') {
        errors.push(`crusher at (${c.pos.x},${c.pos.y}) sits over a pit`);
      }
    }
  }

  if (board.flamers !== undefined && !Array.isArray(board.flamers)) {
    errors.push('flamers must be a list');
  } else {
    for (const f of board.flamers ?? []) {
      if (!f?.pos || !inBounds(board, f.pos)) {
        errors.push(`flamer at (${f?.pos?.x},${f?.pos?.y}) is out of bounds or malformed`);
        continue;
      }
      if (badRegisters(f.registers)) {
        errors.push(
          `flamer at (${f.pos.x},${f.pos.y}) needs registers from 1–5 (e.g. [1,2,4])`,
        );
        continue;
      }
      const tile = board.tiles[f.pos.y][f.pos.x];
      if (tile && tile.kind === 'pit') {
        errors.push(`flamer at (${f.pos.x},${f.pos.y}) sits on a pit`);
      }
    }
  }

  if (errors.length > 0) return { errors, warnings };

  // ---- warnings (only worth computing on a structurally sound board) ----

  if (hazards === 0) {
    warnings.push('no pits, conveyors, or gears — the board may play bland');
  }

  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const t = board.tiles[y][x];
      if (t.kind !== 'conveyor' || !t.express) continue;
      // A lone express belt behaves exactly like a normal belt; express only
      // matters within a belt line. Warn when this belt neither feeds a
      // conveyor nor is fed by one.
      const next = step({ x, y }, t.dir);
      const feeds =
        !wallBlocked(board, { x, y }, t.dir) &&
        inBounds(board, next) &&
        board.tiles[next.y][next.x].kind === 'conveyor';
      const fedBy = DIRECTIONS.some((from) => {
        const src = step({ x, y }, from);
        if (!inBounds(board, src)) return false;
        const s = board.tiles[src.y][src.x];
        return s.kind === 'conveyor' && s.dir === opposite(from) && !wallBlocked(board, src, s.dir);
      });
      if (!feeds && !fedBy) {
        warnings.push(
          `express conveyor at (${x},${y}) isn't part of a belt line — express has no effect`,
        );
      }
    }
  }

  for (const l of board.lasers) {
    for (const p of beamPath(board, l.pos, l.facing)) {
      const t = board.tiles[p.y][p.x];
      if (t.kind === 'spawn') {
        warnings.push(`spawn ${t.n} at (${p.x},${p.y}) sits in a board-laser line`);
      }
    }
  }

  // The real fixture sits on a wall; without one it's mechanically harmless
  // but looks like it floats (lenient, like lasers needing no backing wall).
  for (const p of board.pushers ?? []) {
    const mount = opposite(p.facing);
    if (!wallBlocked(board, p.pos, mount)) {
      warnings.push(
        `pusher at (${p.pos.x},${p.pos.y}) has no wall on its ${mount} edge to mount on`,
      );
    }
  }

  return { errors, warnings };
}
