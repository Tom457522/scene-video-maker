@echo off
rem Launcher for Windows (double-click to start). Messages are printed by scripts\start.mjs.
rem "start.bat --check" checks everything up to the launch and exits (used by CI).
rem This file must stay ASCII-only: cmd.exe misreads multi-byte text in batch files.
cd /d "%~dp0"

where node > nul 2> nul
if errorlevel 1 (
  echo Node.js was not found. Install the LTS version from https://nodejs.org/ and run start.bat again.
  pause
  exit /b 1
)

node scripts\start.mjs %*
if errorlevel 1 (
  pause
  exit /b 1
)
