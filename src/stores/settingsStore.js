import { create } from 'zustand';

/**
 * Settings store — persistent user preferences per campaign.
 */
const useSettingsStore = create((set, get) => ({
  // View preferences
  layout: 'split',          // 'full' | 'split'
  mapSide: 'left',          // 'left' | 'right'
  showConnections: false,
  showNodeLabels: true,
  showStatusOverlays: true,
  canvasGridVisible: true,
  theme: 'dark',            // 'dark' | 'light'

  // Node type display overrides: { type: { label?, color?, icon? } }
  nodeTypeOverrides: {},

  // Custom node types: [{ id, label, icon, color }]
  customNodeTypes: [],

  // Per-type field schema overrides: { type: { added: [...fields], removed: ['fieldKey', ...] } }
  nodeFieldOverrides: {},

  // Legend entries: [{ id, color, meaning }]
  legendEntries: [],

  // Campaign image pool — images available to any node [{ id, url, label? }]
  imagePool: [],

  // Saved Pinterest boards: [{ id, url, label }]
  pinterestBoards: [],

  // Pinterest session cookie — used to authenticate proxy requests.
  // User pastes the value of their _pinterest_sess cookie from pinterest.com DevTools.
  pinterestSession: '',

  // Settings panel state
  settingsOpen: false,
  settingsCategory: 'view',

  /** Push the current Pinterest session into the Vite dev-server proxy.
   *  The proxy reads from a shared in-memory variable, so this takes effect
   *  immediately without a server restart. Safe to call in production (no-op). */
  _syncPinterestSession: (session) => {
    fetch('/api/set-pinterest-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session: session || '' }),
    }).catch(() => { /* no-op outside dev */ });
  },

  /** Load settings for a campaign */
  loadSettings: (campaignId) => {
    const raw = localStorage.getItem(`flux_settings_${campaignId}`);
    if (!raw) return;
    try {
      const saved = JSON.parse(raw);
      set(saved);
      // Apply theme immediately on load
      document.documentElement.setAttribute('data-theme', saved.theme || 'dark');
      // Re-sync Pinterest session into the proxy on every page load so the
      // user never has to restart the dev server after the first time setup.
      if (saved.pinterestSession) get()._syncPinterestSession(saved.pinterestSession);
    } catch (e) {
      console.warn('loadSettings failed:', e);
    }
  },

  /** Persist current settings */
  _persist: (campaignId) => {
    try {
      const { settingsOpen, settingsCategory, ...rest } = get();
      localStorage.setItem(`flux_settings_${campaignId}`, JSON.stringify(rest));
    } catch (e) {
      console.warn('Settings persist failed:', e);
    }
  },

  /** Update a single setting */
  setSetting: (campaignId, key, value) => {
    set({ [key]: value });
    if (key === 'theme') {
      document.documentElement.setAttribute('data-theme', value);
    }
    const { settingsOpen, settingsCategory, ...rest } = { ...get(), [key]: value };
    localStorage.setItem(`flux_settings_${campaignId}`, JSON.stringify(rest));
  },

  /** Open settings panel to a specific category */
  openSettings: (category = 'view') => set({ settingsOpen: true, settingsCategory: category }),
  closeSettings: () => set({ settingsOpen: false }),
  setSettingsCategory: (category) => set({ settingsCategory: category }),

  /** Legend management */
  addLegendEntry: (campaignId, color, meaning) => {
    const { legendEntries } = get();
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
    const updated = [...legendEntries, { id, color, meaning }];
    set({ legendEntries: updated });
    get()._persist(campaignId);
  },

  updateLegendEntry: (campaignId, entryId, updates) => {
    const updated = get().legendEntries.map((e) =>
      e.id === entryId ? { ...e, ...updates } : e
    );
    set({ legendEntries: updated });
    get()._persist(campaignId);
  },

  removeLegendEntry: (campaignId, entryId) => {
    const updated = get().legendEntries.filter((e) => e.id !== entryId);
    set({ legendEntries: updated });
    get()._persist(campaignId);
  },

  /** Custom node type management */
  addCustomNodeType: (campaignId, typeData) => {
    const id = typeData.id || `custom_${Date.now().toString(36)}`;
    const updated = [...get().customNodeTypes, { ...typeData, id }];
    set({ customNodeTypes: updated });
    get()._persist(campaignId);
    return id;
  },

  updateCustomNodeType: (campaignId, typeId, updates) => {
    const updated = get().customNodeTypes.map((t) =>
      t.id === typeId ? { ...t, ...updates } : t
    );
    set({ customNodeTypes: updated });
    get()._persist(campaignId);
  },

  removeCustomNodeType: (campaignId, typeId) => {
    const updated = get().customNodeTypes.filter((t) => t.id !== typeId);
    set({ customNodeTypes: updated });
    get()._persist(campaignId);
  },

  /** Add a field to a node type's global schema */
  addNodeTypeField: (campaignId, nodeType, field) => {
    const current = get().nodeFieldOverrides[nodeType] || { added: [], removed: [] };
    const newField = { ...field, key: field.key || `custom_${Date.now().toString(36)}` };
    const updated = {
      ...get().nodeFieldOverrides,
      [nodeType]: { ...current, added: [...(current.added || []), newField] },
    };
    set({ nodeFieldOverrides: updated });
    get()._persist(campaignId);
  },

  /** Remove a field from a node type's global schema */
  removeNodeTypeField: (campaignId, nodeType, fieldKey) => {
    const current = get().nodeFieldOverrides[nodeType] || { added: [], removed: [] };
    const added = (current.added || []).filter((f) => f.key !== fieldKey);
    const removed = [...new Set([...(current.removed || []), fieldKey])];
    const updated = {
      ...get().nodeFieldOverrides,
      [nodeType]: { ...current, added, removed },
    };
    set({ nodeFieldOverrides: updated });
    get()._persist(campaignId);
  },

  /** Restore a removed field to a node type's global schema */
  restoreNodeTypeField: (campaignId, nodeType, fieldKey) => {
    const current = get().nodeFieldOverrides[nodeType] || { added: [], removed: [] };
    const removed = (current.removed || []).filter((k) => k !== fieldKey);
    const updated = {
      ...get().nodeFieldOverrides,
      [nodeType]: { ...current, removed },
    };
    set({ nodeFieldOverrides: updated });
    get()._persist(campaignId);
  },

  /** Image Pool management */
  addToImagePool: (campaignId, url, label = '') => {
    const pool = get().imagePool || [];
    if (pool.some((p) => p.url === url)) return; // no duplicates
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
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

  /** Pinterest session cookie */
  setPinterestSession: (campaignId, value) => {
    set({ pinterestSession: value });
    get()._persist(campaignId);
    // Immediately update the Vite proxy — no restart needed
    get()._syncPinterestSession(value);
  },

  /** Pinterest board management */
  addPinterestBoard: (campaignId, url, label) => {
    const boards = get().pinterestBoards || [];
    // Don't duplicate
    if (boards.some((b) => b.url === url)) return;
    const id = crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36);
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
