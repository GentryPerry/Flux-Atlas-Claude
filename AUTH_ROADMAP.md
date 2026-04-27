# Flux Atlas — Auth & Cloud Storage Roadmap

*Cloudflare D1 + Workers implementation plan*

---

## Overview

The goal is to replace `localStorage` with a real cloud database so user data persists across devices and browsers, and users can log in with an account. Everything stays on Cloudflare — no new servers, no new accounts.

There are **52 localStorage calls** across 9 stores that need to be migrated. The data structure barely changes — we're moving the same JSON blobs from the browser into D1.

---

## What Claude Does

Claude writes all the code. You don't need to touch any of this manually:

- **Worker API** (`src/worker.js`) — the serverless backend that runs on Cloudflare. Handles signup, login, save, and load endpoints.
- **SQL schema** — the D1 database tables (users + campaign data storage)
- **Auth UI** — login and signup modal, gated at the Campaign Select screen
- **Store migrations** — all 9 stores updated to call the API instead of localStorage:
  - `campaignStore.js`
  - `nodeStore.js`
  - `tagStore.js`
  - `mapStore.js`
  - `widgetStore.js`
  - `settingsStore.js`
  - `snapshotStore.js`
  - `connectionStore.js`
  - `territoryStore.js`
- **wrangler.toml updates** — Worker and D1 binding configuration
- **Auth context** — a React context that holds the logged-in user and token, available app-wide

---

## What You Do

You run a handful of terminal commands and click through a few Cloudflare dashboard steps. No code writing required.

---

## Step-by-Step Process

### Step 1 — Create the D1 Database (You)

In your terminal, from the Flux Atlas folder:

```bash
npx wrangler d1 create flux-atlas-db
```

Wrangler will print output that looks like this:

```
✅ Successfully created DB 'flux-atlas-db'
[[d1_databases]]
binding = "DB"
database_name = "flux-atlas-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
```

**Copy that entire `[[d1_databases]]` block** — you'll give it to Claude in the next step.

---

### Step 2 — Update wrangler.toml (Claude)

Paste the database ID block from Step 1 into the chat. Claude will update `wrangler.toml` to add the D1 binding and configure the Worker entry point alongside your existing static assets.

---

### Step 3 — Write the Worker + Schema (Claude)

Claude writes `src/worker.js` with these endpoints:

| Endpoint | What it does |
|---|---|
| `POST /api/auth/signup` | Creates a new user, returns a session token |
| `POST /api/auth/login` | Validates credentials, returns a session token |
| `POST /api/data/save` | Saves a store's JSON blob for a campaign |
| `GET /api/data/load` | Loads all store blobs for a campaign |

Claude also writes and runs the SQL schema against your D1 database:

```bash
npx wrangler d1 execute flux-atlas-db --file=schema.sql
```

You just run that one command.

---

### Step 4 — Build the Auth UI (Claude)

Claude adds a login/signup modal to `CampaignSelect.jsx`. When the app loads, if the user isn't logged in they see the auth screen first. After login, the Campaign Select screen appears as normal.

Nothing else in the UI changes.

---

### Step 5 — Migrate the Stores (Claude)

Claude migrates each store one at a time, replacing:

```js
// Before
localStorage.setItem(`flux_nodes_${campaignId}`, JSON.stringify(nodes));

// After
await api.save(campaignId, 'nodes', nodes);
```

The logic inside every store stays identical — only the read/write calls change. Claude does all 9 stores.

---

### Step 6 — Deploy (You)

```bash
npm run build
npx wrangler deploy
```

That's it. Your app is live with auth and cloud storage.

---

### Step 7 — Test (Both)

- Sign up with a test account
- Create a campaign, add some nodes
- Open the app in a different browser or device — data should be there
- Claude fixes anything that doesn't work

---

## What the Data Looks Like in D1

Two tables, dead simple:

```sql
-- One row per user
users (id, email, password_hash, created_at)

-- One row per store per campaign
-- e.g. store = 'nodes', 'tags', 'widgets', etc.
campaign_data (user_id, campaign_id, store, data, updated_at)
```

The `data` column is just the JSON string that currently goes into localStorage. No schema redesign, no relational complexity.

---

## Timeline Estimate

| Phase | Who | Time |
|---|---|---|
| Steps 1–2: D1 setup | You (CLI) + Claude | ~30 min |
| Step 3: Worker + schema | Claude | ~1 session |
| Step 4: Auth UI | Claude | ~1 session |
| Step 5: Store migrations | Claude | ~1–2 sessions |
| Step 6–7: Deploy + test | You + Claude | ~30 min |

Total real time on your end: **under 2 hours of terminal commands and testing.** Claude handles the rest across a few focused sessions.

---

## When to Start

Say **"let's start Step 1"** and Claude will walk you through the wrangler command. Once you paste back the database ID, the build begins.
