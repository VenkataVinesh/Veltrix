$ErrorActionPreference = 'Stop'

Set-Location "$PSScriptRoot/.."

Write-Host 'Starting PostgreSQL + Redis + backend + frontend (monorepo)...'
docker compose -f docker/docker-compose.monorepo.yml up --build
