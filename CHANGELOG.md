# Changelog

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
