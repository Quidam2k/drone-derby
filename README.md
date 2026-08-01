# Drone Derby

An asynchronous multiplayer programming game in the spirit of RoboRally:
program five moves for your drone, submit, and watch everyone's turn play
out at once — with conveyor belts, gears, lasers, and pits doing their best
to ruin the plan.

**▶ Play now: https://drone-derby.pages.dev**

Stack: Vite + React + TypeScript PWA over a pure, deterministic game engine
(`src/engine/`); Convex backend (`convex/`) for online play, hosted on
Cloudflare Pages + Convex prod.

## Quick start (local)

Two terminals:

```sh
npm install
npm run dev                                # Vite dev server → http://localhost:5173
```

```sh
CONVEX_AGENT_MODE=anonymous npx convex dev # local Convex backend (no account needed)
```

The Convex CLI writes `.env.local` with `VITE_CONVEX_URL` on first run.
Without it, the app still works but falls back to **hot-seat only** (no
online games, editor stays local-first).

Other commands: `npm test` (Vitest), `npm run typecheck`,
`npm run build`, `npm run deploy` (Convex prod + Cloudflare Pages).

## Firing up the playtest

**Recommended: play on prod** — https://drone-derby.pages.dev

- **Multiplayer**: Create game → pick a board → share the invite code (or
  the `#/join/CODE` link). The second player can be another browser
  profile, an incognito window, or a phone — players are anonymous, no
  sign-up. Program your registers, submit, and the turn executes when
  everyone's in; push notifications (installed PWA) nudge you when it's
  your move.
- **Solo rules-testing**: Hot-seat mode from the lobby — two players, one
  screen, no backend round-trips.
- **New players**: the in-app rules live at `#/rules` (linked from the
  lobby, the join screen, and hot-seat setup) — point first-timers there.

## The 3D board (the default since Phase 3D-7)

The player-facing board renders in WebGL: the programming screen, the
replay, the highlight reel, online and hot-seat alike. **3D / 2D** in the
board's top-left corner switches renderer at any time — mid-turn, mid-replay,
without losing where you are — and the choice is remembered across turns and
reloads. The DOM board is the fallback, not a museum piece: it is what a
machine without WebGL2 gets, what a failed scene falls back to, and what
anyone on an old phone can choose.

- `?render=dom` forces the flat board for one session (e.g.
  `.../?render=dom#/hotseat`) and always wins, whatever is stored.
  `?render=3d` forces the other way, but **cannot** overrule a machine that
  has no WebGL2.
- **No WebGL2** → the flat board, with the 3D button disabled and a reason
  on hover. Nothing is silently blank.
- **If the 3D scene fails to start** (a bad chunk, a dead driver) the board
  swaps itself to the flat one on the spot and files a telemetry entry. That
  downgrade lasts the page load only — a reload puts you back in 3D, because
  your stored choice was never overwritten.
- The **editor and the board thumbnails are always DOM**, whatever the
  toggle says. They are not affected by any of this.

The 3D board's tiles are modelled — an industrial factory floor, from
`public/models/tiles.glb` (rebuild with `npm run art:tiles`, which needs
Blender). It deliberately does **not** match the flat board's palette, so
the setup-screen thumbnails and the editor look like a different game to the
one you play. That is expected. If the `.glb` is missing the board falls back
to the old procedural primitives and logs one warning.

Camera, on both the programming screen and the replay:

| Gesture | Does |
|---|---|
| drag / one finger | orbit and tilt |
| wheel / pinch | zoom |
| right-drag / two fingers | pan — this parks the camera (*Free*) |
| double-click / double-tap | back to the default view and auto-follow |

The overlay in the board's **top-right** corner picks who the camera
follows: **Action** (whatever is happening — the default), **My robot**
(locks onto your robot's area; disabled in a pass-and-play replay, which has
no single local player), **Free**. **↺** resets the view — the camera only;
it never changes your renderer choice. The renderer toggle keeps the
opposite corner, so the two never collide.

Your angle, tilt and zoom are remembered across turns and reloads, so ↺
**Watch again** in the replay controls re-runs the turn from wherever you
have parked the camera.

## Inviting friends

The friend-facing walkthrough lives **in the app** (join screen → "First
time?" → the *Your first game* section at the top of `#/rules`), so an
invite link is all a first-timer needs. The host-side flow:

1. **Create game** on https://drone-derby.pages.dev, pick a board
   (Proving Grounds is the gentlest first track).
2. In the game lobby, **copy the invite link** and send it however you
   like. Each friend opens it, types a name, joins — no account.
3. Program and submit your own turn. The turn executes when everyone has
   submitted; if someone stalls, an installed PWA with 🔔 notifications
   nudges them, or just ping them yourself.
4. **Feedback lands in telemetry**: crashes upload automatically, and the
   🐞 button (bottom-left, every screen) files their notes. Mine it with
   `npx convex run telemetry:recent --prod`.

Paste-ready invite message:

> Wanna playtest my robot-programming game? It's like RoboRally in the
> browser — plan 5 moves, submit, watch everyone's plans collide.
> Turns are async, so play whenever. No account needed, ~2 min to learn
> (there's a "First time?" link when you join). If anything feels broken
> or confusing, smash the 🐞 button and tell me. → LINK

## Test-everything checklist

### Screens

- [ ] Lobby: create game, board picker shows 10 built-in thumbnail cards
      (the tall composed thumbs — Grand Circuit and the four authentic
      boards — stay inside their cards)
- [ ] Flag placement: "Customize flags" under the board picker (online
      create AND hot-seat setup) expands to a clickable board — click
      floor to add a flag, click a flag to remove it, reset restores the
      printed layout; the created game plays with the custom flags, and
      an untouched expander leaves the board exactly as printed
- [ ] How to play (`#/rules`): opens from the lobby card, the join
      screen's "First time?" link (back returns to the invite), and
      hot-seat setup; "Your first game" walkthrough sits on top;
      board-element sprites render in the legend
- [ ] Invite self-serve: a first-time friend can get from the invite
      link to a submitted turn using only the join screen + rules
      walkthrough (no host hand-holding)
- [ ] Sound toggle (🔊/🔇 in lobby header + replay controls): OFF by
      default; turn it on, reload — it stays on; sounds play in replays
      (phase 25: gentler clip set, loudness-normalized — worth an unmute)
- [ ] Hot-seat: full game start → programming → replay loop
- [ ] Online: create → join via invite code from a second browser/phone
- [ ] Rejoin: close the tab mid-game, reopen the game link, state intact
- [ ] Programming dock: deal, drag/tap cards into registers, submit, taunt
- [ ] Ghost preview: placing a card plays a translucent ghost through
      the turn-so-far — belts/gears/lasers/pits previewed, other robots
      ignored (ghost passes through them); updates on every placement
      change and rests at the final pose
- [ ] Turn replay: animations match outcomes; auto-plays for the player
      who was waiting
- [ ] **Renderer, both ways**: a fresh browser lands on the 3D board with
      no URL flag; **2D** in the board's top-left corner swaps to the flat
      board mid-turn without losing the turn; the choice survives a reload;
      `?render=dom` forces flat against a stored 3D choice
- [ ] **Both renderers reach everything**: programming, ghost preview,
      replay, ★ Highlights, online catch-up and Turn history all work with
      the toggle set either way
- [ ] ★ Highlights: the replay controls offer it on an eventful turn (and
      hide it on a dull one); beats play back to back with a counter, ✕
      returns to the replay where you left it
- [ ] Visual polish: belts scroll in their travel direction (express
      visibly faster), each seat's robot has a distinct silhouette +
      bright nose light, lasers glow/pulse, damaged robots flash
      (all animation respects OS reduced-motion settings)
- [ ] Editor (`#/editor`): paint tiles/walls, validation, save online,
      import/export JSON — always the flat board, never a canvas, whatever
      the renderer toggle is set to
- [ ] Editor tools: palette grouped into sections (Terrain / Hazards /
      Movers / Course / Edges / Eraser) with single-key hotkeys shown on
      each button (e.g. W wall, C conveyor, K checkpoint, E eraser);
      hotkeys don't fire while typing in the board-name field
- [ ] Editor templates: "New from template…" replaces the draft with a
      copy of any built-in board ("Copy of <name>", one undo step)
- [ ] Editor renumber: delete a checkpoint → numbering error appears →
      "Renumber flags" button in the validation panel fixes 1..n in
      reading order (undoable)
- [ ] Editor append: ⬆ Append stacks a picked board ABOVE the draft
      (draft keeps its spawn docks, checkpoints renumber from the
      bottom up, one undo step; >24 tall is refused with an alert)
- [ ] Tall boards on a phone: Grand Circuit's tiles never shrink below
      legible — the board pans inside its frame instead (page itself
      never scrolls sideways)
- [ ] Gallery: publish a board, see it listed, play it, fork it
      ("forked from X by Y" appears on the fork's card once published)
- [ ] Push notifications: installed PWA, allow → nudge arrives when the
      other player submits

### Mechanics, by board

- [ ] **Proving Grounds** — moves, rotation, chain pushing, edge walls
      blocking movement, checkpoints in order, win on last checkpoint
- [ ] **Spin Cycle** — belts and express belts (express pulses twice),
      gears rotating, pits killing, respawn at last checkpoint; the ring's
      corners are curved belts — a rider carried around one turns with the
      loop ("The bend swings X around"), so a lap keeps you aimed along it
- [ ] **The Gauntlet** — corridor lasers dealing damage per register-end,
      damage locking registers at 5+, route trade-offs (safe lane vs
      gauntlet vs belts) actually feel like choices
- [ ] **Pushers (The Gauntlet / Grand Circuit)** — the numbered wall
      plates: park a robot in front of one and it's shoved a space on
      exactly the registers printed on it (1/3/5 amber, 2/4 steel) —
      "Pusher shoves X" caption, thud, bump ring; shoves chain-push,
      are wall-blocked, and can dump you in a pit; the Gauntlet's
      corridor pair forces the lane switch on a clock, and the Grand
      Circuit baffles bounce dock campers south
- [ ] **Vortex Arena** — express whirlpool carries 2 cells/register;
      Move 2 shoots through a core gear gate, but STOPPING on one spins
      you every register (u-turn is the escape); core pits punish
      sloppy hops; does riding vs walking feel like a real choice? The
      whirlpool's corners are curves too — riders swing around with it
- [ ] **Pit Archipelago** — islands split by 1-wide pit channels; the
      floor causeways are free but demand exact programs (one wrong
      column is a life, and loitering on a shore invites a shove into
      the channel); belt bridges carry you over hands-free but the
      south one is swept by a laser (≈2 damage per crossing); gears on
      the causeway landings spin you on arrival — do both crossings
      see real use?
- [ ] **Grand Circuit** — Spin Cycle stacked on a dockyard staging
      board (12×17, the composed one): launch from the south docks
      through the baffle walls, then the whole Spin Cycle race above;
      Spin Cycle's old spawn row is plain floor
- [ ] **Reactor Core** (authentic, transcribed from the Radioactive
      expansion board; 12×19 over the dockyard) — nearly every tile is
      radiation: END THE TURN on green and take 1 damage; the bright
      mottled waste burns 1 per REGISTER ended on it. Four teleporters
      hurl you (card + 2) squares past walls and drains; belt lines feed
      them — and continue out the rims as death runs. The bare-metal
      rest pockets are one-way-walled: you can always leave, but belts
      can't shove you in — flag 2 sits in one (enter from N/W only).
      Drains are pits with grates. Check the one-way walls read
      red/green in both renderers
- [ ] **Gear Box** (authentic; 12×19 over the dockyard) — 20 meshed
      gears spin the middle; repulsor fields fling you back your card's
      value (chain-pushing whoever's behind); two DOUBLE lasers (2
      damage) including the walled cage at the board's east; a 2-cell
      pit chasm; three corner teleporters fed by belt spirals. Verify a
      repulsor fling mid-Move-3 eats the rest of the card
- [ ] **Pinwheel** (authentic; 12×19 over the dockyard) — four belt
      spokes all turning left spin the floor counterclockwise; two
      FLAMERS burn both squares of their printed flame on registers
      1/2/4 (N) and 2/4/5 (S) — moving through, rotating on, or ending
      a phase on an active one costs 1 each; two DOUBLE lasers cross
      the middle; eight trap-door pits open on their printed registers
      (stand on one when it opens and you fall); radiation corners with
      waste pools; the purple portal pair links the corners — step in
      while the twin is empty and you pop out across the board
- [ ] **Shake 'n' Bake** (authentic; 12×19 over the dockyard) — every
      belt is express and every line feeds the four-flamer oven in the
      middle; the oven's one-way doors (green side out) let belts and
      pushes shove you IN but nothing walks back out — check red/green
      band art on all 12 one-ways; something in the oven burns on every
      register, so escape via the blue/orange portal pairs or eat 1 a
      phase; eight trap-doors in stacked pairs guard the portals
- [ ] Repair (any board): end a damaged robot's turn on a wrench tile or
      a checkpoint flag → 1 damage comes off (replay caption + a pip
      drops); at 5+ damage, repairing back below the threshold unlocks
      the register and next turn's hand is one card bigger
- [ ] Lives: 3 lives, death → respawn, last life → eliminated
- [ ] Respawn facing: die (pit/edge/10 damage), and while programming the
      next turn a "Back in play — face:" arrow row appears — toggling it
      turns your robot live on the board; submit and the replay opens
      with the robot swinging to your pick before register 1
- [ ] Power-down: hit "⏻ Power down next turn" in the programming footer →
      the replay ends with "powers down — all systems off"; next turn your
      seat gets a one-tap Stay/Wake screen, all damage clears at the turn
      start (repair caption + pips to 0), and the robot sits dimmed while
      belts still carry it and lasers still hit it (that damage sticks);
      wake and the following hand is 9 − damage cards
- [ ] Win: first to tag all checkpoints in order ends the game

### When something breaks

- **Crashes log themselves** — window errors, unhandled rejections, and
  React render errors upload automatically (and always land in a local
  buffer, even offline).
- **Anything that just feels wrong** — tap the **🐞 button** (bottom-left
  on every screen) and type a quick note. It records your note plus the
  current route/game so it can be found later.
- **Every report carries the build version** — the small stamp at the
  bottom of the lobby (e.g. `2.0.0+c3e8b77+20260731`). Ask playtesters to
  read it back when reporting by hand.

### Reading playtest logs

- **The digest** is the first stop:
  `node scripts/telemetry-digest.mjs --prod` (add `--hours 24` to narrow;
  drop `--prod` for local dev). One screen: the game funnel
  (created → joined → started → turns → finished), turn errors, renderer
  fallbacks, crash/note rows verbatim, sessions and versions seen. Game
  mutations log server-side `flow` rows automatically (create/join/start/
  submit/execute/finish/nudge), so the funnel needs no client cooperation.
- Raw rows: `npx convex run telemetry:recent --prod` (or without
  `--prod` for local dev), or the `telemetry` table in the Convex
  dashboard. In the browser console, `ddTelemetry.dump()` shows the local
  buffer and `ddTelemetry.note('...')` files a note.
- Pruning between rounds:
  `npx convex run telemetry:clear '{"olderThanDays": 7}' --prod`.

## Repo map

- `src/engine/` — pure deterministic engine (no DOM/IO/randomness; seeded
  RNG only). Shared verbatim by client and Convex.
- `src/components/` — React UI. The player-facing board is WebGL by default
  (`board3d/`, chosen in `board/BoardView.tsx`); the DOM/CSS-grid board
  (`board/Board.tsx`) is its fallback and the editor's only renderer.
- `src/services/` — client plumbing (Convex client, routing, push, telemetry)
- `convex/` — backend functions + schema
- `docs/game_mechanics_md.md` — rules source of truth
- `cascades/2026-07-05-v2-rewrite.md` — build plan and phase log
