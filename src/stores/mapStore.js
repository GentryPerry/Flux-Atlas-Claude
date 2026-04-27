import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { saveStore, loadCampaign } from '../utils/api';

const useMapStore = create((set, get) => ({
  maps: [],
  activeMapId: null,
  mapStack: [],

  loadMaps: async (campaignId) => {
    try {
      const data = await loadCampaign(campaignId);
      const maps = Array.isArray(data.maps) ? data.maps : [];
      set({ maps, activeMapId: maps[0]?.id || null, mapStack: [] });
    } catch (e) {
      console.warn('loadMaps failed:', e);
      set({ maps: [], activeMapId: null, mapStack: [] });
    }
  },

  _persist: (campaignId) => {
    saveStore(campaignId, 'maps', get().maps).catch((e) =>
      console.warn('Map save failed:', e)
    );
  },

  createMap: (campaignId, name, imageUrl, parentMapId = null) => {
    const map = {
      id: uuid(),
      campaignId,
      name,
      image: imageUrl,
      parentMapId,
      createdAt: new Date().toISOString(),
    };
    const maps = [...get().maps, map];
    set({ maps, activeMapId: map.id });
    get()._persist(campaignId);
    return map;
  },

  drillDown: (childMapId) => {
    const { activeMapId, mapStack } = get();
    set({ mapStack: [...mapStack, activeMapId], activeMapId: childMapId });
  },

  drillUp: () => {
    const { mapStack } = get();
    if (mapStack.length === 0) return;
    const newStack = [...mapStack];
    const parentId = newStack.pop();
    set({ mapStack: newStack, activeMapId: parentId });
  },

  jumpTo: (mapId) => {
    const { mapStack } = get();
    const idx = mapStack.indexOf(mapId);
    if (idx === -1) return;
    set({ mapStack: mapStack.slice(0, idx), activeMapId: mapId });
  },

  setActiveMap: (mapId) => set({ activeMapId: mapId, mapStack: [] }),

  getActiveMap: () => {
    const { maps, activeMapId } = get();
    return maps.find((m) => m.id === activeMapId) || null;
  },

  getBreadcrumbs: () => {
    const { maps, mapStack, activeMapId } = get();
    return [...mapStack, activeMapId]
      .filter(Boolean)
      .map((id) => maps.find((m) => m.id === id))
      .filter(Boolean);
  },

  updateMap: (campaignId, mapId, updates) => {
    const maps = get().maps.map((m) => (m.id === mapId ? { ...m, ...updates } : m));
    set({ maps });
    get()._persist(campaignId);
  },

  deleteMap: (campaignId, mapId) => {
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
    const cleanStack = mapStack.filter((id) => !idsToDelete.has(id));
    const newActiveMapId = idsToDelete.has(currentActive) ? (maps[0]?.id || null) : currentActive;
    set({ maps, activeMapId: newActiveMapId, mapStack: cleanStack });
    get()._persist(campaignId);
  },
}));

export default useMapStore;
