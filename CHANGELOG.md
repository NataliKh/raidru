# Changelog

## 3.0.0-alpha.3.3 — Planner UX Cleanup

- удалён неочевидный переключатель `Оригинал / RaidRU`;
- удалён связанный presentation mode из Planner/Arena;
- `↗ RaidPlan` остаётся единственным способом открыть оригинальную сцену для внешнего сравнения.


## 3.0.0-alpha.3.2 — RaidPlan Native Tokens

- исправлен `Number(null) => 0`, из-за которого role/raid-marker/mob tokens RaidPlan становились полностью прозрачными;
- native token CSS вынесен в null-safe тестируемый helper;
- `encounter`/`mechanic` получили отдельные renderer classes;
- внутренний `mob.lname` больше не рисуется как подпись без `attr.text`;
- добавлен regression на missing opacity и explicit opacity=0.

## 3.0.0-alpha.3.1 — RaidPlan Visual Fidelity

- новый pure TypeScript `@raidru/raidplan-core`;
- strict visible RaidPlan v2 conversion;
- URL/JSON import preview;
- append/replace через единую Store transaction;
- imported background/text/native vector rendering;
- regression fixtures для scene 3 freehand path и scene 4 off-canvas Fabric lines;
- Worker разрешает Vite dev/preview origin.
- deployment-safe palette assets через Vite `BASE_URL`;
- точнее восстановлены Fabric IText scale/lineHeight/font/origin;
- исходные RaidPlan role/marker assets + локальный fallback;
- explicit z-order; helper/duplicate text filtering;
- режимы «Оригинал / RaidRU», ссылка на исходную сцену и fidelity strip.


## 3.0.0-alpha.2 — Planner Core
- Added independent plans for Normal, Heroic and Mythic difficulties.
- Added explicit difficulty-switch behavior instead of silent map reuse.
- Added scene authoring: create, duplicate, delete, rename, duration and notes.
- Added object palette and arena drag/drop.
- Added selectable/editable arrows, lines, danger zones and soak zones.
- Added route authoring with draggable route points.
- Added selection inspector and 50-step undo/redo.
- Upgraded persisted state to schema v4 with migration from alpha.1 schema v3.
- Extracted pure planner mutations into `packages/planner-core`.

## 3.0.0-alpha.1 — Architecture Core
- Rebuilt the web layer around React, TypeScript and Vite.
- Centralized versioning and application state.
- Moved persistence to IndexedDB.
- Added non-destructive migration from RaidRU 2.x local data.
- Preserved current raid content, maps, scenes and timelines.
- Separated WCL/Bridge from the UI until a typed adapter is ready.
