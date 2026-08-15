$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
Write-Host "Deploying RaidRU Edge Worker (RaidPlan + WCL Adaptive Import)..." -ForegroundColor Cyan
Write-Host "One-time WCL setup, if secrets are not configured yet:" -ForegroundColor DarkGray
Write-Host "  npx wrangler@4.120.1 secret put WCL_CLIENT_ID" -ForegroundColor DarkGray
Write-Host "  npx wrangler@4.120.1 secret put WCL_CLIENT_SECRET" -ForegroundColor DarkGray
npx wrangler@4.120.1 deploy
if ($LASTEXITCODE -ne 0) { throw "Wrangler deploy failed" }
Write-Host "Done: https://raidru-raidplan.raidru-wcl.workers.dev/health" -ForegroundColor Green
