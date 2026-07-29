// Which moments of a turn are worth a highlight reel, as plain data.
//
// The ./visualState, ../board3d/directorMath pattern: no DOM, no `three`, no
// React, unit tested in the node environment by folding real engine logs
// through it. ./HighlightReel.tsx holds the clock and the pixels; every
// decision about WHAT to show is here.
//
// ---------------------------------------------------------------------------
// The decision this turns on
//
// **A reel is a SUBSEQUENCE, not a speed-up.** `visualAt(initial, events, n)`
// re-folds from zero for any cursor, so moving the cursor anywhere is already
// free and already safe — the property backwards-scrubbing has relied on since
// Phase 2. That is what lets a reel play events 34-39 straight after 11-14 with
// no new state machinery, no engine change and no event change: pick beats,
// play each beat's slice, hard-cut between them.
//
// Scoring is `interestOf` from the camera director, imported rather than
// re-derived. It is the one place that already ranks events, and it is why this
// module is small. It is also why the reel and the camera agree about what a
// beat IS — a reel that thinks a laser matters while the camera does not would
// cut to a shot of nothing.
//
// The other half of the reel's honesty is that it must be worth watching on the
// DOM board: `?render=3d` is still off by default, so "the best bits, back to
// back, with a caption" has to carry the feature on its own. The 3D camera makes
// it better, not viable.

import type { EngineEvent, EventLog } from '../../engine';
import { interestOf } from '../board3d/directorMath';
import { caption, eventDuration } from './eventPresentation';

/**
 * One moment of a turn: a half-open index range `[start, end)` into the event
 * log, the index of the event that earned it, and the caption to show.
 *
 * Half-open because that is ReplayPlayer's cursor convention: `cursor` events
 * have been applied, so playing this beat means running the cursor from
 * `start + 1` to `end`, with `events[cursor - 1]` on screen throughout.
 */
export interface Beat {
  /** First event index in the beat, INCLUSIVE (its lead-in). */
  start: number;
  /** One past the last event index in the beat (its lead-out). */
  end: number;
  /** The event this beat exists for. Always `start <= peak < end`. */
  peak: number;
  /** `interestOf(events[peak])`, the beat's rank. */
  interest: number;
  /** The peak's caption — the reel's headline for the whole beat. */
  label: string;
}

/**
 * Below this an event cannot start a beat.
 *
 * Drawn against `interestOf` so the list reads: a destruction (0.9), a fall
 * (0.9), a checkpoint (0.8), a laser that connects (0.7), a respawn (0.65),
 * damage (0.55), a robot slammed into a wall (0.5). NOT a plain move (0.35), a
 * conveyor (0.3), a rotation (0.25) or a card reveal (0.05) — a reel of five
 * robots shuffling one tile each is what scrubbing the replay already gives you.
 */
export const MIN_BEAT_INTEREST = 0.5;
/**
 * Peaks this close together are ONE moment.
 *
 * A laser hit -> damage -> register-locked -> destroyed run is four events and
 * three of them score above the floor; cutting four times through it would
 * reproduce exactly the noise the 3D-5 director exists to stop. The engine's
 * death path emits the cause, then life-lost, then possibly player-eliminated,
 * so the gap to close is small and known rather than guessed.
 */
export const MERGE_GAP = 5;
/**
 * Events of run-up and follow-through padded around a merged run.
 *
 * A destruction with no lead-in is a robot that simply vanishes: the push that
 * carried it into the beam is the story, and it is one or two events earlier.
 * The follow-through is shorter because the consequence (life-lost, the
 * player-strip news) is already legible.
 *
 * LEAD_IN + LEAD_OUT == MERGE_GAP is deliberate: it is exactly the point at
 * which two runs far enough apart NOT to merge are also far enough apart for
 * their padding not to collide. `pickBeats` still clamps, because `opts` can
 * break the identity.
 */
export const LEAD_IN = 3;
export const LEAD_OUT = 2;
/** Most beats a reel will show, however eventful the turn. */
export const MAX_BEATS = 5;
/** Seconds of reel clock the whole thing must fit inside. */
export const MAX_REEL_SECONDS = 12;

/** Reel-clock stretch on a beat's peak, and squeeze on its connective tissue. */
export const PEAK_STRETCH = 1.35;
export const FILLER_SQUEEZE = 0.7;

export interface PickBeatsOptions {
  minInterest?: number;
  mergeGap?: number;
  leadIn?: number;
  leadOut?: number;
  maxBeats?: number;
  maxSeconds?: number;
}

/**
 * Milliseconds an event holds the screen IN A REEL.
 *
 * Built on the replay's own `eventDuration` rather than a second table, so the
 * two cannot drift: a reel is the same events at a different rhythm, not a
 * different opinion about them. What changes is the rhythm — a fall gets its
 * full arc instead of being clipped by the next event, and the run-up that
 * exists only to make the fall legible goes past faster.
 *
 * Keyed off `interestOf`, so "is this a peak" is the same question everywhere
 * in this module.
 */
export function reelDuration(e: EngineEvent): number {
  const base = eventDuration(e);
  return interestOf(e) >= MIN_BEAT_INTEREST ? base * PEAK_STRETCH : base * FILLER_SQUEEZE;
}

/** Reel-clock seconds a beat takes to play. */
export function beatSeconds(events: EventLog, beat: Beat): number {
  let ms = 0;
  for (let i = beat.start; i < beat.end; i++) ms += reelDuration(events[i]);
  return ms / 1000;
}

/** Reel-clock seconds for a whole beat list. */
export function reelSeconds(events: EventLog, beats: readonly Beat[]): number {
  return beats.reduce((a, b) => a + beatSeconds(events, b), 0);
}

/**
 * The beats worth showing from one turn, in chronological order.
 *
 * Returns `[]` for a dull turn — a real outcome, not an edge case: a turn of
 * nothing but reveals, moves and conveyor pulses HAS no highlight, and the UI's
 * job is to hide the button rather than to offer a reel of shuffling.
 */
export function pickBeats(events: EventLog, opts: PickBeatsOptions = {}): Beat[] {
  const minInterest = opts.minInterest ?? MIN_BEAT_INTEREST;
  const mergeGap = opts.mergeGap ?? MERGE_GAP;
  const leadIn = opts.leadIn ?? LEAD_IN;
  const leadOut = opts.leadOut ?? LEAD_OUT;
  const maxBeats = opts.maxBeats ?? MAX_BEATS;
  const maxSeconds = opts.maxSeconds ?? MAX_REEL_SECONDS;

  // 1. Score. Everything under the floor is scenery.
  const peaks: number[] = [];
  for (let i = 0; i < events.length; i++) {
    if (interestOf(events[i]) >= minInterest) peaks.push(i);
  }
  if (!peaks.length) return [];

  // 2. Merge. Peaks within `mergeGap` of each other are one moment.
  const runs: number[][] = [[peaks[0]]];
  for (let k = 1; k < peaks.length; k++) {
    const run = runs[runs.length - 1];
    if (peaks[k] - run[run.length - 1] <= mergeGap) run.push(peaks[k]);
    else runs.push([peaks[k]]);
  }

  // 3. Pad, clamped to the log. The run's own heaviest event is the peak; ties
  //    go to the earliest, so a laser hit seeds the beat that its damage and
  //    destruction complete rather than the other way round.
  const beats: Beat[] = runs.map((run) => {
    let peak = run[0];
    for (const i of run) {
      if (interestOf(events[i]) > interestOf(events[peak])) peak = i;
    }
    return {
      start: Math.max(0, run[0] - leadIn),
      end: Math.min(events.length, run[run.length - 1] + 1 + leadOut),
      peak,
      interest: interestOf(events[peak]),
      label: caption(events[peak]),
    };
  });

  // 4. Clamp to neighbours. With the default constants padding cannot collide,
  //    but `opts` can, and two beats sharing an event would replay it twice.
  //    The overlap is split between the two peaks — never INSIDE either of
  //    them, which is why this is a midpoint and not a one-sided shove.
  for (let i = 1; i < beats.length; i++) {
    const prev = beats[i - 1];
    const cur = beats[i];
    if (prev.end <= cur.start) continue;
    const mid = Math.ceil((prev.peak + cur.peak) / 2);
    const split = Math.min(Math.max(mid, prev.peak + 1), cur.peak);
    prev.end = Math.min(prev.end, split);
    cur.start = Math.max(cur.start, split);
  }

  // 5. Cap, by INTEREST rather than by chronology.
  //
  //    Both the beat count and the reel's total length are enforced here, in
  //    one pass: rank the beats, take them while they fit, keep the best one
  //    whatever it costs. Dropping the chronological tail instead would be
  //    simpler and is wrong — the climax of a turn is usually its LAST beat
  //    (`game-won` scores 1.0), and a highlight reel that cuts before the win
  //    to make room for a laser graze has failed at the one thing it does.
  const ranked = beats
    .map((b, i) => ({ b, i }))
    .sort((a, z) => z.b.interest - a.b.interest || a.i - z.i);
  const kept: { b: Beat; i: number }[] = [];
  let seconds = 0;
  for (const entry of ranked) {
    if (kept.length >= maxBeats) break;
    const cost = beatSeconds(events, entry.b);
    if (kept.length && seconds + cost > maxSeconds) continue;
    kept.push(entry);
    seconds += cost;
  }

  return kept.sort((a, z) => a.i - z.i).map((entry) => entry.b);
}
