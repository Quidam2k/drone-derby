# Session State
Updated: 2026-07-06 (Phase 3 complete)

## Current Task
Drone Derby v2 rewrite — cascade: cascades/2026-07-05-v2-rewrite.md.
Phases 1–3 DONE; Phase 4 (PWA + push + deploy) is next.

## Just Completed
- Phase 3: Convex async multiplayer. Backend in convex/ (schema, Anonymous
  auth, games.ts), server runs the pure engine; hands secret at wire level.
  Client: hash routes (#/ lobby, #/hotseat, #/game/<id>, #/join/<code>),
  online screens, auto-replay of unseen turns via existing ReplayPlayer.
- Verified: typecheck + 58 tests green; two-browser-context Playwright E2E
  (create/join/program/replay, positions match) — screengrab/phase3-*.png.

## Next Steps
1. Todd: fun-playtest (hot-seat + async vs himself); `CONVEX_AGENT_MODE=anonymous
   npx convex dev` + `npm run dev` to run locally (no Convex account needed).
2. Phase 4 gates: `npx convex login` (interactive), pick static host,
   optional Resend/Google creds. Then PWA + web push + deploy per cascade.

## Open Questions / Blockers
- Fun-playtest verdict still pending (now covers online pacing too).

## Key Files
- cascades/2026-07-05-v2-rewrite.md — plan of record + Phase 3 notes
- convex/games.ts — all multiplayer mutations/queries + sanitizeState
- src/components/online/OnlineGameScreen.tsx — async turn loop
- src/services/route.ts — hash router
