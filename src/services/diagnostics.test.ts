// The repro key attached to 🐞 notes. This is the only instrument that can
// see a rules mistake producing the WRONG OUTCOME — nothing throws, so a note
// without a seed is a complaint we can never reproduce. These tests exist to
// keep the seed, turn and ring-buffer tail on the payload.
//
// Runs in node like telemetry.test.ts: a fake Storage is installed per test.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./convex', () => ({ convexUrl: undefined, convex: null }));

import { collectRepro } from './diagnostics';
import { logTelemetry } from './telemetry';
import { useGameStore } from '../store/gameStore';

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
  useGameStore.getState().newGame();
});

afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
  useGameStore.getState().newGame();
});

describe('collectRepro', () => {
  it('omits hot-seat details when no game is running', () => {
    expect(collectRepro().hotSeat).toBeUndefined();
  });

  it('carries the exact turn seed a hot-seat report needs to replay', () => {
    useGameStore.getState().startGame(['Ada', 'Rex']);
    const { game, initialSeed } = useGameStore.getState();

    const repro = collectRepro();
    expect(repro.hotSeat).toBeDefined();
    // Must match gameStore's own `initialSeed + game.turn`, or the report
    // replays a different turn than the one being complained about.
    expect(repro.hotSeat?.seed).toBe(initialSeed + game!.turn);
    expect(repro.hotSeat?.turn).toBe(game!.turn);
    expect(repro.hotSeat?.playerCount).toBe(2);
  });

  it('attaches the tail of the ring buffer, newest last', () => {
    for (let i = 0; i < 40; i++) logTelemetry('note', `run-up-${i}`);
    const recent = collectRepro().recent as { message: string }[];
    expect(recent).toHaveLength(15);
    expect(recent[14].message).toBe('run-up-39');
  });

  it('reports the build stamp so a note can be tied to a deploy', () => {
    expect(collectRepro().appVersion).toBeTruthy();
  });

  it('never throws without a DOM', () => {
    expect(() => collectRepro()).not.toThrow();
  });
});
