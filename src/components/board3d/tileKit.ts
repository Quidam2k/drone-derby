// The Blender board tile kit as geometry the board can instance.
// Same models `npm run art:tiles` exports — scripts/blender/tiles.py — in one
// public/models/tiles.glb: a single fetch, a single parse, named nodes pulled
// out by hand.
//
// Every piece collapses to ONE BufferGeometry so it feeds the existing
// InstancedMesh machinery in boardMesh.ts unchanged. A piece that isn't in the
// file resolves to null and the board falls back to its procedural primitive
// for that piece alone — a broken kit costs you the art, never the board.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

const MODEL_URL = '/models/tiles.glb';

/** Node names in tiles.glb. Kept in step with `PIECES` in tiles.py. */
export const PIECE_NAMES = [
  'floor',
  'conveyor',
  'conveyor_curve',
  'chevron',
  'gear',
  'pit_shaft',
  'pit_rim',
  'checkpoint',
  'spawn',
  'wrench',
  'wall',
  'laser_body',
  'laser_lens',
  'pusher_housing',
  'pusher_plate',
] as const;

export type PieceName = (typeof PIECE_NAMES)[number];

export interface KitPiece {
  geometry: THREE.BufferGeometry;
  /** The kit's own material. The board overrides it wherever the colour is
   *  code-driven — express vs normal belts, checkpoint green, laser red. */
  material: THREE.Material;
}

export type TileKit = { readonly [K in PieceName]: KitPiece | null } & {
  dispose(): void;
};

/** Attributes every merged piece carries. Anything else is dropped. */
const KEEP = ['position', 'normal', 'uv', 'color'] as const;

/**
 * Collapse one named node's meshes into a single geometry.
 *
 * The kit is built so a piece never mixes materials — the two it has are the
 * shared PBR one and the emissive one, and no piece uses both — so taking the
 * first material is exact rather than a guess.
 */
function mergePiece(node: THREE.Object3D): KitPiece | null {
  node.updateMatrixWorld(true);
  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [];

  node.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    materials.push(Array.isArray(mesh.material) ? mesh.material[0] : mesh.material);
    geometries.push(mesh.geometry.clone().applyMatrix4(mesh.matrixWorld));
  });

  if (!geometries.length) return null;
  const material = materials[0];

  // mergeGeometries needs every input to carry the same attributes and to
  // agree on being indexed. The exporter gives us both, but a hand-edited
  // .glb shouldn't be able to take the board down.
  const indexed = geometries.every((g) => g.index !== null);
  for (let i = 0; i < geometries.length; i++) {
    const g = geometries[i];
    for (const attr of Object.keys(g.attributes)) {
      if (!(KEEP as readonly string[]).includes(attr)) g.deleteAttribute(attr);
    }
    const count = g.getAttribute('position').count;
    if (!g.getAttribute('uv')) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(count * 2), 2));
    if (!g.getAttribute('color')) {
      const c = new Float32Array(count * 3).fill(1);
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    }
    if (!indexed && g.index) geometries[i] = g.toNonIndexed();
  }

  const merged = geometries.length === 1 ? geometries[0] : mergeGeometries(geometries, false);
  if (!merged) return null;
  if (merged !== geometries[0]) for (const g of geometries) g.dispose();
  return { geometry: merged, material };
}

/**
 * Loads the kit. Resolves to null if the file is missing or unparseable, and
 * to a kit with null pieces for anything the file doesn't contain — either
 * way the board builds, from primitives, with a warning.
 */
export async function loadTileKit(): Promise<TileKit | null> {
  let gltf;
  try {
    gltf = await new GLTFLoader().loadAsync(MODEL_URL);
  } catch (err) {
    console.warn('[board3d] tile kit failed to load — falling back to primitives', err);
    return null;
  }

  const pieces = {} as Record<PieceName, KitPiece | null>;
  const missing: string[] = [];
  for (const name of PIECE_NAMES) {
    const node = gltf.scene.getObjectByName(name);
    const piece = node ? mergePiece(node) : null;
    if (!piece) missing.push(name);
    pieces[name] = piece;
  }
  if (missing.length) console.warn(`[board3d] tile kit is missing ${missing.join(', ')}`);

  return {
    ...pieces,
    dispose() {
      for (const name of PIECE_NAMES) pieces[name]?.geometry.dispose();
      // Two materials for fifteen pieces, so dispose by identity, once each.
      const seen = new Set<THREE.Material>();
      gltf.scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh) return;
        for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
          if (seen.has(m)) continue;
          seen.add(m);
          const std = m as THREE.MeshStandardMaterial;
          std.map?.dispose();
          std.metalnessMap?.dispose();
          std.roughnessMap?.dispose();
          m.dispose();
        }
      });
    },
  };
}
