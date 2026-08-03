// Hot-seat resilience (phase P2).
//
// Two failures used to compound into one: the engine threw, the error escaped
// as an uncaught exception carrying only a stack, and the player's natural
// response — reload — erased the memory-only game along with the last of the
// evidence. These tests hold both halves down: a throw is captured WITH its
// repro key, and a game survives a reload.
//
// Runs in node like the other store tests; a fake Storage is installed per
// test and the module is re-imported to exercise its load-on-init path.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../services/convex', () => ({ convexUrl: undefined, convex: null }));

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: () => null,
    get length() {
      return map.size;
    },
  } as Storage;
}

beforeEach(() => {
  (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  vi.resetModules();
});

afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

/**
 * Fresh module instance, so the store re-runs loadSave() at creation — this is
 * what stands in for a page reload. The resetModules() call must live HERE and
 * not only in beforeEach: without it the second import inside a test returns
 * the cached module, the "reloaded" store is the same object as the original,
 * and the persistence assertions pass without persistence existing at all.
 */
async function freshStore() {
  vi.resetModules();
  const mod = await import('./gameStore');
  return mod.useGameStore;
}

describe('hot-seat persistence', () => {
  it('saves a started game so a reload can resume it', async () => {
    const first = await freshStore();
    first.getState().startGame(['Ada', 'Rex']);
    const seed = first.getState().initialSeed;

    // A reload is a brand new module instance reading the same storage.
    const second = await freshStore();
    expect(second.getState().game).not.toBeNull();
    expect(second.getState().initialSeed).toBe(seed);
    expect(second.getState().screen).toBe('handoff');
    expect(second.getState().game!.robots).toHaveLength(2);
  });

  it('keeps the seed identical across a reload, or replays diverge', async () => {
    const first = await freshStore();
    first.getState().startGame(['Ada', 'Rex']);
    const before = first.getState().game!;

    const second = await freshStore();
    // Same seed AND same turn means the next turn resolves identically — the
    // whole point of persisting rather than restarting.
    expect(second.getState().game!.turn).toBe(before.turn);
    expect(second.getState().initialSeed).toBe(first.getState().initialSeed);
  });

  it('resumes at handoff rather than a replay it can no longer show', async () => {
    const first = await freshStore();
    first.getState().startGame(['Ada', 'Rex']);
    // lastTurn is deliberately not persisted, so a save taken mid-replay must
    // not restore into the replay screen — that would dereference null.
    const raw = JSON.parse(localStorage.getItem('dd-hotseat')!) as Record<string, unknown>;
    localStorage.setItem('dd-hotseat', JSON.stringify({ ...raw, screen: 'replay' }));

    const second = await freshStore();
    expect(second.getState().screen).toBe('handoff');
    expect(second.getState().lastTurn).toBeNull();
  });

  it('clears the save on a new game', async () => {
    const store = await freshStore();
    store.getState().startGame(['Ada', 'Rex']);
    expect(localStorage.getItem('dd-hotseat')).not.toBeNull();
    store.getState().newGame();
    expect(localStorage.getItem('dd-hotseat')).toBeNull();
  });

  it('starts clean when the save is corrupt instead of throwing', async () => {
    localStorage.setItem('dd-hotseat', '{not json');
    const store = await freshStore();
    expect(store.getState().game).toBeNull();
    expect(store.getState().screen).toBe('setup');
  });

  it('ignores a save written by an older schema', async () => {
    const first = await freshStore();
    first.getState().startGame(['Ada', 'Rex']);
    const raw = JSON.parse(localStorage.getItem('dd-hotseat')!) as Record<string, unknown>;
    localStorage.setItem('dd-hotseat', JSON.stringify({ ...raw, version: 0 }));

    const second = await freshStore();
    expect(second.getState().game).toBeNull();
  });
});

describe('turn error capture', () => {
  it('surfaces a turn failure instead of leaving a frozen screen', async () => {
    const store = await freshStore();
    store.getState().startGame(['Ada', 'Rex']);

    // A program whose cards are not in hand is rejected by the engine — the
    // same shape as a real hot-seat throw, without mocking the engine.
    const game = store.getState().game!;
    const bogus = Array.from({ length: 5 }, (_, i) => ({
      id: `not-in-hand-${i}`,
      type: 'move1' as const,
      priority: 100 + i,
    }));
    for (let seat = 0; seat < game.robots.length; seat++) {
      store.getState().beginProgramming();
      store.getState().submitProgram(bogus as never);
    }

    expect(store.getState().turnError).toBeTruthy();
    // The game is left standing so the state is still there to inspect.
    expect(store.getState().game).not.toBeNull();
  });
});

/**
 * Hot-seat lifecycle beacons (phase P3). Hot-seat is the mode Todd describes
 * himself using and it emitted nothing at all before this; these are the only
 * numbers the digest will ever have for it. Each assertion below guards a way
 * the count could be wrong while still looking like a count.
 */
describe('hot-seat beacons', () => {
  // startGame seeds from Date.now(), so an unpinned clock deals a different
  // game every run and these assertions would pass or fail by luck. Pinning it
  // also means both turn beacons land on the same timestamp, which is exactly
  // the dedupe-window case one of these tests exists to prove.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_700_000_000_000);
  });
  afterEach(() => vi.useRealTimers());

  /** Store plus the telemetry buffer from the SAME module instance. */
  async function freshPair() {
    vi.resetModules();
    const store = (await import('./gameStore')).useGameStore;
    const { dumpTelemetry } = await import('../services/telemetry');
    const flow = (event: string) =>
      (dumpTelemetry() as { kind: string; message: string; data?: Record<string, unknown> }[])
        .filter((e) => e.kind === 'flow' && e.message === event)
        .map((e) => e.data ?? {});
    return { store, flow };
  }

  /**
   * Drop the telemetry ring buffer. It deliberately SURVIVES a reload — that is
   * the point of it — so a post-reload assertion would otherwise see the rows
   * emitted before the reload and prove nothing about the reload itself.
   */
  const wipeBuffer = () => localStorage.removeItem('dd-telemetry');

  /**
   * Play one full turn by submitting each seat's own dealt cards.
   *
   * Locked registers must stay null and the hand shrinks by one card per point
   * of damage, so a naive `hand.slice(0, 5)` submits an invalid program the
   * moment a robot takes 5 damage — which board lasers can do on turn one. That
   * made this helper, and only this helper, fail on roughly one seed in three.
   */
  function playTurn(store: Awaited<ReturnType<typeof freshPair>>['store']) {
    const seats = store.getState().game!.robots.length;
    for (let i = 0; i < seats; i++) {
      const active = store.getState().game!;
      const robot = active.robots[store.getState().currentSeat];
      const hand = active.hands[robot.player] ?? [];
      let next = 0;
      const program = robot.lockedRegisters.map((locked) =>
        locked ? null : (hand[next++] ?? null),
      );
      store.getState().beginProgramming();
      store.getState().submitProgram(program as never);
    }
  }

  it('reports a started game with the key that reproduces it', async () => {
    const { store, flow } = await freshPair();
    store.getState().startGame(['Ada', 'Rex']);

    expect(flow('hotseat-game-started')).toEqual([
      { boardName: expect.any(String), playerCount: 2, seed: store.getState().initialSeed },
    ]);
  });

  it('does NOT report a started game on resume', async () => {
    // The subtlest way this funnel could lie. A resume counted as a new start
    // inflates the denominator, so completion rate silently deflates — one
    // game started twice and finished once.
    const { store } = await freshPair();
    store.getState().startGame(['Ada', 'Rex']);
    wipeBuffer();

    const { flow: flowAfterReload } = await freshPair();
    expect(flowAfterReload('hotseat-game-started')).toEqual([]);
  });

  it('reports each executed turn, including two inside the dedupe window', async () => {
    const { store, flow } = await freshPair();
    store.getState().startGame(['Ada', 'Rex']);
    playTurn(store);
    store.getState().finishReplay();
    playTurn(store);

    // Back-to-back turns are ordinary in a fast game; if the 5 s dedupe ate
    // one, "turns executed" would quietly under-report play.
    const turns = flow('hotseat-turn-executed');
    expect(turns.map((d) => d.turn)).toEqual([1, 2]);
    expect(turns[0].playerCount).toBe(2);
    expect(turns[0].ms).toBeTypeOf('number');
  });

  it('names the turn just watched, not the one about to be programmed', async () => {
    const { store, flow } = await freshPair();
    store.getState().startGame(['Ada', 'Rex']);
    playTurn(store);
    // executeTurn advanced the state to turn 2; the replay just shown is turn 1.
    expect(store.getState().game!.turn).toBe(2);
    store.getState().finishReplay();

    expect(flow('replay-watched')).toEqual([{ turn: 1 }]);
  });

  it('reports a finished game, and names its last turn correctly', async () => {
    const { store, flow } = await freshPair();
    store.getState().startGame(['Ada', 'Rex']);
    playTurn(store);
    // executeTurn does NOT advance `turn` on the turn that ends the game, so a
    // blanket turn-1 would misname the final turn — the one most likely to be
    // the subject of a bug report.
    const won = { ...store.getState().game!, winner: 'Ada' };
    store.setState({ game: won });
    store.getState().finishReplay();

    expect(store.getState().screen).toBe('gameover');
    expect(flow('replay-watched').at(-1)).toEqual({ turn: won.turn });
    expect(flow('hotseat-game-finished')).toEqual([
      { turns: won.turn, winner: true, playerCount: 2 },
    ]);
  });

  it('still reports a finish when the tab reloads during the winning replay', async () => {
    // finishReplay never runs in this path, so without the resume-side emit a
    // completed game would sit in the funnel looking abandoned.
    const { store } = await freshPair();
    store.getState().startGame(['Ada', 'Rex']);
    playTurn(store);
    store.setState({ game: { ...store.getState().game!, winner: 'Ada' }, screen: 'replay' });
    // Persist that mid-replay state the way every screen transition does.
    store.getState().beginProgramming();
    store.setState({ screen: 'replay' });
    const raw = JSON.parse(localStorage.getItem('dd-hotseat')!);
    localStorage.setItem('dd-hotseat', JSON.stringify({ ...raw, screen: 'replay' }));
    wipeBuffer();

    const { store: reloaded, flow } = await freshPair();
    expect(reloaded.getState().screen).toBe('gameover');
    expect(flow('hotseat-game-finished')).toEqual([
      { turns: expect.any(Number), winner: true, playerCount: 2, viaResume: true },
    ]);
  });

  it('does not re-report a finish on every reload of the game-over screen', async () => {
    // The mirror of the case above: a save already reading 'gameover' is one
    // whose finish was reported before it was written. Re-emitting here would
    // count one completed game once per idle refresh.
    const { store } = await freshPair();
    store.getState().startGame(['Ada', 'Rex']);
    playTurn(store);
    store.setState({ game: { ...store.getState().game!, winner: 'Ada' } });
    store.getState().finishReplay();
    wipeBuffer();

    const { flow } = await freshPair();
    expect(flow('hotseat-game-finished')).toEqual([]);
  });
});
