# RaidRU 2.0.5 — WCL One-Shot Import

## Problem
Earlier 2.0.x builds could spend several Warcraft Logs GraphQL requests before a replay became useful: report metadata, quota preflight and one or more event pages. A real WCL 429 cannot be safely bypassed.

## Fix
For a normal URL containing an explicit numeric `fight=` RaidRU now uses a single combined GraphQL query per user action. The query returns report/fight metadata, actors, `rateLimitData`, and one page of `Casts` with `includeResources: true`.

- No separate `/report` preflight for numeric fight URLs.
- No separate quota query before the fast import.
- At most one upstream WCL GraphQL request per click in fast mode.
- If one page is insufficient, HTTP 206 returns a usable partial Replay. `Продолжить` requests only the next page.
- Completed replay is cached and subsequent opens spend zero WCL points.
- A genuine WCL HTTP 429 is still respected exactly; clicks during Retry-After are served from the Worker backoff state and do not touch WCL.
- `Высокая точность` remains an explicit opt-in to the older richer multi-page pipeline.

## Important
This release reduces future WCL quota consumption; it cannot erase an upstream Retry-After that Warcraft Logs has already issued.
