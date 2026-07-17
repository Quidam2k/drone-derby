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

## Test-everything checklist

### Screens

- [ ] Lobby: create game, board picker shows 4 built-in thumbnail cards
- [ ] How to play (`#/rules`): opens from the lobby card, the join
      screen's "First time?" link (back returns to the invite), and
      hot-seat setup; board-element sprites render in the legend
- [ ] Sound toggle (🔊/🔇 in lobby header + replay controls): OFF by
      default; turn it on, reload — it stays on; sounds play in replays
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
