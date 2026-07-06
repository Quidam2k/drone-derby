import type { Card, Direction, PlayerId, Position } from './types';

/**
 * The EventLog is the animation contract: the Phase 2 replay player consumes
 * ONLY this stream. Events are atomic, ordered, and grouped by the
 * register-started markers. Every visible change on the board has an event.
 */
export type EngineEvent =
  | { type: 'turn-started'; turn: number }
  | { type: 'register-started'; register: number }
  | { type: 'card-revealed'; player: PlayerId; register: number; card: Card }
  | { type: 'robot-moved'; player: PlayerId; from: Position; to: Position; pushed: boolean }
  | { type: 'robot-blocked'; player: PlayerId; at: Position; dir: Direction }
  | { type: 'robot-rotated'; player: PlayerId; from: Direction; to: Direction }
  | { type: 'conveyor-moved'; player: PlayerId; from: Position; to: Position; express: boolean }
  | { type: 'gear-rotated'; player: PlayerId; cw: boolean; from: Direction; to: Direction }
  | {
      type: 'laser-fired';
      source: 'board' | 'robot';
      /** Set when source === 'robot'. */
      shooter?: PlayerId;
      /** Cells the beam crosses, emitter/muzzle first. Last cell = hit cell if hit. */
      path: Position[];
      hit?: PlayerId;
      strength: number;
    }
  | { type: 'damage'; player: PlayerId; amount: number; total: number }
  | { type: 'register-locked'; player: PlayerId; register: number; card: Card | null }
  | {
      type: 'robot-fell';
      player: PlayerId;
      cause: 'pit' | 'edge';
      /** Pit: the pit cell. Edge: the last in-bounds cell before falling off. */
      at: Position;
    }
  | { type: 'robot-destroyed'; player: PlayerId; at: Position }
  | { type: 'life-lost'; player: PlayerId; remaining: number }
  | { type: 'player-eliminated'; player: PlayerId }
  | { type: 'robot-respawned'; player: PlayerId; pos: Position; facing: Direction }
  | { type: 'checkpoint-claimed'; player: PlayerId; checkpoint: number }
  | { type: 'game-won'; player: PlayerId; reason: 'checkpoints' | 'last-standing' }
  | { type: 'turn-ended'; turn: number };

export type EventLog = EngineEvent[];
