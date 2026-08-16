# RaidRU 2.0.8 — WCL Workspace

## Что изменилось

Warcraft Logs теперь выглядит как обычный рабочий раздел, а не диагностическая панель.

- На пустом экране одно основное действие: вставить ссылку WCL и нажать **Загрузить бой**.
- После загрузки поле ссылки сворачивается в карточку текущего боя.
- Появились режимы **Replay / Разбор / План**.
- **Новый бой** очищает текущий экран, но не удаляет серверный кэш.
- Импорт/экспорт JSON перенесён в меню `•••`.
- В информации о Replay видны формат, mapID, позиции, события и cache status.

## Канонический Replay v2

Добавлен endpoint Worker:

```text
GET /wcl/exact-replay?code=<REPORT>&fight=<ID>&mode=smart
```

Успешный ответ (`200` или `206`) имеет envelope:

```text
format: raidru-wcl-replay-browser
version: 2
```

и совместимые поля:

- `source`
- `time`
- `coordinateSemantics`
- `bounds`
- `mapIDs`
- `actorIds`
- `stats`
- `positions`
- `positionsByActor`
- `timeline`

Для прямого URL-импорта дополнительно передаются `actors`, `report`, `fight`, `partial`, `quality`, `quota` и cache metadata. Это позволяет не терять имена игроков и одновременно сохранять совместимость с Browser Replay JSON.

## WCL quota

Защита 2.0.5 сохранена:

- numeric fight в обычном режиме — максимум один GraphQL request на действие пользователя;
- настоящий WCL `429` соблюдает `Retry-After`;
- checkpoint и server cache сохраняются;
- `206` сразу даёт рабочую частичную версию Replay и кнопку догрузки.

## Разбор

Первый слой Fight Intelligence работает локально по уже загруженным координатам и не делает запросов в WCL. Он показывает длительность, количество позиционных точек, максимальный разброс и несколько сильнейших перемещений центра рейда с переходом в соответствующий момент Replay.

## Проверки

```powershell
node --check app.js
node --check workspace-095.js
node --check wcl-safe-200.js
node --check wcl-workspace-208.js
node --check src/index.js
node test-wcl-safe-worker.mjs
node test-wcl-workspace-208.js
node test-wcl-coordinates-207.js
node test-wcl-new-fight-206.js
node test-ui-101.js
node test-workspace-095.js
```
