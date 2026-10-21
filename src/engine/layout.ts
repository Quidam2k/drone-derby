// Compact text layouts for transcribed boards. A board is 12 rows of
// whitespace-separated cell tokens plus short overlay strings, which keeps a
// 144-cell transcription reviewable at a glance (and diffable against the
// reference cell by cell) where the setTile-per-element style of
// authentic.ts runs to hundreds of lines per board.
//
// Cell tokens:
//   ..   floor            PP   pit           DD   drain (pit, grate art)
//   %    wrench           @    teleporter    o    repulsor
//   x    radiation        z    waste         f1   checkpoint 1 (s1 = spawn)
//   pr pb pg pu po py     portal (red/blue/green/purple/orange/yellow)
//   g+ / g-               gear, clockwise / counter-clockwise
//   t135                  trapdoor, open on registers 1, 3, 5
//   > < ^ v               belt exiting E/W/N/S; doubled (>> << ^^ vv) = express;
//                         a trailing ) = clockwise curve, ( = counter-clockwise
//                         (e.g. "v)" exits S, entered travelling E)
//   OIL  oil slick        ~    water        ~> ~< ~^ ~v  water with a current
//   W+ / W-               whirlpool, clockwise / counter-clockwise
// Overlays (one entry per string, coordinates are x,y):
//   walls     "3,2 NW"  walls on the N and W edges of (3,2); "3,2 W out" = one-way
//   lasers    "2,1 E 2" emitter at (2,1) firing E, strength 2 (strength defaults 1)
//   pushers   "3,4 S 135"  crushers "4,1 15"  flamers "5,1 124"
//   steep     "5,5 S"   a hill ledge: (5,5) is the high side, S the drop. Stored
//             as a one-way wall — robots drop down it but can't climb it.

import type { BoardDef, Direction, PortalColor, TileDef } from './types';
import { emptyBoard } from './board';

export interface LayoutSpec {
  name: string;
  rows: string[];
  walls?: string[];
  lasers?: string[];
  pushers?: string[];
  crushers?: string[];
  flamers?: string[];
  steep?: string[];
}

const BELT_DIRS: Record<string, Direction> = { '>': 'E', '<': 'W', '^': 'N', v: 'S' };
const PORTALS: Record<string, PortalColor> = {
  r: 'red', b: 'blue', g: 'green', u: 'purple', o: 'orange', y: 'yellow',
};
const FIXED: Record<string, TileDef> = {
  '..': { kind: 'floor' },
  PP: { kind: 'pit' },
  DD: { kind: 'pit', style: 'drain' },
  '%': { kind: 'wrench' },
  '@': { kind: 'teleporter' },
  o: { kind: 'repulsor' },
  x: { kind: 'radiation' },
  z: { kind: 'waste' },
  'g+': { kind: 'gear', cw: true },
  'g-': { kind: 'gear', cw: false },
  OIL: { kind: 'oil' },
  '~': { kind: 'water' },
  'W+': { kind: 'whirlpool', cw: true },
  'W-': { kind: 'whirlpool', cw: false },
};

const registers = (s: string): number[] => [...s].map(Number);

export function parseTile(token: string): TileDef {
  const fixed = FIXED[token];
  if (fixed) return { ...fixed };
  let m = /^([><^v])(\1?)([()]?)$/.exec(token);
  if (m) {
    const tile: TileDef = { kind: 'conveyor', dir: BELT_DIRS[m[1]], express: m[2] !== '' };
    if (m[3]) tile.curve = m[3] === ')' ? 'cw' : 'ccw';
    return tile;
  }
  if ((m = /^~([><^v])$/.exec(token))) return { kind: 'water', current: BELT_DIRS[m[1]] };
  if ((m = /^p([rbguoy])$/.exec(token))) return { kind: 'portal', color: PORTALS[m[1]] };
  if ((m = /^t([1-5]+)$/.exec(token))) return { kind: 'trapdoor', registers: registers(m[1]) };
  if ((m = /^f(\d)$/.exec(token))) return { kind: 'checkpoint', n: Number(m[1]) };
  if ((m = /^s(\d)$/.exec(token))) return { kind: 'spawn', n: Number(m[1]) };
  throw new Error(`unknown layout token "${token}"`);
}

function pos(s: string): { x: number; y: number } {
  const [x, y] = s.split(',').map(Number);
  return { x, y };
}

export function fromLayout(spec: LayoutSpec): BoardDef {
  const width = spec.rows[0].trim().split(/\s+/).length;
  const board = emptyBoard(spec.name, width, spec.rows.length);
  spec.rows.forEach((row, y) => {
    const tokens = row.trim().split(/\s+/);
    if (tokens.length !== width) {
      throw new Error(`${spec.name} row ${y}: ${tokens.length} cells, expected ${width}`);
    }
    tokens.forEach((t, x) => {
      board.tiles[y][x] = parseTile(t);
    });
  });
  board.walls = (spec.walls ?? []).flatMap((w) => {
    const [at, sides, oneWay] = w.split(' ');
    const { x, y } = pos(at);
    return [...sides].map((side) => ({
      x, y, side: side as Direction, ...(oneWay ? { oneWay: oneWay as 'in' | 'out' } : {}),
    }));
  });
  for (const st of spec.steep ?? []) {
    const [at, sides] = st.split(' ');
    const { x, y } = pos(at);
    for (const side of sides) board.walls.push({ x, y, side: side as Direction, oneWay: 'in' });
  }
  board.lasers = (spec.lasers ?? []).map((l) => {
    const [at, facing, strength] = l.split(' ');
    return { pos: pos(at), facing: facing as Direction, strength: strength ? Number(strength) : 1 };
  });
  if (spec.pushers) {
    board.pushers = spec.pushers.map((p) => {
      const [at, facing, regs] = p.split(' ');
      return { pos: pos(at), facing: facing as Direction, registers: registers(regs) };
    });
  }
  if (spec.crushers) {
    board.crushers = spec.crushers.map((c) => {
      const [at, regs] = c.split(' ');
      return { pos: pos(at), registers: registers(regs) };
    });
  }
  if (spec.flamers) {
    board.flamers = spec.flamers.map((f) => {
      const [at, regs] = f.split(' ');
      return { pos: pos(at), registers: registers(regs) };
    });
  }
  return board;
}
