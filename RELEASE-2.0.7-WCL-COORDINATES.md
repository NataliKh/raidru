# RaidRU 2.0.7 — WCL Coordinate Geometry Fix

Fixes the mismatch between RaidRU Replay positions and the official Warcraft Logs Replay.

## Root cause
Older builds normalized the minimum/maximum X and Y of a fight independently to 0..100%. That changes the physical aspect ratio of the coordinate system and can make a compact raid look more than twice as wide. WCL/world Y also runs in the opposite screen direction from CSS `top`, so the raid could appear on the opposite half of the arena.

## Changes
- WCL Y is converted to screen Y by default.
- X and Y now share one world-to-screen scale; aspect ratio is preserved.
- The scale uses the actual WCL map viewport aspect ratio.
- Existing 2.0.x WCL replays are migrated once via `REPLAY_COORD_VERSION=2`.
- mapID 2606 (Nek'zali) has a small map-specific visual calibration based on the supplied RaidRU/WCL 0:22 comparison.
- Manual rotation/reflection/scale/offset controls remain available for diagnostics.
- No Worker/API changes; WCL quota logic is untouched.
