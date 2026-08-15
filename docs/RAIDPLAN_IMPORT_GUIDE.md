# RaidRU — руководство по импорту RaidPlan

> Документ для разработчиков и ИИ-агентов.  
> Актуально для RaidRU `0.8.37`, renderer: `native-v18-v2-canvas-line-endpoints`.

## 1. Цель импорта

Импорт RaidPlan в RaidRU должен **воспроизводить то, что пользователь реально видит в RaidPlan**, а не пытаться «догадаться», что означают внутренние записи JSON.

Главный принцип:

> **Visible-first / strict import:** импортировать только подтверждённо видимые и поддерживаемые объекты, сохраняя их исходную геометрию, порядок, прозрачность и координаты.

Это важнее, чем «импортировать как можно больше».

Исторически большинство проблем импорта появлялось из-за обратного подхода: неизвестный объект автоматически превращался в круг, прямоугольник или зону. В результате RaidRU показывал служебные маски, bounding box, скрытые Fabric-объекты и внутреннюю геометрию арены, которых пользователь RaidPlan не видел.

---

## 2. Где находится логика

Основной адаптер:

```text
raidplan-importer.js
```

Связанные файлы:

```text
app.js                  — версия renderer и отображение импортированных сцен
index.html              — cache busting версии JS/CSS
sw.js                   — service worker cache
tools/                  — Worker/browser export helpers
test-rp.html            — ручные тесты
test-rp-debug.html      — диагностика
test-rp-scene3-paths.json
test-rp-scene4-lines.json
test-rp-offcanvas-vector.md
```

Импорт RaidPlan специально изолирован от основной логики `app.js`, потому что формат RaidPlan не является стабильным публичным API и может меняться.

---

# 3. Общий pipeline

Импорт проходит примерно так:

```text
RaidPlan URL
   ↓
RaidRU Worker
   ↓
raw JSON
   ↓
findPlanRoot()
   ↓
findSteps()
   ↓
flattenItems()
   ↓
coordTransform()
   ↓
convertItem()
   ↓
RaidRU scene
   ↓
normalizeScene()
   ↓
RaidPlan tab в выбранной сложности
```

Основная точка входа:

```js
RaidPlanImporter.fetchUrl(...)
RaidPlanImporter.convert(...)
RaidPlanImporter.applyConverted(...)
```

---

# 4. Получение JSON RaidPlan

Публичная страница RaidPlan не должна читаться напрямую из браузера RaidRU.

Причина: `userdata.raidplan.io` не обязан разрешать CORS для GitHub Pages.

Используется backend endpoint:

```text
https://raidru-raidplan.raidru-wcl.workers.dev/raidplan
```

Пример:

```text
GET /raidplan?code=9v3wssyjja56rttz
```

На клиенте endpoint берётся из:

```js
window.RAIDRU_RAIDPLAN_API
```

или используется дефолтный Worker URL.

### Нельзя

- показывать пользователю сообщения про CORS;
- просить пользователя вручную искать `userdata endpoint`;
- делать прямой `fetch()` к RaidPlan из GitHub Pages как основной путь.

Пользователь должен видеть либо корректно импортированный план, либо обычное понятное сообщение об ошибке.

---

# 5. Определение корня плана

Формат ответа Worker может быть обёрнут:

```json
{
  "data": {
    "plan": {}
  }
}
```

или иметь другую структуру.

Поэтому `findPlanRoot()` не привязан к одному пути.

Он:

1. рассматривает несколько известных root-кандидатов;
2. рекурсивно просматривает вложенные объекты;
3. оценивает кандидаты через `scoreCandidate()`;
4. выбирает структуру, наиболее похожую на RaidPlan.

Для настоящего RaidPlan v2 сильный сигнал:

```json
{
  "code": "...",
  "version": 2,
  "revision": 8,
  "steps": 6,
  "nodes": []
}
```

## Правило для новых агентов

Нельзя менять `findPlanRoot()` на:

```js
raw.data.plan
```

без fallback-механизма.

---

# 6. RaidPlan v2: самая важная структура

RaidPlan v2 хранит сцены не отдельными массивами, а единым:

```json
"nodes": [...]
```

Номер сцены находится здесь:

```json
node.meta.step
```

Например:

```json
{
  "type": "marker",
  "meta": {
    "step": 2
  }
}
```

означает визуальный объект на **третьей сцене**.

`findSteps()` создаёт виртуальные шаги:

```js
{
  __raidplanV2: true,
  index: i,
  nodes: [...]
}
```

---

# 7. Strict Visible Import

Для RaidPlan v2 действует whitelist.

Поддерживаемые базовые типы:

```text
arena
itext
marker
mob

circle
ellipse
rect
rectangle
square
polygon

line
path
cone
wedge
sector

player
character
member
assignment
slot
role
class
job

icon
ability
spell
status
effect
aura
sticker
encountericon
tooltip
```

Неизвестный v2-объект **не должен автоматически отрисовываться**.

Функция:

```js
strictV2NodeAllowed()
```

### Почему

RaidPlan хранит в `nodes` не только визуальные элементы, но и редакторские/внутренние записи.

Если неизвестный объект преобразовывать в обычную `zone`, появляются:

- огромные белые прямоугольники;
- серые овалы;
- случайные круги;
- невидимые helper-объекты;
- bounding box вместо рисунка.

### Правильное поведение

Если тип неизвестен:

```text
skip
```

и записать его в:

```js
report.unsupported
```

---

# 8. Невидимые объекты

Функция:

```js
hiddenRaidPlanNode()
```

Объект не импортируется, если выполняется хотя бы одно условие.

## 8.1 hidden / visible

Проверяются варианты:

```text
hidden = true
isHidden = true
disabled = true

visible = false
display = none
```

в нескольких местах:

```text
meta
attr
data
root
```

## 8.2 opacity = 0

RaidPlan/Fabric иногда не ставит:

```json
"visible": false
```

а делает:

```json
"opacity": 0
```

Такой объект визуально отсутствует и должен быть отброшен.

## 8.3 scale = 0

Невидимый объект также может выглядеть так:

```json
"scale": {
  "x": 0,
  "y": 0
}
```

или:

```text
scaleX = 0
scaleY = 0
```

Он тоже не импортируется.

## 8.4 editor helpers

Отбрасываются служебные сущности:

```text
clip
clipPath
mask
viewport
hitbox
selection
helper
guide
interaction
```

---

# 9. Прозрачность

Нельзя сводить всё к одному `opacity`.

Раздельно учитываются:

```text
opacity
fillOpacity
strokeOpacity
```

RaidPlan/Fabric также может хранить альфу прямо в цвете:

```text
rgba(...)
hsla(...)
#RRGGBBAA
#RGBA
```

Причина: если потерять `fillOpacity`, полупрозрачная механика может превратиться в сплошной белый/чёрный объект.

Связанные функции:

```js
alphaNumber()
colorEmbeddedAlpha()
deepAlpha()
shapeAlpha()
```

---

# 10. Арена и background

`arena` — особый объект.

В RaidPlan arena может содержать:

```json
{
  "attr": {
    "raid": "wow.midnight.venomabyss",
    "boss": "01.nakzali",
    "map": "new"
  }
}
```

Из этого строится background RaidPlan CDN.

Функция:

```js
raidPlanBackground()
```

## Главное правило

Если у сцены есть нормальный map background:

> **arena geometry не импортируется поверх карты как обычная zone.**

Именно нарушение этого правила раньше создавало огромный серый овал поверх карты.

Проверяется в:

```js
arenaVisualEffect()
```

Если background существует:

```js
return null
```

а внутренняя arena geometry считается backing/mask geometry.

## Исключение

Если это действительно blank/custom arena без карты, её собственная форма может быть визуально важной и тогда импортируется.

---

# 11. Размер canvas

Для RaidPlan v2 стандартный planner board:

```text
1200 × 675
```

Функция:

```js
canvasSize()
```

Сначала используются явные canvas-поля, если они существуют.

Если `arena.meta.size` выглядит как 16:9 board — он может использоваться как canvas.

Если arena квадратная/круглая, например:

```text
600 × 600
```

это может быть **сама custom arena**, а не размер всей доски.

В таком случае fallback:

```text
1200 × 675
```

---

# 12. Координаты: критическое правило RaidPlan v2

Функция:

```js
coordTransform()
```

Для RaidPlan v2 координаты объектов находятся в системе planner canvas.

При canvas:

```text
1200 × 675
```

преобразование:

```text
xPercent = x / 1200 × 100
yPercent = y / 675 × 100
```

## Никогда не использовать fit-to-content для RaidPlan v2

Объекты RaidPlan могут легально находиться за пределами canvas.

Например:

```text
x < 0
y < 0
```

Если включить `fit` по min/max всех объектов, один декоративный объект за границей:

- сдвинет весь рейд;
- изменит масштаб сцены;
- утащит босса из центра;
- разрушит совпадение с оригиналом.

Поэтому для v2:

```text
mode = raidplan-v2-canvas
```

и transform **не зависит от bounding box объектов**.

---

# 13. Объекты вне canvas

`path` и `line` могут быть намеренно частично или полностью за границей карты.

Это нормальное поведение RaidPlan.

Для них нельзя делать:

```js
clamp(x, 0.5, 99.5)
clamp(y, 0.5, 99.5)
```

Иначе объект «прилипает» к краю и становится видимым там, где в оригинале его почти нет.

Функция:

```js
pointFor()
```

Для:

```text
path
line
```

координата сохраняется как есть.

Обрезку выполняет viewport карты.

---

# 14. Текст (`itext`)

Текст нельзя классифицировать по словам внутри текста.

Например инструкция:

```text
"Танки стоят..."
```

не означает, что весь `itext` является объектом типа `tank`.

Для v2 текст распознаётся по:

```text
type = itext
```

и остаётся текстом.

Сохраняются:

```text
text
fontSize
textAlign
verticalAlign
fill
position
width / height
scale
```

## Размер текста

Для `itext` сначала следует использовать реальные размеры текстового объекта:

```text
attr.width / attr.height
```

если они доступны.

`meta.size` иногда является размером control/bounding box и может давать неправильный wrapping.

Функция:

```js
nativeSize()
```

---

# 15. Название сцены

Функция:

```js
stepName()
```

Для v2, если отдельного title нет:

1. найти все `itext`;
2. отсортировать по `meta.pos.y`;
3. взять верхний текстовый блок;
4. первую строку использовать как название сцены.

Это позволяет получать:

```text
"1 Фаза - Адды. фаза до 50% здоровья босса"
```

вместо:

```text
RaidPlan · сцена 3
```

---

# 16. Заметки сцены

Текстовые объекты на карте **не являются автоматически note**.

Для RaidPlan v2 заметки шага читаются из:

```text
step_notes_raw[index]
```

Функции:

```js
stepNote()
noteFrom()
```

---

# 17. Маркеры

Raid marks определяются прежде всего через asset:

```text
game/wow/raid/star.png
game/wow/raid/circle.png
game/wow/raid/diamond.png
game/wow/raid/triangle.png
...
```

Функция:

```js
markerKey()
```

Соответствия:

```text
star      → ★
circle    → ●
diamond   → ◆
triangle  → ▲
moon      → ☾
square    → ■
cross     → ✕
skull     → ☠
```

Нельзя определять raid marker только по цвету или тексту.

---

# 18. Роли

Роли v2 определяются через asset:

```text
game/wow/role/tank.svg
game/wow/role/healer.svg
game/wow/role/mdps.svg
game/wow/role/rdps.svg
```

Соответствия:

```text
tank.svg    → tank
healer.svg  → healer
mdps.svg    → melee
rdps.svg    → ranged
```

Функция:

```js
roleType()
```

Это надёжнее, чем искать слова `tank`, `healer`, `рдд` в произвольном тексте.

---

# 19. Mob / boss

`type: "mob"` импортируется как encounter token, если известен mapping.

Для Nek'zali сейчас есть специальные `displayId`:

```text
142077 → Nek'zali
143588 → Drowned Echo
143999 → cultist
```

Функция:

```js
mobEncounter()
```

Для остальных используется:

```js
nearestEncounter()
```

по имени/alias.

---

# 20. Shapes

В v2:

```text
circle
ellipse
rect
rectangle
square
polygon
```

преобразуются в:

```text
zone
```

только если имеют видимую paint-информацию или label.

Учитываются:

```text
fill
stroke
strokeWidth
opacity
fillOpacity
strokeOpacity
rotation
scale
```

---

# 21. Защита от больших белых helper-зон

Функция:

```js
suppressUnresolvedBackdropFill()
```

Ненадписанная почти полноэкранная белая фигура без явной fill alpha подозрительна.

Если она не имеет semantic hints типа:

```text
danger
damage
safe
soak
stack
aoe
mechanic
```

её fill может быть подавлен.

Это safety-net, а не замена strict whitelist.

---

# 22. Freehand `path` — важнейший частный случай

RaidPlan v2 freehand рисунок может выглядеть так:

```json
{
  "type": "path",
  "attr": {
    "stroke": "#ffffff",
    "strokeWidth": 4,
    "points": [
      5787, 4688,
      5794, 4688,
      5807, 4688
    ]
  },
  "meta": {
    "pos": {"x": 667.439, "y": 510.056},
    "size": {"w": 221.708, "h": 76.004},
    "scale": {"x": 0.75, "y": 0.81}
  }
}
```

### Важное наблюдение

`attr.points` здесь **не находятся в системе canvas 1200×675**.

Это high-resolution brush coordinates.

Поэтому нельзя использовать эти значения как абсолютные координаты сцены.

Правильная логика:

1. сохранить форму по `attr.points`;
2. построить SVG polyline/path:
   ```text
   M x1 y1
   L x2 y2
   L x3 y3
   ...
   ```
3. вычислить local viewBox по min/max raw points;
4. использовать:
   ```text
   meta.pos
   meta.size
   meta.scale
   ```
   для размещения всего SVG-объекта на RaidPlan canvas.

Функции:

```js
flatRaidPlanPathPoints()
raidPlanSvgPath()
```

## Почему это важно

Если использовать только `meta.size`, получается bounding box:

```text
белый круг
белая капсула
прямоугольник
```

вместо нарисованной стрелки.

Если использовать raw points как canvas coordinates — стрелка уедет далеко за карту.

---

# 23. Вырожденный freehand path

RaidPlan может хранить:

```json
"points": [
  4010,
  1818,
  4010,
  1818
]
```

Это одна повторяющаяся точка.

Такой объект визуально ничего полезного не содержит.

Функция:

```js
degenerateRaidPlanPath()
```

Если:

```text
width < 0.01
height < 0.01
```

объект пропускается.

Иначе он может превратиться в случайный белый штрих.

---

# 24. `line` — не то же самое, что `path`

RaidPlan v2 может хранить нарисованную стрелку как:

```json
{
  "type": "line",
  "attr": {
    "stroke": "#ffffff",
    "strokeWidth": 6,
    "startType": "none",
    "endType": "drawn",
    "points": [
      -171.208,
      23.744,
      171.208,
      -23.744
    ]
  }
}
```

`endType: "drawn"` означает стрелку.

---

# 25. Fabric `line` и absolute endpoints

Критический случай найден на RaidPlan:

```text
9v3wssyjja56rttz
scene 4
```

Для line:

```text
meta.pos.x ≈ min(attr.points.x) - strokeWidth / 2
meta.pos.y ≈ min(attr.points.y) - strokeWidth / 2

meta.size.w ≈ maxX - minX
meta.size.h ≈ maxY - minY
```

Это характерная подпись Fabric line.

В таком случае:

> `attr.points` являются настоящими endpoints линии в координатах canvas.

Нельзя использовать `meta.pos` как центр линии.

Функция:

```js
fabricLineGeometry()
```

Алгоритм:

```text
points
   ↓
bbox
   ↓
сверка bbox с meta.pos / meta.size
   ↓
если совпадает → absolute Fabric endpoints
   ↓
map endpoint A
map endpoint B
   ↓
center
length
rotation = atan2(dy, dx)
```

---

# 26. Почему scene 4 раньше ломала всю сцену

Реальные данные содержат линии около:

```text
(0, 0)
```

с отрицательными `meta.pos`.

Старый importer видел отрицательные координаты и решал:

```text
"это нестандартная система координат"
```

после чего включал:

```text
fit
```

по min/max всех объектов.

Результат:

- босс уезжал из центра;
- все маркеры меняли положение;
- стрелка оказывалась внутри карты;
- вся сцена переставала совпадать с RaidPlan.

Правильное решение:

> Для RaidPlan v2 canvas является источником истины.  
> Off-canvas decoration не меняет transform.

---

# 27. Проверочный пример scene 4

Для Nek'zali:

```text
meta.pos ≈ (599.886, 344.487)
canvas = 1200 × 675
```

Получаем:

```text
x ≈ 49.99%
y ≈ 51.04%
```

То есть босс обязан находиться практически в центре.

Это полезный smoke-test transform.

Если после изменения importer босс оказывается, например:

```text
70% X
```

ошибка почти наверняка находится в coordinate transform, а не в mob renderer.

---

# 28. Rotation

Функция:

```js
readRotation()
```

RaidPlan/Fabric может хранить rotation в:

```text
attr.rotation
attr.rot
attr.angle

data.*
style.*
transform.*

root
meta.*
```

Нельзя смотреть только:

```text
meta.angle
```

Также старые форматы могли хранить небольшое значение как radians.

Поэтому значения около:

```text
[-2π, +2π]
```

могут переводиться в degrees.

---

# 29. Scale

Функция:

```js
nativeScale()
```

Поддерживаются:

```text
meta.scale.x / y
attr.scale.x / y
data.scale.x / y

meta.scaleX / scaleY
attr.scaleX / scaleY
data.scaleX / scaleY

scaleX / scaleY
```

Нельзя предполагать, что scale всегда находится в одном месте.

---

# 30. Z-order

Порядок объектов важен.

При импорте сохраняется:

```text
meta.zIndex
meta.z
zIndex
z
```

Если явного значения нет:

```text
sourceOrder
```

Используется исходный порядок в `nodes`.

Не сортировать объекты случайно по type.

---

# 31. Разделение RaidRU и RaidPlan сценариев

Импортированные сцены хранятся отдельно:

```js
bs.raidPlanScenes
```

Оригинальные сценарии RaidRU не должны перезаписываться.

Timeline:

```js
bs.raidPlanTimelineV3
```

Metadata:

```js
bs.raidPlanImport
```

Источник сценария:

```text
raidplan
```

---

# 32. Difficulty

Импорт должен применяться к текущей выбранной сложности:

```text
normal
heroic
mythic
```

Выбранная difficulty сохраняется в:

```js
bs.raidPlanImport.difficulty
```

Нельзя импортировать всегда в Heroic.

---

# 33. Backup перед новым импортом

Если RaidPlan tab уже существует, перед заменой сохраняется backup:

```js
state._raidPlanTabBackups
```

В backup входят:

```text
scenes
timelineV3
importMeta
difficulty
createdAt
```

Это нужно сохранять при будущих рефакторингах.

---

# 34. Renderer version

Ключевая константа:

```js
RAIDPLAN_RENDER_VERSION
```

в `app.js`.

И renderer в import metadata:

```js
bs.raidPlanImport.renderer
```

Текущая версия:

```text
native-v18-v2-canvas-line-endpoints
```

## Когда менять renderer

Если изменение меняет семантику импорта:

- coordinate transform;
- path;
- line;
- visibility filter;
- arena;
- sizes;
- positions;
- object type mapping;

renderer необходимо поднять.

Это заставляет старый импорт автоматически перестроиться.

---

# 35. Silent refresh старого импорта

Функция:

```js
refreshCurrentIfLegacy()
```

Если:

```text
raidPlanImport.renderer != current renderer
```

и известен source code RaidPlan:

1. заново загрузить JSON;
2. выполнить `convert()`;
3. заменить RaidPlan tab;
4. не переключать пользователю экран.

Используется `sessionStorage` guard, чтобы не запускать refresh бесконечно.

При смене renderer нужно также менять suffix guard:

```text
-0837
```

---

# 36. Cache busting

После изменения importer недостаточно поменять только:

```text
raidplan-importer.js
```

Нужно синхронно обновить:

```text
raidplan-importer.js VERSION
app.js RAIDPLAN_RENDER_VERSION
index.html ?v=
sw.js CACHE
sw.js asset ?v=
README.md current version
```

Пример:

```text
index.html:
raidplan-importer.js?v=0.8.37
app.js?v=0.8.37

sw.js:
raidru-v0837-...
```

Иначе GitHub Pages может уже содержать новый файл, а браузер продолжит использовать старую копию service worker.

---

# 37. GitHub Pages и Worker — это разные deploy

Статический RaidRU:

```text
index.html
app.js
raidplan-importer.js
styles.css
assets/
```

деплоится через GitHub Pages после:

```bash
git push
```

Cloudflare Worker:

```text
src/
wrangler.toml
```

деплоится отдельно.

Не запускать Worker deploy, если менялся только importer frontend.

---

# 38. Диагностический JSON — лучший способ искать баг

Если screenshot показывает неверный объект, **не надо угадывать его тип**.

Нужно получить raw nodes конкретной сцены.

Минимум сохранить:

```json
{
  "code": "...",
  "scene": 3,
  "plan": {
    "version": 2,
    "revision": 8
  },
  "nodes": []
}
```

Для каждого подозрительного объекта важны:

```text
type
attr
meta
```

Особенно:

```text
attr.points
attr.path
attr.d
attr.stroke
attr.fill
attr.strokeWidth
attr.opacity
attr.startType
attr.endType

meta.step
meta.pos
meta.size
meta.scale
meta.angle
meta.hidden
meta.origin
```

---

# 39. Сначала определять реальный тип, потом писать fix

Правильный порядок расследования:

```text
1. Screenshot оригинала RaidPlan
2. Screenshot RaidRU
3. raw JSON этой сцены
4. найти подозрительный node
5. понять систему координат node
6. найти точку преобразования в importer
7. добавить regression fixture
8. только после этого менять renderer
```

Неправильный порядок:

```text
"похоже на стрелку → наверное line"
"не помогло → наверное SVG path"
"не помогло → наверное rotation"
```

Именно такой guessing раньше привёл к нескольким итерациям исправлений одного и того же объекта.

---

# 40. Регрессионные кейсы

## Case A — scene 3: freehand arrows

Plan:

```text
https://raidplan.io/plan/9v3wssyjja56rttz#3
```

Fixture:

```text
test-rp-scene3-paths.json
```

На сцене две белые freehand стрелки.

В JSON они состоят из нескольких:

```text
type = path
attr.points = high-resolution brush coordinates
```

Ожидание:

- не white capsule;
- не circle;
- не bounding rectangle;
- форма совпадает с RaidPlan;
- stroke остаётся белым;
- arrow pieces сохраняют relative geometry.

---

## Case B — scene 4: off-canvas drawn lines

Plan:

```text
https://raidplan.io/plan/9v3wssyjja56rttz#4
```

Fixtures:

```text
test-rp-scene4-lines.json
test-rp-offcanvas-vector.md
```

Стрелка состоит из:

```text
type = line
endType = drawn
```

части лежат около `(0,0)` и частично находятся за canvas.

Ожидание:

- transform сцены остаётся `1200×675`;
- Nek'zali остаётся около центра;
- line не clamp-ится внутрь;
- видна только та часть стрелки, которая попадает в viewport.

---

# 41. Acceptance checklist после изменения importer

Перед merge/push агент должен проверить:

## Видимость

- [ ] hidden objects не появились
- [ ] opacity=0 не появились
- [ ] scale=0 не появились
- [ ] helper/mask/clip не появились
- [ ] неизвестные v2 nodes не стали зонами

## Arena

- [ ] background RaidPlan отображается
- [ ] arena mask не наложилась поверх background
- [ ] blank/custom arena по-прежнему поддерживается

## Coordinates

- [ ] RaidPlan v2 использует canvas transform
- [ ] center boss остаётся в центре
- [ ] off-canvas path/line не clamp-ятся внутрь
- [ ] отрицательные декоративные координаты не включают fit-mode

## Text

- [ ] текст не превратился в роль
- [ ] wrapping примерно совпадает
- [ ] fontSize сохранён
- [ ] название сцены взято из верхнего heading

## Markers / roles

- [ ] raid markers совпадают
- [ ] tank/healer/mdps/rdps совпадают
- [ ] scale маркеров соответствует оригиналу

## Vector

- [ ] scene 3 freehand arrows корректны
- [ ] scene 4 off-canvas line корректна
- [ ] degenerate path не рисуется
- [ ] stroke/fill alpha сохранены

## State

- [ ] импорт записан в выбранную difficulty
- [ ] RaidRU scenarios не затёрты
- [ ] backup старого RaidPlan tab создан
- [ ] timeline перестроен

## Version / cache

- [ ] VERSION обновлён
- [ ] RAIDPLAN_RENDER_VERSION обновлён
- [ ] renderer metadata обновлён
- [ ] legacy refresh guard обновлён
- [ ] index.html `?v=` обновлён
- [ ] sw.js CACHE обновлён
- [ ] sw.js asset versions обновлены
- [ ] README version обновлена

## Syntax

- [ ] `node --check raidplan-importer.js`
- [ ] `node --check app.js`
- [ ] `node --check sw.js`

---

# 42. Как добавлять поддержку нового RaidPlan node

Предположим, появился:

```text
type = "newThing"
```

Не добавлять его сразу в универсальную zone.

Шаги:

1. Получить raw node.
2. Найти screenshot, где он точно виден.
3. Проверить:
   - position;
   - size;
   - scale;
   - rotation;
   - opacity;
   - fill/stroke;
   - asset;
   - parent/group semantics;
   - off-canvas behavior.
4. Добавить тип в `strictV2NodeAllowed()`.
5. Определить RaidRU representation:
   ```text
   token
   zone
   line
   arrow
   cone
   icon
   text
   ```
6. Добавить dedicated conversion.
7. Создать regression JSON.
8. Проверить, что новые правила не расширяют импорт unknown nodes.
9. Поднять renderer version.

---

# 43. Что нельзя делать

## Нельзя: unknown → zone

```js
if (unknown) {
  return zone(...)
}
```

## Нельзя: все координаты clamp

```js
x = clamp(x, 0, 100)
y = clamp(y, 0, 100)
```

для vector objects.

## Нельзя: v2 fit-to-content

```text
min(all x/y) → max(all x/y) → fit
```

## Нельзя: attr.points всегда считать canvas points

Для `path` они могут быть brush coordinates.

## Нельзя: meta.pos всегда считать center

Для Fabric `line` это может быть bounding-box top-left.

## Нельзя: meta.size всегда считать canvas

Квадратная custom arena — не обязательно planner board.

## Нельзя: любой белый объект считать механикой

Он может быть mask/helper/backdrop.

## Нельзя: чинить по screenshot без raw node

Screenshot показывает симптом, JSON показывает причину.

---

# 44. Полезная стратегия для ИИ-агента

Когда приходит новый баг импорта, ответ должен быть построен так:

### Сначала

```text
Что конкретно отличается?
```

Например:

```text
"большой серый овал отсутствует в RaidPlan"
```

### Затем

```text
Какой raw node создаёт этот объект?
```

### Затем

```text
Почему importer считает его видимым?
```

### И только затем

```text
Какое минимальное правило исправляет класс ошибки?
```

Предпочтительно исправлять **класс ошибок**, а не один plan ID.

Пример хорошего правила:

> Map-backed `arena` не должна превращаться в visible zone.

Пример плохого правила:

```js
if (plan.code === '9v3wssyjja56rttz') hideObject(...)
```

---

# 45. Источник истины при расхождениях

При конфликте между:

```text
внутренним JSON
догадкой importer
визуальным RaidPlan
```

для visible import источником истины является:

> **то, что реально показывает RaidPlan пользователю**, при условии что raw JSON позволяет объяснить это поведение.

Цель RaidRU — не визуализировать все внутренние данные RaidPlan.

Цель — импортировать **видимый план**.

---

# 46. Короткая памятка

```text
RaidPlan v2 = nodes + meta.step

unknown node → SKIP
hidden / opacity0 / scale0 → SKIP
map background + arena → background only
v2 coordinates → fixed canvas, no fit
path.attr.points → local brush geometry
line.attr.points → check Fabric endpoint signature
path/line off canvas → preserve
itext → text, never role by wording
role/raid marker → prefer asset
update renderer + cache after semantic changes
always add regression fixture
```

---

# 47. Текущие эталонные файлы

```text
raidplan-importer.js
test-rp-scene3-paths.json
test-rp-scene4-lines.json
test-rp-offcanvas-vector.md
```

Для дальнейшей разработки импортера эти файлы должны рассматриваться как обязательная regression-база.

---

# 48. Критерий готовности

Импорт считается корректным не тогда, когда JSON «успешно распарсился».

Он считается корректным, когда:

> При последовательном переключении сцен RaidRU визуально воспроизводит RaidPlan без лишних объектов, без потерянных видимых объектов и без глобального смещения композиции.

