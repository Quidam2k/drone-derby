import type {
  BoardDef,
  Card,
  CardType,
  Direction,
  GameState,
  PlayerId,
  Program,
  RobotState,
} from '../types';
import type { EngineEvent, EventLog } from '../events';
import type { TurnResult } from '../execute';
import { executeTurn } from '../execute';
import { buildDeck, isRegisterLocked } from '../deck';

export function card(type: CardType, priority: number): Card {
  return { id: `${type}-${priority}`, type, priority };
}

export function robot(
  player: PlayerId,
  x: number,
  y: number,
  facing: Direction = 'N',
  overrides: Partial<RobotState> = {},
): RobotState {
  return {
    player,
    pos: { x, y },
    facing,
    damage: 0,
    lives: 3,
    checkpoints: 0,
    archive: { x, y },
    lockedRegisters: [null, null, null, null, null],
    destroyed: false,
    eliminated: false,
    ...overrides,
  };
}

export function makeState(board: BoardDef, robots: RobotState[]): GameState {
  return {
    board,
    robots,
    decks: Object.fromEntries(
      robots.map((r) => [r.player, { drawPile: buildDeck(), discardPile: [] }]),
    ),
    hands: Object.fromEntries(robots.map((r) => [r.player, []])),
    turn: 1,
    startPlayerIndex: 0,
    winner: null,
  };
}

/** Pad a partial program to the required 5 slots with idle (null) registers. */
export function prog(...cards: (Card | null)[]): Program {
  const p = cards.slice(0, 5);
  while (p.length < 5) p.push(null);
  return p;
}

/**
 * Run one turn of a hand-built scenario. Programs may be partial (padded
 * with nulls); players not mentioned idle all turn. Programmed cards are
 * injected into hands so executeTurn's hand validation passes.
 */
export function run(
  state: GameState,
  programs: Record<PlayerId, (Card | null)[]> = {},
  seed = 1,
): TurnResult {
  const full: Record<PlayerId, Program> = {};
  for (const r of state.robots) {
    if (r.eliminated) continue;
    const p = prog(...(programs[r.player] ?? []));
    state.hands[r.player] = p.filter((c): c is Card => c !== null);
    full[r.player] = p;
  }
  return executeTurn(state, full, seed);
}

/** Program the first hand cards into the unlocked slots, in dealt order. */
export function naiveProgram(state: GameState, player: PlayerId): Program {
  const robotState = state.robots.find((r) => r.player === player);
  if (!robotState) throw new Error(`no robot for ${player}`);
  const hand = state.hands[player].slice();
  const p: Program = [];
  for (let r = 1; r <= 5; r++) {
    p.push(isRegisterLocked(robotState.damage, r) ? null : (hand.shift() ?? null));
  }
  return p;
}

export function eventsOf<T extends EngineEvent['type']>(
  events: EventLog,
  type: T,
): Extract<EngineEvent, { type: T }>[] {
  return events.filter((e): e is Extract<EngineEvent, { type: T }> => e.type === type);
}

export function robotOf(result: TurnResult, player: PlayerId): RobotState {
  const r = result.state.robots.find((x) => x.player === player);
  if (!r) throw new Error(`no robot for ${player}`);
  return r;
}
