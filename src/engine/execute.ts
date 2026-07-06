import type { Card, Direction, GameState, PlayerId, Position, Program } from './types';
import type { EngineEvent, EventLog } from './events';
import {
  countCheckpoints,
  inBounds,
  opposite,
  rotate,
  samePos,
  step,
  tileAt,
  wallBlocked,
} from './board';
import { dealHands, discardHand, isRegisterLocked, lockedRegisterCount } from './deck';
import { createRng } from './rng';

export const RESPAWN_DAMAGE = 2;
export const ROBOT_LASER_STRENGTH = 1;

export interface TurnResult {
  state: GameState;
  events: EventLog;
}

interface Ctx {
  s: GameState;
  events: EngineEvent[];
  /** Effective card per register this turn (locked card wins over program). */
  effective: Map<PlayerId, (Card | null)[]>;
  /** Highest checkpoint on the board = winning target. */
  target: number;
}

/**
 * Execute one full turn: 5 registers of (robot moves by priority → board
 * elements → lasers → checkpoints → win check), then respawns and the next
 * deal. Pure: the input state is never mutated; same inputs → same outputs.
 *
 * Resolution order per register (docs/game_mechanics_md.md):
 *  a. reveal cards, sort by priority desc; ties broken by seat order
 *     starting from state.startPlayerIndex (rotates each turn)
 *  b. execute each card; moves resolve step-by-step with wall blocking and
 *     chain pushing; pits/edges kill the moment a robot enters/exits
 *  c. express conveyors pulse, then all conveyors pulse, then gears rotate
 *  d. board lasers fire, then all robot lasers fire (simultaneously)
 *  e. checkpoints: touching any updates the archive; claiming must be in order
 *  f. win check: all checkpoints claimed, or last robot standing
 */
export function executeTurn(
  state: GameState,
  programs: Record<PlayerId, Program>,
  seed: number,
): TurnResult {
  if (isGameOver(state)) throw new Error('executeTurn: game is already over');

  const s = structuredClone(state);
  const ctx: Ctx = {
    s,
    events: [],
    effective: new Map(),
    target: countCheckpoints(s.board),
  };

  prepareTurn(ctx, programs);
  emit(ctx, { type: 'turn-started', turn: s.turn });

  for (let register = 1; register <= 5; register++) {
    emit(ctx, { type: 'register-started', register });

    // (a) reveal in acting order
    const order = actingOrder(ctx, register);
    for (const { idx, card } of order) {
      emit(ctx, { type: 'card-revealed', player: s.robots[idx].player, register, card });
    }

    // (b) execute cards; a robot killed earlier in the register skips its card
    for (const { idx, card } of order) {
      if (!isActive(ctx, idx)) continue;
      executeCard(ctx, idx, card);
      if (gameEnded(ctx)) break;
    }
    if (gameEnded(ctx)) break;

    // (c) board elements
    conveyorPulse(ctx, true);
    conveyorPulse(ctx, false);
    rotateGears(ctx);
    if (gameEnded(ctx)) break;

    // (d) lasers
    fireBoardLasers(ctx);
    fireRobotLasers(ctx);
    if (gameEnded(ctx)) break;

    // (e) + (f) checkpoints and win check
    touchCheckpoints(ctx);
    if (gameEnded(ctx)) break;
  }

  if (!gameEnded(ctx)) {
    respawnRobots(ctx);
    cleanUpCards(ctx);
    s.turn += 1;
    s.startPlayerIndex = (s.startPlayerIndex + 1) % s.robots.length;
    dealHands(s, createRng(seed));
  }

  emit(ctx, { type: 'turn-ended', turn: state.turn });
  return { state: s, events: ctx.events };
}

/** Game is over once someone won or every robot is eliminated. */
export function isGameOver(state: GameState): boolean {
  return state.winner !== null || state.robots.every((r) => r.eliminated);
}

function emit(ctx: Ctx, event: EngineEvent): void {
  ctx.events.push(event);
}

function gameEnded(ctx: Ctx): boolean {
  return isGameOver(ctx.s);
}

/** Robot participates in the world: on the board, not fallen, not out. */
function isActive(ctx: Ctx, idx: number): boolean {
  const r = ctx.s.robots[idx];
  return !r.destroyed && !r.eliminated;
}

function robotIndexAt(ctx: Ctx, pos: Position): number {
  return ctx.s.robots.findIndex((r) => !r.destroyed && !r.eliminated && samePos(r.pos, pos));
}

// ---------------------------------------------------------------------------
// Turn preparation: validate programs, take programmed cards out of hands,
// merge with locked registers into the effective program per robot.

function prepareTurn(ctx: Ctx, programs: Record<PlayerId, Program>): void {
  const { s } = ctx;
  for (const robot of s.robots) {
    if (robot.eliminated) continue;
    const program = programs[robot.player];
    if (!program || program.length !== 5) {
      throw new Error(`executeTurn: player ${robot.player} needs a 5-slot program`);
    }
    const hand = s.hands[robot.player];
    const effective: (Card | null)[] = [];
    for (let r = 1; r <= 5; r++) {
      if (isRegisterLocked(robot.damage, r)) {
        effective.push(robot.lockedRegisters[r - 1]);
        continue;
      }
      const card = program[r - 1];
      if (card !== null) {
        const i = hand.findIndex((c) => c.id === card.id);
        if (i === -1) {
          throw new Error(
            `executeTurn: player ${robot.player} programmed ${card.id} which is not in hand`,
          );
        }
        hand.splice(i, 1);
      }
      effective.push(card);
    }
    ctx.effective.set(robot.player, effective);
  }
}

function actingOrder(ctx: Ctx, register: number): { idx: number; card: Card }[] {
  const { s } = ctx;
  const n = s.robots.length;
  const entries: { idx: number; card: Card; seatRank: number }[] = [];
  for (let idx = 0; idx < n; idx++) {
    if (!isActive(ctx, idx)) continue;
    const card = ctx.effective.get(s.robots[idx].player)?.[register - 1] ?? null;
    if (card === null) continue; // idle slot (or empty locked register)
    entries.push({ idx, card, seatRank: (idx - s.startPlayerIndex + n) % n });
  }
  entries.sort((a, b) => b.card.priority - a.card.priority || a.seatRank - b.seatRank);
  return entries;
}

// ---------------------------------------------------------------------------
// Card execution

function executeCard(ctx: Ctx, idx: number, card: Card): void {
  switch (card.type) {
    case 'turnLeft':
      rotateRobot(ctx, idx, -1);
      break;
    case 'turnRight':
      rotateRobot(ctx, idx, 1);
      break;
    case 'uTurn':
      rotateRobot(ctx, idx, 2);
      break;
    case 'move1':
      moveRobot(ctx, idx, 1, false);
      break;
    case 'move2':
      moveRobot(ctx, idx, 2, false);
      break;
    case 'move3':
      moveRobot(ctx, idx, 3, false);
      break;
    case 'backUp':
      moveRobot(ctx, idx, 1, true);
      break;
  }
}

function rotateRobot(ctx: Ctx, idx: number, quarterTurnsCW: number): void {
  const robot = ctx.s.robots[idx];
  const from = robot.facing;
  robot.facing = rotate(from, quarterTurnsCW);
  emit(ctx, { type: 'robot-rotated', player: robot.player, from, to: robot.facing });
}

function moveRobot(ctx: Ctx, idx: number, steps: number, backward: boolean): void {
  for (let i = 0; i < steps; i++) {
    if (!isActive(ctx, idx)) return; // fell into a pit / off the edge mid-move
    const dir = backward ? opposite(ctx.s.robots[idx].facing) : ctx.s.robots[idx].facing;
    if (!tryStep(ctx, idx, dir)) return; // blocked by a wall
  }
}

/**
 * Move one robot one cell in `dir`, chain-pushing any robots in the way.
 * A wall anywhere along the chain blocks the whole chain. Robots pushed
 * over a pit or off the board fall. Returns false only when blocked.
 */
function tryStep(ctx: Ctx, idx: number, dir: Direction): boolean {
  const { s } = ctx;
  const mover = s.robots[idx];
  const chain = [idx];
  let scan = mover.pos;
  for (;;) {
    if (wallBlocked(s.board, scan, dir)) {
      emit(ctx, { type: 'robot-blocked', player: mover.player, at: mover.pos, dir });
      return false;
    }
    const next = step(scan, dir);
    if (!inBounds(s.board, next)) break; // chain head gets shoved off the edge
    const occupant = robotIndexAt(ctx, next);
    if (occupant === -1) break;
    chain.push(occupant);
    scan = next;
  }

  // Move far end first so nobody overlaps mid-shift.
  for (let i = chain.length - 1; i >= 0; i--) {
    const robot = s.robots[chain[i]];
    const from = robot.pos;
    const to = step(from, dir);
    if (!inBounds(s.board, to)) {
      killRobot(ctx, chain[i], { type: 'robot-fell', player: robot.player, cause: 'edge', at: from });
      continue;
    }
    robot.pos = to;
    emit(ctx, { type: 'robot-moved', player: robot.player, from, to, pushed: i > 0 });
    if (tileAt(s.board, to).kind === 'pit') {
      killRobot(ctx, chain[i], { type: 'robot-fell', player: robot.player, cause: 'pit', at: to });
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// Board elements

function conveyorPulse(ctx: Ctx, expressOnly: boolean): void {
  const { s } = ctx;
  interface Proposal {
    idx: number;
    from: Position;
    to: Position;
    express: boolean;
    cancelled: boolean;
  }
  const proposals: Proposal[] = [];
  for (let idx = 0; idx < s.robots.length; idx++) {
    if (!isActive(ctx, idx)) continue;
    const pos = s.robots[idx].pos;
    const tile = tileAt(s.board, pos);
    if (tile.kind !== 'conveyor') continue;
    if (expressOnly && !tile.express) continue;
    if (wallBlocked(s.board, pos, tile.dir)) continue;
    proposals.push({
      idx,
      from: pos,
      to: step(pos, tile.dir),
      express: tile.express,
      cancelled: false,
    });
  }

  const live = () => proposals.filter((p) => !p.cancelled);
  const hasLiveProposal = (idx: number) => live().some((p) => p.idx === idx);

  // Cancel until stable: converging robots, head-on swaps, and moves into a
  // robot that is not itself moving all stay put.
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of live()) {
      const blockerIdx = robotIndexAt(ctx, p.to);
      if (blockerIdx !== -1 && blockerIdx !== p.idx && !hasLiveProposal(blockerIdx)) {
        p.cancelled = true;
        changed = true;
        continue;
      }
      const rival = live().find((q) => q !== p && samePos(q.to, p.to));
      if (rival) {
        p.cancelled = true;
        rival.cancelled = true;
        changed = true;
        continue;
      }
      const swapper = live().find(
        (q) => q !== p && samePos(q.to, p.from) && samePos(p.to, q.from),
      );
      if (swapper) {
        p.cancelled = true;
        swapper.cancelled = true;
        changed = true;
      }
    }
  }

  // Survivors have distinct destinations; apply simultaneously.
  for (const p of live()) {
    const robot = s.robots[p.idx];
    if (!inBounds(s.board, p.to)) {
      killRobot(ctx, p.idx, { type: 'robot-fell', player: robot.player, cause: 'edge', at: p.from });
      continue;
    }
    robot.pos = p.to;
    emit(ctx, {
      type: 'conveyor-moved',
      player: robot.player,
      from: p.from,
      to: p.to,
      express: p.express,
    });
    if (tileAt(s.board, p.to).kind === 'pit') {
      killRobot(ctx, p.idx, { type: 'robot-fell', player: robot.player, cause: 'pit', at: p.to });
    }
  }
}

function rotateGears(ctx: Ctx): void {
  const { s } = ctx;
  for (let idx = 0; idx < s.robots.length; idx++) {
    if (!isActive(ctx, idx)) continue;
    const robot = s.robots[idx];
    const tile = tileAt(s.board, robot.pos);
    if (tile.kind !== 'gear') continue;
    const from = robot.facing;
    robot.facing = rotate(from, tile.cw ? 1 : -1);
    emit(ctx, { type: 'gear-rotated', player: robot.player, cw: tile.cw, from, to: robot.facing });
  }
}

// ---------------------------------------------------------------------------
// Lasers and damage

/** Trace a beam; returns cells crossed and the index of the robot hit (-1 if none). */
function traceBeam(
  ctx: Ctx,
  start: Position,
  dir: Direction,
  includeStart: boolean,
): { path: Position[]; hit: number } {
  const { s } = ctx;
  const path: Position[] = [];
  let cur = start;
  if (includeStart) {
    path.push(cur);
    const hit = robotIndexAt(ctx, cur);
    if (hit !== -1) return { path, hit };
  }
  for (;;) {
    if (wallBlocked(s.board, cur, dir)) break;
    const next = step(cur, dir);
    if (!inBounds(s.board, next)) break;
    cur = next;
    path.push(cur);
    const hit = robotIndexAt(ctx, cur);
    if (hit !== -1) return { path, hit };
  }
  return { path, hit: -1 };
}

function fireBoardLasers(ctx: Ctx): void {
  for (const laser of ctx.s.board.lasers) {
    const { path, hit } = traceBeam(ctx, laser.pos, laser.facing, true);
    emit(ctx, {
      type: 'laser-fired',
      source: 'board',
      path,
      hit: hit === -1 ? undefined : ctx.s.robots[hit].player,
      strength: laser.strength,
    });
    if (hit !== -1) applyDamage(ctx, hit, laser.strength);
  }
}

function fireRobotLasers(ctx: Ctx): void {
  const { s } = ctx;
  // All robots fire simultaneously: trace every beam before applying damage.
  const shots: { shooter: number; path: Position[]; hit: number }[] = [];
  for (let idx = 0; idx < s.robots.length; idx++) {
    if (!isActive(ctx, idx)) continue;
    const robot = s.robots[idx];
    shots.push({ shooter: idx, ...traceBeam(ctx, robot.pos, robot.facing, false) });
  }
  for (const shot of shots) {
    emit(ctx, {
      type: 'laser-fired',
      source: 'robot',
      shooter: s.robots[shot.shooter].player,
      path: shot.path,
      hit: shot.hit === -1 ? undefined : s.robots[shot.hit].player,
      strength: ROBOT_LASER_STRENGTH,
    });
  }
  for (const shot of shots) {
    if (shot.hit !== -1) applyDamage(ctx, shot.hit, ROBOT_LASER_STRENGTH);
  }
}

function applyDamage(ctx: Ctx, idx: number, amount: number): void {
  const robot = ctx.s.robots[idx];
  if (robot.destroyed || robot.eliminated) return;
  const before = robot.damage;
  robot.damage = Math.min(10, robot.damage + amount);
  emit(ctx, { type: 'damage', player: robot.player, amount, total: robot.damage });

  if (robot.damage >= 10) {
    killRobot(ctx, idx, { type: 'robot-destroyed', player: robot.player, at: robot.pos });
    return;
  }

  // Registers lock from 5 downward as damage crosses 5, 6, 7, 8. A register
  // locks with the card it holds THIS turn, which then repeats every turn
  // until the lock clears (only via destruction/respawn — no repair in MVP).
  const wasLocked = lockedRegisterCount(before);
  const nowLocked = lockedRegisterCount(robot.damage);
  const effective = ctx.effective.get(robot.player);
  for (let k = wasLocked + 1; k <= nowLocked; k++) {
    const register = 6 - k; // k-th lock claims register 5, then 4, ...
    const card = effective?.[register - 1] ?? null;
    robot.lockedRegisters[register - 1] = card;
    emit(ctx, { type: 'register-locked', player: robot.player, register, card });
  }
}

// ---------------------------------------------------------------------------
// Death, elimination, respawn

/**
 * Shared death path for pits, edges, and 10-damage destruction. `causeEvent`
 * (robot-fell or robot-destroyed) is emitted first, then life-lost and, if
 * out of lives, player-eliminated. Locked-register cards return to the
 * discard pile via cleanUpCards (nothing stays locked through death).
 */
function killRobot(ctx: Ctx, idx: number, causeEvent: EngineEvent): void {
  const robot = ctx.s.robots[idx];
  emit(ctx, causeEvent);
  robot.destroyed = true;
  robot.lockedRegisters = [null, null, null, null, null];
  robot.lives -= 1;
  emit(ctx, { type: 'life-lost', player: robot.player, remaining: robot.lives });
  if (robot.lives <= 0) {
    robot.eliminated = true;
    emit(ctx, { type: 'player-eliminated', player: robot.player });
    checkLastStanding(ctx);
  }
}

function checkLastStanding(ctx: Ctx): void {
  const { s } = ctx;
  if (s.winner !== null || s.robots.length < 2) return;
  const alive = s.robots.filter((r) => !r.eliminated);
  if (alive.length === 1) {
    s.winner = alive[0].player;
    emit(ctx, { type: 'game-won', player: alive[0].player, reason: 'last-standing' });
  }
}

function touchCheckpoints(ctx: Ctx): void {
  const { s } = ctx;
  for (let idx = 0; idx < s.robots.length; idx++) {
    if (!isActive(ctx, idx)) continue;
    const robot = s.robots[idx];
    const tile = tileAt(s.board, robot.pos);
    if (tile.kind !== 'checkpoint') continue;
    robot.archive = { ...robot.pos }; // any checkpoint updates the respawn point
    if (tile.n === robot.checkpoints + 1) {
      robot.checkpoints = tile.n;
      emit(ctx, { type: 'checkpoint-claimed', player: robot.player, checkpoint: tile.n });
      if (robot.checkpoints === ctx.target && s.winner === null) {
        s.winner = robot.player;
        emit(ctx, { type: 'game-won', player: robot.player, reason: 'checkpoints' });
        return;
      }
    }
  }
}

function respawnRobots(ctx: Ctx): void {
  const { s } = ctx;
  for (let idx = 0; idx < s.robots.length; idx++) {
    const robot = s.robots[idx];
    if (!robot.destroyed || robot.eliminated) continue;
    robot.pos = respawnSpot(ctx, robot.archive);
    robot.facing = 'N'; // deterministic facing for MVP (no chooser yet)
    robot.damage = RESPAWN_DAMAGE;
    robot.destroyed = false;
    emit(ctx, {
      type: 'robot-respawned',
      player: robot.player,
      pos: { ...robot.pos },
      facing: robot.facing,
    });
  }
}

/**
 * The archive cell, or if occupied the nearest free non-pit cell (scanning
 * outward by Manhattan distance, then row-major — deterministic).
 */
function respawnSpot(ctx: Ctx, archive: Position): Position {
  const { s } = ctx;
  const free = (p: Position) =>
    inBounds(s.board, p) && tileAt(s.board, p).kind !== 'pit' && robotIndexAt(ctx, p) === -1;
  if (free(archive)) return { ...archive };
  const maxRadius = s.board.width + s.board.height;
  for (let radius = 1; radius <= maxRadius; radius++) {
    for (let y = archive.y - radius; y <= archive.y + radius; y++) {
      for (let x = archive.x - radius; x <= archive.x + radius; x++) {
        if (Math.abs(x - archive.x) + Math.abs(y - archive.y) !== radius) continue;
        if (free({ x, y })) return { x, y };
      }
    }
  }
  return { ...archive }; // board completely full — should never happen
}

// ---------------------------------------------------------------------------
// End-of-turn card bookkeeping

/**
 * Discard leftover hands and every card played this turn that did not end
 * the turn held by a locked register. Cards that came in locked and are
 * still locked stay on their registers (they are not part of the deck).
 */
function cleanUpCards(ctx: Ctx): void {
  const { s } = ctx;
  for (const robot of s.robots) {
    if (!(robot.player in s.decks)) continue;
    discardHand(s, robot.player);
    const effective = ctx.effective.get(robot.player);
    if (!effective) continue;
    const stillLocked = new Set(
      robot.lockedRegisters.filter((c): c is Card => c !== null).map((c) => c.id),
    );
    for (const card of effective) {
      if (card !== null && !stillLocked.has(card.id)) {
        s.decks[robot.player].discardPile.push(card);
      }
    }
  }
}
