# Session State
Updated: 2026-07-06 (Phase 4 code complete)

## Current Task
Drone Derby v2 — cascade: cascades/2026-07-05-v2-rewrite.md.
Phase 4 code DONE + verified locally; only the deploy step remains,
blocked on Todd's gates.

## Just Completed
- PWA shell: vite-plugin-pwa injectManifest, custom src/sw.ts (push +
  notificationclick), icons via `npm run icons`, iOS meta, tsconfig.sw.json.
- Web push end-to-end: pushSubscriptions table, convex/notifications.ts,
  convex/push.ts ("use node" web-push action), notifyOthers() from
  startGame/submitProgram, src/services/push.ts + NotificationsButton.
- Verified: typecheck + 58 tests + build green; SW activates on preview;
  REAL push round-trip locally (subscribe → convex run push:send → FCM →
  notification shown). screengrab/phase4-lobby-notifications-on.png.

## Next Steps
1. Todd: `! npx convex login`, confirm host (Cloudflare Pages recommended,
   `npm run deploy` prewired, needs `npx wrangler login`), fun-playtest.
2. Deploy per cascade ⚠️ NEXT: prod env vars (fresh VAPID + JWT single-line
   + SITE_URL), `npm run deploy`, prod smoke + phone push, Phase 4 → DONE.

## Open Questions / Blockers
- Gates 1–3 (playtest verdict, convex login, host choice). Optional: Resend/
  Google creds (gate 4, can slip to Phase 5).

## Key Files
- cascades/2026-07-05-v2-rewrite.md — Phase 4 notes + deploy sequence
- convex/push.ts, convex/notifications.ts, src/sw.ts, src/services/push.ts
