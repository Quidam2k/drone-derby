// The animated sub-part list exists twice — `ANIM_PARTS` in ./robots.ts and the
// `anim_group(...)` calls in scripts/blender/robots.py — because one is
// TypeScript the rig runs and the other is Python Blender runs. Nothing links
// them, and both directions of drift are silent:
//
//   * a name here that robots.py doesn't write is a part the rig looks for,
//     never finds, and quietly leaves static;
//   * a group robots.py writes that isn't here is geometry held out of the
//     by-material merge for nothing — an extra draw call per robot that never
//     moves.
//
// Both look exactly like "the animation didn't land". So this reads robots.py
// as text and asserts the two agree — the same crude approach, for the same
// reason, as tileKit.pieces.test.ts and BoardView.imports.test.ts.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { ANIM_PARTS } from './robots';

const robotsPy = readFileSync(
  fileURLToPath(new URL('../../../scripts/blender/robots.py', import.meta.url)),
  'utf8',
);

/**
 * The node names robots.py's `anim_group(...)` calls produce. The Python passes
 * the bare name and `common.anim_group` prefixes `anim_`, so this has to as
 * well — and the wheels are written with a `%d` format, which is expanded here
 * rather than parsed, because that loop is the one place the name is computed.
 */
const CALLS = [...robotsPy.matchAll(/anim_group\(\s*'([a-z_]+)(%d)?'/g)];

function groupsInBlenderScript(): string[] {
  return CALLS.flatMap((m) =>
    m[2] ? [0, 1, 2, 3].map((i) => `anim_${m[1]}${i}`) : [`anim_${m[1]}`],
  );
}

describe('the rig animated-part list matches robots.py', () => {
  const blender = groupsInBlenderScript();

  it('the scan saw every anim_group call in the file', () => {
    // The one way this guard could fail open: a call whose name stops being a
    // literal (`'tripod_' + key`) is invisible to the regex above, and two
    // shorter lists still agree with each other. So count the calls
    // independently of parsing them.
    expect(CALLS.length).toBe([...robotsPy.matchAll(/\banim_group\(/g)].length);
    expect(CALLS.length).toBeGreaterThan(3);
  });

  it('parsed a plausible set of calls', () => {
    expect(blender.length).toBeGreaterThan(4);
    expect(blender).toContain('anim_tread_l');
    expect(blender).toContain('anim_wheel_3');
  });

  it('every part the rig animates is one robots.py groups', () => {
    expect(blender).toEqual(expect.arrayContaining([...ANIM_PARTS]));
  });

  it('every group robots.py writes is one the rig animates', () => {
    expect([...ANIM_PARTS]).toEqual(expect.arrayContaining(blender));
  });

  it('the two lists are the same length — no duplicates hiding a mismatch', () => {
    expect(new Set(ANIM_PARTS).size).toBe(ANIM_PARTS.length);
    expect(blender.length).toBe(ANIM_PARTS.length);
  });

  it('every name carries the prefix the loader keys off', () => {
    // robots.ts pulls a mesh out of the merge by walking up to the nearest
    // ancestor whose name starts with `anim_`. A group named anything else is
    // invisible to that walk however well it matches this list.
    for (const name of ANIM_PARTS) expect(name.startsWith('anim_')).toBe(true);
  });

  it('the export keeps the empties that carry those names', () => {
    // `export_glb` strips every non-MESH object as render scaffolding. The one
    // exception is what makes this whole phase work; without it the parts fall
    // back to static and nothing anywhere says so.
    expect(robotsPy).toMatch(/EMPTY.*startswith\('anim_'\)/);
  });
});
