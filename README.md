# RaidRU v0.8.17

## Встроенный импорт RaidPlan

- Пользователь вставляет только ссылку RaidPlan и нажимает «Импортировать».
- CORS, Browser Exporter, JSON и Worker route полностью скрыты из пользовательского интерфейса.
- Клиент RaidRU обращается только к внутреннему `/raidplan` endpoint собственного Cloudflare Worker.
- Импорт по-прежнему живёт в отдельной вкладке RaidPlan и не меняет основные сцены RaidRU.
- Share-ссылка не содержит импортированный приватный план.

## Новое в 0.8.16 — аккуратные вкладки наборов сцен

- Переделан внешний вид переключателя **RaidRU / RaidPlan**: теперь это компактная карточка с двумя равными вкладками, без налезания и визуального шума.
- Основной набор RaidRU и импортированный набор RaidPlan визуально разделены понятнее.
- Активная вкладка подсвечивается чище, отключённая RaidPlan выглядит аккуратнее.
- Вкладки адаптированы для узкой ширины и мобильного режима.

# RaidRU v0.8.16

Русскоязычный planner-first планировщик рейда WoW Midnight Season 2 — The Venomous Abyss.

## Новое в 0.8.14 — настоящий RaidPlan v2 import

Диагностика реального link-only плана показала фактический формат RaidPlan: `version: 2`, числовой `steps` и единый массив `nodes`, где сцена хранится в `meta.step`. Данные плана загружаются RaidPlan из `userdata.raidplan.io/<code>.json`.

- `raidplan-importer.js` теперь нативно понимает `{ code, version, revision, steps, nodes }`.
- `nodes` группируются по `meta.step` → сцены RaidRU.
- Координаты RaidPlan `meta.pos` переводятся из реального canvas (в проверенном плане 1200×675) в проценты RaidRU.
- Размеры/масштаб читаются из `meta.size + meta.scale`, поворот — из `meta.angle`.
- Поддержаны реальные node types RaidPlan: `arena`, `marker`, `mob`, `itext`, `circle`, `line`, `path`.
- Raid markers определяются по `attr.asset` (`star/circle/diamond/triangle/...`).
- Роли определяются по `game/wow/role/tank.svg`, `healer.svg`, `mdps.svg`, `rdps.svg`.
- `mob` использует `attr.lname/displayId`; известные существа сопоставляются с encounter-иконками RaidRU. Для Нек'зали отдельно распознаны основной босс, Latent Cultist и Drowned Echo.
- `line` с `endType: drawn` переносится как стрелка; `circle` — как зона; freehand `path` — как приближённая линия.
- Текстовые блоки больше не притягиваются внутрь маски арены: их раскладка вокруг комнаты сохраняется.
- Название сцены берётся из верхнего `itext`, а весь текст шага дополнительно попадает в note сцены.

## Получение link-only плана без публикации

RaidPlan CDN не разрешает браузеру GitHub Pages/Snippet прочитать JSON cross-origin, хотя сама вкладка RaidPlan уже загрузила его. Поэтому есть три пути:

1. **Browser Exporter v0.3** — сначала ищет настоящий v2-объект в React/Next state. Если он доступен, сразу скачивает JSON.
2. Если CORS мешает, exporter находит точный уже использованный `userdata.raidplan.io/...json?v=<revision>` и открывает его напрямую в новой вкладке. План не нужно переводить в Public.
3. Для настоящего импорта «вставил ссылку → готово» добавлен `tools/raidplan-proxy-worker-route.js`: route для собственного Cloudflare Worker. Он принимает только код плана, ничего не хранит и отвечает с `Cache-Control: private, no-store`.

`raidplan-importer.js` по ссылке сначала пробует userdata endpoint, затем `/raidplan` на RaidRU Worker, затем старый HTML fallback.

## Приватность

- Импортированные сцены хранятся в localStorage RaidRU.
- Browser Exporter не читает cookies/Authorization/passwords и не отправляет содержимое плана сторонним сервисам.
- Worker route не кэширует и не сохраняет тело плана.
- План не добавляется в готовые публичные пресеты RaidRU.
- Не используй «Поделиться» для плана, который не должен передаваться другим: share URL содержит данные текущей стратегии.

## Сохранено

- Heroic-only и Planner-first.
- `raidMaps / bossMaps` с mapID 2606/2607/2608/2609.
- Перетаскиваемые подписи механик и линии к ним.
- Ростер, классы/роли, raid markers, маршруты, зоны, маски арен, localStorage и импорт/экспорт.
- Русские NSRT voice notes и 5-секундные healer warnings для боссов с проверенным Heroic PTR timeline.
