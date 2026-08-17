# RaidRU Edge Worker

Worker 2.x WCL code is preserved during the RaidRU 3 rewrite. Alpha.3.1 reuses only its established `/raidplan` transport contract for RaidPlan Visual Fidelity; WCL is still not connected to the RaidRU 3 UI.

## Alpha.3.1 transport status

`/raidplan?code=<code>` remains the only server-side transport needed by the web importer. The Worker now also allows local Vite origins:

- `http://localhost:5173`
- `http://127.0.0.1:5173`
- `http://localhost:4173`
- `http://127.0.0.1:4173`

Health version: `3.0.0-alpha.3.1-raidplan-visual-fidelity`.

## Deploy

From this directory:

```bash
npx wrangler deploy
```

WCL OAuth secrets/vars remain managed by the existing Worker environment. Do not copy them into the web app.
