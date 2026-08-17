# RaidRU 2.2.1 — WCL Bridge Final Audit

## Симптом production

После установки 2.2.0 состав выбранного боя определялся корректно, Bridge запускался, но реальный отчёт

```text
https://www.warcraftlogs.com/reports/v3Qdp9M24hxy1bRg?fight=last
```

завершался ошибкой:

```text
WCL_BRIDGE_ZERO_COORDINATES
```

При этом ранее сохранённый Browser Replay этого же боя доказанно содержит:

- bossId `53445`;
- 3 ReplaySegment окна;
- `297830` raw events;
- `166456` position events;
- `43635` next-position events;
- `57268` compact coordinate points;
- `81830` timeline events;
- mapID `2608`.

Следовательно, нулевой результат создавал сам Bridge после получения данных, а не Warcraft Logs.

## Конкретный дефект 2.2.0

`wcl-page-probe.js` разрешал владельца координаты через `resourceActor`, но затем пропускал точку только если actor ID входил в GraphQL `fight.friendlyPlayers`:

```text
ReplaySegment actor id -> must be in GraphQL friendlyPlayers -> keep
                                              else -> discard
```

Это слишком сильное предположение. На составных encounter actor IDs, наблюдаемые в browser Replay, могут не пересекаться с fight-scoped roster IDs так, как ожидает GraphQL metadata. Если пересечения нет, 2.2.0 отбрасывал вообще все валидные coordinates и выдавал `WCL_BRIDGE_ZERO_COORDINATES`.

## Исправление participant resolution

2.2.1 больше не уничтожает Replay tracks до того, как определит, кто из них Player.

### В браузере WCL

`wcl-page-probe.js`:

1. сохраняет координату по правильной семантике:
   - `resourceActor = 1` -> `sourceID`;
   - `resourceActor = 2` -> `targetID`;
2. учитывает `sourceIsFriendly` / `targetIsFriendly`;
3. получает от RaidRU также IDs `masterData.actors` с `type=Player` и может распознать Player даже когда friendliness flag отсутствует;
4. сначала предпочитает точное пересечение с `fight.friendlyPlayers`;
5. если пересечения нет, возвращает все подтверждённые friendly/player Replay tracks с `rosterFallback=true` и диагностикой вместо ложного нуля.

### В RaidRU

`wcl-bridge-220.js` окончательно отбирает player tracks:

1. берёт только actor IDs, у которых реально есть координаты в выбранном Replay;
2. предпочитает `fight.friendlyPlayers`, если пересечение есть;
3. иначе пересекает coordinate IDs с `report.actors[type=Player]`;
4. Pet/NPC не попадают в actors;
5. при необходимости ограничивает результат `fight.size`, сортируя candidate tracks по количеству coordinate points.

Так report-wide таблица из сотен actors больше не может превратиться в 500 отображаемых игроков, но mismatch ID-space также не превращается в 0 coordinate points.

## Механики больше не зависят от отдельного успешного GraphQL-прохода

2.2.1 извлекает из тех же ReplaySegment rows компактный tactical timeline:

- hostile `cast` / `begincast`;
- hostile debuffs на friendly targets;
- hostile summons;
- deaths friendly targets.

Если Bridge успешно загрузил Replay, этот timeline используется сразу локально.

Официальный `/wcl/mechanics` остаётся fallback. В нём:

- удалена зависимость от GraphQL `HostilityType` для Casts/Debuffs/Summons;
- friendliness определяется по event flags и player roster;
- partial pages автоматически продолжаются до 6 страниц за одно нажатие;
- cache namespace поднят до `v221`.

## Дополнительный найденный баг UI

`viewer-212.js` жёстко переписывал footer на:

```text
RaidRU 2.1.8 · WCL GraphQL Resource Replay
```

даже когда реальная страница уже была 2.2.0. В 2.2.1 footer синхронизирован с релизом:

```text
RaidRU 2.2.1 · WCL Bridge Final Audit
```

## Диагностика вместо бесконечных догадок

При невозможности получить координаты Bridge теперь возвращает диагностические счётчики:

- `rawEvents`;
- `coordinateCandidates`;
- `expectedPlayerCount`;
- `knownPlayerCount`;
- `matchedExpectedActorCount`;
- `observedFriendlyActorCount`;
- `ownerWays`;
- observed/expected actor IDs при zero result.

Это позволяет отличить «ReplaySegment пуст» от «точки пришли, но roster resolver их не признал».

## Regression test

`test-wcl-bridge-220.mjs` специально моделирует production failure:

- GraphQL `friendlyPlayers = [9001, 9002]`;
- Replay coordinates принадлежат actors `318` и `292` — пересечения нет;
- один coordinate event не имеет friendliness flags и должен быть распознан через masterData Player ID;
- присутствует friendly Pet `777`;
- присутствует hostile boss coordinate `99999/99999` при `resourceActor=2`;
- есть hostile cast и debuff.

Проверки требуют, чтобы:

- координаты 318/292 сохранились;
- Pet не попал в итоговый player roster;
- boss coordinate не был приписан player source;
- `nextX/nextY/nextTimestamp` сохранились;
- tactical timeline содержал cast/debuff;
- использовались реальные три 240-секундных окна тестового fight;
- normal client не использовал GraphQL exact-replay path;
- Worker mechanics не зависел от HostilityType;
- footer не содержал 2.1.8.

## Cache / versions

- static cache: `raidru-v221-wcl-bridge-final-audit`;
- report metadata: `wcl/report-v221/`;
- mechanics progress/final: `wcl/mechanics-v221-*`;
- Chrome extension: `2.2.1`;
- client: `2.2.1`.

## Деплой

Worker:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

GitHub Pages:

```bash
git add -A
git commit -m "Release RaidRU 2.2.1 WCL Bridge Final Audit"
git push origin main
```

Chrome Bridge нужно обновить отдельно: удалить/перезагрузить старую unpacked 2.2.0 и загрузить новую папку `wcl-bridge-extension` версии 2.2.1.
