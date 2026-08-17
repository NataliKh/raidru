# RaidRU 3 Architecture

## Goals

RaidRU 3 removes the patch-chain architecture where `app.js`, `workspace-*`, `wcl-*`, `navigation-*` and `viewer-*` could all mutate the same DOM and state.

The web application has one state model, one version source, one rendering tree, and explicit integration boundaries.

## Dependency direction

```text
pages / components
       ↓
features
       ↓
app store + domain model
       ↓
storage repositories / integration adapters
       ↓
external systems (IndexedDB, WCL, RaidPlan, browser bridge)
```

A lower layer never imports a page/component.

## Rules

1. `apps/web/src/app/version.ts` is the only UI version source.
2. Components never write directly to `localStorage` or IndexedDB.
3. WCL parsing never happens in Map/Timeline/Planner components.
4. RaidPlan parsing never happens in UI components.
5. Replay is normalized once in `packages/replay-core` and then consumed by Map, Timeline and Mechanics.
6. Large data belongs in IndexedDB. `localStorage` is only read by the 2.x migration adapter.
7. Built-in tactics/scenes are source data, not mutable globals.
8. Every future external adapter must have a real fixture from production data before it is wired into the UI.

## State ownership

`RaidruState` owns:
- selected boss, page and difficulty;
- per-boss progress, notes, scenes and timeline;
- global roster;
- migration marker.

The React tree subscribes to one `AppStore`. Updates are immutable and persisted by a repository.

## Current alpha.1 scope

Implemented: app shell, eight bosses, current visual maps, tactics, scene viewer, draggable planner tokens, timeline, roster, notes, IndexedDB persistence, backup import/export and defensive migration from `raidru-standalone`.

Not yet wired: RaidPlan import, WCL Replay/Mechanics, scenario authoring tools, route editing and live sharing.
