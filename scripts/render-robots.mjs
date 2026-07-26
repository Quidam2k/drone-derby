// Drives the Blender robot renders: `npm run art`.
//
// Blender isn't an npm dependency and isn't on PATH on a default Windows
// install, so this locates it, then hands off to scripts/blender/robots.py.
// Set BLENDER=/path/to/blender to override.
//
// Renders on CPU (pinned in the Python) -- ask before using the GPU.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const CANDIDATES = [
  process.env.BLENDER,
  'C:/Program Files/Blender Foundation/Blender 3.6/blender.exe',
  'C:/Program Files/Blender Foundation/Blender 4.0/blender.exe',
  '/Applications/Blender.app/Contents/MacOS/Blender',
  '/usr/bin/blender',
].filter(Boolean);

const blender = CANDIDATES.find((p) => existsSync(p));
if (!blender) {
  console.error(
    'Blender not found. Install it or set BLENDER=/path/to/blender.\nLooked in:\n  ' +
      CANDIDATES.join('\n  '),
  );
  process.exit(1);
}

console.log(`using ${blender}`);
const res = spawnSync(
  blender,
  ['--background', '--python', path.join(root, 'scripts/blender/robots.py'), '--', '--all',
   '--out-dir', path.join(root, 'public/robots')],
  { stdio: 'inherit', cwd: root },
);
process.exit(res.status ?? 1);
