# RaidRU 2.1.4 — WCL Fight Scope

## Симптом

Для некоторых больших Warcraft Logs reports первый быстрый Replay мог показывать `500 игроков · 0 координатных точек`, хотя официальный Warcraft Logs Replay содержал обычный рейд и движение игроков.

## Причина

`masterData.actors` — таблица акторов всего report. Использовать все записи `type = Player` как состав конкретного боя нельзя. В WCL у объекта fight есть `friendlyPlayers` — IDs игроков, реально участвовавших именно в этом fight.

Старый Worker строил `playerIds` из всей `masterData.actors`. На больших reports это могло дать сотни Player actors, а реальные resource coordinates текущего боя не совпадали с ошибочно выбранным набором.

## Исправление

- `REPORT_QUERY`, `RaidRUOneShot` и Mechanics metadata получают `friendlyPlayers`.
- `publicReport()` сохраняет `friendlyPlayers` у каждого fight.
- `fightPlayerIds()` использует `fight.friendlyPlayers` как основной источник participant IDs.
- `fightActors()` подтягивает имена/классы из masterData только для этих IDs; при отсутствии записи создаётся безопасная подпись `Игрок <id>`.
- `compactWclPage()` фильтрует coordinates по participant IDs текущего fight.
- `replayBodyFromProgress()` больше не показывает report-wide Player actors.

## Cache migration

Изменена семантика actor scope, поэтому старые WCL replay/progress/page/report caches нельзя считать безопасными. В 2.1.4 используются новые namespaces:

- `wcl/report-v214/...`
- `wcl/page-v214/...`
- `wcl/progress-v214/...`
- `wcl/replay-v214/...`

Это важно для уже закэшированного бага: после деплоя Worker не должен повторно отдать старый `500 игроков / 0 точек` payload.

## Regression test

`test-wcl-safe-worker.mjs` теперь моделирует report с 500 Player actors, но fight содержит `friendlyPlayers: [9001]`. Проверяется, что exact replay:

- возвращает 1 игрока;
- сохраняет mapID;
- содержит координаты;
- по-прежнему делает ровно один GraphQL request на numeric fast-path click.

## Деплой

В этой версии изменён Cloudflare Worker, поэтому нужен деплой Worker:

```powershell
powershell -ExecutionPolicy Bypass -File .\deploy.ps1
```

После этого опубликовать статические файлы GitHub Pages и сделать `Ctrl + F5`. Новый Service Worker cache: `raidru-v214-wcl-fight-scope`.
