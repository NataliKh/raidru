$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Write-Host "Deploying RaidRU RaidPlan importer..." -ForegroundColor Cyan
npx wrangler@4.120.1 deploy
if ($LASTEXITCODE -ne 0) { throw "Wrangler deploy failed" }
Write-Host "Done: https://raidru-raidplan.raidru-wcl.workers.dev/health" -ForegroundColor Green
