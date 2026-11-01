@echo off
rem SFX Lab: desktop launcher. First run installs Electron (needs Node.js and internet), later runs start at once.
cd /d "%~dp0desktop"
if not exist "node_modules\electron\dist\electron.exe" (
  echo Installing Electron, one-time...
  call npm install --no-audit --no-fund
)
start "" /b "node_modules\electron\dist\electron.exe" .
