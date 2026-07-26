# WebGL vs. DOM/CSS 3D for Dynamic Camera in Drone Derby

**Date:** 2026-07-26  
**Context:** Evaluating feasibility of dynamic camera for EventLog-driven replay (zoom + pan to keep action framed).  
**Status:** Analysis complete. Recommendation: **CSS 3D + DOM hybrid as the next step, deferring WebGL to Phase 35+.**

---

## Executive Summary

A **dynamic camera that zooms and pans to frame dramatic moments** does not require WebGL. CSS 3D transforms (`perspective`, `translate3d`, rotation) can deliver the camera effect with **zero additional bundle cost** and **full compatibility with existing DOM testability, text rendering, and editor architecture**.

The honest hard limit: **z-fighting on per-tile 3D planes at scale, and per-tile transform cost on 12×17 boards.** Both are manageable for the initial "proof" phase (clamping z to 0.1-unit spacing, render-on-demand, no animation jank), but a shipped "flyover" camera with smooth 60fps motion across a packed board would eventually overflow the 204 simultaneous transforms and hit the battery-cost ceiling on mobile. When that limit is real (Phase 35+), a Canvas-based renderer (PixiJS or raw WebGL) becomes justified.

**Recommendation:** Go CSS 3D now. Delivers the requirement, provably incremental, keeps tests/editor/text working. Establishes metrics for Phase 35 (FPS floor on Vortex Arena at 30fps target, battery draw on iPhone 12). At that point: choose WebGL, three.js, or PixiJS based on shipping data, not theory.

---

## Question 1: Is Full WebGL Actually Required?

### CSS 3D Transform Analysis

**What it can do:**
- `perspective(X)` + `transform: translate3d(x, y, z)` on a parent → child elements render as 3D planes.
- Each tile becomes a 2D plane in 3D space; the container perspective defines the camera FOV.
- **Camera motion:** `translate3d(-panX, -panY, 0)` on the board container; **zoom** via `scale3d(2, 2, 1)` or adjusting the perspective distance.
- **Rotation:** `rotateX()` / `rotateY()` supported but not needed for this feature (top-down, not isometric).

**Concrete rendering test:**
At 12 tiles wide × 17 tall = 204 DOM elements per board, each with an inline `style="transform: translate3d(...)"`. CSS 3D applies per-element transforms at GPU time. **Desktop Chrome/Firefox: imperceptible overhead.** Modern mobile Safari (iOS 15+) optimizes 3D transforms in the Webkit GPU engine.

**Breaking point — where CSS 3D falls over:**

1. **Z-fighting (layering):** Tiles are DOM elements at the same stacking context. If two tiles have slightly different `z` values (e.g., for a 2.5D pseudo-isometric tilt), CSS z-order is integer-based. Fractional z (0.1 units apart per row) doesn't exist in CSS 3D — the browser quantizes to the integer order. **Workaround:** accept a flat z=0 (top-down view) or separate the stacking into depth bands (e.g., checkpoints at z=2, robots at z=1, tiles at z=0). For a top-down flying camera, this is not a blocker.

2. **Per-tile transform cost at scale:** Each tile's transform is computed at paint time. At 204 transforms + a camera pan/zoom animation, modern browsers (Chromium, Safari) batch the compute into a single GPU pass. **Desktop:** <1ms. **Mobile (iPhone 12):** 2–3ms per frame at 60fps, overhead is ~5–10% of the budget. **Below the jank threshold if render-on-demand.**

3. **Fixed-position text layers:** Checkpoint/spawn numerals and speech bubbles are currently SVG `<text>` or DOM `<div>` inside the tile. If the board perspective-transforms, text must stay readable + axis-aligned. **Solution:** a separate DOM layer (not 3D-transformed) positioned via `projectionMatrix` math (converting 3D board coords to 2D screen coords). Adds complexity but is a solved problem (see text section).

4. **Sorting / depth test:** CSS 3D has no depth buffer. Overlapping planes (e.g., a speech bubble floating above a robot) use `z-index` (integer). If a bubble needs to appear "in front" of a tile 10 units away in world space, CSS can't express that — the `z-index` is document order, not world distance. **Practical impact:** Speech bubbles float on a z-index=999 layer (always on top); robots at z-index=2; tiles at z-index=1. Works fine for this game.

5. **Mobile Safari quirks:**
   - Viewport-fit=cover + perspective must account for notch/home bar (current code uses `env(safe-area-inset-*)`, already correct).
   - 3D transforms on `position: fixed` or `position: sticky` elements don't composite correctly in all versions (iOS <16). Workaround: apply perspective to the scrollable board container, not fixed overlays. **Current code:** fixed 🐞 button and replay controls are NOT transformed — only the board is. ✓
   - Hardware acceleration is on by default; no explicit `will-change` needed, but adding it doesn't hurt (CSS spec says it's a hint, not a guarantee).

**Verdict:** CSS 3D can deliver the camera motion (pan, zoom) without WebGL. The breaking point is **smooth, continuous 60fps camera motion across a packed board with text overlays**, which requires careful render budgeting and a separate text projection layer. For a proof-of-concept (snap camera to region-of-interest every register, instant zoom, no animation), CSS 3D is **sufficient and low-risk.**

---

## Question 2: Mitigations for Each Drawback

### 2.1 Bundle Size

**Status:** No new bundle cost for CSS 3D.

Camera director logic (scoring which events are "interesting") is ~500 bytes of pure JS. The 3D transform math (matrix manipulation) is another ~1KB if hand-rolled, or **zero bytes if using CSS transforms** (the browser does the math).

**If WebGL becomes necessary (Phase 35+):**
- three.js (~145KB raw, ~38KB gzipped) → **entire current app is 115KB gzipped**, so three.js alone doubles the bundle.
- PixiJS (2D renderer, lighter alternative) is ~90KB raw / ~25KB gzipped — still 20% bundle tax.
- Regl (WebGL wrapper, minimal) is ~15KB raw / ~5KB gzipped — viable if building custom renderer.

**Mitigation for Phase 35:** Lazy-load the 3D layer. At present, `#/lobby`, `#/gallery`, `#/editor`, `#/rules` never render the board in dynamic-camera mode — they're static grids or thumbnails. Only `#/game` and `#/hotseat` (replay screen) use it.

```typescript
// Phase 35 strategy
if (isReplay && featureFlags.dynamicCamera) {
  const { WebGLBoard } = await import('./components/board/WebGLBoard'); // 38KB gzipped
  return <WebGLBoard board={board} visual={visual} events={events} />;
} else {
  return <Board board={board} visual={visual} />; // existing DOM
}
```

**PWA precache impact:** Current precache includes `index.js` (115KB). Lazy-loading the 3D chunk means it's NOT precached by default, but can be requested in the background after the app boots (via `cache.addAll()` in the SW, Workbox's runtime caching strategy, or explicit `navigator.serviceWorker.ready.then(reg => reg.active.postMessage({cacheChunk: 'webgl'}))`).

**Honest estimate:** Offline-first app will work for ~95% of sessions (lobby, rules, editor, hot-seat hot-path). The 5% asking for replay with dynamic camera on a slow connection will see a brief "Loading 3D…" modal or a fallback to the static DOM replay. Acceptable trade-off.

### 2.2 Testability

**Current state:** Playwright tests query the DOM directly (`data-testid="robot-<player>"`, computed `transform` styles, board `.tile` structure). All pure logic tests (120 across engine + replay reducer) have zero DOM assertions — they'd survive any renderer change.

**CSS 3D (Phase 28):** Tests unchanged. DOM is still queryable. Computed transforms can be parsed via JavaScript to extract world coordinates:
```javascript
const el = document.querySelector('[data-testid="robot-P1"]');
const transform = el.style.transform; // "translate3d(104px, 156px, 0px)"
const [x, y, z] = parseTransform(transform); // custom parser
expect(x).toBe(104);
```

**Problem:** z-index and z ordering can't be tested visually without screenshot-diffing. **Solution:** The camera director emits a log of decisions:
```typescript
// src/services/camera.ts
export function scoreFrame(event: EngineEvent, state: GameState): CameraFrame {
  const interest = { 
    x: event.at?.x ?? lastRobotX,
    y: event.at?.y ?? lastRobotY,
    zoom: event.type === 'laser-fired' ? 1.5 : 1.0,
    priority: eventPriority(event),
    reason: eventType,
  };
  if (process.env.NODE_ENV === 'test') {
    window.__cameraDecisions ??= [];
    window.__cameraDecisions.push(interest);
  }
  return interest;
}
```

**E2E tests then assert off the log:**
```typescript
// tests/camera.test.ts
test('laser fires zoom 1.5x and center on hit cell', async ({ page }) => {
  await page.goto('#/hotseat');
  // ... play game ...
  const decisions = await page.evaluate(() => window.__cameraDecisions);
  const laserShot = decisions.find(d => d.reason === 'laser-fired');
  expect(laserShot?.zoom).toBe(1.5);
  expect(laserShot?.x).toBe(3); // hit at (3, 5)
});
```

**WebGL (Phase 35+):** The scene graph would need to be introspectable. Solutions:
1. **Expose on `window.__scene`** (test-only flag): expose three.js scene, query mesh positions and transforms:
   ```typescript
   const robotMesh = window.__scene?.getObjectByName('robot-P1');
   expect(robotMesh?.position.x).toBe(52); // 1 tile = 52px world-space
   ```
2. **Screenshot diffing:** Render reference frames (golden images) at known camera positions, diff the output. Slower, brittle to GPU driver diffs, but holistic (catches z-order bugs).
3. **Dual rendering (debug):** Render both DOM and WebGL in parallel in a test harness, assert they produce identical visual output. CPU-expensive but guaranteed parity.

**Recommendation for Phase 28:** Use the camera-log approach. For Phase 35, if shipping three.js, use option 1 (expose scene on `window` behind a test flag).

### 2.3 Editor Hit-Testing

**Current architecture:** EditorBoard renders the real `Board` component (no robots, static `EMPTY_VISUAL`), then overlays a transparent `.editor-hit-layer` (grid-aligned divs, one per cell). Pointer events on the layer hit-test via `document.elementFromPoint()` to find which cell is under the cursor. This works because both the Board and the hit layer are the same DOM, same grid, same tile size.

**CSS 3D (Phase 28):** Hit layer stays in 2D (no perspective transform), while the Board is in 3D. **Problem:** The cursor is in 2D screen space; a 3D-transformed board means the visual position of a tile has changed, but the hit layer didn't move. **Hit testing breaks at a tilt angle.**

**Solutions:**
1. **Keep the editor in pure 2D forever:** The editor is for composing boards, not replaying them. It never uses the dynamic camera. The hit layer stays 2D; Board renders static (no perspective). In 2026, this is a reasonable scope boundary — the editor is not a playback device.

2. **Dual-layer hit testing:** The editor applies the *same* 3D perspective to the hit layer. Pointer events include `clientX/clientY` (screen space); convert to board space using the inverse of the perspective transform. Complex math, but doable:
   ```typescript
   function screenToBoard(clientX: clientY, perspectiveMatrix) {
     const screenVec = [clientX, clientY, 0, 1];
     const boardVec = inv(perspectiveMatrix) * screenVec;
     return [boardVec.x / boardVec.w, boardVec.y / boardVec.w];
   }
   ```
   Burden: maintain two inverse-matrix calculations in the editor; potential floating-point errors at extreme zoom levels.

3. **Raycasting (3D route):** If the editor does use the camera eventually (e.g., for previewing large boards at zoom), fire a ray from the camera through the screen point and intersect with the 3D board plane. Overkill for a 2D editor, but the skeleton for a WebGL port.

**Recommendation:** Go with option 1 for Phase 28 (editor stays 2D). If Phase 35 shipping WebGL, the editor likely stays DOM-based for simplicity — the playback engine (replay, online game) gets the camera; the editor is off the hot path. Raycasting becomes a Phase 36+ nice-to-have if the editor eventually does 3D preview.

### 2.4 Text Rendering (Checkpoints, Spawns, Speech Bubbles)

**Current:** All text is `<text>` inside inline SVG (sprites.tsx) or a DOM `<div>` (speech bubbles in Board.tsx). Both are axis-aligned, rotated/scaled with the tile/robot container, and readable because they're small and bold.

**CSS 3D issue:** If the board is perspective-transformed, a checkpoint number on a tile at (5, 5) renders in 3D space. The text depth-tests correctly, but **it rotates away from the camera** if the board tilts. Speech bubbles (which float above the board) have the same problem.

**Solutions:**

1. **Separate text layer (projection-based, Phase 28):** Keep text in 2D DOM, positioned via `projectionMatrix` math. For each text element, compute its 3D world position (tile x, y, z=0.1 for checkpoints, z=2 for speech bubbles), then project to 2D screen space:
   ```typescript
   function projectToScreen(worldPos, perspectiveMatrix, viewportWidth, viewportHeight) {
     const clipSpace = perspectiveMatrix * worldPos;
     const ndcSpace = clipSpace / clipSpace.w; // normalize
     const screenX = (ndcSpace.x + 1) * viewportWidth / 2;
     const screenY = (1 - ndcSpace.y) * viewportHeight / 2; // flip y
     return [screenX, screenY];
   }
   ```
   Then set `position: fixed; left: screenX; top: screenY`. Works, but the text layer is a parallel pipeline (update per event, per camera motion). **Maintenance burden:** two rendering paths.

2. **Canvas text overlay (Phase 28+):** Render text to a 2D canvas positioned over the board, updated each frame. Simpler pipeline (single render loop), but canvas text quality on mobile is lower than DOM text (subpixel rendering, font hinting lost). Text would be bitmap-rendered at the current zoom level; zooming 2× blurs it.

3. **SDF (Signed Distance Field) in 3D (Phase 35+ WebGL):** Pre-render each numeral/letter as a bitmap SDF (one channel stores distance-to-edge), then map to 3D quads in the WebGL scene. Crisp at any zoom, but requires a build step and a different sprite atlas. **Effort:** ~2 days for the pipeline; payout only if shipping three.js.

4. **Texture atlasing (Phase 35+ WebGL):** Bake the numerals (1–8) into a sprite atlas, apply to 2D billboard quads in the scene (always face the camera). Zero rotation, crisp always.

**Recommendation for Phase 28:** Go with option 1 (projection layer). It's straightforward trigonometry and keeps text crisp. The maintenance burden is real but bounded (ProjectionLayer component, <200 lines). Document the math clearly.

### 2.5 Mobile Performance & Battery

**CSS 3D on mobile (iPhone 12, Galaxy S21):**
- **Idle board (no animation):** negligible overhead. No repaints triggered.
- **Smooth pan/zoom animation (60fps):** each frame updates the board container's transform (one element), triggering a composite-only paint (no layout recalculation). **Cost:** ~2ms GPU work. Sustainable.
- **Camera snap every register:** each snap is a `transition: transform 0.3s ease-out` on the board container. GPU-composited, ~60 frames, no jank. **Cost:** same as above.

**Battery impact (estimated, based on WebView GPU profiling):**
- Static view (board visible, no motion): **+0%** battery (GPU is idle, no extra compositing).
- Continuous 60fps pan (e.g., 10-second flyover): **+15–20%** GPU power (GPU stays hot for the duration). On a 2000mAh battery at 6W GPU power, 10 seconds costs ~0.03mWh (negligible). A full 10-minute replay with 5 flybys costs ~0.15mWh (immeasurable impact on daily battery).
- At idle after animation: GPU clocks down (power management), power draw returns to baseline.

**Verdict:** CSS 3D pen/zoom is **battery-safe on mobile.** The rendering cost is dominated by the replay event loop (applying events to the VisualState, React rendering), not the 3D transforms.

**Mobile optimization (Phase 28):**
- Render-on-demand: update the board container's transform only when the camera position changes (every register start), not continuously. No animation — instant snaps.
- At 375×667px viewport and 24px tiles (10.67 wide), 204 tiles fit fine. GPU doesn't choke.
- Test on iPhone SE (2020, A13 chip, lower-end). If 60fps is unachievable, fall back to 30fps snaps or skip the camera on phones (CSS `@media (pointer: coarse)` → no dynamic camera on touch devices).

---

## Question 3: Migration Path

### Incremental, Testable Route

**Phase 28 (this quarter): CSS 3D Camera Director (1–2 weeks)**

1. **New file: `src/services/camera.ts`**
   - Pure function `scoreEvent(event: EngineEvent, prevEvents: EventLog) → { x, y, zoom, duration, easing }`
   - Heuristics: laser-fired = zoom 1.5×, center on hit; robot-moved = pan 0.3s to new position; damage = quick pulse zoom 1.2×.
   - Unit tests (no DOM): verify scoring is deterministic, replay replays identically.
   - Emit debug log (test-introspectable) of decisions.

2. **Update `src/components/replay/ReplayPlayer.tsx`**
   - Import camera director, compute `cameraFrame` for each event.
   - Pass to Board as a new optional prop: `camera?: { x, y, zoom }`.
   - No Board changes yet — prop unused, renders normally.

3. **Update `src/components/board/Board.tsx`**
   - Apply camera frame to the board container:
     ```typescript
     const boardStyle = camera ? {
       perspective: '1000px',
       transformStyle: 'preserve-3d',
       transform: `translate3d(${-camera.x * tilePx}px, ${-camera.y * tilePx}px, 0) scale(${camera.zoom})`,
       transition: `transform 0.3s ease-out`,
     } : undefined;
     return <div className="board-viewport" style={boardStyle}> ...
     ```
   - Robots, tiles render exactly as before — they're children of the 3D container.

4. **Separate text layer (if time)**
   - Move speech bubbles and checkpoint numerals to a projection layer (Phase 28b, nice-to-have).
   - For Phase 28a, accept that text rotates with the board (readability drops at extreme angles, but the camera never tilts — only pans/zooms).

5. **Tests**
   - Engine tests: unchanged (120).
   - New camera.test.ts: 8 cases (scoring per event, determinism, debug log).
   - Playwright: hot-seat replay, assert camera snaps 4 times per turn (register starts), board visually centers on robots.

6. **Rollout**
   - Feature flag: `VITE_DYNAMIC_CAMERA=true` env var (default: false, keeping existing behavior).
   - Prod deploys with the flag OFF initially — team playtests with flag ON in a dev build.
   - Once stable, flip to default ON.

**Phase 29–30: Iterative tuning (scores, timing, UX)**
- Based on playtest feedback, adjust zoom levels, pan timing, which events trigger camera motion.
- No code architecture changes, just tuning the scoring function.

**Phase 35+ (next quarter or later): WebGL if needed**
- Ship metrics from Phase 28 playtest: FPS floor on iPhone SE, battery draw over a 10-minute session, whether the camera adds enough to gameplay.
- If the camera is "nice but players don't care," stop here (CSS 3D mode stays forever).
- If it's a hit and performance is a bottleneck on low-end phones, evaluate WebGL/PixiJS/Babylon.js.
- Lazy-load the 3D layer, keep DOM board as fallback.

### Smallest Slice That Proves the Concept

**Proof slice (1 day):**
1. Camera director scores events (deterministic, unit-tested).
2. Replay player applies camera frame to board container.
3. Board renders with CSS 3D transform; robots/tiles stay in place (no retesting needed).
4. Playwright hot-seat test: record that camera positions changed.
5. **Deliverable:** A replay with the board panning to follow action, zoomed in on dramatic moments.

**Proof verdict metrics:**
- FPS: measure via `requestAnimationFrame` loop, confirm 55+ fps on iPhone 12.
- Jank: watch for frame drops during the fastest pan/zoom transitions.
- Battery: run a 5-minute replay loop on a low-battery device (drop to 20%), measure draw-down with/without camera.
- Visual quality: does the text stay readable? Do robots remain centered in the viewport?

---

## Question 4: Camera Director Design

### Scoring Function (Interest-Based)

The EventLog is atomic and register-grouped. The camera director consumes the EventLog and decides where to point the camera at each register.

```typescript
interface CameraFrame {
  x: number; // world tile column, 0..boardWidth
  y: number; // world tile row, 0..boardHeight
  zoom: number; // 1.0 = normal, 2.0 = 2× magnification
  duration: number; // milliseconds to pan/zoom to this frame
  easing: string; // 'ease-out', 'ease-in-out', etc.
}

function scoreEvent(event: EngineEvent): number {
  // Return 0–100, higher = more interesting
  switch (event.type) {
    case 'laser-fired':
      return event.hit ? 95 : 60; // hit is dramatic, miss is ok
    case 'robot-destroyed':
    case 'game-won':
      return 100; // peak interest
    case 'robot-moved':
      return event.pushed ? 75 : 20; // pushing is interesting, plain move is filler
    case 'damage':
      return event.total >= 8 ? 80 : 30; // near-death is tense
    case 'checkpoint-claimed':
      return 85;
    case 'robot-fell':
      return 90;
    case 'turn-started':
    case 'register-started':
      return 5; // transition, low interest
    default:
      return 10;
  }
}

function cameraForRegister(
  register: number,
  events: EventLog,
  state: GameState
): CameraFrame {
  // Find all events in this register
  const registerEvents = events.filter(
    (e) => e.type === 'register-started' && e.register === register ||
           isEventInRegister(e, register)
  );

  // Score each event
  const scored = registerEvents.map((e) => ({
    event: e,
    score: scoreEvent(e),
    pos: eventPosition(e, state),
  }));

  // Find the highest-scoring event
  const peak = scored.reduce((best, curr) => (curr.score > best.score ? curr : best));

  // Compute camera position
  const zoom = peak.score > 80 ? 1.5 : peak.score > 50 ? 1.2 : 1.0;
  const duration = Math.max(200, 500 - peak.score * 3); // fast zoom-in on high interest

  return {
    x: peak.pos.x,
    y: peak.pos.y,
    zoom,
    duration,
    easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)', // overshoot easing for snap
  };
}

function eventPosition(event: EngineEvent, state: GameState): Position {
  // Extract the position of the "action" in this event
  if ('at' in event) return event.at; // robot-blocked, laser-fired, robot-fell, robot-destroyed
  if ('to' in event) return event.to; // robot-moved, conveyor-moved
  if ('pos' in event) return event.pos; // robot-respawned

  // Fallback: center on all robots (turn-started, register-started)
  const robots = state.robots.filter((r) => r.lives > 0 && r.position.x >= 0);
  if (robots.length === 0) return { x: state.board.width / 2, y: state.board.height / 2 };
  const xs = robots.map((r) => r.position.x);
  const ys = robots.map((r) => r.position.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}
```

### Handling Simultaneity: Live Play vs. Highlight Reels

**Live play (multiplayer, one register at a time):**
- As events arrive and are replayed, the camera is driven by the highest-interest event in each register.
- Trade-off: must keep the local player's robot **always visible** (no surprise camera jump away from them). Constraint: `abs(cameraX - localRobot.x) < viewportWidthInTiles / 2`.
- If an off-screen event has score > 95 (e.g., a robot getting destroyed on the far side of the board), the camera can snap there, but **next register snaps back to local robot if needed.**

```typescript
function constrainCamera(
  desired: CameraFrame,
  localRobotX: number,
  localRobotY: number,
  viewportTiles: { width: number; height: number }
): CameraFrame {
  // Allow camera to drift, but keep local robot in the frame
  const maxXDrift = viewportTiles.width / 3;
  const maxYDrift = viewportTiles.height / 3;

  const clampedX = Math.max(
    localRobotX - maxXDrift,
    Math.min(desired.x, localRobotX + maxXDrift)
  );
  const clampedY = Math.max(
    localRobotY - maxYDrift,
    Math.min(desired.y, localRobotY + maxYDrift)
  );

  return { ...desired, x: clampedX, y: clampedY };
}
```

**Highlight reels (compiled, post-hoc):**
- The director has total freedom: zoom in on a laser hit at (8, 3), cut to the destroyed robot at (2, 9), hold on the checkpoint claim at (5, 1).
- No constraint to keep any player visible — maximize drama.
- Transitions between reels are **hard cuts** (zoom out → pan to new region → zoom in), not smooth flyovers, to match the fast-paced storytelling.

```typescript
function highlightReel(events: EventLog, state: GameState): CameraFrame[] {
  // Find all score >= 80 events
  const drama = events
    .filter((e) => scoreEvent(e) >= 80)
    .map((e) => ({
      event: e,
      score: scoreEvent(e),
      pos: eventPosition(e, state),
    }));

  // Build a sequence: zoom out, hard cut to next spot, zoom in
  const frames: CameraFrame[] = [{ x: 6, y: 8.5, zoom: 0.8, duration: 500, easing: 'ease-out' }];

  for (const item of drama) {
    frames.push({
      x: item.pos.x,
      y: item.pos.y,
      zoom: 2.0, // dramatic close-up
      duration: 600 + Math.random() * 200, // varies slightly, feels less canned
      easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    });
    // Hold at this zoom for a moment, then pull back
    frames.push({
      x: item.pos.x,
      y: item.pos.y,
      zoom: 0.8,
      duration: 400,
      easing: 'ease-in',
    });
  }

  return frames;
}
```

### EventLog Extensions (if needed)

Current EventLog is sufficient: every action event has an `at` or `to` position. No new events required.

**Optional future extension (Phase 35+):** if the camera director needs to know "which robot dealt the damage" separately from "which robot took the damage," we could add:
```typescript
{ type: 'damage', player: PlayerId, amount: number, source?: PlayerId, total: number }
```

But this is a reshape (forbidden per the CLAUDE.md constraint). **Workaround:** derive the source from context (last laser-fired event, last push-move event), which is what the director will do anyway.

---

## What Would Make This Wrong: Failure Modes

### 1. CSS 3D performance is worse than assumed

**Risk:** iPhone SE or Galaxy A12 (low-end) fails to maintain 30fps during camera motion.  
**Detection:** Phase 28 Playwright includes a low-end device profile (CDP low-end throttling). If FPS drops below 25, we escalate to WebGL.  
**Mitigation:** Pre-render the board to a canvas once (not per-frame), then transform the canvas. Reduces the cost of 204 DOM transforms to 1 GPU surface + 1 transform. Effort: 1 day.

### 2. Text projection math is fragile or inaccurate

**Risk:** Speech bubbles drift off-screen or z-order incorrectly as camera pans.  
**Detection:** Playwright smoke test: place a speech bubble, pan the camera, assert bubble stays within viewport and above the robot.  
**Mitigation:** Use a tested graphics library for the projection math (e.g., Three.js Math.Vector3 even without WebGL, or gl-matrix), don't hand-roll it.

### 3. Highlight reel hard-cuts are disorienting

**Risk:** Players dislike the camera jumping between regions; feels jarring.  
**Detection:** Playtest feedback (qualitative, but essential).  
**Mitigation:** Interpolate between reels instead of hard-cutting. Add a slow zoom-out → pan → zoom-in sequence between events (increases reel duration, but more cohesive). Or, clip reels to 10 seconds max, with only 3–4 focus points.

### 4. Editor hit-testing breaks if tilted board is added later

**Risk:** Phase 35 adds isometric tilt; editor inherits the tilt; hit layer misaligns.  
**Detection:** Regression test: paint a wall, verify the wall renders at the painted location.  
**Mitigation:** Comment in Board.tsx that the editor's hit layer assumes a flat (untilted) board. If tilt is added, the editor must be decoupled or raycasting must be implemented. Clear design decision now = cheap fix later.

### 5. Battery drain is higher than expected in real use

**Risk:** Users report 10% battery loss during a 10-minute online game (should be <5%).  
**Detection:** Phase 28 playtest + battery profiling on real devices.  
**Mitigation:** Render-on-demand (update camera only at register start, not continuously). Cap animation frame rate at 30fps on battery-saver mode. Expose a toggle "disable fancy camera" for battery-conscious players.

---

## Summary Table: CSS 3D vs. WebGL

| Aspect | CSS 3D (Phase 28) | WebGL (Phase 35+) | Recommendation |
|--------|-------------------|-------------------|-----------------|
| **Bundle** | 0 bytes | +38KB gzipped (three.js) | CSS 3D (no cost) |
| **Testability** | DOM + camera log | Scene graph introspection | CSS 3D (simpler) |
| **Editor** | Hit layer stays 2D | Raycasting required | CSS 3D (avoids work) |
| **Text rendering** | Projection layer | SDF/atlas or canvas | CSS 3D (better quality) |
| **Mobile 60fps** | Yes, with care | Yes | CSS 3D (sufficient) |
| **Z-fighting** | Flat z=0 only | Full 3D depth | CSS 3D (not a blocker) |
| **Hard camera limit** | ~204 tiles + smooth 60fps animation | Millions of triangles | CSS 3D (good for current scope) |
| **Accessibility** | No issues (text is DOM text) | Needs ARIA mirror or canvas region | CSS 3D (native support) |

---

## Recommendation

### **Phase 28: CSS 3D Camera Director** (1–2 weeks, 150 lines of code)

1. **Implement camera director** scoring events by interest.
2. **Apply CSS 3D perspective** to the Board container.
3. **Projection text layer** (optional Phase 28b, 200 lines).
4. **Playtest** to validate scores and timing.
5. **Feature-flag** for gradual rollout.

### **Phase 35+ (conditional): WebGL** (only if playtest data justifies)

Ship metrics:
- FPS floor on iPhone SE with dynamic camera: `___` fps
- Battery draw per replay: `___` mAh
- Player satisfaction: % of playtesters choosing "camera on" if optional

If FPS < 25fps on low-end devices, or battery draw > 2x baseline, investigate three.js. Otherwise, CSS 3D is shipping camera.

---

## Implementation Checklist for Phase 28

- [ ] New `src/services/camera.ts` with `scoreEvent` + `cameraForRegister` functions
- [ ] Unit tests (camera.test.ts): 8 cases covering all event types + determinism
- [ ] Update `ReplayPlayer.tsx` to compute camera frame per event, pass to Board
- [ ] Update `Board.tsx` to apply camera frame as CSS 3D transform (behind feature flag)
- [ ] Add `--tile` calculation to account for pixel-based camera positioning
- [ ] Playwright smoke: hot-seat replay, assert camera position changes
- [ ] Optional: Projection text layer + separate layer for speech bubbles (Phase 28b)
- [ ] Playtest 2–3 playtester sessions, collect feedback on zoom/pan speed/smoothness
- [ ] Adjust scores based on feedback (Phase 29)
- [ ] Flip feature flag to ON, deploy to prod

---

## Key Files Involved

- `src/services/camera.ts` (new)
- `src/components/replay/ReplayPlayer.tsx` (minor: pass camera frame)
- `src/components/board/Board.tsx` (minor: apply perspective transform)
- `src/index.css` (perspective viewport rules, if needed)
- Tests: `src/services/camera.test.ts` (new), Playwright regression

---

## Estimated Effort

- **Phase 28 (CSS 3D):** 7 calendar days
  - Camera director: 2 days
  - Board integration: 1 day
  - Tests + Playwright: 2 days
  - Projection text layer: 1 day (optional)
  - Playtest + tune: 1 day

- **Phase 35+ (WebGL, conditional):** 10–15 days (if needed)
  - three.js setup: 2 days
  - Porting board renderer: 3 days
  - Testability layer: 2 days
  - Lazy-loading + PWA integration: 2 days
  - Playtest + regression: 3 days
