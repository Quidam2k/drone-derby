// The layout-format boards (src/engine/layouts.ts). Each census was counted
// off the verified transcription — a regression net, not a rules test. If an
// edit changes a count, re-check the cell against its private reference
// overlay (notes/2026-10-21-board-source-map.md) before "fixing" the number.

import { describe, expect, it } from 'vitest';
import type { BoardDef, PlayerId, Program } from '../types';
import { BUILTIN_BOARDS, dockyard } from '../boards';
import { fromLayout, type LayoutSpec } from '../layout';
import * as layouts from '../layouts';
import { createGame } from '../setup';
import { executeTurn } from '../execute';
import { validateBoard } from '../validate';
import { naiveProgram } from './helpers';

type Census = {
  kinds: Record<string, number>;
  walls: number;
  lasers: number;
  pushers: number;
  crushers: number;
  flamers: number;
};

const CENSUS: Record<string, Census> = {
  packingPlant: { kinds: { checkpoint: 3, conveyor: 66, pit: 3, wrench: 5 }, walls: 58, lasers: 11, pushers: 5, crushers: 10, flamers: 0 },
  crossroads: { kinds: { checkpoint: 3, conveyor: 60, pit: 11, wrench: 3 }, walls: 45, lasers: 4, pushers: 0, crushers: 0, flamers: 0 },
  switchyard: { kinds: { checkpoint: 3, conveyor: 68, gear: 5, pit: 2, wrench: 3 }, walls: 27, lasers: 1, pushers: 0, crushers: 0, flamers: 0 },
  atoll: { kinds: { checkpoint: 3, conveyor: 46, gear: 6, pit: 18, wrench: 3 }, walls: 20, lasers: 0, pushers: 0, crushers: 0, flamers: 0 },
  spiralMill: { kinds: { checkpoint: 3, conveyor: 106, pit: 4, wrench: 3 }, walls: 24, lasers: 4, pushers: 16, crushers: 0, flamers: 0 },
  sinkholeGrid: { kinds: { checkpoint: 3, conveyor: 49, pit: 26, wrench: 5 }, walls: 46, lasers: 2, pushers: 0, crushers: 0, flamers: 0 },
  theRift: { kinds: { checkpoint: 3, conveyor: 25, pit: 70, teleporter: 20, wrench: 6 }, walls: 14, lasers: 0, pushers: 0, crushers: 0, flamers: 0 },
  shortCircuit: { kinds: { checkpoint: 3, conveyor: 96, pit: 16, wrench: 4 }, walls: 54, lasers: 8, pushers: 4, crushers: 2, flamers: 0 },
  theRing: { kinds: { checkpoint: 3, conveyor: 84, pit: 5, wrench: 3 }, walls: 76, lasers: 3, pushers: 0, crushers: 2, flamers: 0 },
  spillway: { kinds: { checkpoint: 3, conveyor: 16, water: 75, whirlpool: 3, wrench: 3 }, walls: 23, lasers: 3, pushers: 0, crushers: 0, flamers: 0 },
  cogYard: { kinds: { checkpoint: 3, conveyor: 49, gear: 19, pit: 12, repulsor: 11, teleporter: 3, wrench: 5 }, walls: 34, lasers: 5, pushers: 0, crushers: 0, flamers: 0 },
  beamLattice: { kinds: { checkpoint: 3, conveyor: 50, pit: 9, wrench: 4 }, walls: 71, lasers: 21, pushers: 3, crushers: 0, flamers: 0 },
  farStraight: { kinds: { checkpoint: 3, conveyor: 65, oil: 20, pit: 6, trapdoor: 3, wrench: 4 }, walls: 6, lasers: 2, pushers: 6, crushers: 0, flamers: 0 },
  gorgeRun: { kinds: { checkpoint: 3, conveyor: 44, gear: 4, oil: 7, portal: 4, wrench: 2 }, walls: 30, lasers: 0, pushers: 0, crushers: 0, flamers: 0 },
  serviceLane: { kinds: { checkpoint: 3, conveyor: 56, oil: 14, portal: 4, trapdoor: 3, wrench: 4 }, walls: 7, lasers: 0, pushers: 4, crushers: 0, flamers: 0 },
  smelter: { kinds: { checkpoint: 3, conveyor: 63, pit: 4, wrench: 5 }, walls: 24, lasers: 0, pushers: 13, crushers: 0, flamers: 16 },
  toolRoom: { kinds: { checkpoint: 3, conveyor: 28, oil: 19, pit: 4, portal: 4, wrench: 4 }, walls: 12, lasers: 0, pushers: 0, crushers: 0, flamers: 8 },
  windmill: { kinds: { checkpoint: 3, conveyor: 44, gear: 2, portal: 2, radiation: 18, trapdoor: 8, waste: 4, wrench: 2 }, walls: 6, lasers: 2, pushers: 0, crushers: 0, flamers: 4 },
  gambit: { kinds: { checkpoint: 3, conveyor: 62, pit: 4, wrench: 4 }, walls: 34, lasers: 0, pushers: 0, crushers: 0, flamers: 0 },
  scrapyard: { kinds: { checkpoint: 3, conveyor: 48, gear: 7, pit: 5, wrench: 5 }, walls: 32, lasers: 6, pushers: 0, crushers: 0, flamers: 0 },
  turntable: { kinds: { checkpoint: 3, conveyor: 48, gear: 16, wrench: 4 }, walls: 24, lasers: 6, pushers: 0, crushers: 0, flamers: 0 },
  strongroom: { kinds: { checkpoint: 3, conveyor: 32, gear: 2, pit: 4, wrench: 6 }, walls: 33, lasers: 5, pushers: 6, crushers: 0, flamers: 0 },
  summit: { kinds: { checkpoint: 3, conveyor: 10, gear: 2, oil: 10, portal: 8, wrench: 4 }, walls: 63, lasers: 0, pushers: 2, crushers: 0, flamers: 1 },
};

function census(b: BoardDef): Census {
  const kinds: Record<string, number> = {};
  for (const row of b.tiles) {
    for (const t of row) if (t.kind !== 'floor') kinds[t.kind] = (kinds[t.kind] ?? 0) + 1;
  }
  return {
    kinds,
    walls: b.walls.length,
    lasers: b.lasers.length,
    pushers: (b.pushers ?? []).length,
    crushers: (b.crushers ?? []).length,
    flamers: (b.flamers ?? []).length,
  };
}

const spawnsIn = (b: BoardDef) => b.tiles.flat().filter((t) => t.kind === 'spawn').length;

describe('layout boards (transcribed)', () => {
  const entries = Object.entries(layouts) as [string, LayoutSpec][];

  it('every layout has a census and vice versa', () => {
    expect(entries.map(([k]) => k).sort()).toEqual(Object.keys(CENSUS).sort());
  });

  for (const [key, spec] of entries) {
    it(`${spec.name}: 12×12 with the transcribed element census`, () => {
      const board = fromLayout(spec);
      expect(board.width).toBe(12);
      expect(board.height).toBe(12);
      expect(census(board)).toEqual(CENSUS[key]);
    });
  }
});

describe('every built-in board', () => {
  it('there are 25 transcribed boards plus our 6 originals', () => {
    expect(Object.keys(BUILTIN_BOARDS)).toHaveLength(31);
  });

  for (const [id, { name, factory }] of Object.entries(BUILTIN_BOARDS)) {
    it(`${name}: validates, seats 4 and plays a hot-seat turn`, () => {
      const board = factory();
      expect(validateBoard(board).errors).toEqual([]);
      expect(spawnsIn(board), id).toBeGreaterThanOrEqual(4);
      const start = createGame(board, ['a', 'b', 'c', 'd'], 42);
      const programs: Record<PlayerId, Program> = {};
      for (const r of start.robots) programs[r.player] = naiveProgram(start, r.player);
      const { state, events } = executeTurn(start, programs, 7);
      expect(state.turn).toBe(start.turn + 1);
      expect(events.filter((e) => e.type === 'register-started').length).toBeGreaterThan(0);
    });
  }

  it('the transcribed boards launch from the dockyard', () => {
    for (const spec of Object.values(layouts) as LayoutSpec[]) {
      const id = spec.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const composed = BUILTIN_BOARDS[id].factory();
      expect(composed.height, id).toBe(12 + dockyard().height);
      expect(spawnsIn(composed), id).toBe(spawnsIn(dockyard()));
    }
  });
});
