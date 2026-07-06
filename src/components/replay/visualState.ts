// VisualState is what the board renderer draws: robot positions, facings,
// damage/lives, claimed checkpoints. It is derived EITHER from a live
// GameState (programming view) OR by folding EngineEvents (replay player).
// The replay player must never look at GameState diffs — only events —
// because in Phase 3 it replays turns fetched from Convex with no engine run.

import type { Direction, GameState, PlayerId, Position } from '../../engine';
import type { EngineEvent, EventLog } from '../../engine';
import { RESPAWN_DAMAGE } from '../../engine';

export interface RobotVisual {
  player: PlayerId;
  pos: Position;
  facing: Direction;
  damage: number;
  lives: number;
  checkpoints: number;
  /** False while destroyed (fell/exploded) or eliminated — not drawn. */
  visible: boolean;
  eliminated: boolean;
}

export interface VisualState {
  /** Seat order, same as GameState.robots. */
  robots: RobotVisual[];
  /** 1–5 during a turn, 0 before the first register-started event. */
  register: number;
  winner: PlayerId | null;
}

/** Snapshot a GameState into the renderer's input. */
export function initialVisual(state: GameState): VisualState {
  return {
    robots: state.robots.map((r) => ({
      player: r.player,
      pos: { ...r.pos },
      facing: r.facing,
      damage: r.damage,
      lives: r.lives,
      checkpoints: r.checkpoints,
      visible: !r.destroyed && !r.eliminated,
      eliminated: r.eliminated,
    })),
    register: 0,
    winner: state.winner,
  };
}

function updateRobot(
  v: VisualState,
  player: PlayerId,
  patch: Partial<RobotVisual>,
): VisualState {
  return {
    ...v,
    robots: v.robots.map((r) => (r.player === player ? { ...r, ...patch } : r)),
  };
}

/**
 * Pure reducer: fold one event into the visual state. Transient events
 * (laser beams, blocked bumps, card reveals) change nothing here — the
 * replay player renders those as overlays keyed off the current event.
 */
export function applyEvent(v: VisualState, e: EngineEvent): VisualState {
  switch (e.type) {
    case 'register-started':
      return { ...v, register: e.register };
    case 'robot-moved':
    case 'conveyor-moved':
      return updateRobot(v, e.player, { pos: { ...e.to } });
    case 'robot-rotated':
    case 'gear-rotated':
      return updateRobot(v, e.player, { facing: e.to });
    case 'damage':
      return updateRobot(v, e.player, { damage: e.total });
    case 'robot-fell':
    case 'robot-destroyed':
      return updateRobot(v, e.player, { visible: false });
    case 'life-lost':
      return updateRobot(v, e.player, { lives: e.remaining });
    case 'player-eliminated':
      return updateRobot(v, e.player, { eliminated: true, visible: false });
    case 'robot-respawned':
      // The engine resets damage on respawn without a damage event.
      return updateRobot(v, e.player, {
        pos: { ...e.pos },
        facing: e.facing,
        damage: RESPAWN_DAMAGE,
        visible: true,
      });
    case 'checkpoint-claimed':
      return updateRobot(v, e.player, { checkpoints: e.checkpoint });
    case 'game-won':
      return { ...v, winner: e.player };
    case 'turn-started':
    case 'turn-ended':
    case 'card-revealed':
    case 'robot-blocked':
    case 'laser-fired':
    case 'register-locked':
      return v;
  }
}

/**
 * Visual state after applying the first `cursor` events (cursor 0 = none,
 * events.length = the whole turn). Stepping back just re-folds from the
 * start — event logs are small.
 */
export function visualAt(initial: VisualState, events: EventLog, cursor: number): VisualState {
  let v = initial;
  const n = Math.max(0, Math.min(cursor, events.length));
  for (let i = 0; i < n; i++) v = applyEvent(v, events[i]);
  return v;
}
