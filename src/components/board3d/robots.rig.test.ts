// The two promises RobotRig makes that a screenshot cannot check.
//
//  1. IT STOPS. `step()` returning true is what re-arms scene.ts's rAF loop, so
//     an animation whose liveness signal never falls to false would keep a
//     settled board rendering forever — the exact regression the on-demand loop
//     exists to prevent. Every builtin board has conveyors, which keep the loop
//     alive on their own, so this cannot be observed in the app at all.
//  2. A MISSING PART IS NOT A CRASH. The `anim_*` groups come out of a .glb
//     built by a separate Blender script; the contract is that anything absent
//     leaves the chassis static, exactly as it was before Phase 47.
//
// `three` runs fine in the node environment — Object3D is plain maths — so the
// rig is exercised directly rather than through a canvas.

import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import { ANIM_PARTS, RobotRig } from './robots';

const FRAME = 1 / 60;

/** A stand-in chassis carrying whichever `anim_*` groups a test asks for. */
function fakeChassis(parts: readonly string[], materialName = 'body'): THREE.Group {
  const material = new THREE.MeshStandardMaterial({ name: materialName });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.6), material));
  for (const name of parts) {
    const part = new THREE.Group();
    part.name = name;
    part.position.set(0.3, 0.2, 0.1);
    part.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.1), material));
    group.add(part);
  }
  return group;
}

/** Run frames until the rig says it is done, up to a ceiling. */
function stepUntilStill(rig: RobotRig, maxFrames = 600): number {
  for (let i = 0; i < maxFrames; i++) {
    if (!rig.step(FRAME)) return i;
  }
  return -1;
}

describe('the rig settles, so the render loop can sleep', () => {
  it('stops reporting movement a fraction of a second after a move', () => {
    const rig = new RobotRig(fakeChassis(ANIM_PARTS), 0);
    rig.setTarget({ x: 0, y: 0 }, 'N');
    rig.snap();
    rig.setTarget({ x: 0, y: 3 }, 'N');
    const frames = stepUntilStill(rig);
    expect(frames).toBeGreaterThan(0); // it did animate
    expect(frames).toBeLessThan(120); // and it stopped, inside two seconds
  });

  it('stops after a long diagonal chase across the board, not just a nudge', () => {
    const rig = new RobotRig(fakeChassis(ANIM_PARTS), 0);
    rig.setTarget({ x: 0, y: 0 }, 'N');
    rig.snap();
    for (const to of [
      { x: 11, y: 11 },
      { x: 0, y: 11 },
      { x: 11, y: 0 },
    ]) {
      rig.setTarget(to, 'E');
      // Half a second of travel, then let it finish on its own.
      for (let i = 0; i < 30; i++) rig.step(FRAME);
    }
    expect(stepUntilStill(rig)).toBeGreaterThanOrEqual(0);
  });

  it('stops even when the frames are long — a backgrounded tab must not wedge it', () => {
    const rig = new RobotRig(fakeChassis(ANIM_PARTS), 0);
    rig.setTarget({ x: 0, y: 0 }, 'N');
    rig.snap();
    rig.setTarget({ x: 4, y: 0 }, 'E');
    // scene.ts clamps dt to MAX_DT = 0.05.
    let frames = 0;
    while (rig.step(0.05)) if (++frames > 200) break;
    expect(frames).toBeLessThan(200);
  });

  it('is already still before it is ever told to move', () => {
    const rig = new RobotRig(fakeChassis(ANIM_PARTS), 0);
    rig.setTarget({ x: 2, y: 2 }, 'N');
    rig.snap();
    expect(rig.step(FRAME)).toBe(false);
  });
});

describe('the rig animates the parts it has', () => {
  it('drives the treads, gait and wheels off travel, and puts them back on setStill', () => {
    const rig = new RobotRig(fakeChassis(ANIM_PARTS), 0);
    rig.setTarget({ x: 0, y: 0 }, 'N');
    rig.snap();
    const parts = ANIM_PARTS.map((n) => rig.object.getObjectByName(n)!);
    const rest = parts.map((p) => p.position.clone());

    rig.setTarget({ x: 0, y: 6 }, 'N');
    for (let i = 0; i < 12; i++) rig.step(FRAME);
    const moved = parts.filter((p, i) => !p.position.equals(rest[i]));
    // Treads and tripods translate; the wheels rotate about their own axle.
    expect(moved.length).toBeGreaterThanOrEqual(4);
    expect(rig.object.getObjectByName('anim_wheel_0')!.rotation.x).not.toBe(0);

    rig.setStill(true);
    parts.forEach((p, i) => {
      expect(p.position.x).toBeCloseTo(rest[i].x, 10);
      expect(p.position.y).toBeCloseTo(rest[i].y, 10);
      expect(p.position.z).toBeCloseTo(rest[i].z, 10);
    });
    expect(rig.object.getObjectByName('anim_wheel_0')!.rotation.x).toBe(0);
    // The ease itself is still running — setStill parks the PARTS, it does not
    // teleport the robot — but nothing keeps the loop awake past it.
    expect(stepUntilStill(rig)).toBeGreaterThanOrEqual(0);
    parts.forEach((p, i) => expect(p.position.z).toBeCloseTo(rest[i].z, 10));
  });

  it('reports the parts it found, by name, so a silent fallback is visible', () => {
    const full = new RobotRig(fakeChassis(ANIM_PARTS), 0);
    expect(full.animParts().map((p) => p.name).sort()).toEqual([...ANIM_PARTS].sort());
    expect(full.animParts().every((p) => p.meshes === 1)).toBe(true);
  });
});

describe('a chassis without the named parts is static, never broken', () => {
  it('runs a whole move on a .glb that has no anim groups at all', () => {
    const rig = new RobotRig(fakeChassis([]), 0);
    rig.setTarget({ x: 0, y: 0 }, 'N');
    rig.snap();
    rig.setTarget({ x: 3, y: 0 }, 'E');
    expect(() => stepUntilStill(rig)).not.toThrow();
    expect(rig.animParts()).toEqual([]);
    expect(rig.cell().height).toBe(0);
  });

  it('runs on the placeholder box, which is what a failed load gets', () => {
    const rig = new RobotRig(null, 2);
    rig.setTarget({ x: 1, y: 1 }, 'S');
    rig.snap();
    rig.setTarget({ x: 1, y: 5 }, 'S');
    expect(stepUntilStill(rig)).toBeGreaterThanOrEqual(0);
    expect(rig.animParts()).toEqual([]);
  });

  it('animates whatever it does have when the .glb is only half there', () => {
    const rig = new RobotRig(fakeChassis(['anim_wheel_0', 'anim_wheel_2']), 3);
    rig.setTarget({ x: 0, y: 0 }, 'N');
    rig.snap();
    rig.setTarget({ x: 0, y: 4 }, 'N');
    for (let i = 0; i < 12; i++) rig.step(FRAME);
    expect(rig.animParts()).toHaveLength(2);
    expect(rig.object.getObjectByName('anim_wheel_0')!.rotation.x).not.toBe(0);
    expect(stepUntilStill(rig)).toBeGreaterThanOrEqual(0);
  });
});

describe('the body wrapper keeps the height probe honest', () => {
  it('bobs the hovercraft on the body, never on the object Playwright measures', () => {
    // A chassis with thrusters and no moving parts IS the hovercraft.
    const rig = new RobotRig(fakeChassis([], 'thrust'), 2);
    rig.setTarget({ x: 0, y: 0 }, 'N');
    rig.snap();
    rig.setTarget({ x: 0, y: 5 }, 'N');
    let bobbed = false;
    for (let i = 0; i < 30; i++) {
      rig.step(FRAME);
      // `cell().height` is what "no robot is left airborne" is asserted on.
      expect(rig.cell().height).toBe(0);
      const body = rig.object.children[0];
      if (Math.abs(body.position.y) > 1e-6) bobbed = true;
    }
    expect(bobbed).toBe(true);
    stepUntilStill(rig);
    expect(rig.object.children[0].position.y).toBe(0);
  });
});
