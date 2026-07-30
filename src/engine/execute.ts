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
  twinPortal,
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

/**
 * Optional per-player choices riding the turn's program submissions.
 * Each is gated by a RobotState flag, so stale or bogus entries are inert.
 */
export interface TurnChoices {
  /** Re-entry facing for just-respawned robots (Phase 32); applied at turn start. */
  respawnFacing?: Record<PlayerId, Direction>;
  /**
   * Players announcing a power-down (robot is down NEXT turn) or — if their
   * robot is already down — staying down another turn. A robot down this
   * turn whose player is NOT named wakes at end of turn.
   */
  powerDown?: PlayerId[];
}

interface Ctx {
  s: GameState;
  events: EngineEvent[];
  /** Effective card per register this turn (locked card wins over program). */
  effective: Map<PlayerId, (Card | null)[]>;
  /** Highest checkpoint on the board = winning target. */
  target: number;
  /** Register currently executing (1–5); 0 outside the register loop. Lets
   * movement treat scheduled hazards (trap-doors) as live mid-move. */
  register: number;
  /**
   * True while a movement card is executing (the printed Robots Move
   * segment). Gates the elements that only react to card-driven movement:
   * flamer move-through burns, portals, repulsor fields. Belt pulses and
   * pusher pistons (Board Elements) leave it false.
   */
  cardMove: boolean;
  /** Squares on the executing movement card — the repulsor fling distance. */
  cardValue: number;
  /** True while a repulsor fling is in flight: field-driven movement burns
   * flamers but re-triggers neither portals nor other repulsors. */
  repulsing: boolean;
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
 *  c. express conveyors pulse, then all conveyors pulse, then pushers fire
 *     (on their listed registers), then gears rotate, then crushers slam
 *     (on their listed registers)
 *  d. board + robot lasers fire in one simultaneous segment, then waste /
 *     radiation floors burn (radiation only on register 5)
 *  e. checkpoints: touching any updates the archive; claiming must be in order
 *  f. win check: all checkpoints claimed, or last robot standing
 */
export function executeTurn(
  state: GameState,
  programs: Record<PlayerId, Program>,
  seed: number,
  choices?: TurnChoices,
): TurnResult {
  if (isGameOver(state)) throw new Error('executeTurn: game is already over');

  const s = structuredClone(state);
  const ctx: Ctx = {
    s,
    events: [],
    effective: new Map(),
    target: countCheckpoints(s.board),
    register: 0,
    cardMove: false,
    cardValue: 0,
    repulsing: false,
  };

  prepareTurn(ctx, programs);
  emit(ctx, { type: 'turn-started', turn: s.turn });
  applyRespawnFacing(ctx, choices?.respawnFacing);
  powerDownRepair(ctx);

  for (let register = 1; register <= 5; register++) {
    ctx.register = register;
    emit(ctx, { type: 'register-started', register });

    // Trap-doors scheduled for this register are open for the WHOLE phase:
    // anyone standing on one at phase start falls before cards act.
    openTrapdoors(ctx);
    if (gameEnded(ctx)) break;

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
    firePushers(ctx, register);
    rotateGears(ctx);
    fireCrushers(ctx, register);
    if (gameEnded(ctx)) break;

    // (d) lasers, then environmental floor damage (same printed segment)
    fireLasers(ctx);
    hazardFloorDamage(ctx, register);
    if (gameEnded(ctx)) break;

    // (e) + (f) checkpoints and win check
    touchCheckpoints(ctx);
    if (gameEnded(ctx)) break;
  }
  ctx.register = 0; // end-of-turn phases run with no register hazards live

  // Card cleanup runs even when the game ended mid-register: the 84-card
  // invariant has to hold for the final state too. Only the next turn's
  // respawn/deal is gated on the game continuing. Repair runs before respawn
  // (a robot respawning onto a wrench doesn't heal the turn it died) and
  // before cleanUpCards, so cards freed by an unlock flow back to the shared
  // discard pile this same turn.
  if (!gameEnded(ctx)) {
    repairRobots(ctx);
    // Before respawnRobots: a robot destroyed this turn can be neither kept
    // down nor newly powered down — destruction ends a power-down (killRobot
    // cleared the flag) and voids an announcement (the player may re-announce
    // while programming the next turn).
    applyPowerDownChoices(ctx, choices?.powerDown);
    respawnRobots(ctx);
  }
  cleanUpCards(ctx);
  if (!gameEnded(ctx)) {
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

/**
 * Does standing on `pos` right now mean falling? Pits always; trap-doors
 * only while their schedule lists the current register (they are open for
 * that ENTIRE phase — belts, pushes and card moves all drop robots in).
 */
function fallsAt(ctx: Ctx, pos: Position): boolean {
  const tile = tileAt(ctx.s.board, pos);
  return (
    tile.kind === 'pit' ||
    (tile.kind === 'trapdoor' && tile.registers.includes(ctx.register))
  );
}

// ---------------------------------------------------------------------------
// Turn preparation: validate programs, take programmed cards out of hands,
// merge with locked registers into the effective program per robot.

function prepareTurn(ctx: Ctx, programs: Record<PlayerId, Program>): void {
  const { s } = ctx;
  for (const robot of s.robots) {
    if (robot.eliminated) continue;
    // A powered-down robot has no hand and needs no program (any submitted
    // one-tap placeholder is ignored). No effective entry = idles every
    // register, which is also what keeps it out of actingOrder.
    if (robot.poweredDown) continue;
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
      flamerRotateBurn(ctx, idx);
      break;
    case 'turnRight':
      rotateRobot(ctx, idx, 1);
      flamerRotateBurn(ctx, idx);
      break;
    case 'uTurn':
      rotateRobot(ctx, idx, 2);
      flamerRotateBurn(ctx, idx);
      break;
    case 'move1':
      cardMoveRobot(ctx, idx, 1, false);
      break;
    case 'move2':
      cardMoveRobot(ctx, idx, 2, false);
      break;
    case 'move3':
      cardMoveRobot(ctx, idx, 3, false);
      break;
    case 'backUp':
      cardMoveRobot(ctx, idx, 1, true);
      break;
  }
}

/**
 * A movement card executing — the only movement that triggers teleporters,
 * portals, repulsor fields and flamer move-through burns (printed timing:
 * all fire during Robots Move; belts and pistons are Board Elements).
 */
function cardMoveRobot(ctx: Ctx, idx: number, steps: number, backward: boolean): void {
  // Teleporter under the robot: it appears (card squares + 2) forward —
  // Back-Up appears 2 squares FORWARD, per the printed guide's own example —
  // ignoring everything in between. If that fails (destination occupied)
  // the card executes normally.
  if (tileAt(ctx.s.board, ctx.s.robots[idx].pos).kind === 'teleporter') {
    if (teleportJump(ctx, idx, backward ? 2 : steps + 2)) return;
  }
  ctx.cardMove = true;
  ctx.cardValue = steps;
  moveRobot(ctx, idx, steps, backward);
  ctx.cardMove = false;
  ctx.cardValue = 0;
}

/**
 * Teleporter jump: `distance` squares in the robot's facing, ignoring all
 * intervening board elements, walls and robots. Returns false when the
 * teleporter doesn't operate (destination occupied → move normally).
 * Judgment call (unprinted): a destination past the rim is an edge death,
 * framed at the last in-bounds cell along the jump line.
 */
function teleportJump(ctx: Ctx, idx: number, distance: number): boolean {
  const { s } = ctx;
  const robot = s.robots[idx];
  const from = { ...robot.pos };
  let dest = from;
  for (let i = 0; i < distance; i++) dest = step(dest, robot.facing);
  if (!inBounds(s.board, dest)) {
    let last = from;
    for (;;) {
      const next = step(last, robot.facing);
      if (!inBounds(s.board, next)) break;
      last = next;
    }
    killRobot(ctx, idx, { type: 'robot-fell', player: robot.player, cause: 'edge', at: last });
    return true;
  }
  if (robotIndexAt(ctx, dest) !== -1) return false;
  robot.pos = { ...dest };
  emit(ctx, {
    type: 'robot-teleported',
    player: robot.player,
    from,
    to: { ...dest },
    via: 'teleporter',
  });
  if (fallsAt(ctx, dest)) {
    killRobot(ctx, idx, { type: 'robot-fell', player: robot.player, cause: 'pit', at: dest });
  }
  return true;
}

/** Executing a rotate card ON an active flamer burns 1 (printed rule). */
function flamerRotateBurn(ctx: Ctx, idx: number): void {
  if (flamerActiveAt(ctx, ctx.s.robots[idx].pos)) applyDamage(ctx, idx, 1, 'flamer');
}

function flamerActiveAt(ctx: Ctx, pos: Position): boolean {
  return (ctx.s.board.flamers ?? []).some(
    (f) => samePos(f.pos, pos) && f.registers.includes(ctx.register),
  );
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
 * `moverPushed` marks the mover itself as shoved (pusher pistons) so its
 * robot-moved carries pushed: true; card moves leave it false.
 */
function tryStep(ctx: Ctx, idx: number, dir: Direction, moverPushed = false): boolean {
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
    // Repulsor field (card movement only; field-driven flight doesn't
    // re-trigger): the robot that would enter is flung straight back by the
    // field instead, chain-pushing everything behind it — including the
    // mover — and the card's remaining movement is lost (return false).
    if (ctx.cardMove && !ctx.repulsing && tileAt(s.board, next).kind === 'repulsor') {
      repulse(ctx, chain[chain.length - 1], dir);
      return false;
    }
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
    emit(ctx, { type: 'robot-moved', player: robot.player, from, to, pushed: i > 0 || moverPushed });
    if (ctx.cardMove) {
      // Moving onto/through an active flamer burns 1 per square entered
      // (walked or chain-pushed — both are the Robots Move segment).
      if (flamerActiveAt(ctx, to)) applyDamage(ctx, chain[i], 1, 'flamer');
      // A portal relocates its entrant to the twin (unless occupied) and
      // movement continues from there. Field-driven flight stays put.
      if (!robot.destroyed && !ctx.repulsing) maybePortal(ctx, chain[i]);
    }
    if (!robot.destroyed && fallsAt(ctx, robot.pos)) {
      killRobot(ctx, chain[i], {
        type: 'robot-fell',
        player: robot.player,
        cause: 'pit',
        at: { ...robot.pos },
      });
    }
  }
  return true;
}

/**
 * Repulsor fling: the robot that ran (or was pushed) into the field is
 * shoved directly away — opposite the travel direction — by the moving
 * robot's card value, with normal chain pushing, wall blocking and falls.
 * The summary event trails its robot-moved steps so replay movement stays
 * driven by the moves; the event is the flash, not the motion.
 */
function repulse(ctx: Ctx, idx: number, dir: Direction): void {
  const robot = ctx.s.robots[idx];
  const from = { ...robot.pos };
  const back = opposite(dir);
  ctx.repulsing = true;
  for (let i = 0; i < ctx.cardValue; i++) {
    if (!isActive(ctx, idx)) break;
    if (!tryStep(ctx, idx, back, true)) break;
  }
  ctx.repulsing = false;
  emit(ctx, { type: 'repulsed', player: robot.player, from, to: { ...robot.pos } });
}

/** Relocate a robot standing on a portal to its twin, if the twin is free. */
function maybePortal(ctx: Ctx, idx: number): void {
  const { s } = ctx;
  const robot = s.robots[idx];
  const tile = tileAt(s.board, robot.pos);
  if (tile.kind !== 'portal') return;
  const twin = twinPortal(s.board, robot.pos, tile.color);
  if (!twin || robotIndexAt(ctx, twin) !== -1) return; // unpaired/occupied → inert
  const from = { ...robot.pos };
  robot.pos = { ...twin };
  emit(ctx, { type: 'robot-teleported', player: robot.player, from, to: { ...twin }, via: 'portal' });
}

// ---------------------------------------------------------------------------
// Board elements

function conveyorPulse(ctx: Ctx, expressOnly: boolean): void {
  const { s } = ctx;
  interface Proposal {
    idx: number;
    from: Position;
    to: Position;
    /** Travel direction this pulse — the source belt's exit dir. */
    dir: Direction;
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
      dir: tile.dir,
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
    // 1994 curve rule: a robot the BELT carries onto a curved section, in
    // across the curve's entry edge, rotates with the bend. Walking, pushing
    // and respawning onto curves never rotate (they don't come through here),
    // and neither does being conveyed in from a non-entry side.
    const dest = tileAt(s.board, p.to);
    if (dest.kind === 'conveyor' && dest.curve) {
      const cw = dest.curve === 'cw';
      const entryDir = rotate(dest.dir, cw ? -1 : 1);
      if (p.dir === entryDir) {
        const from = robot.facing;
        robot.facing = rotate(from, cw ? 1 : -1);
        emit(ctx, { type: 'conveyor-rotated', player: robot.player, cw, from, to: robot.facing });
      }
    }
    if (fallsAt(ctx, p.to)) {
      killRobot(ctx, p.idx, { type: 'robot-fell', player: robot.player, cause: 'pit', at: p.to });
    }
  }
}

/**
 * Phase-start sweep for trap-door pits (expansion rule): a trap-door whose
 * schedule lists the current register is open for the whole phase, so any
 * robot standing on one when the register begins falls immediately.
 */
function openTrapdoors(ctx: Ctx): void {
  const { s } = ctx;
  for (let idx = 0; idx < s.robots.length; idx++) {
    if (!isActive(ctx, idx)) continue;
    const robot = s.robots[idx];
    if (fallsAt(ctx, robot.pos)) {
      killRobot(ctx, idx, {
        type: 'robot-fell',
        player: robot.player,
        cause: 'pit',
        at: { ...robot.pos },
      });
    }
  }
}

/**
 * Wall-mounted pushers (1994 rule): each pusher whose printed registers
 * include the current one shoves the robot in its cell one space in
 * `facing`, with normal chain pushing, wall blocking and pit/edge falls.
 * List order — deterministic. Powered-down robots are shoved like anything
 * else; an empty pusher fires silently (no event without a subject).
 */
function firePushers(ctx: Ctx, register: number): void {
  for (const pusher of ctx.s.board.pushers ?? []) {
    if (!pusher.registers.includes(register)) continue;
    const idx = robotIndexAt(ctx, pusher.pos);
    if (idx === -1) continue;
    emit(ctx, {
      type: 'pusher-fired',
      at: { ...pusher.pos },
      dir: pusher.facing,
      player: ctx.s.robots[idx].player,
    });
    tryStep(ctx, idx, pusher.facing, true);
  }
}

/**
 * Overhead crushers (expansion rule): Board Elements step 5, after gears.
 * A crusher whose printed registers include the current one destroys the
 * robot in its cell outright. crusher-crushed is the slam visual; the kill
 * itself is the standard robot-destroyed path (replay needs no new removal
 * logic). An empty crusher slams silently — no event without a subject.
 */
function fireCrushers(ctx: Ctx, register: number): void {
  for (const crusher of ctx.s.board.crushers ?? []) {
    if (!crusher.registers.includes(register)) continue;
    const idx = robotIndexAt(ctx, crusher.pos);
    if (idx === -1) continue;
    const robot = ctx.s.robots[idx];
    emit(ctx, { type: 'crusher-crushed', player: robot.player, at: { ...crusher.pos } });
    killRobot(ctx, idx, { type: 'robot-destroyed', player: robot.player, at: { ...robot.pos } });
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

/**
 * Resolve Laser Fire — printed rule: board AND robot lasers fire in ONE
 * simultaneous segment. Every beam is traced from the same position
 * snapshot before any damage lands, so a robot destroyed by a board laser
 * still returns fire this segment, and its body still blocks other beams.
 * The event stream stays sequential: board laser-fired events first, then
 * robot laser-fired events, then all damage in that same order.
 */
function fireLasers(ctx: Ctx): void {
  const { s } = ctx;
  interface Shot {
    event: EngineEvent;
    hit: number;
    strength: number;
  }
  const shots: Shot[] = [];
  for (const laser of s.board.lasers) {
    const { path, hit } = traceBeam(ctx, laser.pos, laser.facing, true);
    shots.push({
      event: {
        type: 'laser-fired',
        source: 'board',
        path,
        hit: hit === -1 ? undefined : s.robots[hit].player,
        strength: laser.strength,
      },
      hit,
      strength: laser.strength,
    });
  }
  for (let idx = 0; idx < s.robots.length; idx++) {
    if (!isActive(ctx, idx)) continue;
    const robot = s.robots[idx];
    // Powered down: all systems off — it doesn't fire, but it still gets hit
    // (isActive is untouched, so beams and robotIndexAt still find it).
    if (robot.poweredDown) continue;
    const { path, hit } = traceBeam(ctx, robot.pos, robot.facing, false);
    shots.push({
      event: {
        type: 'laser-fired',
        source: 'robot',
        shooter: robot.player,
        path,
        hit: hit === -1 ? undefined : s.robots[hit].player,
        strength: ROBOT_LASER_STRENGTH,
      },
      hit,
      strength: ROBOT_LASER_STRENGTH,
    });
  }
  for (const shot of shots) emit(ctx, shot.event);
  for (const shot of shots) {
    if (shot.hit !== -1) applyDamage(ctx, shot.hit, shot.strength);
  }
}

/**
 * Environmental floor damage, printed as part of Resolve Laser Fire:
 * radioactive waste burns a robot ending ANY register phase on it;
 * a radiation floor burns a robot ending the TURN on it (register 5 only).
 * (Waste's option-card draw is cut with the option deck, by design.)
 */
function hazardFloorDamage(ctx: Ctx, register: number): void {
  const { s } = ctx;
  for (let idx = 0; idx < s.robots.length; idx++) {
    if (!isActive(ctx, idx)) continue;
    const pos = s.robots[idx].pos;
    const tile = tileAt(s.board, pos);
    if (tile.kind === 'waste') applyDamage(ctx, idx, 1, 'waste');
    else if (tile.kind === 'radiation' && register === 5) applyDamage(ctx, idx, 1, 'radiation');
    // Ending the register phase on an active flamer burns 1 more (printed:
    // "an additional 1 point of damage" during Resolve Laser Fire).
    if (flamerActiveAt(ctx, pos)) applyDamage(ctx, idx, 1, 'flamer');
  }
}

function applyDamage(
  ctx: Ctx,
  idx: number,
  amount: number,
  source?: 'flamer' | 'radiation' | 'waste',
): void {
  const robot = ctx.s.robots[idx];
  if (robot.destroyed || robot.eliminated) return;
  const before = robot.damage;
  robot.damage = Math.min(10, robot.damage + amount);
  emit(ctx, {
    type: 'damage',
    player: robot.player,
    amount,
    total: robot.damage,
    ...(source ? { source } : {}),
  });

  if (robot.damage >= 10) {
    killRobot(ctx, idx, { type: 'robot-destroyed', player: robot.player, at: robot.pos });
    return;
  }

  // Registers lock from 5 downward as damage crosses 5, 6, 7, 8. A register
  // locks with the card it holds THIS turn, which then repeats every turn
  // until the lock clears — via destruction/respawn, or end-of-turn repair.
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
  delete robot.poweredDown; // destruction ends a power-down
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

/**
 * End-of-turn repair (1994 rule): a robot ending the turn on a repair site
 * (wrench) or a flag (checkpoint) discards 1 damage token, and its archive
 * marker moves there. Runs before respawnRobots — a destroyed robot doesn't
 * repair the turn it died — and before cleanUpCards, so a register unlocked
 * by dropping below its lock threshold releases its card into the shared
 * discard pile this same turn (cleanUpCards discards every effective card
 * that is no longer locked).
 */
function repairRobots(ctx: Ctx): void {
  const { s } = ctx;
  for (let idx = 0; idx < s.robots.length; idx++) {
    if (!isActive(ctx, idx)) continue;
    const robot = s.robots[idx];
    const tile = tileAt(s.board, robot.pos);
    if (tile.kind !== 'wrench' && tile.kind !== 'checkpoint') continue;
    robot.archive = { ...robot.pos }; // a wrench updates the respawn point too
    if (robot.damage <= 0) continue;
    const before = robot.damage;
    robot.damage -= 1;
    emit(ctx, { type: 'repair', player: robot.player, amount: 1, total: robot.damage });
    for (let register = 1; register <= 5; register++) {
      if (isRegisterLocked(before, register) && !isRegisterLocked(robot.damage, register)) {
        const card = robot.lockedRegisters[register - 1];
        robot.lockedRegisters[register - 1] = null;
        emit(ctx, { type: 'register-unlocked', player: robot.player, register, card });
      }
    }
  }
}

const DIRECTIONS: readonly Direction[] = ['N', 'E', 'S', 'W'];

/**
 * 1994 rule: the player of a destroyed robot chooses which way it faces on
 * re-entry. The choice is made while programming the NEXT turn (it rides the
 * program submission, so async play never blocks): the robot respawns facing
 * N at end of turn, and the choice lands here — right after turn-started of
 * the following turn — as a plain robot-rotated. The justRespawned flag is
 * the permission gate: choices for players who aren't flagged are ignored,
 * and the flag clears whether or not a choice arrived (no choice = stays N).
 */
function applyRespawnFacing(
  ctx: Ctx,
  choices: Record<PlayerId, Direction> | undefined,
): void {
  const { s } = ctx;
  for (let idx = 0; idx < s.robots.length; idx++) {
    const robot = s.robots[idx];
    if (!robot.justRespawned) continue;
    const to = choices?.[robot.player];
    if (isActive(ctx, idx) && to !== undefined && DIRECTIONS.includes(to) && to !== robot.facing) {
      const from = robot.facing;
      robot.facing = to;
      emit(ctx, { type: 'robot-rotated', player: robot.player, from, to });
    }
    delete robot.justRespawned;
  }
}

/**
 * Start-of-turn recovery for powered-down robots (1994 rule): ALL damage is
 * removed at the start of the turn the robot spends down. Every locked
 * register releases — its card returns to the shared discard pile directly,
 * because a powered-down robot has no effective program for cleanUpCards to
 * sweep. Damage taken later in the turn (it can still be shot) sticks until
 * the next power-down turn's clear, or normal repair after waking.
 */
function powerDownRepair(ctx: Ctx): void {
  const { s } = ctx;
  for (const robot of s.robots) {
    if (!robot.poweredDown || robot.eliminated) continue;
    if (robot.damage <= 0) continue;
    const before = robot.damage;
    robot.damage = 0;
    emit(ctx, { type: 'repair', player: robot.player, amount: before, total: 0 });
    for (let register = 1; register <= 5; register++) {
      if (!isRegisterLocked(before, register)) continue;
      const card = robot.lockedRegisters[register - 1];
      robot.lockedRegisters[register - 1] = null;
      emit(ctx, { type: 'register-unlocked', player: robot.player, register, card });
      if (card !== null) s.deck.discardPile.push(card);
    }
  }
}

/**
 * End-of-turn power-down bookkeeping. `names` lists players announcing a
 * power-down (their robot is down NEXT turn) or staying down; a robot down
 * this turn whose player is not named wakes. Runs before respawnRobots, so a
 * robot destroyed this turn is never in either branch: killRobot already
 * cleared its flag, and an announcement from its player is void (isActive
 * gate) — the player may re-announce while programming the next turn.
 */
function applyPowerDownChoices(ctx: Ctx, names: PlayerId[] | undefined): void {
  const { s } = ctx;
  const chosen = new Set(names ?? []);
  for (let idx = 0; idx < s.robots.length; idx++) {
    const robot = s.robots[idx];
    if (!isActive(ctx, idx)) continue;
    if (robot.poweredDown) {
      if (!chosen.has(robot.player)) {
        delete robot.poweredDown;
        emit(ctx, { type: 'robot-powered-up', player: robot.player });
      }
      // Named: staying down another turn — keep the flag, no event.
    } else if (chosen.has(robot.player)) {
      robot.poweredDown = true;
      emit(ctx, { type: 'robot-powered-down', player: robot.player });
    }
  }
}

function respawnRobots(ctx: Ctx): void {
  const { s } = ctx;
  for (let idx = 0; idx < s.robots.length; idx++) {
    const robot = s.robots[idx];
    if (!robot.destroyed || robot.eliminated) continue;
    robot.pos = respawnSpot(ctx, robot.archive);
    robot.facing = 'N'; // player's facing choice arrives with next turn's program
    robot.damage = RESPAWN_DAMAGE;
    robot.destroyed = false;
    robot.justRespawned = true;
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
 * the turn held by a locked register, all into the shared discard pile.
 * Cards that came in locked and are still locked stay on their registers
 * (they are not part of the deck). Death clears lockedRegisters (killRobot),
 * so an eliminated player's cards flow back to the shared pool here.
 */
function cleanUpCards(ctx: Ctx): void {
  const { s } = ctx;
  for (const robot of s.robots) {
    discardHand(s, robot.player);
    const effective = ctx.effective.get(robot.player);
    if (!effective) continue;
    const stillLocked = new Set(
      robot.lockedRegisters.filter((c): c is Card => c !== null).map((c) => c.id),
    );
    for (const card of effective) {
      if (card !== null && !stillLocked.has(card.id)) {
        s.deck.discardPile.push(card);
      }
    }
  }
}
