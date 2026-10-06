# Session State
Updated: 2026-10-05 19:45

## Current Task
TV mode + turn timer cascade (`cascades/2026-10-05-tv-mode.md`) — T1–T3 DONE, committed, NOT deployed.

## Just Completed
- T1 backend timer + tvGame/tvTurn, T2 TvScreen (#/tv/<code>), T3 phone countdown,
  timer picker, controller mode, README "TV mode" section.
- E2E verified on the dev deployment (see the cascade's verification log).

## Next Steps
1. Ask Todd before prod deploy (`npm run deploy`).
2. Couch playtest with a real TV + phones; read back with `npx convex run telemetry:digest --prod`.

## Open Questions / Blockers
- Countdown is red for the whole of a 1-min turn (spec says red under 1 min) — Todd's call.
- Diagnosability cascade P5 hard stop still stands, untouched.

## Key Files
convex/games.ts, src/components/tv/TvScreen.tsx, src/components/online/TurnTimer.tsx,
src/components/online/OnlineGameScreen.tsx, cascades/2026-10-05-tv-mode.md
