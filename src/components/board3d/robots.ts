// The four Blender chassis as meshes, and the rig that eases one around the
// board. Same models the sprites are rendered from — scripts/blender/robots.py
// `build(seat)` — exported by `npm run art -- --glb`.
//
// Static meshes only. Rolling treads, the hexapod walk cycle and spinning
// wheels are 3D-3.

import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Direction, Position } from '../../engine';
import { DIR_YAW } from './boardMesh';

export const SEATS = 4;

const modelUrl = (seat: number) => `/models/robot-${seat}.glb`;

/**
 * Each chassis is built from 30-60 separate Blender objects, which would be
 * 30-60 draw calls per robot. They only use seven materials between them, so
 * merging by material takes a four-robot board from ~200 draw calls to ~28.
 */
function mergeByMaterial(root: THREE.Object3D): THREE.Group {
  const byMaterial = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
    const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
    // Merging needs identical attribute sets; UVs exist on some parts only.
    for (const attr of Object.keys(g.attributes)) {
      if (attr !== 'position' && attr !== 'normal') g.deleteAttribute(attr);
    }
    const list = byMaterial.get(material);
    if (list) list.push(g);
    else byMaterial.set(material, [g]);
  });

  const group = new THREE.Group();
  for (const [material, geoms] of byMaterial) {
    const merged = geoms.length === 1 ? geoms[0] : mergeGeometries(geoms, false);
    if (!merged) {
      // mergeGeometries returns null on mismatched attributes — keep the parts
      // rather than losing them.
      for (const g of geoms) group.add(new THREE.Mesh(g, material));
      continue;
    }
    if (merged !== geoms[0]) for (const g of geoms) g.dispose();
    group.add(new THREE.Mesh(merged, material));
  }
  group.traverse((o) => {
    o.castShadow = true;
    o.receiveShadow = false;
  });
  return group;
}

/** Loads all four chassis. A model that fails to load resolves to null. */
export async function loadChassis(): Promise<(THREE.Group | null)[]> {
  const loader = new GLTFLoader();
  return Promise.all(
    Array.from({ length: SEATS }, (_, seat) =>
      loader
        .loadAsync(modelUrl(seat))
        .then((gltf) => mergeByMaterial(gltf.scene))
        .catch((err) => {
          console.warn(`[board3d] chassis ${seat} failed to load`, err);
          return null;
        }),
    ),
  );
}

/** Fallback body so a failed .glb load still shows something on the board. */
function placeholder(seat: number): THREE.Group {
  const colors = [0xf94144, 0xf9c74f, 0x43aa8b, 0x9d6bf2];
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.BoxGeometry(0.6, 0.4, 0.7),
    new THREE.MeshStandardMaterial({ color: colors[seat % 4], roughness: 0.5 }),
  );
  body.position.y = 0.2;
  body.castShadow = true;
  g.add(body);
  return g;
}

/** Seconds to cover ~63% of the remaining distance — tuned to the DOM board's
 *  `transition: transform 0.32s ease`. */
const TAU = 0.1;
const FLASH_SECONDS = 0.32;

/** One robot on the 3D board: eased position, shortest-path facing, hit flash. */
export class RobotRig {
  readonly object: THREE.Group;

  private readonly pos = new THREE.Vector3();
  private readonly wanted = new THREE.Vector3();
  /** Cumulative, so a W->N turn goes 90 degrees CW instead of 270 back. */
  private angle = 0;
  private wantedAngle = 0;
  private flash = 0;
  private readonly emissives: {
    material: THREE.MeshStandardMaterial;
    color: THREE.Color;
    intensity: number;
  }[] = [];

  constructor(chassis: THREE.Group | null, seat: number, ghost = false) {
    const source = chassis ?? placeholder(seat);
    this.object = source.clone(true);
    // Clone materials so a damage flash (or the ghost's transparency) touches
    // this robot only — Object3D.clone() shares material references.
    this.object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = (
        Array.isArray(mesh.material) ? mesh.material[0] : mesh.material
      ).clone() as THREE.MeshStandardMaterial;
      mesh.material = material;
      mesh.castShadow = !ghost;
      if (ghost) {
        material.transparent = true;
        material.opacity = 0.42;
        material.depthWrite = false;
      } else if (material.emissive) {
        this.emissives.push({
          material,
          color: material.emissive.clone(),
          intensity: material.emissiveIntensity,
        });
      }
    });
  }

  setTarget(pos: Position, facing: Direction): void {
    this.wanted.set(pos.x + 0.5, 0, pos.y + 0.5);
    const target = DIR_YAW[facing];
    let delta = (((target - this.angle) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    if (delta > Math.PI) delta -= Math.PI * 2;
    this.wantedAngle = this.angle + delta;
  }

  setVisible(visible: boolean): void {
    this.object.visible = visible;
  }

  /** Red pulse on a hit. Purely cosmetic; the state change is the event's. */
  hit(): void {
    this.flash = FLASH_SECONDS;
  }

  /** Advance the ease. Returns true while still moving. */
  step(dt: number): boolean {
    const k = 1 - Math.exp(-dt / TAU);
    this.pos.lerp(this.wanted, k);
    this.angle += (this.wantedAngle - this.angle) * k;

    let moving =
      this.pos.distanceToSquared(this.wanted) > 1e-6 ||
      Math.abs(this.wantedAngle - this.angle) > 1e-3;
    if (!moving) {
      this.pos.copy(this.wanted);
      this.angle = this.wantedAngle;
    }

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - dt);
      const t = this.flash / FLASH_SECONDS;
      for (const e of this.emissives) {
        if (this.flash === 0) {
          // Restore the colour too: several chassis parts are lamps and
          // thrusters that emit on their own.
          e.material.emissive.copy(e.color);
          e.material.emissiveIntensity = e.intensity;
        } else {
          e.material.emissive.setHex(0xff2b2b);
          e.material.emissiveIntensity = 0.15 + t * 1.6;
        }
      }
      moving = true;
    }

    this.object.position.copy(this.pos);
    this.object.rotation.y = this.angle;
    return moving;
  }

  /** Where this rig actually is, in board cells. Fractional mid-ease. */
  cell(): { x: number; y: number; visible: boolean } {
    return {
      x: this.object.position.x - 0.5,
      y: this.object.position.z - 0.5,
      visible: this.object.visible,
    };
  }

  snap(): void {
    this.pos.copy(this.wanted);
    this.angle = this.wantedAngle;
    this.object.position.copy(this.pos);
    this.object.rotation.y = this.angle;
  }

  dispose(): void {
    this.object.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const material = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of material) m.dispose();
    });
  }
}
