# RaidRU 2.0 Preview — WCL Safe Import

Первый инфраструктурный блок 2.0: обычная ссылка Warcraft Logs теперь может загружаться прямо в раздел Replay без Browser Exporter и ручного JSON.

## Пользовательский сценарий

```text
Warcraft Logs URL
    ↓
RaidRU
    ↓
Cloudflare Worker /wcl/report /wcl/replay
    ↓
OAuth Client Credentials
    ↓
Warcraft Logs v2 GraphQL
    ↓
quota guard + resumable page cache
    ↓
компактный RaidRU Replay
```

Если в ссылке нет `fight=`, RaidRU показывает список пулов отчёта. `fight=last` также поддерживается.

## Почему Worker больше не должен «банить на час»

1. Перед незакэшированной загрузкой проверяется `rateLimitData`.
2. Мягкий порог по умолчанию — 70% часового бюджета.
3. Дополнительно всегда сохраняется резерв минимум 500 points или 20% квоты (что больше).
4. После каждой страницы Worker видит обновлённый `rateLimitData` и оценивает цену следующей страницы.
5. При приближении к порогу Worker возвращает HTTP 202 и **не делает следующий WCL запрос**.
6. Уже полученные страницы и контрольная точка сохраняются в Cloudflare Cache API. После защитной паузы загрузка продолжает именно следующий пакет, а не перечитывает бой с нуля.
7. Ответ 429 никогда автоматически не ретраится. Создаётся backoff до `Retry-After`/сброса квоты.
8. Готовый Replay кэшируется. Повторное открытие того же завершённого боя не расходует WCL API.
9. Одна страница WCL намеренно ограничена 2500 событиями (а не максимумом 10000), чтобы после небольшого пакета снова увидеть актуальный `rateLimitData`.
10. Для координат запрашивается `includeResources: true`; поэтому запрос потенциально дорогой, и именно поэтому используются маленькие страницы, 70% stop-line, резерв и checkpoint.
11. В долгоживущий кэш сохраняются не сотни тысяч полных событий, а только позиции игроков и вражеские cast/begincast.

Настройки находятся в `wrangler.toml`:

```toml
WCL_SOFT_LIMIT = "0.70"
WCL_MIN_RESERVE = "500"
WCL_MAX_PAGES_PER_REQUEST = "8"
WCL_EVENT_PAGE_LIMIT = "2500"
```

## OAuth secrets — один раз

Секреты не должны попадать в GitHub Pages или репозиторий.

```powershell
npx wrangler@4.120.1 secret put WCL_CLIENT_ID
npx wrangler@4.120.1 secret put WCL_CLIENT_SECRET
```

После этого обычный деплой:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

Проверка:

```text
https://raidru-raidplan.raidru-wcl.workers.dev/health
```

В ответе должно быть:

```json
{"ok":true,"wclConfigured":true}
```

## Endpoints

### Список пулов

```text
GET /wcl/report?code=g2Cm9dXRjxAT61Dw
```

### Replay

```text
GET /wcl/replay?code=g2Cm9dXRjxAT61Dw&fight=10
GET /wcl/replay?code=ZHMFmALfbdkaz7WX&fight=last
```

HTTP `202` не является ошибкой импорта: это защитная остановка. Клиент показывает время ожидания и не продолжает долбить WCL.

## Важное ограничение Preview

Этот build использует официальный публичный WCL API и Client Credentials, поэтому предназначен для публичных отчётов. GraphQL-запросы в архиве проверены статически и mock-тестом, но без WCL credentials в среде сборки live-вызов API не выполнялся — после деплоя сначала проверь один короткий публичный бой. OAuth пользователя для приватных логов будет отдельным этапом 2.x.

## Что не менялось

- RaidPlan importer и renderer;
- геометрия сцен;
- Workspace 0.9.5;
- Raid Ready 1.0;
- UI/timeline 1.0.1.

WCL Safe Import добавлен отдельным модулем `wcl-safe-200.js`.
