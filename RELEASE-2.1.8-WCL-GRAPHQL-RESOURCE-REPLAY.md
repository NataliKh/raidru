# RaidRU 2.1.8 — WCL GraphQL Resource Replay

## Симптом

После 2.1.7 прямой импорт Warcraft Logs доходил до нового transport и завершался ошибкой:

```text
WCL_REPLAYSEGMENT_INVALID_JSON
```

Это уже не ошибка определения состава или boss ID. В 2.1.7 Worker успешно получал HTTP-ответ от приватного web route Warcraft Logs `reports/replaysegment/...`, но тело ответа не удавалось разобрать как JSON.

## Вывод

Обычный импорт RaidRU не должен зависеть от приватного web endpoint ReplaySegment. Он остаётся полезным как Browser Replay/диагностический источник, но server-to-server transport через Cloudflare Worker нельзя считать стабильным контрактом.

Поэтому 2.1.8 меняет архитектуру обычного WCL URL import.

## Новый production path

```text
WCL URL
  -> Worker /wcl/replay
  -> GraphQL report metadata
  -> fight.friendlyPlayers
  -> GraphQL Report.events(includeResources: true)
  -> compact resource positions + mechanics
  -> checkpoint / cache
  -> RaidRU Replay
```

Приватный `reports/replaysegment/...` больше не вызывается режимами `smart` и `full`.

Он оставлен только как явный diagnostic `mode=segment` и не используется обычной кнопкой загрузки боя.

## Исправленная семантика координат

Ключевая ошибка старого generic parser была в трактовке `resourceActor`.

`resourceActor` — не actor ID, а discriminator:

```text
resourceActor = 1 -> x/y принадлежат sourceID
resourceActor = 2 -> x/y принадлежат targetID
```

Теперь GraphQL resource events разбираются по этому правилу.

Поддерживаются:

- `x / y`;
- `facing`;
- `mapID`;
- `nextX / nextY / nextTimestamp`;
- `nextFacing / nextFacingTimestamp`;
- `ability.guid` как spell ID.

Координаты сохраняются только для actor IDs из `fight.friendlyPlayers`.

## Механики из того же потока

Полный GraphQL event stream одновременно собирает компактный tactical timeline:

- hostile `cast` / `begincast`;
- hostile debuffs на игроков;
- hostile summons;
- deaths игроков.

После готового Replay кнопка «Загрузить механики» сначала читает полный Replay cache `v218`, поэтому второй большой GraphQL-проход не нужен.

## Пагинация и нагрузка

Полный поток по-прежнему идёт через checkpoint:

- event pages кэшируются;
- за один Worker-вызов по умолчанию запрашивается не более 3 новых страниц;
- при необходимости Worker отвечает `202 batch_yield`;
- клиент автоматически продолжает с сохранённого cursor;
- реальный WCL `429` по-прежнему соблюдает Retry-After.

## Защита от ложного успеха

Если GraphQL вернул участников боя, но после полного прохода координат всё равно `0`, RaidRU:

- не кэширует такой результат как успешный Replay;
- удаляет завершённый progress checkpoint;
- возвращает:

```text
WCL_GRAPHQL_ZERO_COORDINATES
```

Это позволяет отличить реальное отсутствие resource coordinates в API от старого transport failure.

## Cache migration

Новые namespaces:

```text
wcl/report-v218/...
wcl/page-v218/...
wcl/progress-v218/...
wcl/replay-v218/full/...
wcl/replay-v218/fast/...
wcl/mechanics-v218/...
```

Service Worker:

```text
raidru-v218-wcl-graphql-resource-replay
```

## Regression

Новый Worker mock специально моделирует production failure 2.1.7:

1. report содержит 500 Player actors;
2. текущий fight содержит только `friendlyPlayers: [9001, 9002]`;
3. официальный GraphQL event stream отдаёт resource coordinates несколькими страницами;
4. проверяются `resourceActor = 1` и `resourceActor = 2`;
5. событие `friendly source -> hostile boss`, `resourceActor = 2`, содержит ложные координаты босса — они не должны попасть в player track;
6. `ability.guid` попадает в mechanics timeline;
7. private ReplaySegment mock отвечает `text/html` challenge;
8. smart import обязан вообще не обращаться к ReplaySegment;
9. повторный Replay читается только из cache;
10. Mechanics после готового Replay читается из GraphQL Replay cache без второго GraphQL-прохода.

Полный набор `test-*.js` и `test-*.mjs` проходит.

## Деплой

В 2.1.8 изменены Worker и static client.

Сначала Worker:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

Затем GitHub Pages:

```powershell
git add .
git commit -m "Release RaidRU 2.1.8 WCL GraphQL resource replay"
git push
```

После публикации один раз удалить старый Service Worker / Cache Storage или сделать hard reload, чтобы браузер не использовал сборку 2.1.7.

## Что ожидается в UI

Для обычного WCL URL больше не должно быть:

```text
WCL_REPLAYSEGMENT_INVALID_JSON
```

Ожидаемый flow:

```text
metadata / 18 игроков
-> WCL API: страницы событий
-> 202 batch_yield при необходимости
-> координаты > 0
-> движение на карте
-> mechanics из того же Replay cache
```

Если вместо этого появится `WCL_GRAPHQL_ZERO_COORDINATES`, это уже новый диагностический результат: официальный GraphQL resource stream завершился без usable x/y и нужен отдельный fallback, а не очередная попытка чинить ReplaySegment transport.
