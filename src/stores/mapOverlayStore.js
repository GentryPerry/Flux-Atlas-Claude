import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { saveStore, loadCampaign } from '../utils/api';

let _saveTimer = null;
function debouncedSave(campaignId, overlays) {
  const snapshot = [...overlays];
  if (_saveTimer) clearTimeout(_saveTimer);
  _saveTimer = setTimeout(() => {
    saveStore(campaignId, 'mapOverlays', snapshot).catch((e) =>
      console.warn('MapOverlay save failed:', e)
    );
    _saveTimer = null;
  }, 400);
}

const useMapOverlayStore = create((set, get) => ({
  overlays: [],

  loadOverlays: async (campaignId) => {
    try {
      const data = await loadCampaign(campaignId);
      const overlays = Array.isArray(data.mapOverlays) ? data.mapOverlays : [];
      set({ overlays });
    } catch (e) {
      console.warn('loadOverlays failed:', e);
      set({ overlays: [] });
    }
  },

  /** Add a new image overlay to a map */
  addOverlay: (campaignId, mapId, url, { x = 0, y = 0, width = 400, height = 300 } = {}) => {
    const overlay = {
      id: uuid(),
      campaignId,
      mapId,
      url,
      x,
      y,
      width,
      height,
      opacity: 1,
      locked: false,
      createdAt: new Date().toISOString(),
    };
    const overlays = [...get().overlays, overlay];
    set({ overlays });
    debouncedSave(campaignId, overlays);
    return overlay;
  },

  /** Update position, size, opacity, locked state */
  updateOverlay: (campaignId, overlayId, updates) => {
    const overlays = get().overlays.map((o) =>
      o.id === overlayId ? { ...o, ...updates } : o
    );
    set({ overlays });
    debouncedSave(campaignId, overlays);
  },

  /** Delete an overlay */
  deleteOverlay: (campaignId, overlayId) => {
    const overlays = get().overlays.filter((o) => o.id !== overlayId);
    set({ overlays });
    debouncedSave(campaignId, overlays);
  },

  /** Get overlays for the active map */
  getOverlaysForMap: (mapId) => get().overlays.filter((o) => o.mapId === mapId),

  clearCampaign: (campaignId) => {
    const overlays = get().overlays.filter((o) => o.campaignId !== campaignId);
    set({ overlays });
    saveStore(campaignId, 'mapOverlays', []).catch(() => {});
  },
}));

export default useMapOverlayStore;
