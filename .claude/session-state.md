# Session State
Updated: 2026-07-06 (Phase 4 DONE — game is LIVE)

## Current Task
Drone Derby v2 — cascade: cascades/2026-07-05-v2-rewrite.md.
Phases 1–4 DONE. LIVE at https://drone-derby.pages.dev
(GitHub: https://github.com/Quidam2k/drone-derby). Phase 5 is next.

## Just Completed
- Deployed: Convex prod fastidious-dinosaur-923 + dev vivid-cat-177 (both
  with JWT/JWKS/SITE_URL/VAPID env vars), Cloudflare Pages `drone-derby`.
  Redeploy = `npm run deploy` (both CLIs logged in on this PC).
- Prod smoke PASSED incl. real push round-trip (subscribe → push:send --prod
  → notification shown). screengrab/phase4-prod-lobby.png.
- CLI notes (PEM `--` separator, --yes, login --login-flow poll) in cascade.

## Next Steps
1. Todd: fun-playtest on the live site; install PWA on phone + verify push.
2. Phase 5 per cascade ⚠️ NEXT: deadlines + nudges, AFK policy (ask Todd),
   history browser, stats, polish; optional Resend/Google auth.

## Open Questions / Blockers
- Fun-playtest verdict (gates Phase 5 priorities). AFK policy undecided.

## Key Files
- cascades/2026-07-05-v2-rewrite.md — Phase 4 deploy notes + Phase 5 scope
- convex/push.ts, convex/notifications.ts, src/sw.ts — push pipeline
