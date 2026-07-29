# 2026-07-28 — Commit + deploy the 3D-5→34 backlog

Nine phases of uncommitted work (3D-5 camera director, 3D-6 highlight
reels, 3D-7 cutover to 3D-by-default, 29c shared deck, 30 repair, 31
curved conveyors, 32 respawn facing, 33 power-down, 34 pushers) landed
on prod. Todd's calls from the planning session: one comprehensive
commit (shared files interleave phases — execute.ts carries 30–34,
scene.ts carries 3D-5→7+33+34), deploy in the same phase.

## What happened

- **Pre-flight**: `npm run typecheck` ✅, `npx tsc -p convex/tsconfig.json
  --noEmit` ✅, `npm test` 392/392 ✅, `npm run build` ✅.
- **Commit `b9b374c`** — 82 files, +7867/−735. The plan's draft message
  had 29c as "chassis polish"; the session note says 29c was the
  **shared 84-card deck** change, so the commit message was corrected
  to match.
- **Deploy**: `npm run deploy` — Convex prod (fastidious-dinosaur-923)
  functions pushed, schema validated; wrangler Pages deploy succeeded
  (https://e40e36a2.drone-derby.pages.dev; canonical
  https://drone-derby.pages.dev serves the new `index-Ce5CpZmz.js`).

## Prod smoke (Playwright)

- Lobby thumbnails: Gauntlet shows 2/4 + 1/3/5 + 2/4 pusher plates,
  Grand Circuit 1/3/5 + 2/4 — the numbered plates render in BoardThumb.
- `#/rules`: Pusher legend row present; "pushers fire on their printed
  registers" in the register order copy.
- Hot-seat: 3D board mounts (canvas, tile kit, robots), camera modes
  Action/My robot/Free, ⏻ power-down button present; 2D toggle swaps to
  the DOM board and back. Zero console errors.
- `npx convex run telemetry:recent --prod` → only the old phase-15
  smoke note; no fresh crashes.

## Gotcha worth remembering (test-browser, not prod)

Playwright's `browser_navigate` to the *same* hash URL is a
same-document navigation — it never reloads, so the page kept showing
the pre-deploy bundle from the old service worker and it looked like
the deploy hadn't taken. Edge was verified correct via `curl` (new
bundle hash, `sw.js` `max-age=0, must-revalidate`). Fix: navigate to
`about:blank` and back (and clear the SW while diagnosing). Real
clients update normally via vite-plugin-pwa autoUpdate.

## Follow-up spotted

`RulesScreen.tsx` "Lives & respawn" (line ~232) still says destroyed
robots respawn "facing north" — stale copy from before Phase 32's
player-chosen respawn facing. Not touched (out of scope for the
commit/deploy phase); fold into the next rules-copy pass.

## ⚠️ NEXT

**The fun-playtest gate is open**: Todd plays on prod
(https://drone-derby.pages.dev), 🐞 notes + crashes self-report; a
later phase mines `npx convex run telemetry:recent --prod` + Todd's
verdict into rules/pacing tweaks (informing a Gauntlet re-tune).
Backlog unchanged: Resend/Google auth creds, gallery
search/pagination, sound ear-check.
