# Session State
Updated: 2026-07-26 (four Blender chassis shipped; camera work is next)

## Current Task
Robot art is **DONE**. Four Blender/Cycles-rendered chassis, distinct by
silhouette not just colour, wired in and verified. Next direction is
Todd's **dynamic camera** (flies/zooms to frame the action) plus
**highlight reels**.

## Just Completed
- `scripts/blender/robots.py` + `scripts/render-robots.mjs` (`npm run art`).
  Seats 0-3 = tracked scout / hexapod walker / hovercraft / quad buggy.
  4 renders only (chassis pairs 1:1 with seat, palette is fixed).
  **CPU only — ask before using the GPU.**
- Wiring simplified: `usesBakedChassis`, the `.baked` modifier and the
  `--seat` property all deleted; `RobotSprite` is one `<img>`. JS shrank
  115.50 → 113.88 KB gz. Contact shadow is CSS on the non-rotating
  `.robot` so it can't swing as the robot turns. 192px renders = 207 KB.
- Deleted the dead SVG baker (`scripts/bake-robots.mjs`,
  `robotArt.generated.tsx`) — superseded, not salvageable.
- typecheck + 120 tests green; Playwright 1280 + 375, all facings, ghost,
  `#/rules`, zero console errors. `screengrab/robots-compare.png`.

## Next Steps
1. Decide the camera architecture. Opus subagent analysis is in
   `notes/2026-07-26-webgl-analysis.md` — recommends **CSS 3D transforms
   over WebGL** (keeps DOM hit-testing/text/testability, zero bundle).
   **Its numbers are unverified** — the three.js size figure (38 KB gz)
   looks several times too low, and its FPS/battery figures were never
   measured. Verify before acting; the architectural argument stands
   independently.
2. Then build the camera director as an EventLog consumer (interest
   scoring; live play frames a bounding box to keep the local robot on
   screen, highlight reels hard-cut to the single best beat).
3. Rules work, independent: phase 30 repair economy (repair MUST run
   before `cleanUpCards`), 31 curved conveyors, 32 respawn facing,
   33 power-down.

## Open Questions / Blockers
- Real-time 3D would need `CLAUDE.md`'s "no canvas anywhere" rule changed.
  CSS 3D would not — that's a large part of its appeal.
- Nothing committed yet this session.
- Standing gates (external): invite links → unblocks phase 27 telemetry
  mining; phase-25 SFX ear-check; auth creds.

## Key Files
scripts/blender/robots.py, scripts/render-robots.mjs, public/robots/*.png,
src/components/board/sprites.tsx, src/components/board/Board.tsx,
src/index.css (.robot / .robot-body), notes/2026-07-26-webgl-analysis.md,
cascades/2026-07-05-v2-rewrite.md (§29b + camera backlog)
