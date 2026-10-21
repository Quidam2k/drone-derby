@echo off
rem Double-click to play-test locally: starts the local Convex backend
rem (minimized) and the game dev server, then opens the game in your browser.
rem Close this window to stop. Friends on other devices play on the deployed
rem site instead: https://drone-derby.pages.dev (see README "TV mode").
cd /d "%~dp0"
if not exist node_modules (
  echo Installing dependencies, first run only...
  call npm install || goto :fail
)
start "Drone Derby backend" /min cmd /c "set CONVEX_AGENT_MODE=anonymous&& npx convex dev"
rem Give Vite a few seconds to come up before the browser asks for the page.
start "" /b cmd /c "timeout /t 6 /nobreak >nul && start "" http://localhost:5173/"
call npm run dev -- --port 5173 --strictPort
goto :eof

:fail
echo Setup failed - see the messages above.
pause
