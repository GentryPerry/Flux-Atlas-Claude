# Flux Atlas — Development Roadmap

*Generated April 13, 2026 — based on original spec audit*

---

## Current State Summary

The app has a solid Phase 1 foundation: campaign creation, map canvas with pan/zoom/drag, all 7 node types (NPC, Location, Faction, Religion, Event, Polity, Item) with field editing, multi-image upload per node, tag system, basic connections with color and directional arrows, nested drill-down for locations (breadcrumb nav), status flags, territory drawing with entity assignment, and a Kanban-style column organizer with move/copy prompts.

**Storage is entirely localStorage** — PocketBase is imported but unused. All data persists client-side only.

---

## Phase 1 — MVP: The Living Map

### Complete

- [x] Campaign creation and selection screen
- [x] Map image upload as canvas
- [x] Free node placement and movement (Konva.js)
- [x] Node types with default field schemas (7 types)
- [x] Detail panel with full field editing
- [x] Multi-image upload per node (with gallery/lightbox)
- [x] Tags (node reference + freeform)
- [x] Basic connections with color
- [x] Nested drill-down for Place nodes (breadcrumb nav)
- [x] Node status flags (alive/dead, active/disbanded, revealed/hidden)
- [x] Icon defaults per type (Phosphor Icons)
- [x] Campaign switcher
- [x] Markdown import (bulk node creation from .md files)
- [x] Territory drawing tool with entity assignment and custom colors
- [x] Column organizer / Kanban board (move/copy prompt, multi-membership)
- [x] Performance optimization (memoized canvas nodes, debounced persistence)

### Remaining

- [ ] **PocketBase storage integration** — Replace all localStorage calls with PocketBase SDK. Currently every store (nodeStore, mapStore, campaignStore, etc.) reads/writes to localStorage. The `pb.js` file exists but is never called. This is the biggest infrastructure gap.
- [ ] **Custom icon upload per node** — The `customIcon` field exists on nodes but has no UI. Need: file upload in DetailPanel, icon preview in NodeIcon, fallback to type default.
- [ ] **Connection labels** — Connections currently render as colored curves with optional arrows, but no text labels on the line. The spec calls for labels visible by default, full edit on hover.
- [ ] **Connection editing UI** — No way to edit an existing connection's color, label, or directional toggle after creation. Need a connection detail popover (click on a connection line → edit panel).

---

## Phase 2 — The World Organized

### Partially Started

- [x] **Column organizer** — Kanban board with 4 group modes (faction, religion, polity, location), drag/drop with move-or-copy prompt, X button to remove. *Missing: user-addable columns, horizontal scroll for many columns, right-click context menu on cards, color dot badges for multi-membership.*
- [~] **Search and filter** — CardPanel has a basic search bar filtering by name. *Missing: global search across all nodes by field content and tags, type/status/tag filters in map view (highlight matching nodes), filter in relationship web.*
- [~] **Legend editor** — SettingsPanel has connection color meanings. *Missing: full legend editor for node colors, tag colors, exportable/importable presets.*

### Not Started

- [ ] **Relationship web view** — Global graph showing ALL nodes and connections, not tied to a single map. The spec calls for this as a separate view toggle. Would use React Flow (which is already a dependency but unused).
- [ ] **Org hierarchy drill-down (Faction, Religion, Polity)** — Tree/org-chart view showing ranks, subgroups, and member characters. The schema marks these types with `drillDown: 'hierarchy'` but no hierarchy view component exists.
- [ ] **Event web drill-down** — Freeform cause/effect canvas for Event nodes. Schema marks events with `drillDown: 'eventWeb'` but no implementation exists.
- [ ] **Session log** — Chronological campaign notes attached to timeline points. No store, component, or data model exists yet. Need: `sessionStore`, session list/editor view, markdown notes per session.
- [ ] **Player view mode** — Read-only view showing only nodes with `revealed: true` and connections between revealed nodes. The status flag infrastructure exists, but no view mode toggle or filtered rendering.
- [ ] **Markdown/vault export** — Per-node `.md` export and full campaign document generation. The spec details the format. Import exists but no export.
- [ ] **Campaign settings export/import** — Save legend, custom types, and default behaviors as a `.json` template. Import into another campaign. SettingsPanel shows "Coming in Phase 2" placeholder.
- [ ] **Custom node types** — User-defined types with custom field schemas, icons, and drill-down behavior. The spec says custom types should behave identically to built-in types. SettingsPanel shows "Available in Phase 2" placeholder.
- [ ] **Column organizer enhancements** — Per the spec: right-click context menu on cards (Remove From, Add To, Move To, Open Node), multi-assignment color dots along bottom of card tied to legend colors, "Unassigned only" toggle as a world audit tool.

---

## Phase 3 — The World Engine

*Architecture should anticipate these features but none should be built yet.*

- [ ] Timeline and world state snapshots
- [ ] Manual and auto time-passing modes
- [ ] Volatility controls and per-system advanced settings
- [ ] Scheduled events / ticking clocks
- [ ] Revert and branch timeline
- [ ] AI plugin hooks (named slots, confirm-to-place flow)
- [ ] Ollama / Anthropic API integration

---

## Bug Fixes Applied (This Session)

- Fixed `Array.isArray()` guards in DetailPanel tag handling (crash on imported nodes with string tag values)
- Fixed territory drawing tool (replaced broken double-click detection with explicit Finish/Cancel buttons)
- Renamed Realm → Polity across all files
- Added move/copy prompt to Kanban board for same-category drags
- Added custom territory colors (decoupled from entity type color)
- Removed Linux-only rolldown binding from package.json

---

## Recommended Next Priority

1. **PocketBase integration** — Without this, all data is trapped in one browser's localStorage. Campaign sharing, multi-device access, and the Player View mode all depend on a real backend.
2. **Connection labels and editing** — Connections are a core part of the knowledge graph but currently have no way to edit after creation.
3. **Relationship web view** — React Flow is already a dependency. This view would make the interconnected data visible and navigable beyond individual maps.
4. **Session log** — Lightweight to build, high value for actual play use.
5. **Markdown export** — Completes the import/export loop. The per-node format is well-defined in the spec.

---

## Spec Divergences

These are intentional deviations from the original spec worth noting:

| Spec Says | Current State | Reason |
|-----------|--------------|--------|
| "Thing" node type | Renamed to "Item" | User preference |
| "Realm" node type | Renamed to "Polity" | More setting-agnostic |
| PocketBase backend | localStorage only | Faster iteration, no server dependency during dev |
| React Flow for graph views | Not yet used (dependency installed) | Only Konva map view built so far |
| Location types: city/dungeon/ruin/village | city/town/district/landmark/building/region/territory/outpost/port/crossing/hideout/other | More setting-agnostic terminology |
| Column Organizer as separate view | Implemented as Kanban board toggle in workspace | Simpler UX, same functionality |
