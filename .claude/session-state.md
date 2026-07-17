# Session State
Updated: 2026-07-17 ~14:00

## Current Task
NONE IN FLIGHT — Phase 22 (Pit Archipelago) committed (3d4a239) AND
DEPLOYED to prod, smoke-tested (bundle index-85Y88kCF served after SW
update, 5 boards in picker + rules list, zero console errors).

## Just Completed
- §22: pitArchipelago() 12×11 (pit channels, causeways vs laser-taxed
  belt bridges), RulesScreen + README entries, 109 tests, Playwright
  1280+375. Cascade §22 logged (incl. corrected pit-jump premise).

## Next Steps
1. GHOST PREVIEW phase (Todd's 2026-07-17 request, jumps queue): while
   programming, ghost robot replays placed registers via solo
   executeTurn (deterministic board effects, no other robots). Enter
   plan mode with this loaded. Scouted: ProgrammingView owns slots;
   ReplayPlayer/visualAt fold EventLog; Board can grow a ghost layer.
2. Then: composition (+MAX_BOARD_SIZE 24, mobile tile floor/pan),
   editor append, softer SFX (default-muted), docs invite walkthrough.
3. STANDING GATE still open: Todd's friends playtest → mine telemetry.

## Open Questions / Blockers
- Port 5173 = Leyline Tycoon; drone_derby dev currently on 5175.

## Key Files
- src/components/programming/ProgrammingView.tsx (slots state)
- src/components/replay/visualState.ts, ReplayPlayer.tsx
- src/engine/execute.ts (executeTurn, prepareTurn hand validation)
