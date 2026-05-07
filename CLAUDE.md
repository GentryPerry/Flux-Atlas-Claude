# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Dev Commands

```bash
npm run dev        # Start Vite dev server
npm run build      # Production build
npm run preview    # Preview production build
npm run lint       # ESLint check
```

## Architecture Overview

**Flux Atlas** is a React + Vite app — a campaign/worldbuilding canvas tool. It uses Konva.js for the map canvas, Zustand for state, and persists everything to `localStorage`.

### Core Stores (Zustand, `src/stores/`)

- **`nodeStore`** — all campaign nodes (characters, locations, orgs, etc.) + `selectNode`, `hoverNode`
- **`campaignStore`** — active campaign, campaign list
- **`widgetStore`** — canvas widgets (sticky notes, trackers, etc.), persisted per campaign
- **`viewportStore`** — Konva viewport x/y/scale, used by both `MapCanvas` and `WidgetLayer`
- **`folderStore`** — open folder overlays on the map
- **`uiStore`** — layout mode (`full` | `split`), panel open/close, modal states
- **`settingsStore`** — app-wide settings (grid, snap, node size, etc.)
- **`tagStore`** — tag definitions; tags live on nodes as `fields.tags` (ID array)

All stores persist via `localStorage` using campaign-scoped keys (e.g., `flux_nodes_<campaignId>`).

### Node Type System (`src/utils/`)

- **`nodeSchema.js`** — canonical field definitions per node type. Each field has `{ label, type, defaultValue }`. Field types: `text`, `textarea`, `tags`, `noderefs`, `number`, `boolean`, `select`, `color`, `date`.
- **`typeColors.js`** — `DEFAULT_TYPE_COLORS` map: type → hex color
- **`iconRegistry.js`** — `resolveIcon(type | iconName)` → Phosphor icon component
- **`typeCategories.js`** — spatial types (placed on map) vs abstract types (exist only in panel)

**Spatial types** (render on canvas): `location`, `character`, `faction`, `event`, etc.  
**Abstract types** (panel-only): `concept`, `item`, `timeline`, etc.

### Node Fields — Key Conventions

- `fields.tags` — array of tag IDs (from tagStore). Rendered as colored chips.
- `fields.members` — `noderefs` type on org nodes (faction, religion, polity). Stores direct node ID arrays. This is the canonical membership model — membership is stored on the org, not on the character.
- `ORG_MEMBERSHIP_LABELS = new Set(['faction', 'religion', 'polity'])` — used in import to handle backward-compatible character-side membership lines.

### Canvas Rendering (`src/components/map/MapCanvas.jsx`)

Uses Konva.js. Key performance rules:
- `shadowBlur` must be `0` on idle nodes — any non-zero value forces Canvas filter pipeline on every draw call. Only selected nodes get `shadowBlur={16}`.
- `perfectDrawEnabled={false}` on all shapes for perf.
- Node label text uses stroke halo (`stroke + fillAfterStrokeEnabled={true}`) instead of shadowBlur — zero filter cost, same contrast. This is the GIS map label pattern.
- Drag viewport sync is RAF-throttled via `dragRafRef`.
- `.to()` mount pop animations use `easing: Konva.Easings.EaseOut`.
- Folder close uses a `closing: true` flag in folderState; the exit tween fires first, then `onFinish` removes the entry — prevents flash-of-removal.

### Widget System (`src/components/widgets/`)

Widgets live in `WidgetLayer.jsx` which is absolutely positioned over the Konva canvas and mirrors its transform. All widgets must:
- Use `className="widget-shell"` as the outer container (not `.widget-card` — doesn't exist)
- Use `className="widget-ctrl-btn"` for minimize/close buttons
- Use `data-drag-handle="true"` on the title bar for drag detection
- Use `data-resize-handle="true"` on resize handles

Widget types: `sticky-note`, `linear-tracker`, `thread-tracker`, `clock-widget`, `trouble-engine`.

Default data shapes and persistence keys are in `widgetStore.js`.

### Import System (`src/components/import/ImportModal.jsx`)

Three-pass markdown import:
1. **Pass 1** — Create all nodes, build `nodeNameMap` (name.toLowerCase() → [{id, type}])
2. **Pass 2** — Resolve `__tagNames_<key>` sentinels (tags), `__noderefNames_<key>` sentinels (noderefs), accumulate `pendingOrgMembers` from `__pendingMembership`
3. **Pass 3** — Apply pending memberships to org nodes' `members` field

Import format: markdown with `## NodeType: Name` headers and `- Field: Value` bullets. Org membership goes on the org block as `Members: Name1, Name2` — not on character blocks.

### Panel / Layout (`src/views/WorkspaceView.jsx`)

Layout modes: `full` (map only) and `split` (map + right panel). Panel slide-out uses a `panelExiting` state with a 160ms timeout to keep the panel mounted during the CSS exit animation (`@keyframes slideOut` in `index.css`).

### CSS Conventions (`src/index.css`)

Single large CSS file. Key namespaces:
- `.widget-shell`, `.widget-controls`, `.widget-ctrl-btn` — shared widget chrome
- `.te-widget-*` — TroubleEngine widget
- `.tt-*` — ThreadTracker widget
- `.lt-*` — LinearTracker widget
- `.player-*`, `.invite-*` — player view and GM invite panel
- Konva stage sits in `.map-canvas-container`; `WidgetLayer` is `.widget-layer` with matching `transform`

### Authentication & Image Serving (`src/worker.js`)

The Cloudflare Worker serves both the API and static assets. Session auth uses two cookies:
- `flux_session` — set on GM login/signup, used for all GM API calls and image serving
- `flux_player_session` — set when a player joins via invite link, used for player API calls and image serving

`handleImageServe` checks the regular user session first, then falls back to the player cookie. Player image access is scoped to the campaign owner's images (`images/{ownerUserId}/...`), verified via the player session's `owner_user_id`.

### Player View System (`src/components/player/`)

Lets the GM share a read-only map view with players. No player accounts — invite link only.

**Data model (D1 tables):**
- `campaign_invites` — one per campaign, stores the invite token
- `player_sessions` — one per player per campaign: `display_name`, `color` (auto-assigned from palette), `status` (`pending` | `approved` | `rejected`), `token`
- `player_notes` — one row per player per node: freetext, auto-saves

**GM workflow:**
1. Open invite panel (people icon in toolbar) → copy the invite URL
2. When players join, pending list appears → approve or reject each
3. Toggle the Eye button in toolbar to preview exactly what players see (hides unrevealed nodes)
4. Open any node's DetailPanel → click the Eye icon (header row) to reveal/hide that node

**Reveal state** is stored in `playerRevealStore` (`src/stores/playerRevealStore.js`) and persisted to `campaign_data` under `store='player_reveal'` as an array of node IDs. The store is loaded alongside other stores on campaign load in `WorkspaceView.jsx`.

**Player routing** (`src/App.jsx`): if `?join=TOKEN` is in the URL or `flux_player_token` exists in localStorage, the normal GM app is bypassed entirely and the player flow renders instead:
1. `PlayerJoinScreen` — name entry, calls `POST /api/player/join`
2. Pending screen — polls `GET /api/player/status` every 8s until approved
3. `PlayerView` (`src/components/player/PlayerView.jsx`) — standalone Konva canvas showing only bg images, overlays, and revealed nodes. Clicking a node opens `PlayerNotePanel`.

**Player notes** auto-save 1.2s after the user stops typing. All approved players' notes for a node are returned by `GET /api/player/view` and displayed with name + color attribution.

**Player canvas** is a lightweight standalone component (not MapCanvas) — it renders the background image using the same `imageX/Y/Width/Height` fields as the GM view, so repositioned backgrounds look correct for players too.

## Key Files

| File | Purpose |
|------|---------|
| `src/stores/nodeStore.js` | All node CRUD + selection |
| `src/utils/nodeSchema.js` | Field definitions per type |
| `src/components/map/MapCanvas.jsx` | Konva canvas, all rendering |
| `src/components/widgets/WidgetLayer.jsx` | Widget container + drag/resize |
| `src/components/import/ImportModal.jsx` | Markdown import, three-pass |
| `src/stores/playerRevealStore.js` | Revealed node IDs, persisted to campaign_data |
| `src/components/player/PlayerView.jsx` | Player-facing canvas + note panel |
| `src/components/player/InvitePanel.jsx` | GM invite link + approval UI |
| `src/worker.js` | Cloudflare Worker: all API routes, auth, image serving |
| `src/index.css` | All styles (single file) |
