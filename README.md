# RaidRU v0.8.27

## RaidPlan hidden/helper geometry fix

- Hidden RaidPlan nodes (`meta.hidden`, `visible:false`) are no longer rendered.
- Editor helper/mask/clip/viewport nodes are ignored.
- Near-full-canvas unlabeled white helper shapes without explicit fill alpha no longer flood the map with an opaque white fill.
- Normal/Heroic/Mythic storage and separate RaidPlan tabs are unchanged.
- RaidPlan renderer: `native-v8-hidden-helper-safe`.

# RaidRU v0.8.27

## Исправление прозрачности фигур RaidPlan

- Раздельно импортируются `opacity`, `fillOpacity` и `strokeOpacity`.
- Поддержаны `alpha`, `globalAlpha`, `fillAlpha`, `strokeAlpha`, проценты 0–100 и alpha внутри `rgba()/hsla()/#RGBA/#RRGGBBAA`.
- Полупрозрачные белые/цветные зоны больше не становятся непрозрачными плитами поверх всей арены.
- Общая прозрачность объекта не смешивается с прозрачностью только заливки/обводки.
- Renderer: `native-v7-alpha-safe`; сохранённые RaidPlan-вкладки автоматически перечитываются.
- Normal / Heroic / Mythic и отдельные RaidPlan-вкладки сохранены.


## Критический фикс RaidPlan opacity

- Исправлен баг, при котором отсутствующее `opacity` (`null`) трактовалось как `0` и делало импортированные объекты невидимыми.
- Optional numeric metadata RaidPlan теперь проверяется null-safe для token/effect renderer.
- Существующие уже импортированные сцены исправляются самим новым renderer, без удаления данных.
- Раздельные Normal / Heroic / Mythic планы из 0.8.21–0.8.23 сохранены.

## 0.8.23 — RaidPlan visibility regression fix

- Исправлена регрессия 0.8.22: контейнеры RaidPlan tokens/effects снова имеют стабильные слои над картой.
- Убрана опасная попытка межтипового z-order, из-за которой текст, маркеры и NPC могли уходить под карту.
- Сохранено раздельное хранение Normal/Heroic/Mythic из 0.8.22.
- Renderer поднят до native-v5: сохранённые native-v4 импорты автоматически перечитываются из RaidPlan.
- Добавлена проверка целостности результата импорта и служебная статистика количества объектов по сценам.

# RaidRU v0.8.23

## RaidPlan fidelity + исправление регрессии сложностей

- RaidPlan больше не копируется между Normal/Heroic/Mythic через «Скопировать текущую карту». Импорт принадлежит только сложности, в которую его импортировали.
- Исправлена миграция 0.8.21: версия хранения сложностей больше не перезапускает старую миграцию вкладок RaidPlan.
- Назначение сложности фиксируется в момент нажатия «Импортировать» и передаётся импортёру явно.
- Renderer `native-v4`: общий порядок слоёв для фигур и объектов RaidPlan, сохранение source order/z-index.
- Добавлено распознавание крупных ability/spell объектов как карточек вместо растягивания маленькой иконки на весь bounding box.
- Сохраняются raw attr импортированных объектов для последующих улучшений совместимости.
- Удалён внутренний `test-rp.html`: тестовые данные пользовательского плана не должны попадать в публичный GitHub Pages билд.

## Новое в 0.8.21 — отдельные планы Normal / Heroic / Mythic

- Сцены и RaidPlan-импорты теперь хранятся отдельно для каждой сложности.
- При переключении сложности RaidRU предлагает открыть сохранённый набор, скопировать текущую карту или начать с чистой карты.
- Очистка/копирование затрагивает только выбранную сложность.
- RaidPlan импорт всегда привязывается к активному режиму рейда.
- Share URL не включает RaidPlan и не утаскивает планы других сложностей.
- Экспорт стратегии содержит только активную сложность; полный backup сохраняет всё.

## Новое в 0.8.20 — составные объекты RaidPlan

- Исправлен scalar `meta.scale`: маленькие spell/ability icons больше не раздуваются на четверть карты.
- Прямоугольники/квадраты больше не превращаются в овалы.
- Фигуры сохраняют fill/stroke/opacity/rotation и могут показывать встроенный текст (например `Sarg`).
- Размеры прямоугольников считаются отдельно по X/Y, без искажения aspect ratio.
- Добавлена поддержка `scaleX/scaleY`, scalar `scale`, z-index/opacity и object-fit для импортированных ассетов.
- Существующий импорт native-v2 автоматически обновляется до native-v3 через внутренний backend при наличии sourceCode.

# RaidRU v0.8.18

## RaidPlan import backend fix

- RaidPlan URL import теперь использует отдельный Worker `raidru-raidplan`, не старый WCL Worker.
- Пользовательский интерфейс не показывает CORS/Worker/Browser Exporter/JSON детали.
- Приватный RaidPlan импортируется только в локальную вкладку RaidPlan.
- Share URL не содержит импортированные RaidPlan scenes.

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