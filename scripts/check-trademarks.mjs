// Fails if the built bundle (dist/) carries any third-party trademark or an
// official board name. Run after `npm run build`. The game is Drone Derby;
// source boards are mapped to our names privately in notes/ only.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const MARKS = /robo ?rally|hasbro|wizards of the coast|\bwotc\b|avalon hill/i;
// Distinctive official board names, matched anywhere.
const BOARDS = /Cannery Row|Pit Maze|Circuit Trap|Laser Maze|Flood Zone|Gear Box|Back Stretch|Pit Row|Blast Furnace|Machine Shop|Pinwheel|Chop Shop|Spin Zone|King of the Hill|Maelstrom|Colosseum|Coliseum|Reactor Core|Shake 'n' Bake/;
// Generic one-word official names: only flagged as a whole string literal.
const GENERIC = /["'`](Cross|Exchange|Island|Chasm|Canyon|Vault|Chess)["'`]/;

const hits = [];
function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(js|css|html|json|webmanifest|txt|svg)$/.test(name)) {
      readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
        for (const re of [MARKS, BOARDS, GENERIC]) {
          const m = line.match(re);
          if (m) hits.push(`${path}:${i + 1}: ${m[0]}`);
        }
      });
    }
  }
}
walk(process.argv[2] ?? 'dist');
if (hits.length) {
  console.error(`trademark check FAILED (${hits.length}):\n` + hits.join('\n'));
  process.exit(1);
}
console.log('trademark check: clean');
