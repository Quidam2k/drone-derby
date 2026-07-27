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

## The 3D board (experimental)

Add `?render=3d` to the URL — e.g. `.../?render=3d#/hotseat` — and the
player-facing board renders in WebGL instead of DOM. Off by default; the
DOM board is still the real one, and the editor and thumbnails stay DOM
whatever the flag says.

The 3D board's tiles are modelled — an industrial factory floor, from
`public/models/tiles.glb` (rebuild with `npm run art:tiles`, which needs
Blender). It deliberately does **not** match the DOM board's flat palette,
so the setup-screen thumbnails and the editor will look like a different
game to the one you play. That is expected. If the `.glb` is missing the
board falls back to the old procedural primitives and logs one warning.

Camera, on both the programming screen and the replay:

| Gesture | Does |
|---|---|
| drag / one finger | orbit and tilt |
| wheel / pinch | zoom |
| right-drag / two fingers | pan — this parks the camera (*Free*) |
| double-click / double-tap | back to the default view and auto-follow |

The overlay in the board's corner picks who the camera follows: **Action**
(whatever is happening — the default), **My robot** (locks onto your
robot's area; disabled in a pass-and-play replay, which has no single
local player), **Free**. **↺** resets the view.

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

- [ ] Lobby: create game, board picker shows 6 built-in thumbnail cards
      (Grand Circuit's tall 12×17 thumb stays inside its card)
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
- [ ] Visual polish: belts scroll in their travel direction (express
      visibly faster), each seat's robot has a distinct silhouette +
      bright nose light, lasers glow/pulse, damaged robots flash
      (all animation respects OS reduced-motion settings)
- [ ] Editor (`#/editor`): paint tiles/walls, validation, save online,
      import/export JSON
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
      gears rotating, pits killing, respawn at last checkpoint
- [ ] **The Gauntlet** — corridor lasers dealing damage per register-end,
      damage locking registers at 5+, route trade-offs (safe lane vs
      gauntlet vs belts) actually feel like choices
- [ ] **Vortex Arena** — express whirlpool carries 2 cells/register;
      Move 2 shoots through a core gear gate, but STOPPING on one spins
      you every register (u-turn is the escape); core pits punish
      sloppy hops; does riding vs walking feel like a real choice?
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
- [ ] Lives: 3 lives, death → respawn, last life → eliminated
- [ ] Win: first to tag all checkpoints in order ends the game

### When something breaks

- **Crashes log themselves** — window errors, unhandled rejections, and
  React render errors upload automatically (and always land in a local
  buffer, even offline).
- **Anything that just feels wrong** — tap the **🐞 button** (bottom-left
  on every screen) and type a quick note. It records your note plus the
  current route/game so it can be found later.
- Reading the logs: `npx convex run telemetry:recent --prod` (or without
  `--prod` for local dev), or the `telemetry` table in the Convex
  dashboard. In the browser console, `ddTelemetry.dump()` shows the local
  buffer and `ddTelemetry.note('...')` files a note.

## Repo map

- `src/engine/` — pure deterministic engine (no DOM/IO/randomness; seeded
  RNG only). Shared verbatim by client and Convex.
- `src/components/` — React UI (board rendering is DOM/CSS grid, no canvas)
- `src/services/` — client plumbing (Convex client, routing, push, telemetry)
- `convex/` — backend functions + schema
- `docs/game_mechanics_md.md` — rules source of truth
- `cascades/2026-07-05-v2-rewrite.md` — build plan and phase log
