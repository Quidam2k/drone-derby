// Audio service: fail-silent guarantee in node environment, mute persistence,
// and exhaustive event-to-sound mapping. Runs under vitest with environment: 'node'
// (no DOM, no AudioContext, no localStorage).

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  // Install fake storage for each test.
  (globalThis as { localStorage?: Storage }).localStorage = fakeStorage();
  // Clear the audio module's state (via re-import isolation).
  vi.resetModules();
});

afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

describe('audio service', () => {
  it('defaults to muted (sounds are opt-in) and persists unmute', async () => {
    const { setMuted, isMuted, installAudio } = await import('./audio');

    installAudio(); // Empty localStorage → muted by default.
    expect(isMuted()).toBe(true);

    // Opt in and verify localStorage was written.
    setMuted(false);
    expect(isMuted()).toBe(false);
    expect(localStorage.getItem('dd-muted')).toBe('0');

    // Reset module state and re-import to simulate a new session:
    // the opt-in survives.
    vi.resetModules();
    const { isMuted: isMuted2, installAudio: installAudio2 } = await import('./audio');
    installAudio2();
    expect(isMuted2()).toBe(false);

    // And muting again round-trips.
    const { setMuted: setMuted2 } = await import('./audio');
    setMuted2(true);
    expect(localStorage.getItem('dd-muted')).toBe('1');
    expect(isMuted2()).toBe(true);
  });

  it('does not throw when AudioContext and localStorage are absent', async () => {
    delete (globalThis as { localStorage?: Storage }).localStorage;
    delete (globalThis as { AudioContext?: unknown }).AudioContext;

    const { installAudio, play, playForEvent, setMuted, isMuted } = await import('./audio');

    expect(() => {
      installAudio();
      play('move');
      playForEvent({ type: 'robot-moved', player: 'Alice', from: { x: 0, y: 0 }, to: { x: 1, y: 0 }, pushed: false });
      setMuted(true);
      isMuted();
    }).not.toThrow();
  });

  it('has exhaustive event-to-sound mapping for every event type', async () => {
    const { EVENT_SOUND } = await import('./audio');

    // Hand-written list of all EngineEvent types from src/engine/events.ts.
    const allEventTypes = [
      'turn-started',
      'register-started',
      'card-revealed',
      'robot-moved',
      'robot-blocked',
      'robot-rotated',
      'conveyor-moved',
      'conveyor-rotated',
      'gear-rotated',
      'pusher-fired',
      'laser-fired',
      'damage',
      'repair',
      'register-locked',
      'register-unlocked',
      'robot-fell',
      'robot-destroyed',
      'life-lost',
      'player-eliminated',
      'robot-respawned',
      'robot-powered-down',
      'robot-powered-up',
      'checkpoint-claimed',
      'game-won',
      'turn-ended',
    ] as const;

    // Every event type is in the mapping.
    for (const type of allEventTypes) {
      expect(EVENT_SOUND).toHaveProperty(type);
    }

    // Every entry in the mapping is a known sound or explicit null.
    const validSounds = new Set<string | null>([
      null,
      'card-flip',
      'card-deal',
      'move',
      'bump',
      'thud',
      'servo',
      'belt',
      'gear',
      'laser',
      'hit',
      'lock',
      'explosion',
      'life-lost',
      'eliminated',
      'respawn',
      'checkpoint',
      'fanfare',
      'click',
    ]);

    for (const sound of Object.values(EVENT_SOUND)) {
      expect(validSounds.has(sound)).toBe(true);
    }

    // Mapping size matches event types (no extraneous entries).
    expect(Object.keys(EVENT_SOUND)).toHaveLength(allEventTypes.length);
  });

  it('SOUND_NAMES matches the clips shipped in public/sounds/', async () => {
    const { SOUND_NAMES } = await import('./audio');
    const { readdirSync } = await import('node:fs');

    const onDisk = readdirSync('public/sounds')
      .filter((f) => f.endsWith('.mp3'))
      .map((f) => f.replace(/\.mp3$/, ''))
      .sort();
    expect([...SOUND_NAMES].sort()).toEqual(onDisk);
  });
});
