import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { saveStore, loadCampaign } from '../utils/api';

const useTerritoryStore = create((set, get) => ({
  territories: [],

  loadTerritories: async (campaignId) => {
    try {
      const data = await loadCampaign(campaignId);
      const territories = Array.isArray(data.territories) ? data.territories : [];
      set({ territories });
    } catch (e) {
      console.warn('loadTerritories failed:', e);
      set({ territories: [] });
    }
  },

  _persist: (campaignId) => {
    saveStore(campaignId, 'territories', get().territories).catch((e) =>
      console.warn('Territory save failed:', e)
    );
  },

  clearCampaign: (campaignId) => {
    const territories = get().territories.filter((t) => t.campaignId !== campaignId);
    set({ territories });
    saveStore(campaignId, 'territories', []).catch(() => {});
  },

  createTerritory: (campaignId, mapId, shapeType, data = {}) => {
    const territory = {
      id: uuid(),
      campaignId,
      mapId,
      nodeId: data.nodeId || null,
      name: data.name || `Territory ${new Date().toLocaleTimeString()}`,
      shapeType,
      points:      data.points      || [],
      center:      data.center      || null,
      radius:      data.radius      || 0,
      x:           data.x           !== undefined ? data.x      : 0,
      y:           data.y           !== undefined ? data.y      : 0,
      width:       data.width       !== undefined ? data.width  : 0,
      height:      data.height      !== undefined ? data.height : 0,
      color:       data.color       || '#8890a0',
      opacity:     data.opacity     !== undefined ? data.opacity      : 0.15,
      strokeColor: data.strokeColor || '#8890a0',
      strokeWidth: data.strokeWidth !== undefined ? data.strokeWidth  : 2,
      createdAt:   new Date().toISOString(),
    };
    const territories = [...get().territories, territory];
    set({ territories });
    get()._persist(campaignId);
    return territory;
  },

  updateTerritory: (campaignId, territoryId, updates) => {
    const territories = get().territories.map((t) =>
      t.id === territoryId ? { ...t, ...updates } : t
    );
    set({ territories });
    get()._persist(campaignId);
  },

  deleteTerritory: (campaignId, territoryId) => {
    const territories = get().territories.filter((t) => t.id !== territoryId);
    set({ territories });
    get()._persist(campaignId);
  },

  linkToNode: (campaignId, territoryId, nodeId) => {
    const territories = get().territories.map((t) =>
      t.id === territoryId ? { ...t, nodeId } : t
    );
    set({ territories });
    get()._persist(campaignId);
  },

  getTerritoriesForMap: (mapId) => get().territories.filter((t) => t.mapId === mapId),

  /** Bulk-set territories (used by snapshot restore) */
  setTerritories: (campaignId, territories) => {
    set({ territories });
    saveStore(campaignId, 'territories', territories).catch((e) =>
      console.warn('setTerritories save failed:', e)
    );
  },
}));

export default useTerritoryStore;
