// Speech-bubble timing for the replay. Taunts ride alongside the EventLog
// (they're submitted with programs, not emitted by the engine): a player's
// bubble pops up the moment their first card of the turn is revealed — right
// before their robot acts — and lingers for the next few events.

import type { EventLog, PlayerId } from '../../engine';

/** How many events past the reveal a bubble stays on screen. */
const LINGER_EVENTS = 8;

export interface TauntWindow {
  /** First replay cursor (event count applied) at which the bubble shows. */
  from: number;
  /** Last cursor at which it still shows. */
  to: number;
}

/** Per-player cursor windows during which that player's bubble is visible. */
export function tauntWindows(events: EventLog): Record<PlayerId, TauntWindow> {
  const windows: Record<PlayerId, TauntWindow> = {};
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    if (e.type === 'card-revealed' && !(e.player in windows)) {
      windows[e.player] = { from: i + 1, to: Math.min(i + 1 + LINGER_EVENTS, events.length) };
    }
  }
  return windows;
}

/** Players whose bubbles are visible at this cursor (only those with taunts). */
export function visibleTaunts(
  taunts: Record<PlayerId, string>,
  windows: Record<PlayerId, TauntWindow>,
  cursor: number,
): { player: PlayerId; text: string }[] {
  return Object.entries(taunts)
    .filter(([player]) => {
      const w = windows[player];
      return w !== undefined && cursor >= w.from && cursor <= w.to;
    })
    .map(([player, text]) => ({ player, text }));
}
