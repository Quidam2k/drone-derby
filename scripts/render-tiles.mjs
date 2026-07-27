// Drives the Blender board tile kit: `npm run art:tiles`.
// One file out -- public/models/tiles.glb -- holding every named piece the
// 3D board instances. Nothing is rendered; this is a mesh export only, so
// Cycles is never touched.
import path from 'node:path';
import { root, runBlender } from './blender-path.mjs';

const out = path.join(root, 'public/models/tiles.glb');
runBlender('tiles.py', ['--out', out], 'tile kit');
