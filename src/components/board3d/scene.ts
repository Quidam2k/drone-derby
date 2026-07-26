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
import type { BoardDef, EngineEvent, PlayerId } from '../../engine';
import type { RobotVisual, VisualState } from '../replay/visualState';
import {
  getFocusPlayer,
  getView,
  resetView,
  setView,
  subscribe,
} from '../../services/viewSettings';
import { buildBoard, type BoardMeshes } from './boardMesh';
import { CameraDirector, eventFocus, ROBOT_RADIUS } from './camera';
import { attachViewControls } from './controls';
import { loadChassis, RobotRig } from './robots';
import type { FollowMode } from './viewMath';

export interface BoardSceneInput {
  board: BoardDef;
  visual: VisualState;
  currentEvent?: EngineEvent | null;
  ghost?: { robot: RobotVisual; seat: number };
}

export interface BoardScene {
  update(input: BoardSceneInput): void;
  dispose(): void;
  /**
   * Verification hooks for the spike. `probe` reports where each rig actually
   * ended up in world space (not what it was told), so Playwright can check
   * robots land on the right cells; `settled` is false while anything is
   * still easing, which is what a screenshot should wait for.
   */
  probe(): { player: PlayerId; x: number; y: number; visible: boolean }[];
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

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

export async function createBoardScene(
  canvas: HTMLCanvasElement,
  first: BoardSceneInput,
): Promise<BoardScene> {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  // PCFSoftShadowMap is deprecated in r185 and silently falls back to PCF.
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();

  // Metal parts (the chassis have metalness-1 steel) render black without
  // something to reflect. A generated room is cheaper than shipping an HDRI.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const roomScene = new RoomEnvironment();
  const envRT = pmrem.fromScene(roomScene, 0.04);
  scene.environment = envRT.texture;
  scene.environmentIntensity = 0.3;
  pmrem.dispose();
  roomScene.dispose?.();

  scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x0a0c12, 0.55));
  const key = new THREE.DirectionalLight(0xfff2dc, 2.4);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.bias = -0.0015;
  key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x7fd6ff, 0.9);
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

  const chassis = await loadChassis();

  let board = first.board;
  let meshes: BoardMeshes = buildBoard(board);
  scene.add(meshes.group);

  const director = new CameraDirector(board, aspect());
  const rigs = new Map<PlayerId, RobotRig>();
  let ghostRig: { rig: RobotRig; seat: number } | null = null;
  let lastEvent: EngineEvent | null | undefined;
  let settled = false;
  /** Last input seen, so the follow rule can be re-applied on a mode change. */
  let current = first;

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
    scene.remove(meshes.group);
    meshes.dispose();
    board = next;
    meshes = buildBoard(board);
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

  function updateBeam(e: EngineEvent | null | undefined): void {
    if (!e || e.type !== 'laser-fired' || e.path.length === 0) {
      beam.visible = false;
      return;
    }
    const a = e.path[0];
    const b = e.path[e.path.length - 1];
    const horizontal = a.y === b.y;
    const length = (horizontal ? Math.abs(b.x - a.x) : Math.abs(b.y - a.y)) + 1;
    beam.position.set((a.x + b.x) / 2 + 0.5, 0.36, (a.y + b.y) / 2 + 0.5);
    beam.rotation.y = horizontal ? 0 : Math.PI / 2;
    beam.scale.set(length, 1, 1);
    beam.visible = true;
  }

  // ------------------------------------------------------------ render loop
  let raf = 0;
  let last = 0;
  let elapsed = 0;
  let disposed = false;
  const belts = () => meshes.animated && !prefersReducedMotion();

  function frame(now: number): void {
    if (disposed) return;
    const dt = last ? Math.min((now - last) / 1000, MAX_DT) : 1 / 60;
    last = now;
    elapsed += dt;

    let moving = director.step(dt);
    for (const rig of rigs.values()) moving = rig.step(dt) || moving;
    if (ghostRig) moving = ghostRig.rig.step(dt) || moving;
    if (belts()) meshes.tick(elapsed);

    renderer.render(scene, director.camera);

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
      if (e?.type === 'damage') rigs.get(e.player)?.hit();
      updateBeam(e);
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
      meshes.dispose();
      beamGeom.dispose();
      beamMat.dispose();
      envRT.dispose();
      renderer.dispose();
    },
  };
}
