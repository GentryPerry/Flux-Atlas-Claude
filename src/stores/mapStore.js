import { create } from 'zustand';
import { v4 as uuid } from 'uuid';

/**
 * Map store — manages map images and navigation stack for drill-down.
 */
const useMapStore = create((set, get) => ({
  maps: [],           // all maps for active campaign
  activeMapId: null,  // current map being viewed
  mapStack: [],       // breadcrumb stack for drill-down navigation

  /** Load maps for a campaign */
  loadMaps: (campaignId) => {
    try {
      const raw = localStorage.getItem(`flux_maps_${campaignId}`);
      const maps = raw ? JSON.parse(raw) : [];
      set({ maps, activeMapId: maps[0]?.id || null, mapStack: [] });
    } catch (e) {
      console.warn('loadMaps failed:', e);
      set({ maps: [], activeMapId: null, mapStack: [] });
    }
  },

  /** Persist maps to storage */
  _persist: (campaignId) => {
    try {
      localStorage.setItem(`flux_maps_${campaignId}`, JSON.stringify(get().maps));
    } catch (e) {
      console.warn('Map persist failed:', e);
    }
  },

  /** Create a new map (optionally as child of a parent map/node) */
  createMap: (campaignId, name, imageDataUrl, parentMapId = null) => {
    const map = {
      id: uuid(),
      campaignId,
      name,
      image: imageDataUrl,
      parentMapId,
      createdAt: new Date().toISOString(),
    };
    const maps = [...get().maps, map];
    set({ maps, activeMapId: map.id });
    get()._persist(campaignId);
    return map;
  },

  /** Navigate into a child map (drill-down) */
  drillDown: (childMapId) => {
    const { activeMapId, mapStack } = get();
    set({
      mapStack: [...mapStack, activeMapId],
      activeMapId: childMapId,
    });
  },

  /** Navigate back up one level */
  drillUp: () => {
    const { mapStack } = get();
    if (mapStack.length === 0) return;
    const newStack = [...mapStack];
    const parentId = newStack.pop();
    set({ mapStack: newStack, activeMapId: parentId });
  },

  /** Jump to a specific level in the breadcrumb */
  jumpTo: (mapId) => {
    const { mapStack } = get();
    const idx = mapStack.indexOf(mapId);
    if (idx === -1) return;
    set({ mapStack: mapStack.slice(0, idx), activeMapId: mapId });
  },

  /** Set active map directly */
  setActiveMap: (mapId) => {
    set({ activeMapId: mapId, mapStack: [] });
  },

  /** Get active map object */
  getActiveMap: () => {
    const { maps, activeMapId } = get();
    return maps.find((m) => m.id === activeMapId) || null;
  },

  /** Get breadcrumb trail */
  getBreadcrumbs: () => {
    const { maps, mapStack, activeMapId } = get();
    const trail = [...mapStack, activeMapId]
      .filter(Boolean)
      .map((id) => maps.find((m) => m.id === id))
      .filter(Boolean);
    return trail;
  },

  /** Update a map's properties */
  updateMap: (campaignId, mapId, updates) => {
    const maps = get().maps.map((m) =>
      m.id === mapId ? { ...m, ...updates } : m
    );
    set({ maps });
    get()._persist(campaignId);
  },

  /** Delete a map and all its children recursively */
  deleteMap: (campaignId, mapId) => {
    // Collect all descendant map IDs
    const idsToDelete = new Set([mapId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const m of get().maps) {
        if (m.parentMapId && idsToDelete.has(m.parentMapId) && !idsToDelete.has(m.id)) {
          idsToDelete.add(m.id);
          changed = true;
        }
      }
    }
    const maps = get().maps.filter((m) => !idsToDelete.has(m.id));
    const { activeMapId: currentActive, mapStack } = get();
    // Clean stale IDs out of the breadcrumb stack
    const cleanStack = mapStack.filter((id) => !idsToDelete.has(id));
    const newActiveMapId = idsToDelete.has(currentActive) ? (maps[0]?.id || null) : currentActive;
    set({ maps, activeMapId: newActiveMapId, mapStack: cleanStack });
    get()._persist(campaignId);
  },
}));

export default useMapStore;
