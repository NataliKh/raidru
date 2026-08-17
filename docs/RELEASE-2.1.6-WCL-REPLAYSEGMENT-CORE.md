# RaidRU 2.1.6 — WCL ReplaySegment Core

## Зачем понадобился ещё один фикс

Версия 2.1.5 исправляла GraphQL-путь получения событий, но это всё ещё был не тот источник, из которого экран Replay Warcraft Logs получает полные позиционные snapshots.

На эталонном Browser Replay для `v3Qdp9M24hxy1bRg?fight=last` координаты и таймлайн реально существуют:

- `57 268` compact position points;
- `166 456` position events;
- `43 635` next-position events;
- `81 830` timeline events;
- `mapID = 2608`.

Следовательно, проблема была не в самом логе и не в выбранном составе, а в transport/parser pipeline RaidRU.

## Корневая причина

Рабочий Browser Replay использует сырой поток Warcraft Logs ReplaySegment:

```text
/reports/replaysegment/<REPORT>/<BOSS>/<START>/<END>/
```

События имеют форму `events[]` и содержат позиционные поля непосредственно внутри события:

```json
{
  "timestamp": 88277548,
  "sourceID": 177,
  "targetID": 344,
  "resourceActor": 2,
  "x": 31877,
  "y": 45393,
  "mapID": 2608,
  "nextX": 31814,
  "nextY": 45338,
  "nextTimestamp": 88277602
}
```

Ключевое правило:

```text
resourceActor = 1  -> x/y принадлежат sourceID
resourceActor = 2  -> x/y принадлежат targetID
```

Это принципиально важно. Если игрок наносит урон боссу и `resourceActor = 2`, координаты в событии относятся к боссу, а не к игроку. Старый generic parser мог приписать такую точку source-игроку или потерять её при фильтрации.

## Что изменено

### 1. Smart Replay теперь использует ReplaySegment

Обычная загрузка WCL URL больше не пытается строить Replay из GraphQL event stream.

GraphQL используется только для:

- метаданных отчёта;
- выбора fight;
- `friendlyPlayers`;
- actor names / classes;
- quota metadata.

После этого координаты и тактические события берутся из ReplaySegment.

`mode=fast` оставлен только как явный диагностический legacy-путь.

### 2. Реальная семантика `resourceActor`

Добавлен отдельный parser ReplaySegment:

- `resourceActor: 1` -> `sourceID`;
- `resourceActor: 2` -> `targetID`;
- координата сохраняется только если найденный actor входит в `fight.friendlyPlayers`;
- `nextX / nextY / nextTimestamp / nextFacing` сохраняются как следующая точка того же actor;
- `ability.guid` поддерживается как spell ID;
- `mapID` сохраняется вместе с точкой.

### 3. 30-секундные окна вместо одного огромного ReplaySegment

Наблюдаемый реальный ReplaySegment на ~240 секунд содержит `103 134` событий и имеет размер около `100 MB` в сыром JSON.

Для Cloudflare Worker это слишком большой объект для безопасного `response.json()`.

Поэтому RaidRU использует тот же endpoint, но запрашивает бой окнами по `30 000 ms`:

```text
fight start
  -> 30 s
  -> 30 s
  -> 30 s
  -> ...
  -> fight end
```

Каждое окно:

1. загружается отдельно;
2. сразу превращается в компактные positions + mechanics;
3. сохраняется в Cache API;
4. raw JSON после завершения Worker-вызова больше не нужен.

Клиент автоматически продолжает загрузку через `202 batch_yield`.

### 4. Механики строятся из того же потока

Из ReplaySegment одновременно извлекаются:

- hostile `cast` / `begincast`;
- hostile debuffs на игроков;
- hostile summons;
- deaths игроков.

После готового Replay кнопка «Загрузить механики» читает уже готовый ReplaySegment cache и не расходует второй большой GraphQL-проход.

### 5. Исправлен `numeric(null)`

Раньше:

```js
Number(null) === 0
```

мог превратить отсутствующий cursor / timestamp в ложный `0`.

Теперь `null` и пустая строка возвращают `null` до вызова `Number()`.

### 6. Новые cache namespaces

```text
wcl/replaysegment-v216/...
wcl/replaysegment-v216-progress/...
wcl/replay-v216/replaysegment/...
```

Service Worker:

```text
raidru-v216-wcl-replaysegment-core
```

Старые пустые Replay 2.1.4/2.1.5 не должны попадать в новый pipeline.

### 7. Явная ошибка вместо ложного успеха

Если WCL вернул участников, но после полного ReplaySegment-прохода получилось `0` координат, Worker возвращает ошибку:

```text
wcl_replaysegment_zero_coordinates
```

Если серверный запрос WCL к ReplaySegment запрещён:

```text
wcl_replaysegment_forbidden
```

То есть UI больше не должен оставлять состояние «18 игроков / 0 точек» как будто импорт завершился нормально.

## Regression

`test-wcl-safe-worker.mjs` моделирует production-путь:

1. report содержит 500 посторонних Player actors;
2. fight содержит только `friendlyPlayers: [9001, 9002]`;
3. координаты приходят в ReplaySegment events;
4. проверяются обе семантики `resourceActor = 1` и `resourceActor = 2`;
5. отдельное событие специально содержит source=player, target=boss, `resourceActor=2` и координаты босса — они не должны попасть в player track;
6. проверяются `nextX/nextY`, `mapID`, `ability.guid`;
7. casts/debuffs/summons/deaths попадают в mechanics timeline;
8. Mechanics после готового Replay не вызывает GraphQL;
9. повторный Replay читается только из cache;
10. настоящий upstream 429 создаёт backoff и не запускает цикл запросов.

Worker-тест режет mock-fight на три 30-секундных окна и проверяет resume/cache pipeline.

## Проверка перед релизом

```powershell
node --check src/index.js
node --check app.js
node --check workspace-095.js
node --check raidplan-importer.js
node --check sw.js
node --check wcl-safe-200.js
node --check viewer-212.js

node test-wcl-safe-200.js
node test-wcl-safe-worker.mjs
```

Также должны пройти все остальные `test*.js` и `test*.mjs` проекта.

## Деплой

В 2.1.6 меняется и Worker, и static client.

Сначала Worker:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

Потом GitHub Pages:

```powershell
git add .
git commit -m "Release RaidRU 2.1.6 WCL ReplaySegment Core"
git push
```

Из-за большого количества предыдущих WCL/PWA версий после публикации рекомендуется один раз удалить старый Service Worker и Cache Storage в DevTools -> Application, затем перезагрузить страницу.

## Что должно быть видно в UI

При прямой загрузке WCL URL:

```text
metadata / состав
-> ReplaySegment 1 / N
-> ReplaySegment 2 / N
-> ...
-> координаты > 0
-> карта двигается
-> mechanics timeline уже находится в Replay cache
```

Если Cloudflare -> WCL ReplaySegment transport блокируется самим WCL, вместо нулевых координат должна появиться явная transport-ошибка. Для диагностики достаточно текста этой ошибки или скриншота; секреты OAuth, cookies и request headers не нужны.
