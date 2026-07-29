// A tripwire for the exact bug Phase 3D-4 shipped.
//
// `Board3D`'s props are DERIVED from the DOM board's — `Parameters<typeof
// Board>[0]` — so the two can never drift apart in type. What they can do, and
// did, is drift apart in USE: 3D-4 destructured four of the five props and
// silently dropped `bubbles`, so taunts simply never appeared in 3D. Nothing
// catches that. An unused prop is not a type error, an undestructured prop is
// not a type error, and a prop destructured and then never forwarded to the
// scene is not a type error either.
//
// So this reads the two files as text and asserts they agree. Crude on purpose:
// the alternative is rendering React in a node test environment to check that a
// speech bubble appeared, which is a much heavier way to catch a typo.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = fileURLToPath(new URL('.', import.meta.url));
const read = (rel: string) => readFileSync(here + rel, 'utf8');

/** Top-level field names of `interface BoardProps { ... }`. */
function boardPropNames(source: string): string[] {
  const start = source.indexOf('interface BoardProps {');
  expect(start, 'Board.tsx must still declare interface BoardProps').toBeGreaterThan(-1);
  const body = source.slice(start, source.indexOf('\n}', start));
  return [...body.matchAll(/^ {2}(\w+)\??:/gm)].map((m) => m[1]);
}

/** Names destructured by `export function <name>({ ... })`. */
function destructuredNames(source: string, fn: string): string[] {
  const start = source.indexOf(`export function ${fn}({`);
  expect(start, `${fn} must still destructure its props`).toBeGreaterThan(-1);
  const open = source.indexOf('{', start);
  const close = source.indexOf('}', open);
  return [...source.slice(open + 1, close).matchAll(/(\w+)\s*(?:,|$)/g)].map((m) => m[1]);
}

describe('Board3D props', () => {
  const board = read('../board/Board.tsx');
  const board3d = read('./Board3D.tsx');
  const props = boardPropNames(board);

  it('found the props to check — the parse itself has to keep working', () => {
    expect(props).toContain('board');
    expect(props).toContain('visual');
    expect(props.length).toBeGreaterThanOrEqual(8);
  });

  it('destructures EVERY BoardProps field, none dropped and none invented', () => {
    expect([...destructuredNames(board3d, 'Board3D')].sort()).toEqual([...props].sort());
  });

  it('actually uses every prop it destructured', () => {
    // `bubbles` is consumed by the JSX overlay; the rest are forwarded to the
    // scene. Either way the name has to appear again below the destructure.
    const body = board3d.slice(board3d.indexOf('}: BoardProps)'));
    for (const name of props) {
      expect(new RegExp(`\\b${name}\\b`).test(body), `${name} is destructured but never used`).toBe(
        true,
      );
    }
  });

  it('forwards the replay look-ahead and the reel flag on BOTH update paths', () => {
    // One for the props that arrive before the async scene exists, one for
    // every render after. Missing either is a camera that never sees the
    // future — which is the whole of 3D-5 — or a reel that never cuts, which
    // is the whole of 3D-6.
    const forwards = [
      ...board3d.matchAll(/(?:BoardSceneInput>\(|inputRef\.current = |\.update\()\{([^}]*)\}/g),
    ];
    expect(forwards.length).toBe(3);
    for (const [, fields] of forwards) {
      expect(fields).toContain('events');
      expect(fields).toContain('cursor');
      expect(fields).toContain('reel');
    }
  });

  it('is the same props type the DOM board takes', () => {
    expect(board3d).toContain('Parameters<typeof Board>[0]');
  });
});
