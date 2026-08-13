# RaidRU RaidPlan Worker

Отдельный Cloudflare Worker для приватного импорта RaidPlan в RaidRU.

- Worker: `raidru-raidplan`
- Endpoint: `https://raidru-raidplan.raidru-wcl.workers.dev/raidplan?code=...`
- Health: `https://raidru-raidplan.raidru-wcl.workers.dev/health`
- Cache: disabled / `no-store`
- Разрешённый production Origin: `https://natalikh.github.io`

## Deploy

PowerShell из этой папки:

```powershell
.\deploy.ps1
```

Wrangler использует уже выполненную авторизацию Cloudflare. Существующий Worker `raidru-wcl` не изменяется.
