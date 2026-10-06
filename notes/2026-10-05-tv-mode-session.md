# 2026-10-05 — TV mode + turn timer

- T1 (62e1317): games.turnTimerMs/turnDeadline; autoFillProgram (seed game.seed + turn*7919 + seat);
  submitProgram's execute block moved into executeCurrentTurn; internal turnTimeout; setTurnTimer;
  public tvGame/tvTurn keyed by invite code.
- T2 (5737ede): TvScreen + QrCode (qrcode-generator, new dep), ReplayPlayer autoContinue,
  GameOverScreen onNewGame optional, entry points. Codex drafted TvScreen (fixed) + TurnTimer (accepted).
- T3: TurnTimer chip in ProgrammingView/WaitingView, TimerPicker (create form + host lobby),
  viewSettings.controllerMode (persisted) → skip replay + collapsible board. README updated.
- E2E: Playwright MCP's browser_run_code_unsafe can open isolated contexts via
  page.context().browser().newContext() — three separate anonymous users in one browser.
  Globals don't persist between calls; re-find pages via browser().contexts().
- Not deployed. Ask Todd first.
