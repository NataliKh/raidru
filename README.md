# RaidRU 3

**Текущая версия:** `3.0.0-alpha.3.3 — Planner UX Cleanup`

RaidRU 3 — чистая архитектурная ветка русскоязычного визуального планировщика рейдов World of Warcraft. Production `main` пока должен оставаться на стабильной 2.x-линии; разработка 3.x идёт отдельно в `raidru-3`.

## Что уже есть

### Architecture Core

- React + TypeScript + Vite;
- единый `AppStore` и один render tree;
- единая версия приложения;
- IndexedDB persistence;
- импорт старого локального состояния RaidRU;
- 8 боссов, существующие карты, сцены и таймлайны.

### Planner Core

- независимые планы Normal / Heroic / Mythic;
- создание, дублирование и удаление сцен;
- palette ролей, классов, raid markers и механик;
- drag/drop и прямое перемещение объектов;
- зоны, линии, стрелки и маршруты;
- inspector;
- undo/redo;
- pure domain mutations в `packages/planner-core`.

### RaidPlan Adapter — alpha.3

RaidPlan впервые подключён к новой архитектуре через отдельную границу:

```text
RaidPlan URL / JSON
   ↓
RaidPlanClient
   ↓
packages/raidplan-core
   ↓
BossDifficultyPlanState
   ↓
AppStore.applyExternalPlan()
   ↓
Planner / Viewer
```

Importer не имеет доступа к React/DOM. Он реализует strict visible RaidPlan v2: `nodes + meta.step`, fixed canvas, фильтрацию hidden/opacity0/scale0/unknown nodes, map-backed arena suppression, role/raid marker assets, `itext`, freehand path и Fabric off-canvas lines.

В Planner доступна кнопка **⇩ RaidPlan** с preview перед применением. Можно безопасно добавить импортированные сцены либо явно заменить план текущей сложности.

### Visual Fidelity — alpha.3.1

- palette assets больше не зависят от текущего URL страницы;
- импортированный IText сохраняет размер, scale, line-height, font, origin и rotation;
- role/raid markers предпочитают оригинальные RaidPlan CDN assets и имеют локальный fallback;
- explicit z-order сохраняется; helper/guide и дубли текста фильтруются;
- для импортированной сцены остаются ссылка на исходную сцену RaidPlan и диагностическая строка fidelity; отдельный режим **Оригинал / RaidRU** удалён как лишний.


### Native Tokens — alpha.3.2

После визуального сравнения с оригиналом найден renderer-баг: отсутствие `opacity` в RaidPlan token превращалось через `Number(null)` в CSS `opacity: 0`. Поэтому role markers, raid markers и mob portraits были импортированы, но полностью невидимы. Alpha.3.2 использует null-safe style metadata, сохраняет explicit opacity=0 и не рисует внутренний `mob.lname` как подпись без `attr.text`. Worker в этом релизе не менялся.

## Структура

```text
apps/
  web/                 React UI
  wcl-bridge/          browser bridge, пока отдельно
packages/
  shared-types/
  planner-core/
  raidplan-core/
  replay-core/
  mechanics-core/
workers/
  wcl/                 Cloudflare Worker, включая /raidplan
tests/
  fixtures/raidplan/   реальные regression fixtures
docs/
  architecture/
  releases/
```

## Локальный запуск

```bash
npm install
npm run typecheck
npm test
npm run dev
```

Vite dev server использует порт `5173`; Worker alpha.3 разрешает этот origin для локального URL-import RaidPlan.

Production build:

```bash
npm run build
```

## Проверка alpha.3

```bash
npm test
```

Regression база проверяет реальные проблемные случаи старого импортера:

- Scene 3 — freehand arrows из нескольких `path.attr.points`;
- Scene 4 — drawn Fabric lines частично за границами canvas;
- strict-visible fixture — unknown/hidden nodes не превращаются в лишние зоны.

Ручной checklist: `docs/QA-RAIDPLAN-ADAPTER.md`.
Архитектура: `docs/architecture/RAIDPLAN-ADAPTER.md`.

## Worker

Изменения обычного web-приложения не требуют redeploy Worker. Worker нужен при изменении `workers/wcl/src/index.js` или transport `/raidplan`.

Для alpha.3 Worker изменён: добавлены Vite dev/preview origins и новый version marker, поэтому перед проверкой URL-import его нужно один раз передеплоить привычным Wrangler workflow из `workers/wcl`.
