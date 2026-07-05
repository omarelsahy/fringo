# Fringo Dev Launcher (PowerShell)
# Same behavior as "Fringo Dev Launcher.bat" — useful if .bat execution is blocked.

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot\..\..

Write-Host ''
Write-Host ' Fringo Dev Launcher'
Write-Host ' ==================='
Write-Host ''

function Fail($Message) {
  Write-Host "[ERROR] $Message" -ForegroundColor Red
  Read-Host 'Press Enter to exit'
  exit 1
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Fail 'Node.js was not found. Install Node 20+ from https://nodejs.org'
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Fail 'npm was not found. Reinstall Node.js from https://nodejs.org'
}

if (-not (Test-Path '.env')) {
  if (Test-Path '.env.example') {
    Copy-Item '.env.example' '.env'
    Write-Host '[INFO] Created .env from .env.example'
    Write-Host '       After Supabase is running, set keys from: npx supabase status -o env'
    Write-Host ''
  } else {
    Fail 'Missing .env. Copy .env.example to .env and set Supabase keys.'
  }
}

if (-not (Test-Path 'node_modules')) {
  Write-Host '[INFO] Installing app dependencies...'
  npm install
}

if (-not (Test-Path 'dev-launcher/node_modules')) {
  Write-Host '[INFO] Installing dev-launcher dependencies...'
  npm run dev:launcher:install
}

$startedVite = $false

try {
  docker info *> $null
  $supabaseRunning = $false
  try {
    npx supabase status *> $null
    $supabaseRunning = $true
  } catch {}

  if (-not $supabaseRunning) {
    Write-Host '[INFO] Starting local Supabase (first run can take a few minutes)...'
    npm run supabase:start
  }
} catch {
  Write-Host '[WARN] Docker is not running. Start Docker Desktop, then run:'
  Write-Host '       npm run supabase:start'
  Write-Host ''
}

$viteListening = Get-NetTCPConnection -LocalPort 5173 -State Listen -ErrorAction SilentlyContinue
if (-not $viteListening) {
  Write-Host '[INFO] Starting Vite dev server...'
  Start-Process cmd.exe -ArgumentList '/k', 'npm run dev' -WorkingDirectory (Get-Location) -WindowStyle Normal
  $startedVite = $true

  Write-Host '[INFO] Waiting for http://localhost:5173 ...'
  $deadline = (Get-Date).AddSeconds(90)
  $ready = $false
  while ((Get-Date) -lt $deadline) {
    try {
      Invoke-WebRequest -Uri 'http://localhost:5173/' -UseBasicParsing -TimeoutSec 2 | Out-Null
      $ready = $true
      break
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  if (-not $ready) {
    Fail 'Dev server did not become ready. Check the "Fringo Dev Server" window.'
  }
  Write-Host '[OK] Dev server is ready.'
} else {
  Write-Host '[OK] Dev server already running on port 5173.'
}

Write-Host ''
Write-Host '[INFO] Opening Electron dev launcher...'
Write-Host ''

npm run dev:launcher
$exitCode = $LASTEXITCODE

Write-Host ''
if ($startedVite) {
  $stop = Read-Host 'Stop the Vite dev server too? [Y/N]'
  if ($stop -match '^[Yy]$') {
    Get-Process cmd -ErrorAction SilentlyContinue |
      Where-Object { $_.MainWindowTitle -like 'Fringo Dev Server*' } |
      Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host '[INFO] Stopped Vite dev server.'
  } else {
    Write-Host '[INFO] Vite is still running in the "Fringo Dev Server" window.'
  }
}

if ($exitCode -ne 0) {
  Fail "Dev launcher exited with code $exitCode"
}

Write-Host '[OK] Done.'
Read-Host 'Press Enter to exit'
