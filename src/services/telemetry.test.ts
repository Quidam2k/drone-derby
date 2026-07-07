// Telemetry client behavior: ring-buffer trim at 100, 5 s error-loop dedupe,
// and the no-throw guarantee when the environment has no localStorage (node)
// and no Convex backend. Runs in node like editorStore.test.ts — a fake
// Storage is installed per test.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// No backend in tests — the service must degrade to the local buffer alone.
vi.mock('./convex', () => ({ convexUrl: undefined, convex: null }));

import { dumpTelemetry, logTelemetry } from './telemetry';

/** Minimal in-memory Storage for node runs. */
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
});

afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
  vi.useRealTimers();
});

describe('logTelemetry', () => {
  it('keeps only the last 100 entries in the ring buffer', () => {
    for (let i = 0; i < 120; i++) logTelemetry('note', `trim-${i}`);
    const buffer = dumpTelemetry() as { message: string }[];
    expect(buffer).toHaveLength(100);
    expect(buffer[0].message).toBe('trim-20');
    expect(buffer[99].message).toBe('trim-119');
  });

  it('dedupes identical kind+message within 5 s', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000_000);
    logTelemetry('error', 'boom');
    logTelemetry('error', 'boom');
    expect(dumpTelemetry()).toHaveLength(1);

    // Same message under a different kind is not a dupe.
    logTelemetry('note', 'boom');
    expect(dumpTelemetry()).toHaveLength(2);

    // Past the window it logs again.
    vi.setSystemTime(1_000_000 + 5_001);
    logTelemetry('error', 'boom');
    expect(dumpTelemetry()).toHaveLength(3);
  });

  it('does not throw when localStorage is absent', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    expect(() => logTelemetry('error', 'no-storage')).not.toThrow();
    expect(dumpTelemetry()).toEqual([]);
  });

  it('survives a corrupted ring buffer', () => {
    localStorage.setItem('dd-telemetry', 'not json{');
    expect(() => logTelemetry('note', 'after-corruption')).not.toThrow();
    expect(dumpTelemetry()).toEqual([]);
  });
});
