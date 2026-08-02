// Transient world-space effects for the 3D board: the bump ring, the laser
// impact, the destruction blast, the respawn landing, the checkpoint pop and
// the win burst.
//
// POOLED, not allocated per event. There are two shared geometries (a flat ring
// and a billboard quad), one shared sprite texture, and a fixed set of slots
// that are hidden rather than disposed when they finish. A replay fires an
// effect every few hundred milliseconds; churning geometry at that rate is how
// you get GC hitches on a phone.
//
// Durations are sized to ReplayPlayer's eventDuration budget at 1x, and nothing
// here ever asks the replay clock to wait: an effect still running when the next
// event arrives is force-finished by scene.ts, exactly as the DOM board's CSS
// animations behave when the cursor advances underneath them.
//
// The maths — easing, the flash curve — is in ./effectMath and unit tested
// there. This module is only the three.js that consumes it.

import * as THREE from 'three';
import { clamp01, ease, flashCurve } from './effectMath';

/**
 * Expanding/contracting rings: bump, shockwave, landing dust, checkpoint halo,
 * hazard pulses, the crusher's anticipation ring.
 *
 * 8 and 22 were sized for one ring plus seven debris puffs. Phase 48 can put a
 * three-ring shockwave, a hazard pulse and a slam in the same register, and a
 * teleport lays six billboards down at once on top of whatever is still in the
 * air — so both pools go up. `stolen()` is what says whether they went up
 * enough; it must stay at 0 across a whole game.
 */
const RING_SLOTS = 14;
/** Billboards: laser impacts, blast debris, teleport trails, the win burst. */
const PUFF_SLOTS = 32;

/**
 * The pose a reduced-motion effect holds instead of animating. Near the peak of
 * the flash curve and most of the way through the scale ramp, so the mark is at
 * its most legible: the information survives, the motion doesn't.
 */
const STILL_T = 0.35;

/** index.css, as hex — the same palette boardMesh.ts reads in. */
const COLOR = {
  bump: 0xffffff,
  impact: 0xffe3c4,
  ember: 0xffb264,
  smoke: 0xb9c2da,
  dust: 0x9fd8ff,
  checkpoint: 0x6fe3bd,
  win: 0xfff0b8,
  /** The crusher's steel, so the slam doesn't read as another explosion. */
  slam: 0xc9d4f2,
  teleport: 0x6fe4ff,
};

/**
 * Hazard pulse colours, each taken from the tile's OWN material in
 * boardMesh.ts. That is the whole point of the effect: six of the ten
 * expansion elements have to read through silhouette alone (Phase 46's
 * decision log), so when one of them damages a robot the only thing that can
 * say WHICH one did it is the colour of the beat it makes.
 */
const HAZARD: Record<HazardKind, number> = {
  flamer: 0xff9636, // flameMat
  radiation: 0xd3e34a, // radiationMat
  waste: 0x58c470, // wasteMat's emissive
};

/** The `damage` event's environmental sources. Laser damage is not one. */
export type HazardKind = 'flamer' | 'radiation' | 'waste';

interface Anim {
  t: number;
  life: number;
  /** Scale at t=0 and t=1. Contracting effects have r1 < r0. */
  r0: number;
  r1: number;
  peak: number;
  /** Flash curve (rise then decay) vs a straight linear fade out. */
  flash: boolean;
  /** Face the camera every frame — quads only; rings stay flat on the deck. */
  billboard: boolean;
  /** Radians of spin over the whole life, about Y for rings, Z for quads. */
  spin: number;
  base: THREE.Vector3;
  /** Total displacement over the life, eased. */
  drift: THREE.Vector3;
}

interface Slot {
  mesh: THREE.Mesh;
  material: THREE.MeshBasicMaterial;
  anim: Anim | null;
}

interface Spawn {
  at: THREE.Vector3;
  life: number;
  r0: number;
  r1: number;
  color: number;
  peak?: number;
  flash?: boolean;
  spin?: number;
  drift?: THREE.Vector3;
}

/** A soft round blob, so a puff is a puff and not a square. */
function softSprite(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.32, 'rgba(255,255,255,0.72)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Debris and burst directions. A fixed table rather than Math.random: the
 * engine's determinism rule doesn't reach the render layer, but a screenshot
 * that differs run to run is a verification problem all the same.
 */
const SPRAY = [0.31, 1.22, 2.05, 2.88, 3.71, 4.62, 5.45];
/** Golden angle, so the win burst spreads evenly however many puffs it uses. */
const GOLDEN = 2.399963;

export class EffectField {
  /**
   * True while prefers-reduced-motion is set. Read on every step, not captured
   * at construction, because the user can flip it mid-session.
   */
  still = false;

  private readonly ringGeom: THREE.BufferGeometry;
  private readonly puffGeom: THREE.BufferGeometry;
  private readonly sprite: THREE.CanvasTexture;
  private readonly rings: Slot[] = [];
  private readonly puffs: Slot[] = [];
  /**
   * The checkpoint flare: a bright additive copy sitting exactly on the claimed
   * ring, so the ring itself appears to go white-hot. Its own slot because its
   * geometry is BORROWED from the board (whatever the tile kit modelled), and
   * therefore must never be disposed here.
   */
  private readonly flare: Slot;

  constructor(private readonly group: THREE.Group) {
    // A thin band, not a wide one: at a 1.5-tile radius a 22%-thick ring read as
    // a soft grey disc rather than a shockwave.
    this.ringGeom = new THREE.RingGeometry(0.87, 1, 48).rotateX(-Math.PI / 2);
    this.puffGeom = new THREE.PlaneGeometry(1, 1);
    this.sprite = softSprite();

    for (let i = 0; i < RING_SLOTS; i++) this.rings.push(this.slot(this.ringGeom, null));
    for (let i = 0; i < PUFF_SLOTS; i++) this.puffs.push(this.slot(this.puffGeom, this.sprite));
    this.flare = this.slot(this.ringGeom, null);
  }

  private slot(geometry: THREE.BufferGeometry, map: THREE.Texture | null): Slot {
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      map,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      // Additive so effects read as light rather than paint, and so a ring
      // lying on the deck never z-fights with the tile under it.
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.visible = false;
    // Effects are small and always near the subject; culling them costs more
    // than drawing the handful that are live.
    mesh.frustumCulled = false;
    this.group.add(mesh);
    return { mesh, material, anim: null };
  }

  /**
   * A free slot, or the most-progressed busy one. Stealing beats dropping: a
   * blast's shockwave arriving while six debris puffs are still in the air must
   * not be the effect that goes missing.
   *
   * It is still a VISIBLE GLITCH — a live effect vanishes mid-flight — so every
   * theft is counted. `stolen()` reads it out through the scene's `stats()`,
   * and the Phase 48 pool sizes are only justified if a whole multi-turn game
   * leaves it at zero.
   */
  private take(pool: Slot[]): Slot {
    let oldest = pool[0];
    let best = -1;
    for (const s of pool) {
      if (!s.anim) return s;
      const progress = s.anim.life > 0 ? s.anim.t / s.anim.life : 1;
      if (progress > best) {
        best = progress;
        oldest = s;
      }
    }
    this.stolenCount++;
    return oldest;
  }

  private stolenCount = 0;

  /** How many times a live effect has been cut short for want of a slot. */
  stolen(): number {
    return this.stolenCount;
  }

  private start(slot: Slot, s: Spawn): void {
    slot.anim = {
      t: 0,
      life: s.life,
      r0: s.r0,
      r1: s.r1,
      peak: s.peak ?? 1,
      flash: s.flash ?? false,
      billboard: slot.mesh.geometry === this.puffGeom,
      spin: s.spin ?? 0,
      base: s.at.clone(),
      drift: s.drift ? s.drift.clone() : new THREE.Vector3(),
    };
    slot.material.color.setHex(s.color);
    slot.mesh.visible = true;
    // Place it now: an effect spawned in update() must look right on the frame
    // that immediately follows, not one frame later.
    this.pose(slot, null);
  }

  private pose(slot: Slot, camera: THREE.Quaternion | null): void {
    const a = slot.anim;
    if (!a) return;
    const u = this.still ? STILL_T : clamp01(a.life > 0 ? a.t / a.life : 1);
    const k = ease(u);
    const scale = a.r0 + (a.r1 - a.r0) * k;
    slot.mesh.position.copy(a.base).addScaledVector(a.drift, k);
    slot.mesh.scale.setScalar(Math.max(scale, 1e-4));
    slot.material.opacity = a.peak * (a.flash ? flashCurve(u) : 1 - u);
    if (a.billboard) {
      if (camera) slot.mesh.quaternion.copy(camera);
      slot.mesh.rotation.z += a.spin * u;
    } else {
      // The ring geometry is built already lying in the XZ plane, so the mesh
      // itself only ever spins about Y. Rotating it flat a second time here
      // stood every ring on its edge and made it invisible.
      slot.mesh.rotation.set(0, a.spin * u, 0);
    }
  }

  /** Advance every live effect. Returns true while any are still running. */
  step(dt: number, camera: THREE.Quaternion): boolean {
    let live = false;
    for (const pool of [this.rings, this.puffs]) {
      for (const slot of pool) {
        if (!slot.anim) continue;
        slot.anim.t += dt;
        if (slot.anim.t >= slot.anim.life) {
          this.finish(slot);
          continue;
        }
        this.pose(slot, camera);
        live = true;
      }
    }
    if (this.flare.anim) {
      this.flare.anim.t += dt;
      if (this.flare.anim.t >= this.flare.anim.life) this.finish(this.flare);
      else {
        this.poseFlare();
        live = true;
      }
    }
    return live;
  }

  private finish(slot: Slot): void {
    slot.anim = null;
    slot.mesh.visible = false;
    slot.material.opacity = 0;
  }

  /** True while anything is on screen — scene.ts's `settled()` needs this. */
  busy(): boolean {
    if (this.flare.anim) return true;
    for (const pool of [this.rings, this.puffs]) {
      for (const slot of pool) if (slot.anim) return true;
    }
    return false;
  }

  /**
   * Force-finish everything. Called when the board is rebuilt, because the
   * flare borrows the board's own checkpoint geometry and the old board is
   * about to dispose it.
   */
  reset(): void {
    for (const pool of [this.rings, this.puffs]) for (const slot of pool) this.finish(slot);
    this.finish(this.flare);
    this.flare.mesh.geometry = this.ringGeom;
  }

  // ------------------------------------------------------------- the effects
  /**
   * Wall slam. A contracting ring, kicked toward the wall the robot hit —
   * the 3D reading of the DOM board's `.bump-flash`, which scales 1 -> 0.82 and
   * fades.
   */
  bump(at: THREE.Vector3, dir: { x: number; z: number } | null): void {
    const base = new THREE.Vector3(at.x, 0.11, at.z);
    if (dir) {
      base.x += dir.x * 0.28;
      base.z += dir.z * 0.28;
    }
    this.start(this.take(this.rings), {
      at: base,
      life: 0.34,
      r0: 0.62,
      r1: 0.44,
      color: COLOR.bump,
    });
  }

  /** Laser impact: one bright flash where the beam stopped. */
  impact(at: THREE.Vector3): void {
    this.start(this.take(this.puffs), {
      at: at.clone(),
      life: 0.24,
      r0: 0.22,
      r1: 0.7,
      color: COLOR.impact,
      flash: true,
      spin: 0.8,
    });
  }

  /**
   * A layered shockwave: three rings leaving at staggered starts, each reaching
   * further and fading slower than the last.
   *
   * One ring (the pre-48 blast) read as a bubble — it left at a single speed
   * and stopped. Three overlapping wavefronts is what gives an explosion a
   * front and a tail without adding a particle system to do it.
   */
  shockwave(at: THREE.Vector3): void {
    const base = new THREE.Vector3(at.x, 0.09, at.z);
    for (let i = 0; i < 3; i++) {
      this.start(this.take(this.rings), {
        // Each ring starts where the one before it was heading, so they never
        // sit on top of each other and z-fight on the deck.
        at: base.clone().setY(0.09 + i * 0.012),
        life: 0.42 + i * 0.16,
        r0: 0.3 + i * 0.22,
        r1: 1.25 + i * 0.5,
        color: i === 1 ? COLOR.impact : COLOR.ember,
        peak: 1 - i * 0.26,
      });
    }
  }

  /** Destruction: a layered shockwave across the deck plus a puff of debris. */
  blast(at: THREE.Vector3): void {
    this.shockwave(at);
    for (let i = 0; i < SPRAY.length; i++) {
      const a = SPRAY[i];
      const reach = 0.55 + (i % 3) * 0.28;
      this.start(this.take(this.puffs), {
        at: new THREE.Vector3(at.x, 0.3, at.z),
        life: 0.44 + (i % 3) * 0.08,
        r0: 0.22,
        r1: 0.66,
        color: i % 2 ? COLOR.ember : COLOR.smoke,
        flash: true,
        spin: i % 2 ? 1.4 : -1.1,
        drift: new THREE.Vector3(Math.cos(a) * reach, 0.5 + (i % 2) * 0.35, Math.sin(a) * reach),
      });
    }
  }

  /**
   * End-of-turn repair: a ring in the checkpoint green CONTRACTING onto the
   * chassis. Expansion is this pool's language for impacts and arrivals;
   * drawing inward is what reads as mending rather than another hit.
   */
  repair(at: THREE.Vector3): void {
    this.start(this.take(this.rings), {
      at: new THREE.Vector3(at.x, 0.08, at.z),
      life: 0.4,
      r0: 0.95,
      r1: 0.3,
      color: COLOR.checkpoint,
      peak: 0.85,
    });
  }

  /**
   * Teleport: a trail of cyan billboards along a LIFTED ARC from the departure
   * cell to the arrival cell.
   *
   * The arc is the whole reading. A blink already marks both ends (scene.ts
   * fires `repair` on the origin and `land` on the destination), but with only
   * those two marks a portal jump across the board is indistinguishable from
   * two unrelated things happening at once. The arc is what says they are the
   * same robot — and it is drawn as a rising trail rather than a straight line
   * so it reads as travel over the board, not a laser across it.
   *
   * The puffs are staggered so the trail LEAVES the origin: each one starts
   * further along and lives a little longer, which the shared drift field turns
   * into a wave without any per-puff timeline.
   */
  teleport(from: THREE.Vector3, to: THREE.Vector3): void {
    const n = 6;
    // A short hop over one tile shouldn't arc as high as a jump across the
    // board, but a zero-length hop still needs a visible pop.
    const span = Math.hypot(to.x - from.x, to.z - from.z);
    const height = 0.45 + Math.min(span, 8) * 0.14;
    for (let i = 0; i < n; i++) {
      const s = i / (n - 1);
      // Sine, not a parabola: it is 0 at both ends, so the trail meets the deck
      // exactly where the two end marks are.
      const lift = Math.sin(Math.PI * s) * height;
      this.start(this.take(this.puffs), {
        at: new THREE.Vector3(
          from.x + (to.x - from.x) * s,
          0.22 + lift,
          from.z + (to.z - from.z) * s,
        ),
        life: 0.34 + s * 0.2,
        r0: 0.16 + s * 0.1,
        r1: 0.5,
        color: COLOR.teleport,
        flash: true,
        peak: 0.9,
        spin: i % 2 ? 1.1 : -0.9,
        drift: new THREE.Vector3(0, 0.28, 0),
      });
    }
  }

  /**
   * An environmental hazard biting: a ring in the HAZARD'S OWN COLOUR.
   *
   * This is the beat the silhouette-only pieces never had. A flamer roasting a
   * robot, a radiation tick and a walk through waste all emitted the same
   * `damage` event with nothing on the board to tell them apart — the caption
   * was the entire difference. Orange, yellow-green and green are the same
   * three colours the tiles themselves are painted, so the pulse points at the
   * tile that did it.
   */
  hazardPulse(at: THREE.Vector3, kind: HazardKind): void {
    this.start(this.take(this.rings), {
      at: new THREE.Vector3(at.x, 0.12, at.z),
      life: 0.42,
      r0: 0.34,
      r1: 0.95,
      color: HAZARD[kind],
      peak: 0.9,
      // Radiation and waste are ambient — they seep. A flamer is a burst, so it
      // gets the flash attack and the other two get a plain fade.
      flash: kind === 'flamer',
      spin: kind === 'waste' ? 0.5 : 0,
    });
  }

  /**
   * Crusher anticipation: a ring drawn INWARD onto the cell, ahead of the
   * impact.
   *
   * Contracting is `repair()`'s idiom, borrowed deliberately. The crusher's
   * own beat used to be an impact flash plus a bump ring — both of which are
   * this field's language for something leaving a point — so a press coming
   * down read as a small explosion. Drawing the ring in first is what makes it
   * read as a mass arriving from above.
   */
  slam(at: THREE.Vector3): void {
    this.start(this.take(this.rings), {
      at: new THREE.Vector3(at.x, 0.13, at.z),
      life: 0.3,
      r0: 1.45,
      r1: 0.5,
      color: COLOR.slam,
      peak: 0.95,
    });
  }

  /** Respawn touchdown: a ring of dust kicked out from under the chassis. */
  land(at: THREE.Vector3): void {
    this.start(this.take(this.rings), {
      at: new THREE.Vector3(at.x, 0.07, at.z),
      life: 0.4,
      r0: 0.25,
      r1: 0.92,
      color: COLOR.dust,
      peak: 0.9,
    });
  }

  /**
   * Checkpoint claimed: an expanding halo, plus a flare welded to the claimed
   * ring itself. `ring` is the board's own checkpoint instance — geometry and
   * placement — so the flare lands exactly on the modelled ring whatever the
   * tile kit shipped, instead of on a guess about where it is.
   */
  checkpointPop(
    at: THREE.Vector3,
    ring: { geometry: THREE.BufferGeometry; matrix: THREE.Matrix4 } | null,
  ): void {
    this.start(this.take(this.rings), {
      at: new THREE.Vector3(at.x, 0.08, at.z),
      life: 0.5,
      r0: 0.4,
      r1: 1.0,
      color: COLOR.checkpoint,
      spin: 0.6,
    });
    if (!ring) return;
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    ring.matrix.decompose(pos, quat, scale);
    this.flare.mesh.geometry = ring.geometry;
    this.flare.anim = {
      t: 0,
      life: 0.5,
      r0: scale.x,
      r1: scale.x * 1.22,
      peak: 1,
      flash: true,
      billboard: false,
      spin: 0,
      base: pos,
      drift: new THREE.Vector3(),
    };
    this.flare.mesh.quaternion.copy(quat);
    this.flare.material.color.setHex(COLOR.checkpoint);
    this.flare.mesh.visible = true;
    this.poseFlare();
  }

  /** The flare keeps the claimed ring's own orientation, so it can't use pose(). */
  private poseFlare(): void {
    const a = this.flare.anim;
    if (!a) return;
    const u = this.still ? STILL_T : clamp01(a.t / a.life);
    const k = ease(u);
    this.flare.mesh.position.copy(a.base);
    this.flare.mesh.scale.setScalar(a.r0 + (a.r1 - a.r0) * k);
    this.flare.material.opacity = flashCurve(u);
  }

  /** Win flourish: a camera-facing burst over the winner, and a rising ring. */
  winBurst(at: THREE.Vector3): void {
    this.start(this.take(this.rings), {
      at: new THREE.Vector3(at.x, 0.1, at.z),
      life: 0.8,
      r0: 0.35,
      r1: 1.35,
      color: COLOR.win,
      peak: 0.95,
    });
    const n = 12;
    for (let i = 0; i < n; i++) {
      const a = i * GOLDEN;
      const reach = 0.7 + (i % 4) * 0.22;
      this.start(this.take(this.puffs), {
        at: new THREE.Vector3(at.x, 0.42, at.z),
        life: 0.62 + (i % 4) * 0.09,
        r0: 0.2,
        r1: 0.55,
        color: i % 3 === 0 ? COLOR.impact : COLOR.win,
        flash: true,
        spin: i % 2 ? 1.8 : -1.5,
        drift: new THREE.Vector3(Math.cos(a) * reach, 0.7 + (i % 3) * 0.3, Math.sin(a) * reach),
      });
    }
  }

  dispose(): void {
    // The flare's geometry is the board's, not ours — put ours back before
    // disposing so we never free a borrowed buffer.
    this.flare.mesh.geometry = this.ringGeom;
    for (const pool of [this.rings, this.puffs, [this.flare]]) {
      for (const slot of pool) {
        this.group.remove(slot.mesh);
        slot.material.dispose();
      }
    }
    this.ringGeom.dispose();
    this.puffGeom.dispose();
    this.sprite.dispose();
  }
}
