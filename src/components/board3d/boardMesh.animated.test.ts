import { beforeAll, describe, expect, it } from 'vitest';
import type { BoardDef, TileDef } from '../../engine';
import { buildBoard } from './boardMesh';

/**
 * The suite runs in vitest's `node` environment (vite.config.ts), and
 * `labelTexture` reaches for a canvas to draw checkpoint digits and register
 * schedules on. Those glyphs have nothing to do with what is asserted here, so
 * a five-line stub is the honest fix — pulling in jsdom to render text nobody
 * looks at would be a dependency bought for a texture.
 */
beforeAll(() => {
  if (typeof document === 'undefined') {
    (globalThis as { document?: unknown }).document = {
      // labelTexture already guards on a null context, so this is enough.
      createElement: () => ({ width: 0, height: 0, getContext: () => null }),
    };
  }
});

/**
 * The durable half of PA's render-on-demand guard.
 *
 * `BoardMeshes.animated` is what keeps scene.ts's render loop awake forever:
 * `frame()` re-arms on `moving || belts()`, and `belts()` is `animated &&
 * !prefersReducedMotion()`. Belts and portal swirls are ambient and belong in
 * it. Pushers, gears and crushers are EVENT-DRIVEN and settle, so they must
 * never join it — a board that renders forever is a battery and heat
 * regression on the phone a playtester is holding, and it is invisible to
 * every instrument this cascade shipped, including the P1 `webglcontextlost`
 * alarm. That makes it a defect, not a tuning issue.
 *
 * If anyone (including a later phase of this cascade) ORs the new elements
 * into `animated`, the first test here fails. That is the whole point of it.
 */

function board(tiles: TileDef[][], extra: Partial<BoardDef> = {}): BoardDef {
  return {
    name: 'test',
    width: tiles[0].length,
    height: tiles.length,
    tiles,
    walls: [],
    lasers: [],
    ...extra,
  };
}

const floor = (): TileDef => ({ kind: 'floor' });
const grid = (w: number, h: number, fill: () => TileDef = floor): TileDef[][] =>
  Array.from({ length: h }, () => Array.from({ length: w }, fill));

describe('boardMesh — event-driven elements never wake the render loop', () => {
  it('leaves a pusher/gear/crusher board asleep', () => {
    const tiles = grid(3, 3);
    tiles[1][1] = { kind: 'gear', cw: true };
    const meshes = buildBoard(
      board(tiles, {
        pushers: [{ pos: { x: 0, y: 0 }, facing: 'E', registers: [1, 3] }],
        crushers: [{ pos: { x: 2, y: 2 }, registers: [2] }],
      }),
    );
    expect(meshes.animated).toBe(false);
    meshes.dispose();
  });

  it('still wakes for belts, which are genuinely ambient', () => {
    // The control. Without this, the test above would pass just as happily on
    // an `animated` that was accidentally hard-wired to false.
    const tiles = grid(3, 3);
    tiles[0][0] = { kind: 'conveyor', dir: 'E', express: false };
    const meshes = buildBoard(board(tiles));
    expect(meshes.animated).toBe(true);
    meshes.dispose();
  });

  it('still wakes for a portal swirl', () => {
    const tiles = grid(3, 3);
    tiles[0][0] = { kind: 'portal', color: 'blue' };
    tiles[2][2] = { kind: 'portal', color: 'blue' };
    const meshes = buildBoard(board(tiles));
    expect(meshes.animated).toBe(true);
    meshes.dispose();
  });

  it('leaves a bare floor board asleep', () => {
    const meshes = buildBoard(board(grid(2, 2)));
    expect(meshes.animated).toBe(false);
    meshes.dispose();
  });
});

describe('boardMesh — element accessors confirm the element is really there', () => {
  // scene.ts fires blind: `gear-rotated` carries no position at all, so the
  // cell is the robot's and this false IS the check. Same contract flameAt has.
  it('returns false for a cell with no such element', () => {
    const tiles = grid(3, 3);
    tiles[1][1] = { kind: 'gear', cw: true };
    const meshes = buildBoard(
      board(tiles, {
        pushers: [{ pos: { x: 0, y: 0 }, facing: 'E', registers: [1, 3] }],
        crushers: [{ pos: { x: 2, y: 2 }, registers: [2] }],
      }),
    );

    expect(meshes.gearAt(1, 1, -Math.PI / 2)).toBe(true);
    expect(meshes.gearAt(0, 0, -Math.PI / 2)).toBe(false);
    expect(meshes.pusherAt(0, 0, 1)).toBe(true);
    expect(meshes.pusherAt(1, 1, 1)).toBe(false);
    expect(meshes.crusherAt(2, 2, 1)).toBe(true);
    expect(meshes.crusherAt(0, 0, 1)).toBe(false);
    expect(meshes.beltSurgeAt(0, 0, 0.5)).toBe(false);
    meshes.dispose();
  });

  it('finds the belt a carry came from', () => {
    const tiles = grid(3, 3);
    tiles[1][2] = { kind: 'conveyor', dir: 'N', express: true };
    const meshes = buildBoard(board(tiles));
    expect(meshes.beltSurgeAt(2, 1, 0.5)).toBe(true);
    expect(meshes.beltSurgeAt(0, 0, 0.5)).toBe(false);
    meshes.dispose();
  });

  it('moves the piston when it extends and puts it back at rest', () => {
    // The accessor returning true is not proof it wrote anything, so check the
    // matrix actually moved — and, more importantly, that extend:0 restores
    // exactly the pose the board was built with.
    const meshes = buildBoard(
      board(grid(2, 2), { pushers: [{ pos: { x: 0, y: 0 }, facing: 'E', registers: [1] }] }),
    );
    // Every instance matrix on the board, summed. Crude on purpose: it does
    // not need to know which child is the plate, only that the board's
    // geometry moved and then came back to exactly where it started.
    const signature = (): number => {
      let sum = 0;
      meshes.group.traverse((child) => {
        const im = child as unknown as {
          isInstancedMesh?: boolean;
          instanceMatrix?: { array: ArrayLike<number> };
        };
        if (!im.isInstancedMesh || !im.instanceMatrix) return;
        const a = im.instanceMatrix.array;
        for (let i = 0; i < a.length; i++) sum += a[i] * (i + 1);
      });
      return sum;
    };

    const rest = signature();
    meshes.pusherAt(0, 0, 1);
    expect(signature()).not.toBe(rest);
    meshes.pusherAt(0, 0, 0);
    expect(signature()).toBe(rest);
    meshes.dispose();
  });
});
