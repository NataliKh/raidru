# WCL Bridge in RaidRU 3

This directory preserves the 2.2.1 browser bridge while RaidRU 3's integration boundary is being rebuilt.
It is intentionally **not imported by `apps/web` in alpha.2**.

The next WCL milestone must expose a typed adapter and return normalized Replay data to `packages/replay-core`.
No UI component may call WCL or parse ReplaySegment directly.
