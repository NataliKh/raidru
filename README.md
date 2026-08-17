# RaidRU 3

Russian World of Warcraft raid tactics and visual planning tool.

**Current development build:** `3.0.0-alpha.2 — Planner Core`

This branch is the clean rewrite of RaidRU. Production `main` should remain on the stable 2.x line until RaidRU 3 reaches feature parity and passes real import fixtures.

## What alpha.2 contains

Planner Core is now a real editor rather than a viewer with draggable tokens:

- independent Normal / Heroic / Mythic plans;
- explicit difficulty-switch choices: open existing, copy current, or clear target map;
- scene create / duplicate / delete / rename / duration / notes;
- palette with roles, classes, raid markers, mechanic icons and geometric effects;
- drag & drop from palette to arena and direct dragging on the map;
- arrows, lines, danger/soak zones and editable size/rotation;
- routes with click-to-add points and draggable route points;
- selection inspector for scene/object/effect/route properties;
- undo/redo with keyboard shortcuts (`Ctrl+Z`, `Ctrl+Y`);
- schema v4 with automatic migration from the alpha.1 schema v3;
- pure planner mutations extracted into `packages/planner-core`, so AppStore owns transactions/history while domain changes stay testable and UI-independent;
- IndexedDB persistence and RaidRU 3 backup import/export.

RaidPlan and WCL are still deliberately disconnected from the UI. They will be attached through typed adapters after Planner Core is stable.

## Run locally

```bash
npm install
npm run typecheck
npm test
npm run dev
```

Production build:

```bash
npm run build
```

The Vite base path is `/raidru/` for GitHub Pages.

## Repository layout

```text
apps/web            React application
apps/wcl-bridge     preserved browser bridge, not wired in alpha.2
workers/wcl         preserved Worker, not wired in alpha.2
packages/shared-types
packages/planner-core
packages/replay-core
packages/mechanics-core
packages/raidplan-core
docs/architecture
docs/migration
docs/releases
```

Read `docs/architecture/ARCHITECTURE.md` before adding features. New code must not recreate the 2.x patch-chain pattern.

## Git workflow

Keep production `main` intact:

```bash
git switch raidru-3
# replace branch contents with this archive, preserving .git
git add -A
git commit -m "RaidRU 3 alpha.2 Planner Core"
git push origin raidru-3
```

Do not merge to `main` until the alpha passes real RaidPlan/WCL fixtures and the production checklist.
