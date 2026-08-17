# RaidRU 2.2.0 — WCL Hybrid Browser Bridge

## Почему это не очередной parser fix

Перед 2.2.0 был проведён полный аудит цепочки прямого импорта WCL на реальном проблемном отчёте:

```text
https://www.warcraftlogs.com/reports/v3Qdp9M24hxy1bRg?fight=last
```

Эталонный Browser Replay этого же боя уже сохранён и содержит:

- `bossId = 53445`;
- `3` ReplaySegment окна: `240000 ms + 240000 ms + остаток`;
- `297830` сырых событий;
- `166456` position events;
- `43635` next-position events;
- `57268` compact position points;
- `81830` timeline events;
- `mapID = 2608`.

Следовательно, координаты в WCL есть.

### Что окончательно доказали ошибки 2.1.7 и 2.1.8

1. `WCL_REPLAYSEGMENT_INVALID_JSON` — Cloudflare Worker получает от внутреннего web-route WCL ответ, который нельзя считать стабильным JSON API-контрактом.
2. `WCL_GRAPHQL_ZERO_COORDINATES` — полный официальный `Report.events(includeResources:true)` на реальном отчёте заканчивается без usable `x/y`.

Поэтому невозможно честно считать один из этих двух server-to-server путей надёжным способом точного Replay.

## Ошибка в предыдущих regression tests

Тест 2.1.8 сам подставлял в mock GraphQL события поля:

```text
resourceActor, x, y, nextX, nextY
```

а затем проверял, что parser их извлёк. Это проверяло parser, но не главный production-инвариант: **отдаёт ли реальный публичный GraphQL эти Replay snapshots вообще**.

После появления `WCL_GRAPHQL_ZERO_COORDINATES` этот assumption удалён из production architecture и из regression-теста.

## Финальная архитектура

```text
WCL URL
   |
   +--> RaidRU Worker /wcl/report
   |      official WCL GraphQL
   |      roster / fight metadata / replayBossId
   |
   +--> RaidRU WCL Bridge (локально в Chrome)
   |      same-origin WCL browser tab
   |      /reports/replaysegment/...
   |      only selected friendlyPlayers coordinates
   |
   +--> RaidRU Worker /wcl/mechanics
          official WCL GraphQL
          casts / debuffs / summons / deaths
```

### Важное разделение

- **Coordinates** — browser-only bridge.
- **Mechanics** — official GraphQL, независимо от координат.
- **Cloudflare Worker** больше не запрашивает приватный ReplaySegment в обычном режиме.
- **GraphQL** больше не используется как источник exact coordinates.

## RaidRU WCL Bridge

Папка:

```text
wcl-bridge-extension/
```

Manifest V3 extension содержит:

- `background.js` — открывает/переиспользует WCL Replay tab;
- `wcl-page-probe.js` — MAIN-world same-origin capture;
- `wcl-content.js` — безопасный relay WCL page ↔ extension;
- `raidru-content.js` — relay RaidRU page ↔ extension.

### Как получаются координаты

Bridge получает от RaidRU только:

- report code;
- numeric fight id;
- fight start/end;
- Replay boss id;
- `friendlyPlayers` IDs.

Внутри вкладки WCL он запрашивает ReplaySegment окна по `240000 ms`, то есть по наблюдаемой структуре настоящего Replay.

Для каждой строки:

```text
resourceActor = 1 -> x/y принадлежат sourceID
resourceActor = 2 -> x/y принадлежат targetID
```

В RaidRU передаются только позиции actor IDs из `fight.friendlyPlayers`.

Cookies WCL не читаются и не передаются Worker/RaidRU: `fetch()` выполняется same-origin в WCL page context.

## Mechanics теперь действительно независимы

`/wcl/mechanics` больше не пытается сначала найти Replay cache.

Он всегда может построить Mechanics Pack из официальных GraphQL families:

- Casts;
- Debuffs;
- Summons;
- Deaths.

Клиент сохраняет выбранный бой в `window.__raidruWclSelection220`, поэтому кнопка **«Загрузить механики» работает даже если Bridge отсутствует или координаты ещё не загрузились**.

## Защита от повторения старой ошибки

Для обычного запроса:

```text
/wcl/exact-replay?...&mode=smart
```

Worker теперь отвечает:

```text
409 wcl_browser_bridge_required
```

То есть будущий клиент не сможет незаметно снова начать строить «exact Replay» из speculative GraphQL coordinates.

`mode=fast` оставлен только как diagnostic legacy path.

## Regression tests

### Browser Bridge

`test-wcl-bridge-220.mjs` проверяет:

- точные окна `240000 ms` на координатах текущего реального тестового fight;
- `resourceActor=1`;
- `resourceActor=2`;
- hostile target coordinates не приписываются friendly source;
- `nextX / nextY / nextTimestamp`;
- `mapID`;
- bounds;
- Manifest V3 scopes;
- обычный клиент не вызывает `/wcl/exact-replay`;
- Mechanics source работает от выбранного fight без Replay.

### Worker

`test-wcl-safe-worker.mjs` проверяет:

- report metadata через GraphQL;
- roster = `friendlyPlayers`, а не 500 report actors;
- `replayBossId = 53445` для Ula'tek encounter;
- smart exact Replay = `409 wcl_browser_bridge_required` без расхода GraphQL;
- Worker не обращается к private ReplaySegment;
- Mechanics строятся независимо;
- Mechanics cache работает;
- legacy `fast` diagnostic остаётся доступен.

### Полный suite

Перед упаковкой 2.2.0 выполнены:

```text
node --check для production JS + extension JS
все test-*.js
все test-*.mjs
```

Все проверки проходят.

## Установка Bridge

До публикации расширения в Chrome Web Store оно ставится как unpacked:

1. открыть `chrome://extensions/`;
2. включить «Режим разработчика»;
3. «Загрузить распакованное расширение»;
4. выбрать папку `wcl-bridge-extension`;
5. перезагрузить RaidRU.

После этого обычная ссылка WCL загружается кнопкой RaidRU. Ручной Browser Replay JSON больше не нужен.

## Деплой RaidRU

Worker:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

GitHub Pages:

```powershell
git add .
git commit -m "Release RaidRU 2.2.0 WCL hybrid browser bridge"
git push
```

После публикации один раз сделать hard reload / удалить старый Service Worker cache.
