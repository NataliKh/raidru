# RaidRU Warcraft Logs Proxy

GitHub Pages не должен хранить `WCL_CLIENT_SECRET`, поэтому RaidRU 0.7 использует отдельный proxy.

## Cloudflare Worker
1. Создай приложение Warcraft Logs API и получи Client ID / Client Secret.
2. Скопируй `wrangler.toml.example` в `wrangler.toml`.
3. Установи Wrangler: `npm i -g wrangler` или используй `npx wrangler`.
4. Добавь секреты:
   - `npx wrangler secret put WCL_CLIENT_ID`
   - `npx wrangler secret put WCL_CLIENT_SECRET`
5. `npx wrangler deploy`
6. В RaidRU → **WCL Replay** вставь URL Worker вида `https://raidru-wcl.<account>.workers.dev`.

Endpoint:
`GET /replay?report=<REPORT_CODE>&fight=<FIGHT_ID>`

Worker получает OAuth token по Client Credentials, читает публичный report через Warcraft Logs GraphQL API и возвращает нормализованные actors / positions / events.

### Почему нормализация сделана терпимой
Структура `events` Warcraft Logs может меняться. Worker ищет координаты в `sourceResources`, `targetResources`, `resources` и прямых `x/y`, чтобы переживать небольшие изменения payload.
