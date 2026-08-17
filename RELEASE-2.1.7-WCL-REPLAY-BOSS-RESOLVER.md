# RaidRU 2.1.7 — WCL Replay Boss Resolver

Исправляет ошибку `WCL_REPLAY_BOSS_ID_MISSING` в прямом импорте Warcraft Logs.

## Причина

В 2.1.6 путь ReplaySegment строился из `fight.encounterID || fight.originalEncounterID` и считал отсутствие этих полей фатальной ошибкой.

Это неверно по двум причинам:

1. `ReportFight.encounterID` и идентификатор босса в `/reports/replaysegment/...` находятся в разных пространствах ID.
2. У некоторых боёв, особенно составных encounter'ов, GraphQL может вернуть `0/null`, хотя Replay Warcraft Logs работает.

Для проверенных боёв текущего рейда Replay ID соответствует `encounterID + 50000`: например `3420 -> 53420`, `3421 -> 53421`.

## Что изменено

- добавлен `replayBossIdForFight()`;
- GraphQL `encounterID` автоматически переводится в Replay namespace (`+50000`), если ещё не является Replay ID;
- при `encounterID=0/null` используется fallback по имени encounter;
- для Entombed Sentinels поддерживаются оба имени:
  - `Entombed Sentinels`;
  - `Blood of Ula'tek / Breath of Ula'tek`;
- для Entombed Sentinels Replay ID резолвится в `53445`;
- новый ReplaySegment cache namespace: `v217`;
- report metadata cache также обновлён до `report-v217`;
- в итоговом Replay отдельно сохраняются:
  - `source.bossId` — Replay ID;
  - `source.encounterID` / `fight.encounterID` — GraphQL encounter ID, если он был известен.

## Regression tests

Добавлены проверки:

- `encounterID = 0` + `Blood of Ula'tek / Breath of Ula'tek` -> запрос ReplaySegment с boss id `53445`;
- обычный GraphQL `encounterID = 3420` -> ReplaySegment boss id `53420`;
- fight scope остаётся ограничен `friendlyPlayers`;
- `resourceActor=1/2` продолжает правильно определять владельца координат;
- механики берутся из уже загруженного ReplaySegment без второго GraphQL прохода.

Все `test-*.js` и `test-*.mjs` проходят.
