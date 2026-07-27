// Drives the Blender robot renders: `npm run art`.
// With --glb it exports the same chassis as meshes for the WebGL board
// instead: `npm run art -- --glb` -> public/models/robot-<seat>.glb.
//
// Blender lives behind scripts/blender-path.mjs, shared with render-tiles.mjs.
import path from 'node:path';
import { root, runBlender } from './blender-path.mjs';

const glb = process.argv.includes('--glb');
const mode = glb
  ? ['--export-glb', '--out-dir', path.join(root, 'public/models')]
  : ['--all', '--out-dir', path.join(root, 'public/robots')];

runBlender('robots.py', mode, glb ? 'glb export' : '');
