# Session State
Updated: 2026-07-06 (Phase 5 DONE — deployed to prod)

## Current Task
Drone Derby v2 — cascade: cascades/2026-07-05-v2-rewrite.md.
Phases 1–5 DONE. LIVE at https://drone-derby.pages.dev. Phase 6 (level
editor) is next; enter plan mode with its scope loaded.

## Just Completed
- Phase 5: nudge button (12h rate limit, games.nudge), speech bubbles
  (taunt with program → bubble in replay, online + hot-seat), history
  browser (HistoryBrowser.tsx, never touches markTurnSeen), game-over
  stats + lobby turn/✓⏳ badges. Deadlines/AFK dropped by Todd's call —
  deferred indefinitely as a possible per-game option.
- Verified: 61 tests + typecheck, dev E2E (two contexts), prod deploy +
  spot-check (nudge/bubble/history all green). screengrab/phase5-*.png.

## Next Steps
1. Todd: fun-playtest verdict (still open) — tweaks take priority.
2. Phase 6 per cascade: canvas level editor, boards in Convex, sharing.

## Open Questions / Blockers
- Fun-playtest verdict; optional Resend/Google creds for real auth.

## Key Files
- cascades/2026-07-05-v2-rewrite.md — Phase 5 delivered notes + Phase 6
- convex/games.ts (nudge/taunts), src/components/online/HistoryBrowser.tsx,
  src/components/replay/taunts.ts
