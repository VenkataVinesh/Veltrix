$ErrorActionPreference = 'Stop'

Set-Location "$PSScriptRoot/.."

Write-Host '1) Python environment setup'
if (-not (Test-Path .venv)) {
  python -m venv .venv
}

& ./.venv/Scripts/python.exe -m pip install --upgrade pip
& ./.venv/Scripts/python.exe -m pip install -e ./backend

Write-Host '2) Frontend setup'
Set-Location ./frontend
npm install
Set-Location ..

Write-Host '3) Copy frontend env template'
if (-not (Test-Path ./frontend/.env.local)) {
  Copy-Item ./frontend/.env.local.example ./frontend/.env.local
}

Write-Host 'Setup complete. Use scripts/start_backend.ps1 and scripts/start_frontend.ps1'
