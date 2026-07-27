// Finds Blender and runs one of the scripts in scripts/blender/.
//
// Blender isn't an npm dependency and isn't on PATH on a default Windows
// install, so both art drivers (render-robots.mjs, render-tiles.mjs) come
// through here. Set BLENDER=/path/to/blender to override.
//
// Renders on CPU (pinned in the Python) -- ask before using the GPU.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

const CANDIDATES = [
  process.env.BLENDER,
  'C:/Program Files/Blender Foundation/Blender 3.6/blender.exe',
  'C:/Program Files/Blender Foundation/Blender 4.0/blender.exe',
  '/Applications/Blender.app/Contents/MacOS/Blender',
  '/usr/bin/blender',
].filter(Boolean);

/** Absolute path to a Blender executable, or exits with an explanation. */
export function findBlender() {
  const blender = CANDIDATES.find((p) => existsSync(p));
  if (!blender) {
    console.error(
      'Blender not found. Install it or set BLENDER=/path/to/blender.\nLooked in:\n  ' +
        CANDIDATES.join('\n  '),
    );
    process.exit(1);
  }
  return blender;
}

/** Runs scripts/blender/<script> headless, passing `args` after the `--`. */
export function runBlender(script, args, note = '') {
  const blender = findBlender();
  console.log(`using ${blender}${note ? ` (${note})` : ''}`);
  const res = spawnSync(
    blender,
    ['--background', '--python', path.join(root, 'scripts/blender', script), '--', ...args],
    { stdio: 'inherit', cwd: root },
  );
  process.exit(res.status ?? 1);
}
