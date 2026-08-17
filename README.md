# RaidRU 3

Russian World of Warcraft raid tactics and visual planning tool.

**Current development build:** `3.0.0-alpha.1 — Architecture Core`

This branch is the clean rewrite of RaidRU. The 2.x site should stay production until the new architecture reaches feature parity.

## Run locally

```bash
npm install
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
apps/wcl-bridge     preserved browser bridge, not wired in alpha.1
workers/wcl         preserved Worker, not wired in alpha.1
packages/shared-types
packages/replay-core
packages/mechanics-core
packages/raidplan-core
docs/architecture
docs/migration
docs/releases
```

Read `docs/architecture/ARCHITECTURE.md` before adding features. New code must not recreate the 2.x patch-chain pattern.

## Recommended Git workflow

Keep production `main` intact for now:

```bash
git switch -c raidru-3
# copy this project into the repository while keeping .git
git add -A
git commit -m "Start RaidRU 3 architecture core"
git push -u origin raidru-3
```

Do not merge to `main` until the alpha passes real RaidPlan/WCL fixtures and the production checklist.
