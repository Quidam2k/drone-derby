// The camera director's decisions, deliberately free of `three`.
//
// Third module in the ./viewMath, ./effectMath pattern: plain data in, plain
// data out, unit tested in the node environment without a DOM or a GPU.
// ./camera.ts holds only the three.js that *executes* what this decides.
//
// ---------------------------------------------------------------------------
// What this replaces
//
// 3D-1 shipped a deliberately dumb director: every cursor step it asked the
// current event where it happened and eased the camera onto that cell. On a
// 120-event turn that is up to 120 re-aims at 300-750 ms apart against a 0.36 s
// ease, so the camera was almost never still and almost always arriving late —
// it started moving toward the laser as the beam ended.
//
// The three rules below are the fix:
//
//   1. INTEREST. Most events are not worth a shot. `card-revealed` fires five
//      times a register and its entire content is in the register strip; the
//      turn and register markers have no place at all. Anything under
//      MIN_INTEREST cannot move the camera, full stop.
//   2. LOOKAHEAD. In a replay the whole event log already exists, so the
//      director can frame the laser *before* it fires and be still when it
//      does. Without this any director is a chaser — at TAU 0.36 s it arrives
//      as the event ends no matter how good the scoring is. This is the
//      decision the phase turns on, and it is why `planShot` takes a WINDOW of
//      events rather than one.
//   3. DWELL. A shot that is already framing what is about to happen must not
//      be replaced. `shouldReplace` is the hysteresis, pure so it is testable.
//
// Coordinates are BOARD cells, possibly fractional and possibly outside the
// board (an edge fall is framed partly off the rim). camera.ts converts to
// world space, where cell (x, y) centres on (x + 0.5, 0, y + 0.5).

import type { EngineEvent, PlayerId, Position } from '../../engine';

/** Why the camera is where it is. `'robot'` is the follow-my-robot lock. */
export type ShotReason = EngineEvent['type'] | 'robot';

/**
 * A framing decision: a centre in board cells, and the half-extent in tiles
 * that must be in frame around it. `null` anywhere a Shot is expected means
 * "frame the whole board".
 */
export interface Shot {
  x: number;
  y: number;
  /** Tiles of half-extent to frame. `max(content, MIN_RADIUS)`. */
  radius: number;
  /**
   * Half-extent of the actual CONTENT, before MIN_RADIUS padding — zero for a
   * single-cell event, half a beam's length for a laser.
   *
   * Separate from `radius` because they answer different questions. `radius` is
   * how close the camera may get and is floored so a single explosion isn't
   * framed through a keyhole. `content` is what genuinely has to be on screen,
   * and it is what the dwell rule tests: a shot whose content already sits
   * inside the current framing is not worth moving the camera for, however far
   * apart the two centres are.
   */
  content: number;
  /** The seed event's weight — interest after look-ahead decay, in [0, 1]. */
  interest: number;
  reason: ShotReason;
}

/** What the planner needs to know about the world besides the events. */
export interface DirectorContext {
  width: number;
  height: number;
  /** Where a player's robot is right now, or null if it isn't on the board. */
  robotAt(player: PlayerId): Position | null;
}

/** Below this an event cannot move the camera at all. */
export const MIN_INTEREST = 0.2;
/**
 * An event this interesting cuts through the dwell rule immediately.
 *
 * Drawn so a death, a checkpoint claim and a win cut, and a laser does not.
 * Waiting out a timer before showing a robot being destroyed is worse than a
 * slightly restless camera; waiting one out before showing the fourth board
 * laser of the register is exactly right.
 */
export const CUT_INTEREST = 0.8;
/** Tiles of half-extent a single-point shot keeps in frame. */
export const MIN_RADIUS = 3.6;
/**
 * The same floor for a HIGHLIGHT REEL, which is allowed much closer.
 *
 * MIN_RADIUS is not a framing preference, it is an obligation: the live camera
 * has to keep everyone's robot findable, so a single explosion is still framed
 * with three and a half tiles of context around it. A reel has no such
 * obligation — it has already decided which single beat you are watching — and
 * that one freedom is the entire difference between a reel and a camera mode.
 * So it gets to sit right on top of the moment.
 */
export const REEL_RADIUS = 2.1;
/** Widest bounding box, in tiles, that UNRELATED events may be merged into. */
export const MAX_SPREAD = 6;
/** Weight multiplier per event further into the look-ahead window. */
export const LOOKAHEAD_DECAY = 0.8;
/**
 * Events of look-ahead. Has to reach PAST a register's five `card-revealed`
 * events (register-started + 5 reveals = 6) so the camera is already settled on
 * the first move of the register while the cards are still being turned over —
 * that lead-in is 550 + 5x450 = 2.8 s at 1x, the longest still moment in a turn
 * and the one the old director spent flying between five robots.
 */
export const LOOKAHEAD = 10;
/**
 * Seconds a shot is protected from replacement by a merely-comparable one.
 *
 * MEASURED, not guessed — see ./directorTurn.test.ts, which folds real engine
 * logs through the planner and counts re-aims. The phase was planned around
 * "~0.45 s", and at 0.45 s a real Grand Circuit turn still re-aims 43 times in
 * 39 seconds: events average under half a second, so a half-second floor barely
 * touches anything. Nor was clustering or containment the binding constraint —
 * both were swept and neither moved the number much. The dwell is what does.
 *
 * At 1.6 s the same turn re-aims 16-22 times, about once every two seconds,
 * which is what "directed" reads as. The cost is real and accepted: an event
 * three tiles outside the current framing waits for the shot to expire, so the
 * camera does sometimes miss one. Showing everything is what made the 3D-1
 * director unwatchable.
 */
export const MIN_DWELL = 1.6;
/**
 * Tiles of frame edge that don't count as "already framed".
 *
 * Containment has to mean comfortably on screen, not technically on screen: a
 * robot pinned to the last tile of the frame reads as about to leave it, and
 * holding the shot there is how a director looks asleep rather than calm.
 */
export const EDGE_MARGIN = 0.8;
/** How much more interesting a rival must be to cut a shot short. */
export const INTEREST_MARGIN = 0.15;
/** Tiles past the rim an edge fall is framed, so the throw stays on canvas. */
export const OVERHANG_TILES = 1.3;

/**
 * How much a shot is worth, in [0, 1].
 *
 * Seeded from `eventDuration`'s ranking in ReplayPlayer — the two agree about
 * what matters — but deliberately NOT equal to it. Duration answers "how long
 * should the player read this", interest answers "is this worth pointing a
 * camera at", and the events where they disagree are exactly the ones that made
 * the old director thrash:
 *
 * - `card-revealed` holds the screen 450 ms and is worth 0.05: the whole event
 *   is in the register strip, and following the revealing player dragged the
 *   camera across the board five times a register.
 * - `register-locked` and `life-lost` hold 600 and 400 ms and are worth
 *   nothing: they are player-strip news, not board news.
 * - `player-eliminated` holds 750 ms beside `robot-destroyed`, but the robot
 *   already vanished on that event a beat earlier — which scored 0.9. There is
 *   nothing left on the board to look at.
 */
export function interestOf(e: EngineEvent): number {
  switch (e.type) {
    case 'game-won':
      return 1;
    case 'robot-destroyed':
    case 'robot-fell':
      return 0.9;
    case 'checkpoint-claimed':
      return 0.8;
    case 'laser-fired':
      // A beam that connects is a story. A beam that misses is scenery — and
      // WHOSE scenery matters: a player taking a shot and missing is worth a
      // glance, but the board's emitters fire into the same empty corridor
      // every register of every turn. Scored equally, they dragged the camera
      // off the robots and back four times a turn on Grand Circuit, whose
      // laser row sits ten tiles from where the robots were racing. Measured
      // in the browser, not guessed; see notes/2026-07-27-session-3d5.md.
      if (e.hit) return 0.7;
      return e.source === 'robot' ? 0.4 : 0.15;
    case 'robot-respawned':
      return 0.65;
    case 'robot-teleported':
      // A robot blinking across the board is a story on par with a hit.
      return 0.7;
    case 'repulsed':
      return 0.6;
    case 'robot-powered-down':
    case 'robot-powered-up':
      // The robot visibly dims/relights on its cell — worth a glance at end
      // of turn, never a cut.
      return 0.45;
    case 'damage':
      return 0.55;
    case 'repair':
      // Pleasant, not dramatic: worth a glance at end of turn, never a cut.
      return 0.35;
    case 'robot-blocked':
    case 'pusher-fired':
      return 0.5;
    case 'crusher-crushed':
      // The slam itself; the destruction that follows scores 0.9 anyway.
      return 0.6;
    case 'robot-moved':
      return 0.35;
    case 'conveyor-moved':
      return 0.3;
    case 'robot-rotated':
    case 'gear-rotated':
    case 'conveyor-rotated':
      return 0.25;
    case 'card-revealed':
      return 0.05;
    case 'register-locked':
    case 'register-unlocked':
    case 'life-lost':
    case 'player-eliminated':
    case 'turn-started':
    case 'turn-ended':
    case 'register-started':
      return 0;
  }
}

/**
 * Every point that must be IN FRAME for an event to read — not one cell.
 *
 * Generalises the `eventFocus` the spike kept in camera.ts, which returned a
 * single Position and therefore framed the midpoint of an eight-tile beam with
 * both ends off-screen. camera.ts imports `three`, so that function could never
 * be unit tested; this one is.
 *
 * Returns board cells. Most are integers; an edge fall adds a VIRTUAL point
 * outside the board so the throw has somewhere to land — see OVERHANG_TILES.
 */
export function eventPoints(e: EngineEvent, ctx: DirectorContext): { x: number; y: number }[] {
  const of = (player: PlayerId) => {
    const p = ctx.robotAt(player);
    return p ? [{ x: p.x, y: p.y }] : [];
  };
  switch (e.type) {
    case 'robot-moved':
    case 'conveyor-moved':
    case 'robot-teleported':
    case 'repulsed':
      // Both ends: a push that starts off-frame and ends on it reads as a
      // teleport.
      return [
        { x: e.from.x, y: e.from.y },
        { x: e.to.x, y: e.to.y },
      ];
    case 'robot-blocked':
    case 'robot-destroyed':
    case 'crusher-crushed':
      return [{ x: e.at.x, y: e.at.y }];
    case 'pusher-fired': {
      // Both ends of the shove, like robot-moved.
      const d = { N: { x: 0, y: -1 }, E: { x: 1, y: 0 }, S: { x: 0, y: 1 }, W: { x: -1, y: 0 } }[
        e.dir
      ];
      return [
        { x: e.at.x, y: e.at.y },
        { x: e.at.x + d.x, y: e.at.y + d.y },
      ];
    }
    case 'robot-fell':
      return e.cause === 'edge'
        ? [{ x: e.at.x, y: e.at.y }, ...offBoardPoints(e.at, ctx)]
        : [{ x: e.at.x, y: e.at.y }];
    case 'robot-respawned':
      return [{ x: e.pos.x, y: e.pos.y }];
    case 'laser-fired': {
      // Both ends of the beam, so muzzle and impact are both on screen.
      if (e.path.length === 0) return [];
      const a = e.path[0];
      const b = e.path[e.path.length - 1];
      return [
        { x: a.x, y: a.y },
        { x: b.x, y: b.y },
      ];
    }
    case 'robot-rotated':
    case 'gear-rotated':
    case 'conveyor-rotated':
    case 'damage':
    case 'repair':
    case 'register-locked':
    case 'register-unlocked':
    case 'life-lost':
    case 'player-eliminated':
    case 'checkpoint-claimed':
    case 'game-won':
    case 'card-revealed':
    case 'robot-powered-down':
    case 'robot-powered-up':
      return of(e.player);
    case 'turn-started':
    case 'turn-ended':
    case 'register-started':
      return [];
  }
}

/**
 * Where a robot thrown off the rim ends up, as a point outside the board.
 *
 * `robot-fell`'s `at` is the last IN-BOUNDS cell, so which rim it touches names
 * the direction — the same positional read `effectMath.edgeFallDir` makes for
 * the fall animation, minus the tie-break hints, because over-widening a corner
 * shot costs a fraction of a tile of framing and nothing else. A corner
 * therefore extends BOTH ways, which is the safe answer.
 */
function offBoardPoints(at: Position, ctx: DirectorContext): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  if (at.y <= 0) out.push({ x: at.x, y: at.y - OVERHANG_TILES });
  if (at.y >= ctx.height - 1) out.push({ x: at.x, y: at.y + OVERHANG_TILES });
  if (at.x <= 0) out.push({ x: at.x - OVERHANG_TILES, y: at.y });
  if (at.x >= ctx.width - 1) out.push({ x: at.x + OVERHANG_TILES, y: at.y });
  return out;
}

/**
 * The look-ahead window starting at the CURRENT event.
 *
 * ReplayPlayer's convention: `cursor` events have been applied, so the event on
 * screen is `events[cursor - 1]` and `events[cursor]` is next. At cursor 0
 * nothing has happened yet and the window is the opening run — which is what
 * lets the camera be settled before the first register instead of after it.
 */
export function lookaheadWindow(
  events: readonly EngineEvent[] | undefined,
  cursor: number,
  span = LOOKAHEAD,
): EngineEvent[] {
  if (!events || events.length === 0) return [];
  const start = Math.max(0, Math.min(events.length - 1, Math.floor(cursor) - 1));
  return events.slice(start, start + Math.max(1, span));
}

interface Box {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

function boxOf(points: { x: number; y: number }[]): Box {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, maxX, minY, maxY };
}

function spread(b: Box): number {
  return Math.max(b.maxX - b.minX, b.maxY - b.minY);
}

/**
 * Choose the shot for a window of upcoming events, or null for "frame the whole
 * board" when nothing in the window is worth pointing at.
 *
 * Weight each event by `interest x LOOKAHEAD_DECAY^i` so the present outranks
 * the future without the future being invisible, drop everything under
 * MIN_INTEREST, then CLUSTER: seed on the heaviest event and take ALL of its
 * points (an eight-tile beam is one shot, however wide), then admit other
 * events in weight order only while the bounding box stays inside MAX_SPREAD.
 *
 * That last rule is the one that matters. Without it, a conveyor pulsing in one
 * corner while a laser fires in another pulls the camera back until both fit —
 * which frames neither, and is the failure mode a naive "average the events"
 * director has.
 *
 * Hysteresis is NOT here: `planShot` is a pure function of the window so the
 * same cursor always plans the same shot, and `shouldReplace` decides whether
 * the camera actually takes it.
 *
 * `minRadius` is the floor on how close the camera may get. It is a parameter
 * only so a highlight reel can pass REEL_RADIUS — see there for why a reel is
 * allowed closer than the live camera ever is.
 */
export function planShot(
  window: readonly EngineEvent[],
  ctx: DirectorContext,
  minRadius = MIN_RADIUS,
): Shot | null {
  const groups: { points: { x: number; y: number }[]; weight: number; reason: ShotReason }[] = [];
  let decay = 1;
  for (const e of window) {
    const interest = interestOf(e);
    if (interest >= MIN_INTEREST) {
      const points = eventPoints(e, ctx);
      if (points.length) groups.push({ points, weight: interest * decay, reason: e.type });
    }
    decay *= LOOKAHEAD_DECAY;
  }
  if (!groups.length) return null;

  // Stable heaviest-first: ties keep event order, so the earlier (on-screen)
  // event seeds the shot rather than an equally interesting later one.
  const order = groups.map((g, i) => ({ g, i }));
  order.sort((a, b) => b.g.weight - a.g.weight || a.i - b.i);

  const seed = order[0].g;
  let box = boxOf(seed.points);
  const limit = Math.max(MAX_SPREAD, spread(box));
  for (let k = 1; k < order.length; k++) {
    const merged = boxOf([
      { x: box.minX, y: box.minY },
      { x: box.maxX, y: box.maxY },
      ...order[k].g.points,
    ]);
    if (spread(merged) <= limit) box = merged;
  }

  const content = Math.max((box.maxX - box.minX) / 2, (box.maxY - box.minY) / 2);
  return {
    x: (box.minX + box.maxX) / 2,
    y: (box.minY + box.maxY) / 2,
    radius: Math.max(content, minRadius),
    content,
    interest: seed.weight,
    reason: seed.reason,
  };
}

/**
 * Is everything `inner` needs already comfortably inside `outer`'s framing?
 *
 * Tests `inner`'s CONTENT against `outer`'s radius, not radius against radius.
 * The difference is the whole dwell rule: two single-cell shots three tiles
 * apart both ask for MIN_RADIUS, so a radius-to-radius test calls them
 * different framings and re-aims — even though the second cell was already
 * near the middle of the frame. Content-to-radius calls it what it is: nothing
 * to do.
 */
export function contains(outer: Shot, inner: Shot, margin = EDGE_MARGIN): boolean {
  const reach = outer.radius - margin - inner.content;
  if (reach < 0) return false;
  return Math.abs(outer.x - inner.x) <= reach && Math.abs(outer.y - inner.y) <= reach;
}

/**
 * The dwell rule: should the camera abandon `prev` for `next`?
 *
 * Pure, and separate from `planShot`, because this is the half that decides
 * whether the camera is calm — and "calm" is a property of a whole turn, not of
 * one frame, so it has to be testable by folding a real event log rather than
 * by eye. `heldSeconds` is real seconds, not events: at 4x speed the events go
 * by four times faster and the camera should NOT re-aim four times as often.
 *
 * `null` on either side is the whole-board framing.
 */
export function shouldReplace(prev: Shot | null, next: Shot | null, heldSeconds: number): boolean {
  // Pulling back out to the whole board is a real move; make it wait too, or
  // the gap between two clusters of action becomes a flinch.
  if (!next) return !!prev && heldSeconds >= MIN_DWELL;
  if (!prev) return true;
  // Something big enough always cuts. A destruction or a win that has to wait
  // out a dwell timer is worse than a slightly restless camera.
  if (next.interest >= CUT_INTEREST) return !contains(prev, next);
  // Already framed: the point of look-ahead is that this is the common case.
  if (contains(prev, next)) return false;
  if (heldSeconds < MIN_DWELL && next.interest <= prev.interest + INTEREST_MARGIN) return false;
  return true;
}

/** Seconds to cover ~63% of a short re-aim, and of a cross-board one. */
export const TAU_NEAR = 0.36;
export const TAU_WHIP = 0.2;
/** Tiles of travel at which the ease is fully whipped. */
export const WHIP_DISTANCE = 10;

/**
 * Ease time constant for a re-aim of `distance` tiles.
 *
 * A single time constant cannot serve both ends: at 0.36 s a two-tile nudge is
 * pleasant and a fifteen-tile re-aim is a slow drift that shows the player
 * every irrelevant thing in between. Shortening TAU with distance makes the
 * long one read as a whip. Still an ease, never a cut — in a viewport this
 * small, a hard cut with no shot-change cue reads as a rendering bug.
 */
export function easeTau(distance: number): number {
  if (!Number.isFinite(distance) || distance <= 0) return TAU_NEAR;
  const u = Math.min(1, distance / WHIP_DISTANCE);
  return TAU_NEAR + (TAU_WHIP - TAU_NEAR) * u;
}
