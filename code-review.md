# Flux Atlas — Code Review
**Reviewed:** 2026-04-26  
**Scope:** Full source audit — stores, canvas, widgets, import, API layer, workspace

---

## Executive Summary

Flux Atlas is a well-structured, thoughtfully commented codebase with solid performance instincts in the canvas layer (RAF throttling, shadowBlur suppression, imperative Konva driving). The architecture is coherent and the developer has clearly iterated carefully on UX details.

That said, there are several acute issues — some silently harmful in production today — and a set of structural concerns that will compound as the app grows. This report organizes findings by severity and type, then provides concrete recommended fixes for each.

---

## Part 1 — Acute Issues (Fix Now)

These are bugs or patterns actively hurting correctness, reliability, or performance today.

---

### 1. Widget Drag Fires Unbounded API Calls

**File:** `src/stores/widgetStore.js` — `_persist`, `updateWidget`, `updateWidgetData`  
**Severity:** 🔴 High

`updateWidget` and `updateWidgetData` both call `get()._persist(campaignId)` synchronously on every invocation. `WidgetLayer.jsx`'s `handlePointerMove` calls `updateWidget` / `updateWidgetData` on **every `mousemove` event** while a widget is being dragged or resized. On a 60 Hz screen, that is 60 API calls per second while dragging.

```js
// widgetStore.js — _persist fires on every mouse move
updateWidget: (id, changes) => {
  const widgets = get().widgets.map((w) => (w.id === id ? { ...w, ...changes } : w));
  set({ widgets });
  const w = widgets.find((w) => w.id === id);
  if (w) get()._persist(w.campaignId); // ← no debounce
},
```

**Fix:** Add a debounce to `_persist`, identical to the pattern already used in `nodeStore.js`:

```js
let _widgetSaveTimer = null;
function debouncedWidgetSave(campaignId, getWidgets) {
  if (_widgetSaveTimer) clearTimeout(_widgetSaveTimer);
  _widgetSaveTimer = setTimeout(() => {
    const widgets = getWidgets().filter((w) => w.campaignId === campaignId);
    saveStore(campaignId, 'widgets', widgets).catch(console.warn);
    _widgetSaveTimer = null;
  }, 400);
}
```

Apply the same pattern to `connectionStore._persist`, which also has no debounce.

---

### 2. Eight Simultaneous `loadCampaign` Requests on Every Campaign Switch

**File:** `src/views/WorkspaceView.jsx` lines 157–168; all store `load*` methods  
**Severity:** 🔴 High

When `campaignId` changes, `WorkspaceView` fires nine `load*` calls simultaneously. Each independently calls `loadCampaign(campaignId)`, which hits `/api/data/load` over the network. The backend receives **nine identical fetch requests** at the same moment, all returning the same full campaign payload:

```js
// WorkspaceView.jsx — 9 stores, 9 identical network fetches
useEffect(() => {
  if (!campaignId) return;
  loadMaps(campaignId);
  loadNodes(campaignId);
  loadTags(campaignId);
  loadConnections(campaignId);
  loadSettings(campaignId);
  loadTerritories(campaignId);
  loadSnapshots(campaignId);
  loadWidgets(campaignId);
  loadHierarchies(campaignId);
}, [campaignId, ...]);
```

Additionally, each store imports `loadCampaign` with a **dynamic import inside the async function**, meaning each store triggers its own separate module resolution and function call.

**Fix:** Introduce a shared campaign loader that fetches once and distributes slices:

```js
// utils/campaignLoader.js
let _inFlight = null;
let _lastCampaignId = null;

export async function loadAllCampaignData(campaignId) {
  if (_lastCampaignId === campaignId && _inFlight) return _inFlight;
  _lastCampaignId = campaignId;
  _inFlight = loadCampaign(campaignId).finally(() => { _inFlight = null; });
  return _inFlight;
}
```

Each store's `load*` method calls `loadAllCampaignData` instead of `loadCampaign` — the first caller fetches, all others await the same promise. This reduces 9 network round-trips to 1.

---

### 3. `settingsStore._persist` Fragile Exclusion List

**File:** `src/stores/settingsStore.js` — `_persist` method (line 58)  
**Severity:** 🔴 High

The `_persist` method uses a destructure-and-spread approach to exclude non-serializable keys from the save payload:

```js
_persist: (campaignId) => {
  const {
    settingsOpen, settingsCategory,
    _syncPinterestSession, _persist, loadSettings, setSetting,
    openSettings, closeSettings, setSettingsCategory,
    addLegendEntry, updateLegendEntry, removeLegendEntry,
    // ... 14 more exclusions ...
    ...rest
  } = get();
  debouncedSave(campaignId, rest);
},
```

This is a **maintenance time-bomb**. Every new state key (UI flags, methods, anything) added to the store must be manually added to this exclusion list or it silently leaks into the server-side save payload. If a method is accidentally included in `...rest`, the server stores a JSON object containing function `.toString()` output, corrupting the settings for that user.

**Fix:** Replace the exclusion pattern with an explicit allowlist:

```js
const PERSISTED_SETTINGS_KEYS = [
  'layout', 'mapSide', 'showConnections', 'showNodeLabels',
  'showStatusOverlays', 'canvasGridVisible', 'theme',
  'nodeTypeOverrides', 'customNodeTypes', 'nodeFieldOverrides',
  'legendEntries', 'imagePool', 'pinterestBoards', 'pinterestSession',
];

_persist: (campaignId) => {
  const state = get();
  const data = Object.fromEntries(
    PERSISTED_SETTINGS_KEYS.map((k) => [k, state[k]])
  );
  debouncedSave(campaignId, data);
},
```

New keys are simply not persisted by default; you opt in intentionally.

---

### 4. `deleteNode` Cascade Calls `get().nodes` Inside Loop

**File:** `src/stores/nodeStore.js` — `deleteNode` (lines 130–145)  
**Severity:** 🟡 Medium

The cascading delete reads `get().nodes` on every iteration of the while loop:

```js
deleteNode: (campaignId, nodeId) => {
  const toDelete = new Set([nodeId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const n of get().nodes) {   // ← called fresh every loop pass
      if (n.parentNodeId && toDelete.has(n.parentNodeId) && !toDelete.has(n.id)) {
        toDelete.add(n.id);
        changed = true;
      }
    }
  }
```

Since `get()` always returns the current store state and no `set()` is called inside the loop, this is functionally correct, but it's a subtle convention violation — `get()` should be called once and the result reused. More importantly, each call to `get()` in Zustand executes the selector (cheap), but building a new array from `get().nodes` mid-loop also means the garbage collector has more work to do for deeply nested trees. Capture once:

```js
const allNodes = get().nodes;
while (changed) {
  changed = false;
  for (const n of allNodes) { ... }
}
```

---

### 5. Import Creates N Sequential State Updates Instead of One Batch

**File:** `src/components/import/ImportModal.jsx` — `handleImport` (lines 208–289)  
**Severity:** 🟡 Medium

`handleImport` calls `createNode` once per imported node in a tight loop. Each `createNode` call:
1. Maps over the full nodes array to build a new array
2. Calls `set({ nodes: newArray })` — triggering a React re-render
3. Calls `debouncedSave` (which resets the 400ms timer each time)

For a 50-node import, this fires 50 state updates and 50 re-renders before the import modal even closes. This also means `updateNodeFields` (called in Pass 2) fires another 50 updates.

**Fix:** Collect all nodes locally in Pass 1, resolve all fields, then call `setNodes` once at the end:

```js
// Build all nodes locally first
const builtNodes = preview.map((node, i) => {
  const col = i % cols, row = Math.floor(i / cols);
  return {
    id: uuid(), campaignId, mapId: activeMapId, type: node.type,
    x: startX + col * spacing, y: startY + row * spacing,
    fields: node.fields, statusFlags: node.statusFlags,
    icon: null, customIcon: null, images: [], tagIds: [],
    parentNodeId: null, createdAt: new Date().toISOString(),
  };
});

// Resolve fields (passes 2 & 3) in memory — mutate builtNodes directly

// Then a single atomic update:
const existing = useNodeStore.getState().nodes;
useNodeStore.getState().setNodes(campaignId, [...existing, ...builtNodes]);
```

This collapses N renders into 1 and sends a single API call instead of N debounced ones.

---

### 6. `isAncestorOf` Does Linear Scans Inside a While Loop (O(n²))

**File:** `src/components/map/MapCanvas.jsx` — `isAncestorOf` (lines 964–974)  
**Severity:** 🟡 Medium

```js
const isAncestorOf = useCallback((ancestorId, nodeId) => {
  let curr = mapNodes.find((n) => n.id === nodeId);  // O(n) per step
  while (curr?.parentNodeId) {
    if (curr.parentNodeId === ancestorId) return true;
    curr = mapNodes.find((n) => n.id === curr.parentNodeId); // O(n) per step
  }
  return false;
}, [mapNodes]);
```

For a tree 10 levels deep with 100 nodes, this is up to 1,000 comparisons. This is called during drag events (inside `canNestInto`, which is called from `handleNodeDragMove` on every mousemove frame).

**Fix:** Build a memoized ID-to-node lookup map alongside `mapNodes`:

```js
const nodeById = useMemo(() => {
  const map = {};
  for (const n of mapNodes) map[n.id] = n;
  return map;
}, [mapNodes]);

const isAncestorOf = useCallback((ancestorId, nodeId) => {
  const visited = new Set();
  let curr = nodeById[nodeId];
  while (curr?.parentNodeId) {
    if (visited.has(curr.parentNodeId)) break; // cycle guard
    if (curr.parentNodeId === ancestorId) return true;
    visited.add(curr.id);
    curr = nodeById[curr.parentNodeId]; // O(1) lookup
  }
  return false;
}, [nodeById]);
```

---

### 7. No Loading State During Campaign Switch

**File:** `src/views/WorkspaceView.jsx` / `src/App.jsx`  
**Severity:** 🟡 Medium

When the user switches campaigns, all nine `load*` calls fire, but there's no loading indicator. The previous campaign's nodes and map remain visible until the new data arrives. If the network is slow, the user sees stale data from the wrong campaign and could be confused or inadvertently interact with it.

**Fix:** Add a `campaignLoading` flag to `campaignStore` (or a local `WorkspaceView` state), set to `true` before firing all loads and `false` once they all complete. Render a simple overlay or spinner during the transition.

---

## Part 2 — Reliability Issues

These are patterns that can cause silent data corruption or subtle bugs under specific conditions.

---

### 8. Module-Level Debounce Timer Shared Across All Campaigns

**File:** `src/stores/nodeStore.js` (lines 12–24), `src/stores/settingsStore.js` (lines 4–13)  
**Severity:** 🟡 Medium

Both stores use a single module-level `_saveTimer` variable. If the user rapidly switches campaigns (e.g., campaign A → campaign B within 400ms), the following sequence is possible:

1. Node updated in campaign A → timer starts, `_saveCampaignId = 'A'`
2. User switches to campaign B → `loadNodes` replaces store state with campaign B's nodes
3. Timer fires → `getNodes()` returns campaign B's nodes → they are saved under `campaignId = 'A'`

The node store partially addresses this by capturing `_saveCampaignId` at timer-set time, but `getNodes` is a live closure (`() => get().nodes`) that reads the current state when the timer fires — which is after the campaign switch.

**Fix:** Capture the nodes array at timer-set time, not when the timer fires:

```js
function debouncedSave(campaignId, nodes) {
  // Snapshot the nodes NOW, not when the timer fires
  const snapshot = [...nodes];
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    saveStore(campaignId, 'nodes', snapshot).catch(console.warn);
    _saveTimer = null;
  }, 400);
}
// Call as: debouncedSave(campaignId, get().nodes)
```

---

### 9. `FolderGrid` — `currentFolderNode` Computed Outside `useMemo`

**File:** `src/components/map/MapCanvas.jsx` — `FolderGrid` component (lines 300–301)  
**Severity:** 🟡 Medium

```js
const currentFolderId = drillPath[drillPath.length - 1];
const currentFolderNode = allMapNodes.find((n) => n.id === currentFolderId) || rootFolderNode;
```

This `find` runs on every render of `FolderGrid`, including renders triggered by unrelated state changes (e.g., another node being selected). With dozens of nodes, this is cheap, but it's inconsistent with the memoization pattern used elsewhere in the same component (`allChildren` is memoized, `rootFolderNode` is memoized). Should be wrapped in `useMemo([allMapNodes, currentFolderId])`.

---

### 10. `handleNodeDragMove` Checks Open Folder State via Object.entries on Every Frame

**File:** `src/components/map/MapCanvas.jsx` — `handleNodeDragMove` (lines 1241–1263)  
**Severity:** 🟡 Medium

```js
for (const [rootId, state] of Object.entries(folderState)) {
  const rootNode = mapNodes.find((n) => n.id === rootId);  // O(n) per folder
  const kids = mapNodes.filter((n) => n.parentNodeId === currentFolderId); // O(n) per folder
```

This runs on every `mousemove` during a node drag. With several open folders, it performs multiple `find` and `filter` calls per frame. The `openFolderBounds` memo (already computed for cross-folder drag) should be reused here to avoid re-deriving the same AABB data.

---

### 11. Auth Token Stored in `localStorage` Without Expiry Handling

**File:** `src/utils/api.js` — `getToken`, `setToken`  
**Severity:** 🟡 Medium

The session token is stored in `localStorage` with no client-side expiry check. `getMe()` will catch expired tokens (the server rejects them and `setToken(null)` is called), but between the stored token existing and `getMe()` completing, `authHeaders()` will attach a dead token to every request that fires before the auth check resolves. This is a short window on startup, but any background request racing with `getMe()` will make an authenticated request with an expired token.

**Fix:** Wrap the initial `getMe()` call with a loading guard before any data requests can fire. This is mostly already handled by `App.jsx` (which waits for `loading` before rendering `WorkspaceView`), but worth confirming all background tasks gated on auth resolution.

---

### 12. `WidgetLayer` Widget Position Not Clamped to Viewport

**File:** `src/components/widgets/WidgetLayer.jsx` — `renderWidget` (line 277)  
**Severity:** 🟢 Low

Widget positions are stored in canvas-space coordinates and transformed by the viewport matrix. There is no check that widgets remain visible when the viewport is zoomed or panned significantly. A widget placed at canvas position (10000, 10000) while the viewport is centered near (0, 0) will render far off-screen with no way to retrieve it except manually panning.

**Fix:** Add a "recenter widget" option to the widget context menu that snaps the widget's canvas position to the current viewport center.

---

## Part 3 — Structural Issues (Longer-Term Refactors)

These are architectural concerns that don't cause immediate bugs but will compound as the codebase grows.

---

### 13. `WorkspaceView.jsx` Is a God Component

**File:** `src/views/WorkspaceView.jsx` (499 lines)  
**Severity:** 🟠 Structural

`WorkspaceView` currently manages:
- 20+ `useState` variables (layout, modal states, drawing mode, territory state, search, mobile sheets, etc.)
- 9 store subscriptions with destructured actions
- Full mobile and desktop layout trees
- Keyboard shortcut handlers
- Drag-and-drop from the staging panel
- The campaign data loading orchestration

This makes it difficult to test, reason about, or extend any individual concern. A state change in one modal toggles re-renders for everything.

**Recommended extraction:**
- `useCampaignLoader(campaignId)` hook — handles all 9 load calls, exposes `isLoading`
- `useWorkspaceKeyboard()` hook — Ctrl+Shift+Backspace and other shortcuts
- `useDrawingMode()` hook — drawing mode, polygon points, territory creation
- `<DesktopWorkspace />` and `<MobileWorkspace />` — separate layout components
- `<WorkspaceModals />` — all conditional modal renders in one declarative block

---

### 14. `MapCanvas.jsx` Is a 1,696-Line Monolith

**File:** `src/components/map/MapCanvas.jsx`  
**Severity:** 🟠 Structural

The canvas file handles: viewport state, wheel zoom, pinch zoom, RAF throttling, node rendering, folder grid rendering, territory rendering, polygon draw preview, drag-and-drop nesting logic, cross-folder drag, shake animations, and deep-link breadcrumbs. Nearly all of these could be extracted into focused custom hooks:

- `useCanvasViewport(stageRef)` — position, scale, wheel handler, pinch handler, RAF sync
- `useNodeNesting(mapNodes, nestCounts)` — `isAncestorOf`, `canNestInto`, nest/reject state
- `useFolderState(mapNodes)` — open/close/drill/page state machine
- `useTerritoryDrawing()` — polygon points, preview rendering

This would leave the main `MapCanvas` function as a composition layer, dramatically improving readability and testability.

---

### 15. Two Identical Wheel Zoom Implementations

**File:** `src/components/map/MapCanvas.jsx` — `handleWheel` (lines 1059–1107) and the `flux:canvasWheel` event handler (lines 1110–1151)  
**Severity:** 🟠 Structural

Both handlers perform identical math (pointer-anchored scale, position calculation, imperative Konva drive, RAF sync). The only difference is where the pointer position comes from (Konva's `getPointerPosition()` vs `clientX/Y - rect`). Extract a shared helper:

```js
function applyZoom(stage, pointerX, pointerY, rawDelta, deltaMode, setState) {
  const oldScale = stage.scaleX();
  const oldPos   = stage.position();
  // ... shared math ...
  stage.scale({ x: newScale, y: newScale });
  stage.position(newPos);
  stage.batchDraw();
  setState(newScale, newPos);
}
```

---

### 16. `settingsStore` Has Too Many Responsibilities

**File:** `src/stores/settingsStore.js`  
**Severity:** 🟠 Structural

The settings store currently owns: layout/UI state, theme, node type overrides, custom node types, field overrides, legend entries, image pool, Pinterest session, Pinterest boards, and a direct `fetch` call to `/api/set-pinterest-session`. This is at least four distinct concerns (layout, node customization, image management, external integrations) in one store.

**Recommended split:**
- `uiStore` — layout, mapSide, settingsOpen, settingsCategory, theme
- `nodeCustomizationStore` — nodeTypeOverrides, customNodeTypes, nodeFieldOverrides
- `mapAssetsStore` — imagePool, legendEntries
- Keep `settingsStore` only for persistence orchestration or eliminate it

This makes the `_persist` exclusion problem trivially solvable — each store persists only its own keys.

---

### 17. No Granular Error Boundaries

**File:** `src/App.jsx`, `src/components/common/ErrorBoundary.jsx`  
**Severity:** 🟠 Structural

The single `ErrorBoundary` wraps the entire `WorkspaceView`. If `DetailPanel` throws (e.g., accessing a field on a malformed node), the whole canvas goes down. If `MapCanvas` throws (e.g., a Konva rendering error), the entire UI is replaced with the error fallback.

**Fix:** Wrap individual sections with their own `ErrorBoundary`:

```jsx
// WorkspaceView
<ErrorBoundary fallback={<PanelError />}>
  <DetailPanel />
</ErrorBoundary>

<ErrorBoundary fallback={<CanvasError />}>
  <MapCanvas ... />
</ErrorBoundary>
```

This ensures a broken panel doesn't take down the canvas and vice versa.

---

### 18. `MapCanvas` Instantiated Twice in Mobile Layout

**File:** `src/views/WorkspaceView.jsx` — lines 179–193 (desktop) and 308–323 (mobile)  
**Severity:** 🟢 Low / Structural

`MapCanvas` is fully instantiated in JSX twice — once for the desktop `mapCanvas` variable and once inline in the mobile branch. The mobile version passes identical props. Any prop change or new prop must be updated in both places. Extract to a shared component or at minimum extract the shared props object:

```js
const canvasProps = {
  placingType, onPlacingDone: handlePlacingDone,
  onNodeContextMenu: handleNodeContextMenu,
  drawingMode, setDrawingMode: handleSetDrawingMode,
  polygonPoints, setPolygonPoints,
  selectedTerritoryId, setSelectedTerritoryId,
  editingTerritoryId, searchHighlightIds, orgView,
};

// Then: <MapCanvas {...canvasProps} /> in both places
```

---

### 19. Dynamic Imports Inside Store Load Functions

**File:** All store `load*` methods (e.g., `nodeStore.js` line 33, `mapStore.js` line 12, etc.)  
**Severity:** 🟢 Low / Structural

```js
loadNodes: async (campaignId) => {
  const { loadCampaign } = await import('../utils/api'); // dynamic import on every load
```

`../utils/api` is a static module that's always bundled. Using a dynamic import here adds unnecessary runtime overhead (a module resolution check on every call) and makes the dependency non-obvious to tree-shakers and bundlers. Replace with a static top-level import:

```js
import { loadCampaign } from '../utils/api';
```

---

## Part 4 — Positive Patterns Worth Keeping

These are well-implemented patterns that should be preserved and extended:

- **Konva `shadowBlur=0` on idle nodes** — correct; prevents the expensive canvas filter pipeline from activating on non-selected nodes. Keep this discipline as new node states are added.
- **RAF-throttled drag sync** — `dragRafRef` correctly batches Konva→React state sync to one update per frame. The same pattern is applied consistently to wheel zoom.
- **Imperatively driving Konva on zoom** — `stage.scale()`/`stage.position()`/`stage.batchDraw()` before the RAF update prevents the one-frame lag that plagued the original lerp approach.
- **Folder close with exit tween flag** — the `closing: true` flag pattern prevents flash-of-removal. Elegant and correct.
- **Debounced `nodeStore` saves** — the 400ms debounce on drag/typing is the right pattern. Just needs to be applied consistently to `widgetStore` and `connectionStore`.
- **Icon image caching in `iconImages.js`** — the `renderToStaticMarkup` + `Map` cache means each icon variant is only ever rendered once. Good.
- **Three-pass import** — the pass-1 ID allocation → pass-2 reference resolution → pass-3 membership application structure is correct and handles circular/forward references cleanly.

---

## Summary Table

| # | Issue | File | Severity | Type |
|---|-------|------|----------|------|
| 1 | Widget drag fires unbounded API calls | `widgetStore.js` | 🔴 High | Bug |
| 2 | 8 `loadCampaign` requests per campaign switch | `WorkspaceView.jsx` + all stores | 🔴 High | Performance |
| 3 | `settingsStore._persist` fragile exclusion list | `settingsStore.js` | 🔴 High | Reliability |
| 4 | `deleteNode` cascade calls `get().nodes` in loop | `nodeStore.js` | 🟡 Medium | Bug |
| 5 | Import fires N state updates instead of 1 batch | `ImportModal.jsx` | 🟡 Medium | Performance |
| 6 | `isAncestorOf` O(n²) per drag frame | `MapCanvas.jsx` | 🟡 Medium | Performance |
| 7 | No loading state on campaign switch | `WorkspaceView.jsx` | 🟡 Medium | UX/Reliability |
| 8 | Shared debounce timer risks cross-campaign save | `nodeStore.js` | 🟡 Medium | Reliability |
| 9 | `currentFolderNode` not memoized in FolderGrid | `MapCanvas.jsx` | 🟡 Medium | Performance |
| 10 | DragMove recomputes folder bounds every frame | `MapCanvas.jsx` | 🟡 Medium | Performance |
| 11 | Token attached to requests before auth resolves | `api.js` | 🟡 Medium | Reliability |
| 12 | No widget position clamping | `WidgetLayer.jsx` | 🟢 Low | UX |
| 13 | `WorkspaceView` god component | `WorkspaceView.jsx` | 🟠 Structural | Architecture |
| 14 | `MapCanvas` 1,696-line monolith | `MapCanvas.jsx` | 🟠 Structural | Architecture |
| 15 | Duplicate wheel zoom implementations | `MapCanvas.jsx` | 🟠 Structural | Architecture |
| 16 | `settingsStore` too many responsibilities | `settingsStore.js` | 🟠 Structural | Architecture |
| 17 | Single error boundary for entire workspace | `App.jsx` | 🟠 Structural | Reliability |
| 18 | `MapCanvas` instantiated twice for mobile | `WorkspaceView.jsx` | 🟢 Low | Architecture |
| 19 | Dynamic imports of static module in all stores | All store files | 🟢 Low | Architecture |

---

## Recommended Priority Order

**Sprint 1 (acute fixes, low risk):**
1. Add debounce to `widgetStore._persist` and `connectionStore._persist`
2. Replace `settingsStore._persist` exclusion list with allowlist
3. Fix `deleteNode` — capture `get().nodes` outside the loop
4. Replace dynamic `import('../utils/api')` with static imports in all stores
5. Fix `isAncestorOf` with `nodeById` map

**Sprint 2 (architecture, medium effort):**
6. Implement shared `loadAllCampaignData` to reduce 9 fetches to 1
7. Batch `ImportModal.handleImport` into a single `setNodes` call
8. Add `campaignLoading` state and UI indicator
9. Extract `applyZoom` helper (deduplicates wheel zoom)
10. Add granular error boundaries around DetailPanel and MapCanvas

**Sprint 3 (structural, higher effort):**
11. Extract hooks from `MapCanvas` (`useCanvasViewport`, `useNodeNesting`, `useFolderState`)
12. Split `WorkspaceView` into hooks and sub-components
13. Split `settingsStore` into smaller focused stores
14. Add widget "recenter to viewport" escape hatch
15. Dedup `MapCanvas` instantiation in mobile layout
