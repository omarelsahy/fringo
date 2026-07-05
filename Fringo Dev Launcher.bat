@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

title Fringo Dev Launcher

echo.
echo  Fringo Dev Launcher
echo  ===================
echo.

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install Node 20+ from https://nodejs.org
  goto :fail
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found. Reinstall Node.js from https://nodejs.org
  goto :fail
)

if not exist ".env" (
  if exist ".env.example" (
    copy /Y ".env.example" ".env" >nul
    echo [INFO] Created .env from .env.example
    echo        After Supabase is running, set keys from: npx supabase status -o env
    echo.
  ) else (
    echo [ERROR] Missing .env. Copy .env.example to .env and set Supabase keys.
    goto :fail
  )
)

if not exist "node_modules\" (
  echo [INFO] Installing app dependencies...
  call npm install
  if errorlevel 1 goto :fail
)

if not exist "dev-launcher\node_modules\" (
  echo [INFO] Installing dev-launcher dependencies...
  call npm run dev:launcher:install
  if errorlevel 1 goto :fail
)

set "STARTED_VITE=0"
set "STARTED_SUPABASE=0"

docker info >nul 2>&1
if errorlevel 1 (
  echo [WARN] Docker is not running. Start Docker Desktop, then run:
  echo        npm run supabase:start
  echo.
) else (
  call npx supabase status >nul 2>&1
  if errorlevel 1 (
    echo [INFO] Starting local Supabase ^(first run can take a few minutes^)...
    call npm run supabase:start
    if errorlevel 1 (
      echo [WARN] Could not start Supabase. Continue only if it is already running elsewhere.
      echo.
    ) else (
      set "STARTED_SUPABASE=1"
    )
  )
)

netstat -ano | findstr ":5173" | findstr "LISTENING" >nul 2>&1
if errorlevel 1 (
  echo [INFO] Starting Vite dev server...
  start "Fringo Dev Server" /D "%~dp0" cmd /k npm run dev
  set "STARTED_VITE=1"

  echo [INFO] Waiting for http://localhost:5173 ...
  powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$deadline=(Get-Date).AddSeconds(90); while((Get-Date) -lt $deadline){ try { Invoke-WebRequest -Uri 'http://localhost:5173/' -UseBasicParsing -TimeoutSec 2 | Out-Null; exit 0 } catch { Start-Sleep -Seconds 2 } }; exit 1"
  if errorlevel 1 (
    echo [ERROR] Dev server did not become ready. Check the "Fringo Dev Server" window.
    goto :fail
  )
  echo [OK] Dev server is ready.
) else (
  echo [OK] Dev server already running on port 5173.
)

echo.
echo [INFO] Opening Electron dev launcher...
echo        Close this window after the launcher exits.
echo.

call npm run dev:launcher
set "EXIT_CODE=%ERRORLEVEL%"

echo.
if not "%STARTED_VITE%"=="0" (
  set /p STOP_VITE="Stop the Vite dev server too? [Y/N]: "
  if /I "!STOP_VITE!"=="Y" (
    taskkill /FI "WINDOWTITLE eq Fringo Dev Server*" /T /F >nul 2>&1
    echo [INFO] Stopped Vite dev server.
  ) else (
    echo [INFO] Vite is still running in the "Fringo Dev Server" window.
  )
)

if not "%EXIT_CODE%"=="0" (
  echo [ERROR] Dev launcher exited with code %EXIT_CODE%.
  goto :fail
)

echo [OK] Done.
pause
exit /b 0

:fail
echo.
pause
exit /b 1
