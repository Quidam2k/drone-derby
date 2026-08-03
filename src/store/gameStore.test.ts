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
