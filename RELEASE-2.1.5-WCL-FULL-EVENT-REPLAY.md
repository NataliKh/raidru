# RaidRU 2.1.5 — WCL Full Event Replay

## Симптом

После исправления participant scope в 2.1.4 прямой импорт конкретного Warcraft Logs боя мог корректно показать, например, 18 участников, но затем сообщить `0 координатных точек`; карта не оживала, а WCL timeline не строился.

## Что подтвердило источник ошибки

Для тестового `v3Qdp9M24hxy1bRg / fight=last` Browser Replay, полученный непосредственно со страницы Warcraft Logs, содержит десятки тысяч coordinate points и полный event timeline. Значит, координаты есть в исходных данных WCL, а потеря происходила внутри Worker pipeline RaidRU.

## Причина

2.1.4 исправил только набор actor IDs: `fight.friendlyPlayers` вместо всех Player actors отчёта. Но обычный numeric Replay всё ещё шёл через one-shot запрос с `dataType: Casts`.

Это предположение оказалось неверным: `includeResources: true` не гарантирует, что именно Casts-only выборка даст достаточные `x/y` snapshots. В проблемном классе отчётов roster определяется правильно, но usable coordinates остаются пустыми.

## Исправление

### Smart Replay

- `mode=smart` теперь всегда использует generic/full event stream.
- Query сохраняет `includeResources: true`.
- `mode=fast` остаётся отдельным legacy/diagnostic Casts-only путём и не используется обычной загрузкой.
- Numeric fight больше не отправляется в one-shot builder, кроме явного `mode=fast`.

### Пагинация и checkpoint

- event page: до `10000`;
- за один Worker вызов обрабатывается до `WCL_MAX_PAGES_PER_REQUEST` страниц;
- если бой ещё не закончен, Worker отдаёт `202 batch_yield`;
- клиент автоматически вызывает продолжение с сохранённого checkpoint;
- финальный payload содержит только compact positions + hostile boss casts, а не raw event stream.

### Fight scope

Сохраняется исправление 2.1.4:

- roster = `fight.friendlyPlayers`;
- coordinates фильтруются тем же набором IDs;
- Mechanics Pack теперь также использует `fightPlayerIds(meta, fight)`.

### Защита от пустого Replay

Если клиент получил участников, но после нормализации осталось `0` координат, такой результат больше не записывается как успешный Replay. UI показывает диагностическую ошибку вместо ложного `готово`.

## Cache migration

Новые namespaces:

- `wcl/report-v215/...`
- `wcl/page-v215/...`
- `wcl/progress-v215/...`
- `wcl/replay-v215/...`
- `wcl/mechanics-v215-progress/...`
- `wcl/mechanics-v215/...`

Service Worker: `raidru-v215-wcl-full-event-replay`.

## Regression

`test-wcl-safe-worker.mjs` моделирует production failure:

1. report-wide `masterData` содержит 500 Player actors;
2. fight содержит только `friendlyPlayers: [9001]`;
3. Casts-only page содержит boss cast, но **не содержит x/y**;
4. generic event page содержит resource coordinates игрока и boss cast.

Проверяется, что smart Replay:

- не вызывает Casts-only one-shot;
- возвращает fight-scoped roster;
- имеет ненулевые coordinates;
- имеет boss timeline;
- сохраняет mapID;
- после завершения читается из cache;
- реальный upstream 429 сохраняет Retry-After и не создаёт цикл повторных запросов.

## Деплой

В 2.1.5 изменены и Worker, и static client:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1

git add .
git commit -m "Release RaidRU 2.1.5 WCL full event replay"
git push
```

После GitHub Pages deployment сделать `Ctrl + F5`. При подозрении на старый PWA cache удалить старый Service Worker / Cache Storage в DevTools → Application.
