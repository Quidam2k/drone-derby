// The screen beacon must count NAVIGATIONS, not renders and not hash edits.
// Every assertion here exists because the obvious implementation gets one of
// those wrong: a hook would count renders, and an unguarded listener would
// count `#/` → `#` as a visit to the lobby.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./convex', () => ({ convexUrl: undefined, convex: null }));

import { dumpTelemetry } from './telemetry';
import { installScreenBeacon, resetScreenBeacon, screenOf } from './screenBeacon';

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

type ScreenRow = { name: string; id?: string; n: number };

/** Screens the beacon emitted, in order, with the ordinal dropped. */
function screens(): { name: string; id?: string }[] {
  return rows().map(({ n: _n, ...rest }) => rest);
}

/** Screens as emitted, ordinal included. */
function rows(): ScreenRow[] {
  return (dumpTelemetry() as { kind: string; message: string; data?: ScreenRow }[])
    .filter((e) => e.kind === 'flow' && e.message === 'screen')
    .map((e) => e.data!);
}

describe('screenOf', () => {
  it('names the route and carries the id that makes it joinable', () => {
    expect(screenOf('#/')).toEqual({ name: 'home' });
    expect(screenOf('#/hotseat')).toEqual({ name: 'hotseat' });
    expect(screenOf('#/gallery')).toEqual({ name: 'gallery' });
    // Without the id a `screen` row for a game cannot be joined to the server
    // flow rows for that same game, which is most of its value.
    expect(screenOf('#/game/abc123')).toEqual({ name: 'game', id: 'abc123' });
    expect(screenOf('#/join/WXYZ')).toEqual({ name: 'join', id: 'WXYZ' });
    expect(screenOf('#/editor')).toEqual({ name: 'editor' });
    expect(screenOf('#/editor/b7')).toEqual({ name: 'editor', id: 'b7' });
  });
});

describe('installScreenBeacon', () => {
  let listeners: (() => void)[] = [];
  // The telemetry dedupe map is module-level and outlives a test, while
  // `resetScreenBeacon` restarts the ordinal at 1 — so without this every test
  // after the first would re-emit an identical `{name:'home',n:1}` and watch it
  // collapse. Each test gets its own clock, well outside the 5 s window.
  let base = 10_000_000;

  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
    listeners = [];
    base += 1_000_000;
    vi.useFakeTimers();
    vi.setSystemTime(base);
    // A minimal window: a mutable hash plus a hashchange registry we can fire.
    (globalThis as { window?: unknown }).window = {
      location: { hash: '#/' },
      addEventListener: (type: string, cb: () => void) => {
        if (type === 'hashchange') listeners.push(cb);
      },
    };
    resetScreenBeacon();
  });

  afterEach(() => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    delete (globalThis as { window?: unknown }).window;
    vi.useRealTimers();
  });

  const go = (hash: string) => {
    (globalThis as { window: { location: { hash: string } } }).window.location.hash = hash;
    for (const cb of listeners) cb();
  };

  it('emits the entry screen so a session that never navigates is still counted', () => {
    installScreenBeacon();
    expect(screens()).toEqual([{ name: 'home' }]);
  });

  it('emits once per navigation, including two inside the dedupe window', () => {
    // The 5 s telemetry dedupe used to eat the second of these. A funnel that
    // silently drops rows reads as a real denominator and is not one.
    installScreenBeacon();
    go('#/hotseat');
    vi.setSystemTime(base + 1_000); // 1 s later, well inside the window
    go('#/gallery');

    expect(screens()).toEqual([{ name: 'home' }, { name: 'hotseat' }, { name: 'gallery' }]);
  });

  it('does not count a hash edit that lands on the same screen', () => {
    installScreenBeacon();
    go('#'); // still the lobby — a change of hash, not a navigation
    go('#/');
    expect(screens()).toEqual([{ name: 'home' }]);
  });

  it('counts a return visit inside the dedupe window', () => {
    // home → hotseat → home emits two byte-identical payloads, so keying the
    // dedupe on data cannot save this one — only the ordinal can. Dropping the
    // second `home` would under-count the lobby for every session that backs
    // out of a game, which is most of them.
    installScreenBeacon();
    go('#/hotseat');
    vi.setSystemTime(base + 500); // half a second later
    go('#/');
    expect(screens()).toEqual([{ name: 'home' }, { name: 'hotseat' }, { name: 'home' }]);
  });

  it('numbers navigations in visit order', () => {
    installScreenBeacon();
    go('#/hotseat');
    go('#/gallery');
    expect(rows().map((r) => r.n)).toEqual([1, 2, 3]);
  });

  it('treats two different games as two screens', () => {
    installScreenBeacon();
    go('#/game/aaa');
    go('#/game/bbb');
    expect(screens()).toEqual([
      { name: 'home' },
      { name: 'game', id: 'aaa' },
      { name: 'game', id: 'bbb' },
    ]);
  });
});
