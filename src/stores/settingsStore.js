import { create } from 'zustand';
import { saveStore, loadCampaign } from '../utils/api';

// Per-campaign timers — prevents a rapid campaign switch from cancelling a
// pending settings save for the previous campaign (same pattern as nodeStore).
const _saveTimers = new Map(); // campaignId → timerId

function debouncedSave(campaignId, data) {
  if (_saveTimers.has(campaignId)) clearTimeout(_saveTimers.get(campaignId));
  const id = setTimeout(() => {
    _saveTimers.delete(campaignId);
    saveStore(campaignId, 'settings', data).catch((e) =>
      console.warn('Settings save failed:', e)
    );
  }, 600);
  _saveTimers.set(campaignId, id);
}

const useSettingsStore = create((set, get) => ({
  layout: 'split',
  mapSide: 'left',
  showConnections: false,
  showNodeLabels: true,
  showStatusOverlays: true,
  canvasGridVisible: true,
  theme: 'dark',
  nodeTypeOverrides: {},
  customNodeTypes: [],
  nodeFieldOverrides: {},
  legendEntries: [],
  imagePool: [],
  pinterestBoards: [],
  pinterestSession: '',
  settingsOpen: false,
  settingsCategory: 'view',

  _syncPinterestSession: (session) => {
    fetch('/api/set-pinterest-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: session || '' }),
    }).catch(() => {});
  },

  loadSettings: async (campaignId) => {
    try {
      const data = await loadCampaign(campaignId);
      if (data.settings) {
        set(data.settings);
        document.documentElement.setAttribute('data-theme', data.settings.theme || 'dark');
        if (data.settings.pinterestSession) {
          get()._syncPinterestSession(data.settings.pinterestSession);
        }
      }
    } catch (e) {
      console.warn('loadSettings failed:', e);
    }
  },

  _persist: (campaignId) => {
    // Explicit allowlist — new state keys are not persisted by default, preventing
    // methods or UI flags from leaking into the server-side save payload.
    const PERSISTED_KEYS = [
      'layout', 'mapSide', 'showConnections', 'showNodeLabels',
      'showStatusOverlays', 'canvasGridVisible', 'theme',
      'nodeTypeOverrides', 'customNodeTypes', 'nodeFieldOverrides',
      'legendEntries', 'imagePool', 'pinterestBoards', 'pinterestSession',
    ];
    const state = get();
    const data = Object.fromEntries(PERSISTED_KEYS.map((k) => [k, state[k]]));
    debouncedSave(campaignId, data);
  },

  setSetting: (campaignId, key, value) => {
    set({ [key]: value });
    if (key === 'theme') document.documentElement.setAttribute('data-theme', value);
    get()._persist(campaignId);
  },

  openSettings: (category = 'view') => set({ settingsOpen: true, settingsCategory: category }),
  closeSettings: () => set({ settingsOpen: false }),
  setSettingsCategory: (category) => set({ settingsCategory: category }),

  addLegendEntry: (campaignId, color, meaning) => {
    const id = crypto.randomUUID();
    const updated = [...get().legendEntries, { id, color, meaning }];
    set({ legendEntries: updated });
    get()._persist(campaignId);
  },

  updateLegendEntry: (campaignId, entryId, updates) => {
    const updated = get().legendEntries.map((e) => (e.id === entryId ? { ...e, ...updates } : e));
    set({ legendEntries: updated });
    get()._persist(campaignId);
  },

  removeLegendEntry: (campaignId, entryId) => {
    const updated = get().legendEntries.filter((e) => e.id !== entryId);
    set({ legendEntries: updated });
    get()._persist(campaignId);
  },

  addCustomNodeType: (campaignId, typeData) => {
    const id = typeData.id || `custom_${Date.now().toString(36)}`;
    const updated = [...get().customNodeTypes, { ...typeData, id }];
    set({ customNodeTypes: updated });
    get()._persist(campaignId);
    return id;
  },

  updateCustomNodeType: (campaignId, typeId, updates) => {
    const updated = get().customNodeTypes.map((t) => (t.id === typeId ? { ...t, ...updates } : t));
    set({ customNodeTypes: updated });
    get()._persist(campaignId);
  },

  removeCustomNodeType: (campaignId, typeId) => {
    const updated = get().customNodeTypes.filter((t) => t.id !== typeId);
    set({ customNodeTypes: updated });
    get()._persist(campaignId);
  },

  addNodeTypeField: (campaignId, nodeType, field) => {
    const current = get().nodeFieldOverrides[nodeType] || { added: [], removed: [] };
    const newField = { ...field, key: field.key || `custom_${Date.now().toString(36)}` };
    const updated = { ...get().nodeFieldOverrides, [nodeType]: { ...current, added: [...(current.added || []), newField] } };
    set({ nodeFieldOverrides: updated });
    get()._persist(campaignId);
  },

  removeNodeTypeField: (campaignId, nodeType, fieldKey) => {
    const current = get().nodeFieldOverrides[nodeType] || { added: [], removed: [] };
    const added   = (current.added   || []).filter((f) => f.key !== fieldKey);
    const removed = [...new Set([...(current.removed || []), fieldKey])];
    const updated = { ...get().nodeFieldOverrides, [nodeType]: { ...current, added, removed } };
    set({ nodeFieldOverrides: updated });
    get()._persist(campaignId);
  },

  restoreNodeTypeField: (campaignId, nodeType, fieldKey) => {
    const current = get().nodeFieldOverrides[nodeType] || { added: [], removed: [] };
    const removed = (current.removed || []).filter((k) => k !== fieldKey);
    const updated = { ...get().nodeFieldOverrides, [nodeType]: { ...current, removed } };
    set({ nodeFieldOverrides: updated });
    get()._persist(campaignId);
  },

  addToImagePool: (campaignId, url, label = '') => {
    const pool = get().imagePool || [];
    if (pool.some((p) => p.url === url)) return;
    const id = crypto.randomUUID();
    const updated = [...pool, { id, url, label }];
    set({ imagePool: updated });
    get()._persist(campaignId);
  },

  removeFromImagePool: (campaignId, imageId) => {
    const updated = (get().imagePool || []).filter((p) => p.id !== imageId);
    set({ imagePool: updated });
    get()._persist(campaignId);
  },

  updateImagePoolItem: (campaignId, imageId, changes) => {
    const updated = (get().imagePool || []).map((p) => (p.id === imageId ? { ...p, ...changes } : p));
    set({ imagePool: updated });
    get()._persist(campaignId);
  },

  clearImagePool: (campaignId) => {
    set({ imagePool: [] });
    get()._persist(campaignId);
  },

  setPinterestSession: (campaignId, value) => {
    set({ pinterestSession: value });
    get()._persist(campaignId);
    get()._syncPinterestSession(value);
  },

  addPinterestBoard: (campaignId, url, label) => {
    const boards = get().pinterestBoards || [];
    if (boards.some((b) => b.url === url)) return;
    const id = crypto.randomUUID();
    const updated = [...boards, { id, url, label }];
    set({ pinterestBoards: updated });
    get()._persist(campaignId);
  },

  removePinterestBoard: (campaignId, boardId) => {
    const updated = (get().pinterestBoards || []).filter((b) => b.id !== boardId);
    set({ pinterestBoards: updated });
    get()._persist(campaignId);
  },
}));

export default useSettingsStore;
