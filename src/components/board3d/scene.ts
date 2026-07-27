// The imperative three.js side of the 3D board. React owns the <canvas>;
// everything below this line is plain three.js driven by a VisualState.
//
// This module is the lazy boundary: Board3D reaches it through
// `await import('./scene')`, and it is the only place that imports `three`
// statically — so the lobby, editor, rules and gallery never download it.
//
// Render-on-demand: the rAF loop runs only while something is actually
// moving (robot eases, the camera, scrolling belts). An idle board costs one
// frame and then nothing.

import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { BoardDef, Direction, EngineEvent, PlayerId, Position } from '../../engine';
import type { RobotVisual, VisualState } from '../replay/visualState';
import {
  getFocusPlayer,
  getView,
  resetView,
  setView,
  subscribe,
} from '../../services/viewSettings';
import { buildBoard, laserMuzzle, type BoardMeshes } from './boardMesh';
import { CameraDirector, cellCentre, eventFocus, ROBOT_RADIUS } from './camera';
import { attachViewControls } from './controls';
import {
  BEAM_OVERSHOOT,
  clamp01,
  DIR_STEP,
  edgeFallDir,
  projectToViewport,
  robotMuzzle,
  ROBOT_MUZZLE,
  segment,
  vecToDir,
} from './effectMath';
import { EffectField } from './effects';
import { loadChassis, RobotRig, SEAT_COLORS } from './robots';
import { loadTileKit } from './tileKit';
import type { FollowMode } from './viewMath';

export interface BoardSceneInput {
  board: BoardDef;
  visual: VisualState;
  currentEvent?: EngineEvent | null;
  ghost?: { robot: RobotVisual; seat: number };
}

/** Where a robot's speech bubble should sit, in CSS pixels over the canvas. */
export interface BubbleAnchor {
  player: PlayerId;
  x: number;
  y: number;
  visible: boolean;
}

export interface BoardSceneHooks {
  /**
   * Called on every rendered frame with a bubble anchor per robot. The array is
   * REUSED between calls, so read it synchronously — Board3D writes the numbers
   * straight onto DOM refs and never puts them in React state.
   */
  onAnchors?(anchors: BubbleAnchor[]): void;
}

export interface BoardScene {
  update(input: BoardSceneInput): void;
  dispose(): void;
  /**
   * Verification hooks for the spike. `probe` reports where each rig actually
   * ended up in world space (not what it was told), so Playwright can check
   * robots land on the right cells — and, since 3D-4, that none is left
   * airborne (`height` > 0) or invisible after a backwards scrub. `settled` is
   * false while anything is still easing or any effect is running, which is what
   * a screenshot should wait for.
   */
  probe(): { player: PlayerId; x: number; y: number; height: number; visible: boolean }[];
  settled(): boolean;
  /**
   * The live camera state, so a Playwright drag can assert the camera moved
   * rather than trusting a screenshot. `subject` is in board coordinates and
   * is clamped to keep the framing over the board, so near an edge it lags
   * the followed cell by design.
   */
  view(): { yaw: number; tilt: number; zoom: number; follow: FollowMode; subject: { x: number; y: number } };
}

const DANGER = 0xf25c54;
/** Longest a frame may advance the eases — a backgrounded tab must not jump. */
const MAX_DT = 0.05;
/** Seconds a beam spends fat and bright before settling to its steady width. */
const BEAM_PUNCH = 0.14;
/** The key light's resting intensity, and the win flourish's brief lift. */
const KEY_INTENSITY = 2.4;
const KEY_PEAK = 3.7;
const KEY_LIFT_SECONDS = 0.8;
/** Tiles above the chassis a speech bubble is anchored. */
const BUBBLE_HEIGHT = 0.95;
/**
 * Pixels a bubble anchor is kept inside the canvas so the bubble isn't cut off.
 * The bubble hangs upward from its anchor and is centred on it, so x has to
 * cover half its width and y only its height.
 *
 * Half-width, not a constant: index.css caps a bubble at `min(11rem, 34%)` of
 * the canvas, so on a phone the clamp has to shrink with it or bubbles are held
 * so far from the rim that they detach from their robots.
 */
const BUBBLE_MARGIN_MAX_X = 96;
const BUBBLE_MARGIN_Y = 34;
function bubbleMargin(width: number): { x: number; y: number } {
  return { x: Math.min(BUBBLE_MARGIN_MAX_X, width * 0.19), y: BUBBLE_MARGIN_Y };
}
/** Local axis of the beam cylinder, which is built lying along +X. */
const BEAM_AXIS = new THREE.Vector3(1, 0, 0);

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export async function createBoardScene(
  canvas: HTMLCanvasElement,
  first: BoardSceneInput,
  hooks: BoardSceneHooks = {},
): Promise<BoardScene> {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  // PCFSoftShadowMap is deprecated in r185 and silently falls back to PCF.
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();

  // Metal parts render black without something to reflect. A generated room
  // is cheaper than shipping an HDRI.
  //
  // The balance below is the tile kit's, not the flat panels': a metal
  // surface has no diffuse response, so the environment — not the lamps —
  // is what a deck plate actually shows you. Hence a much stronger env and a
  // quieter hemisphere than the primitives were lit with. The key stays hot
  // because it is doing two other jobs: specular streaks along the decking,
  // and every shadow on the board.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomScene = new RoomEnvironment();
  const envRT = pmrem.fromScene(roomScene, 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.6;
  pmrem.dispose();
  roomScene.dispose?.();

  scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x0a0c12, 0.4));
  const key = new THREE.DirectionalLight(0xfff2dc, KEY_INTENSITY);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0015;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x7fd6ff, 0.75);
  scene.add(rim, rim.target);

  const beamGeom = new THREE.CylinderGeometry(0.05, 0.05, 1, 8).rotateZ(Math.PI / 2);
  const beamMat = new THREE.MeshBasicMaterial({
    color: DANGER,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const beam = new THREE.Mesh(beamGeom, beamMat);
  beam.visible = false;
  scene.add(beam);

  // Every transient effect lives under one group, pooled and hidden rather than
  // allocated per event. See ./effects.ts.
  const fxGroup = new THREE.Group();
  scene.add(fxGroup);
  const effects = new EffectField(fxGroup);

  // Both fetches are in flight together: the kit is one file, and the board
  // can't be built until it has resolved either way.
  const [chassis, kit] = await Promise.all([loadChassis(), loadTileKit()]);

  let board = first.board;
  let meshes: BoardMeshes = buildBoard(board, kit);
  scene.add(meshes.group);

  const director = new CameraDirector(board, aspect());
  const rigs = new Map<PlayerId, RobotRig>();
  let ghostRig: { rig: RobotRig; seat: number } | null = null;
  let lastEvent: EngineEvent | null | undefined;
  let settled = false;
  /** Last input seen, so the follow rule can be re-applied on a mode change. */
  let current = first;
  /** Seconds since the beam appeared, or -1 when there is no beam. */
  let beamAge = -1;
  /** Seconds of key-light lift left on the win flourish. */
  let keyLift = 0;
  /** Scratch, so dispatching an event allocates nothing. */
  const tmpPos = new THREE.Vector3();
  const tmpDir = new THREE.Vector3();

  function aspect(): number {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    return w / h;
  }

  function aimLights(): void {
    const span = Math.max(board.width, board.height);
    const cx = board.width / 2;
    const cz = board.height / 2;
    key.target.position.set(cx, 0, cz);
    key.position.set(cx - span * 0.6, span * 1.15, cz + span * 0.5);
    const half = span * 0.75;
    const cam = key.shadow.camera;
    cam.left = -half;
    cam.right = half;
    cam.top = half;
    cam.bottom = -half;
    cam.near = 0.5;
    cam.far = span * 3;
    cam.updateProjectionMatrix();
    rim.target.position.set(cx, 0, cz);
    rim.position.set(cx + span * 0.7, span * 0.6, cz - span * 0.9);
  }
  aimLights();

  function rebuildBoard(next: BoardDef): void {
    // The checkpoint flare borrows the board's own ring geometry, which is about
    // to be disposed.
    effects.reset();
    scene.remove(meshes.group);
    meshes.dispose();
    board = next;
    meshes = buildBoard(board, kit);
    scene.add(meshes.group);
    director.setBoard(board);
    aimLights();
  }

  function rigFor(r: RobotVisual, seat: number): RobotRig {
    let rig = rigs.get(r.player);
    if (!rig) {
      rig = new RobotRig(chassis[seat % chassis.length] ?? null, seat);
      rigs.set(r.player, rig);
      scene.add(rig.object);
      rig.setTarget(r.pos, r.facing);
      rig.snap();
    }
    return rig;
  }

  // --------------------------------------------------------------- lasers
  function seatOf(player: PlayerId | undefined): number {
    if (!player) return 0;
    const i = current.visual.robots.findIndex((r) => r.player === player);
    return i < 0 ? 0 : i;
  }

  function facingOf(player: PlayerId | undefined): Direction | null {
    if (!player) return null;
    return current.visual.robots.find((r) => r.player === player)?.facing ?? null;
  }

  /**
   * The beam, from the real muzzle to whatever stopped it.
   *
   * Board shots start at `laserMuzzle()` — the same function that placed the
   * modelled `laser_lens`, so the beam cannot drift off the emitter — and stay
   * --danger red. Robot shots start at the shooter rig's chassis muzzle and take
   * the shooter's seat colour, so you can see who fired.
   */
  function updateBeam(e: EngineEvent | null | undefined): void {
    if (!e || e.type !== 'laser-fired' || e.path.length === 0) {
      beam.visible = false;
      beamAge = -1;
      return;
    }
    const first = e.path[0];
    const last = e.path[e.path.length - 1];
    // The path names the direction, unless the beam never left its own cell.
    let dir =
      e.path.length >= 2 ? vecToDir(e.path[1].x - first.x, e.path[1].y - first.y) : null;

    const from = new THREE.Vector3();
    let color = DANGER;
    if (e.source === 'board') {
      const onCell = board.lasers.filter((l) => l.pos.x === first.x && l.pos.y === first.y);
      const emitter = onCell.find((l) => !dir || l.facing === dir) ?? onCell[0];
      dir ??= emitter?.facing ?? null;
      if (emitter) from.copy(laserMuzzle(emitter));
      else cellCentre(first, from).setY(ROBOT_MUZZLE.height);
    } else {
      color = SEAT_COLORS[seatOf(e.shooter) % SEAT_COLORS.length];
      const facing = facingOf(e.shooter) ?? dir ?? 'N';
      dir ??= facing;
      // The rig's LIVE position, not the cell centre: mid-ease the muzzle is
      // wherever the chassis has actually got to.
      const rig = e.shooter ? rigs.get(e.shooter) : undefined;
      const at = rig
        ? { x: rig.object.position.x, z: rig.object.position.z }
        : { x: first.x + 0.5, z: first.y + 0.5 };
      const m = robotMuzzle(at, facing);
      from.set(m.x, m.y, m.z);
    }

    const to = new THREE.Vector3(last.x + 0.5, from.y, last.y + 0.5);
    if (e.hit) {
      // End on the victim's turret line, and at where the victim actually is.
      const victim = rigs.get(e.hit);
      if (victim) {
        to.x = victim.object.position.x;
        to.z = victim.object.position.z;
      }
      to.y = ROBOT_MUZZLE.height;
    } else if (dir) {
      // Nothing stopped it: carry on out of the last cell.
      to.x += DIR_STEP[dir].x * BEAM_OVERSHOOT;
      to.z += DIR_STEP[dir].z * BEAM_OVERSHOOT;
    }

    const s = segment(from, to);
    beam.position.set(s.mid.x, s.mid.y, s.mid.z);
    beam.scale.set(Math.max(s.length, 0.01), 1, 1);
    beam.quaternion.setFromUnitVectors(BEAM_AXIS, tmpDir.set(s.dir.x, s.dir.y, s.dir.z));
    beamMat.color.setHex(color);
    beam.visible = true;
    beamAge = 0;
    if (e.hit) effects.impact(to);
  }

  /** The cell carrying checkpoint `n`, so a claim can flare the right ring. */
  function checkpointCell(n: number): Position | null {
    for (let y = 0; y < board.height; y++) {
      for (let x = 0; x < board.width; x++) {
        const tile = board.tiles[y][x];
        if (tile.kind === 'checkpoint' && tile.n === n) return { x, y };
      }
    }
    return null;
  }

  /**
   * One new event -> its visible consequence on the board.
   *
   * Effects have FIXED durations sized to ReplayPlayer's eventDuration budget:
   * nothing here can make the replay clock wait, because `eventDuration` is
   * shared with the DOM board and Board3D has to stay a drop-in swap. Rig
   * animations are force-finished by the caller when the next event arrives;
   * world-space effects are all shorter than their event's 1x budget and simply
   * expire.
   *
   * Deliberately absent: card-revealed, register-locked, life-lost,
   * player-eliminated, turn-* and register-started. They have no place on the
   * board — the caption, the register strip and the player strip show them.
   */
  function dispatch(e: EngineEvent | null | undefined, still: boolean): void {
    updateBeam(e);
    if (!e) return;
    switch (e.type) {
      case 'damage':
        rigs.get(e.player)?.hit();
        break;
      case 'robot-blocked':
        effects.bump(cellCentre(e.at, tmpPos), DIR_STEP[e.dir]);
        rigs.get(e.player)?.recoil(e.dir, still);
        break;
      case 'robot-fell': {
        const rig = rigs.get(e.player);
        if (!rig) break;
        // `at` is the last in-bounds cell, so which edge it touches names the
        // way it went; on a corner the rig's facing, then its travel, breaks the
        // tie.
        const dir =
          e.cause === 'edge'
            ? edgeFallDir(
                e.at,
                board.width,
                board.height,
                rig.facingDirection(),
                rig.travelDirection(),
              )
            : null;
        rig.fall(e.cause, dir, still);
        break;
      }
      case 'robot-destroyed':
        rigs.get(e.player)?.explode();
        effects.blast(cellCentre(e.at, tmpPos));
        break;
      case 'robot-respawned':
        rigs.get(e.player)?.respawnAt(e.pos, e.facing, still);
        effects.land(cellCentre(e.pos, tmpPos));
        break;
      case 'checkpoint-claimed': {
        const cell = checkpointCell(e.checkpoint);
        if (cell) {
          effects.checkpointPop(cellCentre(cell, tmpPos), meshes.checkpointRing(cell.x, cell.y));
        }
        break;
      }
      case 'game-won': {
        const winner = current.visual.robots.find((r) => r.player === e.player);
        if (winner) effects.winBurst(cellCentre(winner.pos, tmpPos));
        keyLift = still ? 0 : KEY_LIFT_SECONDS;
        break;
      }
      default:
        break;
    }
  }

  // ------------------------------------------------------------ render loop
  let raf = 0;
  let last = 0;
  let elapsed = 0;
  let disposed = false;
  const belts = () => meshes.animated && !prefersReducedMotion();

  /** The beam's opening punch: fat and bright, then its steady width. */
  function stepBeam(dt: number): boolean {
    if (beamAge < 0 || !beam.visible) return false;
    beamAge += dt;
    const u = clamp01(beamAge / BEAM_PUNCH);
    // scale.x is the beam's LENGTH; y and z are its thickness.
    beam.scale.y = beam.scale.z = 1 + 0.85 * (1 - u);
    beamMat.opacity = 0.85 + 0.15 * (1 - u);
    if (u < 1) return true;
    beamAge = -1;
    return false;
  }

  /** A brief lift on the key light over a win. Rises and falls once. */
  function stepKey(dt: number): boolean {
    if (keyLift <= 0) return false;
    keyLift = Math.max(0, keyLift - dt);
    const u = 1 - keyLift / KEY_LIFT_SECONDS;
    key.intensity =
      keyLift === 0 ? KEY_INTENSITY : KEY_INTENSITY + (KEY_PEAK - KEY_INTENSITY) * Math.sin(Math.PI * u);
    return keyLift > 0;
  }

  /**
   * Speech-bubble anchors, in CSS pixels over the canvas. Reported after the
   * render because `project()` needs the camera's inverse world matrix, which
   * the renderer is what updates.
   */
  const anchors: BubbleAnchor[] = [];
  function reportAnchors(): void {
    if (!hooks.onAnchors) return;
    anchors.length = 0;
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const margin = bubbleMargin(w);
    for (const [player, rig] of rigs) {
      tmpDir.copy(rig.object.position);
      tmpDir.y += BUBBLE_HEIGHT;
      tmpDir.project(director.camera);
      const p = projectToViewport(tmpDir, w, h, margin);
      anchors.push({ player, x: p.x, y: p.y, visible: p.visible && rig.object.visible });
    }
    hooks.onAnchors(anchors);
  }

  function frame(now: number): void {
    if (disposed) return;
    const dt = last ? Math.min((now - last) / 1000, MAX_DT) : 1 / 60;
    last = now;
    elapsed += dt;

    let moving = director.step(dt);
    for (const rig of rigs.values()) moving = rig.step(dt) || moving;
    if (ghostRig) moving = ghostRig.rig.step(dt) || moving;
    // Effects, the beam punch and the key lift all keep the loop alive — without
    // this a Playwright screenshot lands mid-animation, and half an effect is
    // worse than none.
    moving = effects.step(dt, director.camera.quaternion) || moving;
    moving = stepBeam(dt) || moving;
    moving = stepKey(dt) || moving;
    if (belts()) meshes.tick(elapsed);

    renderer.render(scene, director.camera);
    reportAnchors();

    if (moving || belts()) raf = requestAnimationFrame(frame);
    else {
      raf = 0;
      settled = true;
    }
  }

  function requestFrame(): void {
    settled = false;
    if (!raf && !disposed) {
      last = 0;
      raf = requestAnimationFrame(frame);
    }
  }

  // -------------------------------------------------------------- lifecycle
  function resize(): void {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    director.setAspect(w / h);
    requestFrame();
  }

  const observer = new ResizeObserver(resize);
  observer.observe(canvas);

  // ------------------------------------------------------- who owns the subject
  /**
   * Point the director at whatever the current follow mode says. Idempotent,
   * so it is safe to call on every update as well as on a mode change — and
   * in `free` mode it deliberately does nothing at all, which is what keeps a
   * panned camera where the player left it.
   */
  function refocus(): void {
    const mode = getView().follow;
    if (mode === 'free') return;
    if (mode === 'robot') {
      const me = getFocusPlayer();
      const robot = me ? current.visual.robots.find((r) => r.player === me) : undefined;
      // A wider radius than a single event: "my bot's area" has to keep the
      // pushes and the incoming lasers in frame, not just the chassis.
      if (robot?.visible) {
        director.focus(robot.pos, ROBOT_RADIUS);
        return;
      }
      // Destroyed, eliminated, or no local player: fall back to the action
      // rather than freezing on an empty cell.
    }
    director.focus(eventFocus(current.currentEvent, current.visual));
  }

  const controls = attachViewControls(canvas, {
    orbit(dYaw, dTilt) {
      const v = getView();
      setView({ yaw: v.yaw + dYaw, tilt: v.tilt + dTilt });
      requestFrame();
    },
    zoom(factor) {
      setView({ zoom: getView().zoom * factor });
      requestFrame();
    },
    pan(dx, dy) {
      director.pan(dx, dy);
      // Panning is the one gesture that takes the subject off the director,
      // so say so out loud instead of leaving a mysteriously stuck camera.
      setView({ follow: 'free' });
      requestFrame();
    },
    reset() {
      resetView();
      requestFrame();
    },
  });

  // The overlay's follow buttons and ↺ write to the same service the gestures
  // do, so this is the single path from settings to camera.
  const unsubscribe = subscribe(() => {
    director.setView(getView());
    refocus();
    requestFrame();
  });
  director.setView(getView());

  function update(next: BoardSceneInput): void {
    current = next;
    if (next.board !== board) rebuildBoard(next.board);

    next.visual.robots.forEach((r, seat) => {
      const rig = rigFor(r, seat);
      rig.setTarget(r.pos, r.facing);
      rig.setVisible(r.visible);
    });

    if (next.ghost) {
      if (!ghostRig || ghostRig.seat !== next.ghost.seat) {
        if (ghostRig) {
          scene.remove(ghostRig.rig.object);
          ghostRig.rig.dispose();
        }
        const seat = next.ghost.seat;
        const rig = new RobotRig(chassis[seat % chassis.length] ?? null, seat, true);
        scene.add(rig.object);
        rig.setTarget(next.ghost.robot.pos, next.ghost.robot.facing);
        rig.snap();
        ghostRig = { rig, seat };
      }
      ghostRig.rig.setTarget(next.ghost.robot.pos, next.ghost.robot.facing);
      ghostRig.rig.setVisible(next.ghost.robot.visible);
    } else if (ghostRig) {
      scene.remove(ghostRig.rig.object);
      ghostRig.rig.dispose();
      ghostRig = null;
    }

    const e = next.currentEvent;
    if (e !== lastEvent) {
      lastEvent = e;
      const still = prefersReducedMotion();
      effects.still = still;
      // Force-finish every rig animation before starting a new one. That is both
      // how the fixed durations stay inside the replay clock's budget (the DOM
      // board's CSS animations end the same way when the cursor advances
      // underneath them) and why scrubbing BACKWARDS is safe: the VisualState is
      // always the truth, so no rig can be left invisible or mid-air.
      for (const rig of rigs.values()) rig.finishAnim();
      dispatch(e, still);
    }

    // The director is deliberately dumb here: fly to wherever this event
    // happened, unless the player has taken the subject. Interest scoring
    // seeded from eventDuration is 3D-5.
    refocus();
    requestFrame();
  }

  update(first);
  resize();
  director.snap();

  return {
    update,
    settled: () => settled,
    probe: () =>
      [...rigs.entries()].map(([player, rig]) => ({
        player,
        ...rig.cell(),
      })),
    // Angles come from the camera itself, not the settings, so this reports
    // where the camera *is* — mid-ease it lags the player's input and settles
    // onto it exactly, which is what makes it worth asserting on.
    view: () => ({
      ...director.currentView(),
      follow: getView().follow,
      subject: director.subject(),
    }),
    dispose() {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      controls.dispose();
      unsubscribe();
      observer.disconnect();
      for (const rig of rigs.values()) rig.dispose();
      ghostRig?.rig.dispose();
      effects.dispose();
      meshes.dispose();
      kit?.dispose();
      beamGeom.dispose();
      beamMat.dispose();
      envRT.dispose();
      renderer.dispose();
    },
  };
}
