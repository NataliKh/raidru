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
8. Every external adapter must have a real fixture from production data before it is wired into the UI.
9. Planner mutations go through `AppStore`; components do not mutate scene arrays directly.
10. A difficulty owns its own `BossDifficultyPlanState`. Switching difficulty never silently overwrites another plan.
11. Drag gestures create one history checkpoint, not hundreds of undo entries.
12. UI-only selection/tool state stays local to Planner components and is not persisted as raid data.

## Planner model

```text
BossPlanState
├─ favorite / progress / note
└─ difficultyPlans
   ├─ normal
   ├─ heroic
   └─ mythic
      ├─ scenes[]
      │  ├─ tokens[]
      │  ├─ effects[]
      │  └─ routes[]
      └─ timeline[]
```

`SceneToken`, `SceneEffect` and `SceneRoute` all have stable IDs. This is required for selection, undo/redo, future collaboration and safe RaidPlan import.

## History

`AppStore` owns a bounded 50-step in-memory history; `packages/planner-core` remains pure and history-agnostic. History is intentionally not persisted. Continuous pointer movement is wrapped in a gesture transaction so a drag operation is undone in one step.

## Difficulty switching

The UI always asks before switching to another difficulty:

- **Open existing** — keeps the target difficulty untouched.
- **Copy current** — replaces the target with a deep copy of the current plan.
- **Clear target map** — keeps target scenes/timeline but removes tokens, effects and routes.

This replaces the ambiguous shared-map behavior from RaidRU 2.x.

## Current alpha.2 scope

Implemented: application shell, eight bosses, visual maps, tactics, independent difficulty plans, full scene management, object palette, arrows/zones, route authoring, drag/drop, selection inspector, undo/redo, timeline, roster, notes, IndexedDB persistence, backup import/export and defensive migration from both RaidRU 2.x and RaidRU 3 alpha.1 schema v3.

Not yet wired: RaidPlan import, WCL Replay/Mechanics, multi-select, live collaboration/sharing.
