// Sound effects service: lazy AudioContext, fail-silent, Web Audio only.
// Follows the same philosophy as telemetry.ts — audio must NEVER throw or
// break the game. Service layer only — never import into src/engine/.

import type { EngineEvent } from '../engine';

/** Every clip in public/sounds/. Drives loadAll — keep in sync with disk. */
export const SOUND_NAMES = [
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
] as const;

export type SoundName = (typeof SOUND_NAMES)[number];

/** Exhaustive event → sound mapping. Null = silent. */
export const EVENT_SOUND = {
  'turn-started': null,
  'register-started': null,
  'card-revealed': 'card-flip',
  'robot-moved': 'move',
  'robot-blocked': 'thud',
  'robot-rotated': 'servo',
  'conveyor-moved': 'belt',
  // The bend reuses the rotation servo — it's a facing change, not a belt hum.
  'conveyor-rotated': 'servo',
  'gear-rotated': 'gear',
  // The piston shares the wall-bump thud — same physical language, one clip.
  'pusher-fired': 'thud',
  'laser-fired': 'laser',
  'damage': 'hit',
  // No new clips this phase: 'respawn' is the existing restorative sound,
  // and end-of-turn repair rarely shares a beat with an actual respawn.
  'repair': 'respawn',
  'register-locked': 'lock',
  'register-unlocked': null,
  'robot-fell': 'explosion',
  'robot-destroyed': 'explosion',
  'life-lost': 'life-lost',
  // No new clips (phase 36): the crusher slam borrows the pusher's
  // mechanical thud, teleporting borrows the respawn shimmer, and a
  // repulsor fling borrows the collision bump.
  'crusher-crushed': 'thud',
  'robot-teleported': 'respawn',
  'repulsed': 'bump',
  'player-eliminated': 'eliminated',
  'robot-respawned': 'respawn',
  // No new clips (phase 33): powering down borrows the register-lock clunk,
  // powering up the restorative respawn chime.
  'robot-powered-down': 'lock',
  'robot-powered-up': 'respawn',
  'checkpoint-claimed': 'checkpoint',
  'game-won': 'fanfare',
  'turn-ended': null,
} as const satisfies Record<EngineEvent['type'], SoundName | null>;

/** Per-clip volume adjustments (0–1, relative to master gain).
 * All clips are loudness-normalized to a common −23 LUFS (phase 25), so
 * these set the relative mix: frequent per-register sounds sit lowest,
 * notifications mid, one-off jingles highest. */
const CLIP_VOLUMES: Partial<Record<SoundName, number>> = {
  'card-flip': 0.8, // peak-capped quieter than −23 during normalization
  'card-deal': 0.6,
  'move': 0.55, // peak-capped quieter than −23
  'bump': 0.45,
  'thud': 0.45,
  'servo': 0.35,
  'belt': 0.45,
  'gear': 0.35,
  'laser': 0.4,
  'hit': 0.55,
  'lock': 0.6,
  'explosion': 0.65,
  'life-lost': 0.7,
  'eliminated': 0.7,
  'respawn': 0.65,
  'checkpoint': 0.8,
  'fanfare': 0.9,
  'click': 0.9, // peak-capped quieter than −23
};

const MUTE_KEY = 'dd-muted';

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let audioBuffers: Map<SoundName, AudioBuffer> = new Map();
let isMutedState = readMutedState();
let audioInstalled = false;

/** Read mute state from localStorage safely. Sounds are OPT-IN: muted
 * unless the user has explicitly unmuted ('0'). */
function readMutedState(): boolean {
  try {
    if (typeof localStorage === 'undefined') return true;
    const raw = localStorage.getItem(MUTE_KEY);
    return raw !== '0';
  } catch {
    return true;
  }
}

/** Write mute state to localStorage safely. */
function writeMutedState(muted: boolean): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
  } catch {
    // Quota or access denied — fail silently.
  }
}

/** Lazily initialize AudioContext and master gain on first use. */
function initAudioContext(): AudioContext | null {
  try {
    if (audioContext) return audioContext;
    if (typeof window === 'undefined' || typeof AudioContext === 'undefined') return null;
    audioContext = new AudioContext();
    masterGain = audioContext.createGain();
    masterGain.connect(audioContext.destination);
    // Apply current mute state to master gain.
    masterGain.gain.value = isMutedState ? 0 : 1;
    return audioContext;
  } catch {
    return null;
  }
}

/** Fetch and decode all audio clips into buffers. Fails silently per clip. */
export async function loadAll(): Promise<void> {
  try {
    const ctx = initAudioContext();
    if (!ctx) return;

    // All clips, not just event-mapped ones — bump/card-deal/click are
    // only reachable through play() calls and special cases.
    await Promise.allSettled(
      SOUND_NAMES.map(async (sound) => {
        if (audioBuffers.has(sound)) return;

        const url = `/sounds/${sound}.mp3`;
        const response = await fetch(url);
        if (!response.ok) return;
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await ctx.decodeAudioData(arrayBuffer);
        audioBuffers.set(sound, buffer);
      }),
    );
    // Fail silently — any that settled are now loaded.
  } catch {
    // Fetch or decode errors are silently absorbed.
  }
}

/** Play a named sound with optional volume and pitch. Silently no-ops if conditions aren't met. */
export function play(name: SoundName, opts?: { volume?: number; pitch?: number }): void {
  try {
    if (isMutedState) return;
    const ctx = audioContext || initAudioContext();
    if (!ctx || !masterGain) return;

    const buffer = audioBuffers.get(name);
    if (!buffer) return; // Not loaded yet.

    const source = ctx.createBufferSource();
    const gain = ctx.createGain();

    source.buffer = buffer;
    source.playbackRate.value = opts?.pitch ?? 1;

    // Apply per-clip default volume, then optional override.
    const clipVol = CLIP_VOLUMES[name] ?? 1;
    gain.gain.value = (opts?.volume ?? 1) * clipVol;

    source.connect(gain);
    gain.connect(masterGain);
    source.start(0);
  } catch {
    // Source, gain, or playback errors are silently absorbed.
  }
}

/** Map an engine event to sound and play it. Handles special cases (pushed, express). */
export function playForEvent(event: EngineEvent): void {
  try {
    const baseSound = EVENT_SOUND[event.type];
    if (!baseSound) return; // Explicitly silent event.

    // Special cases: map based on event properties.
    if (event.type === 'robot-moved' && event.pushed) {
      play('bump');
    } else if (event.type === 'conveyor-moved' && event.express) {
      play(baseSound, { pitch: 1.3 });
    } else {
      play(baseSound);
    }
  } catch {
    // Event handling errors are silently absorbed.
  }
}

/** Mute/unmute audio. Persists to localStorage. */
export function setMuted(muted: boolean): void {
  try {
    isMutedState = muted;
    writeMutedState(muted);
    if (masterGain) {
      masterGain.gain.value = muted ? 0 : 1;
    }
  } catch {
    // State updates are fail-silent.
  }
}

/** Query current mute state. */
export function isMuted(): boolean {
  return isMutedState;
}

/** Install the service: one-time pointerdown listener to resume AudioContext (autoplay unlock),
 * then load all clips. Called once from src/main.tsx. */
export function installAudio(): void {
  try {
    if (audioInstalled) return;
    audioInstalled = true;

    // Read mute state from localStorage immediately (before any UI render).
    isMutedState = readMutedState();

    if (typeof document === 'undefined') return; // Node test environment.

    // One-time pointerdown to resume AudioContext (breaks autoplay lock).
    const unlock = () => {
      try {
        const ctx = initAudioContext();
        if (ctx && ctx.state === 'suspended') {
          ctx.resume().catch(() => {});
        }
      } catch {
        // Resume errors are silently absorbed.
      }
      document.removeEventListener('pointerdown', unlock, true);
    };
    document.addEventListener('pointerdown', unlock, true);

    // Lazy-load clips on first gesture (after unlock).
    const lazyLoad = () => {
      try {
        loadAll().catch(() => {});
      } catch {
        // Load errors are silently absorbed.
      }
      document.removeEventListener('pointerdown', lazyLoad, true);
    };
    document.addEventListener('pointerdown', lazyLoad, true);
  } catch {
    // Service installation errors are silently absorbed.
  }
}
