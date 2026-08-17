# Migration from RaidRU 2.x

RaidRU 3 never overwrites the old `raidru-standalone` localStorage key.

On first launch, if that key exists, the app shows a migration banner. The migration copies data into the RaidRU 3 IndexedDB database (`raidru3`) and records `legacyImportedAt`.

Currently migrated defensively:
- boss favorites and progress;
- boss notes;
- current scenes/tokens/effects/routes;
- `timelineV3`;
- roster;
- selected difficulty plan where present.

Replay blobs are intentionally not migrated in alpha.2. They will move into a dedicated Replay repository after the WCL integration is rebuilt.

Because the old key is not removed, reverting to RaidRU 2.x remains possible during the alpha period.
