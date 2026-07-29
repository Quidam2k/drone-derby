import { describe, expect, it } from 'vitest';
import type { EngineEvent, PlayerId, Position } from '../../engine';
import {
  contains,
  CUT_INTEREST,
  easeTau,
  eventPoints,
  interestOf,
  lookaheadWindow,
  MAX_SPREAD,
  MIN_DWELL,
  MIN_INTEREST,
  MIN_RADIUS,
  OVERHANG_TILES,
  planShot,
  shouldReplace,
  TAU_NEAR,
  TAU_WHIP,
  WHIP_DISTANCE,
  type DirectorContext,
  type Shot,
} from './directorMath';

const P = (x: number, y: number): Position => ({ x, y });

/** A 12x12 board with everyone parked on (5, 5) unless the test says otherwise. */
function ctx(
  positions: Record<string, Position> = {},
  width = 12,
  height = 12,
): DirectorContext {
  return {
    width,
    height,
    robotAt: (player: PlayerId) => positions[player] ?? null,
  };
}

/** One of every EngineEvent variant, for the exhaustiveness checks. */
const ALL_EVENTS: EngineEvent[] = [
  { type: 'turn-started', turn: 1 },
  { type: 'register-started', register: 1 },
  { type: 'card-revealed', player: 'a', register: 1, card: { id: 'move1-500', type: 'move1', priority: 500 } },
  { type: 'robot-moved', player: 'a', from: P(1, 1), to: P(1, 2), pushed: false },
  { type: 'robot-blocked', player: 'a', at: P(1, 1), dir: 'N' },
  { type: 'robot-rotated', player: 'a', from: 'N', to: 'E' },
  { type: 'conveyor-moved', player: 'a', from: P(1, 1), to: P(2, 1), express: false },
  { type: 'gear-rotated', player: 'a', cw: true, from: 'N', to: 'E' },
  { type: 'conveyor-rotated', player: 'a', cw: true, from: 'N', to: 'E' },
  { type: 'pusher-fired', at: P(1, 1), dir: 'E', player: 'a' },
  { type: 'laser-fired', source: 'board', path: [P(0, 3), P(4, 3)], strength: 1 },
  { type: 'damage', player: 'a', amount: 1, total: 3 },
  { type: 'repair', player: 'a', amount: 1, total: 2 },
  { type: 'register-locked', player: 'a', register: 5, card: null },
  { type: 'register-unlocked', player: 'a', register: 5, card: null },
  { type: 'robot-fell', player: 'a', cause: 'pit', at: P(6, 6) },
  { type: 'robot-destroyed', player: 'a', at: P(6, 6) },
  { type: 'life-lost', player: 'a', remaining: 2 },
  { type: 'player-eliminated', player: 'a' },
  { type: 'robot-respawned', player: 'a', pos: P(2, 9), facing: 'N' },
  { type: 'robot-powered-down', player: 'a' },
  { type: 'robot-powered-up', player: 'a' },
  { type: 'checkpoint-claimed', player: 'a', checkpoint: 2 },
  { type: 'game-won', player: 'a', reason: 'checkpoints' },
  { type: 'turn-ended', turn: 1 },
];

describe('interestOf', () => {
  it('scores every EngineEvent variant into [0, 1]', () => {
    for (const e of ALL_EVENTS) {
      const v = interestOf(e);
      expect(Number.isFinite(v), e.type).toBe(true);
      expect(v, e.type).toBeGreaterThanOrEqual(0);
      expect(v, e.type).toBeLessThanOrEqual(1);
    }
  });

  it('puts a win at the top and the board markers at the bottom', () => {
    expect(interestOf({ type: 'game-won', player: 'a', reason: 'checkpoints' })).toBe(1);
    expect(interestOf({ type: 'turn-started', turn: 1 })).toBe(0);
    expect(interestOf({ type: 'turn-ended', turn: 1 })).toBe(0);
    expect(interestOf({ type: 'register-started', register: 3 })).toBe(0);
  });

  it('ranks a death above a checkpoint above a move above a rotation', () => {
    const fell = interestOf({ type: 'robot-fell', player: 'a', cause: 'pit', at: P(1, 1) });
    const cp = interestOf({ type: 'checkpoint-claimed', player: 'a', checkpoint: 1 });
    const moved = interestOf({
      type: 'robot-moved',
      player: 'a',
      from: P(1, 1),
      to: P(1, 2),
      pushed: false,
    });
    const rot = interestOf({ type: 'robot-rotated', player: 'a', from: 'N', to: 'E' });
    expect(fell).toBeGreaterThan(cp);
    expect(cp).toBeGreaterThan(moved);
    expect(moved).toBeGreaterThan(rot);
  });

  it('is worth more when a beam connects than when it misses', () => {
    const hit = interestOf({
      type: 'laser-fired',
      source: 'board',
      path: [P(0, 0), P(3, 0)],
      hit: 'b',
      strength: 1,
    });
    const miss = interestOf({ type: 'laser-fired', source: 'board', path: [P(0, 0)], strength: 1 });
    expect(hit).toBeGreaterThan(miss);
  });

  it('will not let a board laser firing into thin air move the camera', () => {
    // Board emitters fire into the same empty corridor every register. On Grand
    // Circuit the laser row is ten tiles from where the robots race, and while
    // this scored 0.5 the camera whipped off the robots and back four times a
    // turn. A player's missed shot still rates a glance.
    const boardMiss = interestOf({
      type: 'laser-fired',
      source: 'board',
      path: [P(0, 3), P(9, 3)],
      strength: 1,
    });
    const robotMiss = interestOf({
      type: 'laser-fired',
      source: 'robot',
      shooter: 'a',
      path: [P(0, 3), P(9, 3)],
      strength: 1,
    });
    expect(boardMiss).toBeLessThan(MIN_INTEREST);
    expect(robotMiss).toBeGreaterThanOrEqual(MIN_INTEREST);
  });

  it('draws the cut-through line at a death, a checkpoint and a win', () => {
    const cuts = ALL_EVENTS.filter((e) => interestOf(e) >= CUT_INTEREST).map((e) => e.type);
    expect(cuts.sort()).toEqual(
      ['checkpoint-claimed', 'game-won', 'robot-destroyed', 'robot-fell'].sort(),
    );
    // Notably NOT a laser: waiting a beat before the fourth board laser of the
    // register is right, waiting one before a destruction is not.
    expect(cuts).not.toContain('laser-fired');
  });

  it('puts card-revealed BELOW the threshold — the whole point of the phase', () => {
    // It holds the screen 450 ms, five times a register, and the old director
    // flew to the revealing player's robot for every one of them.
    const e: EngineEvent = {
      type: 'card-revealed',
      player: 'a',
      register: 1,
      card: { id: 'move1-500', type: 'move1', priority: 500 },
    };
    expect(interestOf(e)).toBeGreaterThan(0);
    expect(interestOf(e)).toBeLessThan(MIN_INTEREST);
  });

  it('gives the player-strip events nothing at all', () => {
    expect(interestOf({ type: 'register-locked', player: 'a', register: 4, card: null })).toBe(0);
    expect(interestOf({ type: 'life-lost', player: 'a', remaining: 1 })).toBe(0);
    // The robot vanished on robot-destroyed a beat earlier, which scored 0.9.
    expect(interestOf({ type: 'player-eliminated', player: 'a' })).toBe(0);
  });

  it('leaves everything that moves a robot above the threshold', () => {
    const movers: EngineEvent['type'][] = [
      'robot-moved',
      'conveyor-moved',
      'robot-rotated',
      'gear-rotated',
      'conveyor-rotated',
      'robot-blocked',
      'robot-fell',
      'robot-destroyed',
      'robot-respawned',
    ];
    for (const e of ALL_EVENTS) {
      if (movers.includes(e.type)) expect(interestOf(e), e.type).toBeGreaterThanOrEqual(MIN_INTEREST);
    }
  });
});

describe('eventPoints', () => {
  const c = ctx({ a: P(4, 7) });

  it('frames BOTH ends of a move, so a push does not read as a teleport', () => {
    expect(
      eventPoints(
        { type: 'robot-moved', player: 'a', from: P(1, 1), to: P(1, 4), pushed: true },
        c,
      ),
    ).toEqual([
      { x: 1, y: 1 },
      { x: 1, y: 4 },
    ]);
  });

  it('frames both ends of a conveyor ride too', () => {
    expect(
      eventPoints(
        { type: 'conveyor-moved', player: 'a', from: P(2, 2), to: P(5, 2), express: true },
        c,
      ),
    ).toEqual([
      { x: 2, y: 2 },
      { x: 5, y: 2 },
    ]);
  });

  it('frames muzzle AND impact of a beam, not its midpoint', () => {
    const pts = eventPoints(
      {
        type: 'laser-fired',
        source: 'board',
        path: [P(0, 3), P(1, 3), P(2, 3), P(8, 3)],
        hit: 'a',
        strength: 1,
      },
      c,
    );
    expect(pts).toEqual([
      { x: 0, y: 3 },
      { x: 8, y: 3 },
    ]);
  });

  it('has nothing to frame for a beam with no path', () => {
    expect(eventPoints({ type: 'laser-fired', source: 'board', path: [], strength: 1 }, c)).toEqual(
      [],
    );
  });

  it('frames the cell for a block and a destruction', () => {
    expect(eventPoints({ type: 'robot-blocked', player: 'a', at: P(3, 3), dir: 'E' }, c)).toEqual([
      { x: 3, y: 3 },
    ]);
    expect(eventPoints({ type: 'robot-destroyed', player: 'a', at: P(3, 3) }, c)).toEqual([
      { x: 3, y: 3 },
    ]);
  });

  it('frames only the pit cell for a pit fall — the robot drops in place', () => {
    expect(
      eventPoints({ type: 'robot-fell', player: 'a', cause: 'pit', at: P(3, 3) }, c),
    ).toEqual([{ x: 3, y: 3 }]);
  });

  it('reaches PAST the south rim for an edge fall — the 3D-4 open question', () => {
    const pts = eventPoints({ type: 'robot-fell', player: 'a', cause: 'edge', at: P(5, 11) }, c);
    expect(pts).toEqual([
      { x: 5, y: 11 },
      { x: 5, y: 11 + OVERHANG_TILES },
    ]);
  });

  it('reaches past whichever rim the fall touched', () => {
    const north = eventPoints({ type: 'robot-fell', player: 'a', cause: 'edge', at: P(5, 0) }, c);
    expect(north[1]).toEqual({ x: 5, y: -OVERHANG_TILES });
    const west = eventPoints({ type: 'robot-fell', player: 'a', cause: 'edge', at: P(0, 5) }, c);
    expect(west[1]).toEqual({ x: -OVERHANG_TILES, y: 5 });
    const east = eventPoints({ type: 'robot-fell', player: 'a', cause: 'edge', at: P(11, 5) }, c);
    expect(east[1]).toEqual({ x: 11 + OVERHANG_TILES, y: 5 });
  });

  it('extends BOTH ways off a corner, because the event cannot say which', () => {
    const pts = eventPoints({ type: 'robot-fell', player: 'a', cause: 'edge', at: P(11, 11) }, c);
    // The cell itself plus one virtual point per touched rim. Over-widening a
    // corner shot is harmless; framing the wrong side is not.
    expect(pts).toHaveLength(3);
    expect(pts).toContainEqual({ x: 11, y: 11 + OVERHANG_TILES });
    expect(pts).toContainEqual({ x: 11 + OVERHANG_TILES, y: 11 });
  });

  it('follows the robot for the events that only name a player', () => {
    expect(eventPoints({ type: 'damage', player: 'a', amount: 1, total: 2 }, c)).toEqual([
      { x: 4, y: 7 },
    ]);
    expect(eventPoints({ type: 'checkpoint-claimed', player: 'a', checkpoint: 1 }, c)).toEqual([
      { x: 4, y: 7 },
    ]);
    expect(eventPoints({ type: 'game-won', player: 'a', reason: 'last-standing' }, c)).toEqual([
      { x: 4, y: 7 },
    ]);
  });

  it('has nothing to frame when that robot is not on the board', () => {
    expect(eventPoints({ type: 'damage', player: 'ghost', amount: 1, total: 2 }, c)).toEqual([]);
  });

  it('has nothing to frame for the turn and register markers', () => {
    expect(eventPoints({ type: 'turn-started', turn: 1 }, c)).toEqual([]);
    expect(eventPoints({ type: 'turn-ended', turn: 1 }, c)).toEqual([]);
    expect(eventPoints({ type: 'register-started', register: 2 }, c)).toEqual([]);
  });

  it('never throws on any variant', () => {
    for (const e of ALL_EVENTS) expect(() => eventPoints(e, c)).not.toThrow();
  });
});

describe('lookaheadWindow', () => {
  const events = ALL_EVENTS;

  it('starts at the event on screen, which is events[cursor - 1]', () => {
    expect(lookaheadWindow(events, 3, 2)).toEqual([events[2], events[3]]);
  });

  it('starts at the first event when nothing has been applied yet', () => {
    // Cursor 0 means the replay has not started; the window is the opening run,
    // which is what lets the camera settle BEFORE register one rather than after.
    expect(lookaheadWindow(events, 0, 2)).toEqual([events[0], events[1]]);
  });

  it('runs off the end without padding', () => {
    const w = lookaheadWindow(events, events.length, 5);
    expect(w).toEqual([events[events.length - 1]]);
  });

  it('is empty when there is no log', () => {
    expect(lookaheadWindow(undefined, 4)).toEqual([]);
    expect(lookaheadWindow([], 4)).toEqual([]);
  });

  it('defaults to a window long enough to see past five card reveals', () => {
    // register-started + 5 card-revealed = 6 events of nothing worth a shot.
    expect(lookaheadWindow(events, 1).length).toBeGreaterThan(6);
  });

  it('survives a junk cursor', () => {
    expect(lookaheadWindow(events, -5, 2)).toEqual([events[0], events[1]]);
    expect(lookaheadWindow(events, 999, 2)).toEqual([events[events.length - 1]]);
  });
});

describe('planShot', () => {
  const c = ctx({ a: P(4, 7), b: P(9, 2) });

  it('frames the whole board when there is nothing to look at', () => {
    expect(planShot([], c)).toBeNull();
  });

  it('frames the whole board through a register lead-in of pure card reveals', () => {
    const lead: EngineEvent[] = [
      { type: 'register-started', register: 1 },
      ...(['a', 'b', 'a', 'b', 'a'] as const).map(
        (p, i): EngineEvent => ({
          type: 'card-revealed',
          player: p,
          register: 1,
          card: { id: `move1-${100 + i}`, type: 'move1', priority: 100 + i },
        }),
      ),
      { type: 'register-locked', player: 'a', register: 5, card: null },
    ];
    expect(planShot(lead, c)).toBeNull();
  });

  it('centres on a single event and never frames tighter than MIN_RADIUS', () => {
    const shot = planShot(
      [{ type: 'robot-destroyed', player: 'a', at: P(6, 6) }],
      c,
    );
    expect(shot).not.toBeNull();
    expect(shot!.x).toBe(6);
    expect(shot!.y).toBe(6);
    expect(shot!.radius).toBe(MIN_RADIUS);
    // Nothing to fit: MIN_RADIUS is padding, not a requirement, and only the
    // content is what the dwell rule asks about being in frame.
    expect(shot!.content).toBe(0);
    expect(shot!.reason).toBe('robot-destroyed');
  });

  it('centres a move between its ends', () => {
    const shot = planShot(
      [{ type: 'robot-moved', player: 'a', from: P(2, 4), to: P(6, 4), pushed: false }],
      c,
    );
    expect(shot!.x).toBe(4);
    expect(shot!.y).toBe(4);
  });

  it('WIDENS for a long beam rather than cropping one end off', () => {
    const shot = planShot(
      [
        {
          type: 'laser-fired',
          source: 'board',
          path: [P(0, 5), P(11, 5)],
          hit: 'a',
          strength: 1,
        },
      ],
      c,
    );
    expect(shot!.x).toBe(5.5);
    expect(shot!.radius).toBeGreaterThan(MIN_RADIUS);
    // Both ends inside the framing, which is what the old midpoint focus lost.
    expect(shot!.content).toBe(5.5);
    expect(shot!.radius).toBe(5.5);
  });

  it('merges a NEARBY second event into the same shot', () => {
    const shot = planShot(
      [
        { type: 'robot-destroyed', player: 'a', at: P(3, 3) },
        { type: 'conveyor-moved', player: 'b', from: P(5, 3), to: P(5, 4), express: false },
      ],
      c,
    );
    expect(shot!.x).toBe(4);
    expect(shot!.y).toBe(3.5);
  });

  it('REFUSES to merge two unrelated corners — the MAX_SPREAD rule', () => {
    // Without this the camera pulls back until both fit, which frames neither.
    const shot = planShot(
      [
        { type: 'robot-destroyed', player: 'a', at: P(1, 1) },
        { type: 'conveyor-moved', player: 'b', from: P(15, 15), to: P(15, 16), express: false },
      ],
      ctx({}, 18, 18),
    );
    expect(shot!.x).toBe(1);
    expect(shot!.y).toBe(1);
    expect(shot!.radius).toBe(MIN_RADIUS);
  });

  it('never lets an admitted event push the box past MAX_SPREAD', () => {
    const shot = planShot(
      [
        { type: 'robot-destroyed', player: 'a', at: P(0, 0) },
        { type: 'robot-blocked', player: 'b', at: P(4, 0), dir: 'E' },
        { type: 'robot-blocked', player: 'b', at: P(9, 0), dir: 'E' },
      ],
      ctx({}, 18, 18),
    );
    expect(shot!.radius * 2).toBeLessThanOrEqual(MAX_SPREAD + 1e-9 + 2 * MIN_RADIUS);
    // The 9-tile-away block is out; the 4-tile-away one is in.
    expect(shot!.x).toBe(2);
  });

  it('lets the PRESENT outrank an equally interesting future', () => {
    const now: EngineEvent = { type: 'robot-destroyed', player: 'a', at: P(1, 1) };
    const later: EngineEvent = { type: 'robot-destroyed', player: 'b', at: P(15, 15) };
    expect(planShot([now, later], ctx({}, 18, 18))!.x).toBe(1);
    expect(planShot([later, now], ctx({}, 18, 18))!.x).toBe(15);
  });

  it('lets a much more interesting event a few steps out win anyway', () => {
    const dull: EngineEvent = { type: 'robot-rotated', player: 'a', from: 'N', to: 'E' };
    const big: EngineEvent = { type: 'game-won', player: 'b', reason: 'checkpoints' };
    const shot = planShot([dull, dull, big], ctx({ a: P(1, 1), b: P(15, 15) }, 18, 18));
    expect(shot!.reason).toBe('game-won');
  });

  it('reports the seed event as the reason', () => {
    const shot = planShot(
      [
        { type: 'robot-rotated', player: 'a', from: 'N', to: 'E' },
        { type: 'checkpoint-claimed', player: 'a', checkpoint: 2 },
      ],
      c,
    );
    expect(shot!.reason).toBe('checkpoint-claimed');
  });

  it('pushes the centre off the rim for an edge fall so the throw has canvas', () => {
    const shot = planShot(
      [{ type: 'robot-fell', player: 'a', cause: 'edge', at: P(5, 11) }],
      c,
    );
    expect(shot!.y).toBeGreaterThan(11);
  });

  it('is a pure function of the window — the same input plans the same shot', () => {
    const w: EngineEvent[] = [
      { type: 'robot-moved', player: 'a', from: P(1, 1), to: P(1, 2), pushed: false },
      { type: 'damage', player: 'a', amount: 1, total: 1 },
    ];
    expect(planShot(w, c)).toEqual(planShot(w, c));
  });

  it('reports an interest in (0, 1] that decays with distance into the future', () => {
    const win: EngineEvent = { type: 'game-won', player: 'a', reason: 'checkpoints' };
    const pad: EngineEvent = { type: 'register-started', register: 1 };
    const now = planShot([win], c)!;
    const soon = planShot([pad, pad, win], c)!;
    expect(now.interest).toBe(1);
    expect(soon.interest).toBeLessThan(now.interest);
    expect(soon.interest).toBeGreaterThan(0);
  });
});

describe('contains', () => {
  const shot = (x: number, y: number, content = 0): Shot => ({
    x,
    y,
    radius: Math.max(content, MIN_RADIUS),
    content,
    interest: 0.5,
    reason: 'robot-moved',
  });

  it('contains itself', () => {
    expect(contains(shot(4, 4), shot(4, 4))).toBe(true);
  });

  it('holds through a nearby cell rather than nudging the camera at it', () => {
    // Two single-cell shots two tiles apart: the second cell was already well
    // inside the frame. A radius-to-radius test would have called this a cut.
    expect(contains(shot(4, 4), shot(6, 4))).toBe(true);
    expect(contains(shot(4, 4), shot(4, 6))).toBe(true);
  });

  it('rejects a cell out near the frame edge', () => {
    expect(contains(shot(4, 4), shot(9, 4))).toBe(false);
    // EDGE_MARGIN: technically inside the frame is not "already framed".
    expect(contains(shot(4, 4), shot(4 + MIN_RADIUS - 0.1, 4))).toBe(false);
  });

  it('rejects content wider than the outer framing however well centred', () => {
    expect(contains(shot(4, 4), shot(4, 4, 6))).toBe(false);
  });

  it('accepts wide content inside a wide shot, offset by the difference', () => {
    expect(contains(shot(4, 4, 8), shot(7, 4, 3))).toBe(true);
    expect(contains(shot(4, 4, 8), shot(16, 4, 3))).toBe(false);
  });
});

describe('shouldReplace', () => {
  const shot = (x: number, interest = 0.4, content = 0): Shot => ({
    x,
    y: 4,
    radius: Math.max(content, MIN_RADIUS),
    content,
    interest,
    reason: 'robot-moved',
  });

  it('adopts the first shot immediately', () => {
    expect(shouldReplace(null, shot(4), 0)).toBe(true);
  });

  it('does nothing when there is nothing to do', () => {
    expect(shouldReplace(null, null, 0)).toBe(false);
    expect(shouldReplace(null, null, 99)).toBe(false);
  });

  it('makes pulling back out to the whole board wait out the dwell too', () => {
    expect(shouldReplace(shot(4), null, 0.1)).toBe(false);
    expect(shouldReplace(shot(4), null, MIN_DWELL + 0.01)).toBe(true);
  });

  it('HOLDS STILL when the current shot already frames the next one', () => {
    // The point of look-ahead: this is the common case during a register.
    expect(shouldReplace(shot(4), shot(6), 10)).toBe(false);
  });

  it('holds a fresh shot against a merely comparable rival', () => {
    expect(shouldReplace(shot(4, 0.4), shot(11, 0.45), 0.1)).toBe(false);
  });

  it('lets a comparable rival through once the dwell has expired', () => {
    expect(shouldReplace(shot(4, 0.4), shot(11, 0.45), MIN_DWELL + 0.01)).toBe(true);
  });

  it('lets a clearly better rival through even inside the dwell', () => {
    expect(shouldReplace(shot(4, 0.3), shot(11, 0.6), 0.05)).toBe(true);
  });

  it('lets a HIGH-interest event cut through immediately', () => {
    // A destruction or a win that has to wait out a dwell timer is worse than a
    // slightly restless camera.
    expect(shouldReplace(shot(4, 0.9), shot(11, CUT_INTEREST), 0)).toBe(true);
  });

  it('still does not re-aim for a high-interest event already in frame', () => {
    expect(shouldReplace(shot(4, 0.2), shot(6, 1), 0)).toBe(false);
  });

  it('never re-aims for a shot it is already exactly on', () => {
    const s = shot(4);
    expect(shouldReplace(s, { ...s }, 0)).toBe(false);
    expect(shouldReplace(s, { ...s }, 100)).toBe(false);
  });
});

describe('easeTau', () => {
  it('uses the slow drift for a short hop', () => {
    expect(easeTau(0)).toBe(TAU_NEAR);
    expect(easeTau(1)).toBeGreaterThan(TAU_WHIP);
  });

  it('whips a cross-board re-aim', () => {
    expect(easeTau(WHIP_DISTANCE)).toBeCloseTo(TAU_WHIP, 10);
    expect(easeTau(40)).toBeCloseTo(TAU_WHIP, 10);
  });

  it('shortens monotonically with distance', () => {
    let prev = Infinity;
    for (let d = 0; d <= 20; d += 0.5) {
      const t = easeTau(d);
      expect(t).toBeLessThanOrEqual(prev);
      prev = t;
    }
  });

  it('never leaves the [TAU_WHIP, TAU_NEAR] band', () => {
    for (const d of [-3, 0, 0.01, 5, 9.9, 10, 1000]) {
      expect(easeTau(d)).toBeGreaterThanOrEqual(TAU_WHIP);
      expect(easeTau(d)).toBeLessThanOrEqual(TAU_NEAR);
    }
  });

  it('falls back to the slow drift on junk, so a NaN cannot freeze the camera', () => {
    // Anything non-finite is junk, not a very long shot: fall back rather than
    // guess.
    expect(easeTau(NaN)).toBe(TAU_NEAR);
    expect(easeTau(Infinity)).toBe(TAU_NEAR);
    expect(easeTau(-Infinity)).toBe(TAU_NEAR);
  });
});
