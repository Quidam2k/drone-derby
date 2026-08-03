// Telemetry client behavior: ring-buffer trim at 100, 5 s error-loop dedupe,
// and the no-throw guarantee when the environment has no localStorage (node)
// and no Convex backend. Runs in node like editorStore.test.ts — a fake
// Storage is installed per test.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// No backend in tests — the service must degrade to the local buffer alone.
vi.mock('./convex', () => ({ convexUrl: undefined, convex: null }));

import { APP_VERSION, dumpTelemetry, logFlowEvent, logTelemetry } from './telemetry';

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

  it('stamps every entry with the app version', () => {
    logTelemetry('note', 'stamped');
    const [entry] = dumpTelemetry() as { context: { appVersion: string } }[];
    expect(entry.context.appVersion).toBe(APP_VERSION);
    expect(APP_VERSION.length).toBeGreaterThan(0);
  });
});

describe('logFlowEvent', () => {
  it("buffers a kind:'flow' entry with the event as message", () => {
    logFlowEvent('renderer-fallback', { error: 'no context' });
    const [entry] = dumpTelemetry() as { kind: string; message: string; data?: unknown }[];
    expect(entry.kind).toBe('flow');
    expect(entry.message).toBe('renderer-fallback');
    expect(entry.data).toEqual({ error: 'no context' });
  });
});

/**
 * Flow rows are COUNTED — they feed the digest funnels — so a beacon silently
 * eaten by the dedupe window would deflate a rate rather than announce itself.
 * Two hot-seat turns or two route changes inside 5 s are ordinary play. These
 * assertions are what stop the funnels from becoming a plausible fiction.
 */
describe('flow dedupe keys on data', () => {
  it('keeps two flow events that differ only by data inside the window', () => {
    vi.useFakeTimers();
    vi.setSystemTime(2_000_000);
    logFlowEvent('hotseat-turn-executed', { turn: 1 });
    vi.setSystemTime(2_001_000); // 1 s later — well inside the 5 s window
    logFlowEvent('hotseat-turn-executed', { turn: 2 });

    const buffer = dumpTelemetry() as { data?: { turn: number } }[];
    expect(buffer).toHaveLength(2);
    expect(buffer.map((e) => e.data?.turn)).toEqual([1, 2]);
  });

  it('still collapses a flow event repeating identically', () => {
    vi.useFakeTimers();
    vi.setSystemTime(3_000_000);
    // A GPU thrashing the context is the flood the window exists to swallow:
    // it repeats with the same payload, so narrowing the key must not free it.
    logFlowEvent('webgl-context-lost', { deliberate: false });
    logFlowEvent('webgl-context-lost', { deliberate: false });
    expect(dumpTelemetry()).toHaveLength(1);
  });

  it('still collapses identical errors — the guard was narrowed, not widened', () => {
    vi.useFakeTimers();
    vi.setSystemTime(4_000_000);
    // Differing data must NOT split an error: a loop throwing the same error
    // carries a fresh stack every time, which would defeat the collapse.
    logTelemetry('error', 'loop', { stack: 'at a:1' });
    logTelemetry('error', 'loop', { stack: 'at b:2' });
    expect(dumpTelemetry()).toHaveLength(1);
  });

  it('does not throw on unserialisable flow data', () => {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    expect(() => logFlowEvent('circular-data', circular)).not.toThrow();
  });
});
