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

  // Legend entries: [{ id, color, meaning }]
  legendEntries: [],

  // Settings panel state
  settingsOpen: false,
  settingsCategory: 'view',

  /** Load settings for a campaign */
  loadSettings: (campaignId) => {
    const raw = localStorage.getItem(`flux_settings_${campaignId}`);
    if (raw) {
      const saved = JSON.parse(raw);
      set(saved);
    }
  },

  /** Persist current settings */
  _persist: (campaignId) => {
    const { settingsOpen, settingsCategory, ...rest } = get();
    localStorage.setItem(`flux_settings_${campaignId}`, JSON.stringify(rest));
  },

  /** Update a single setting */
  setSetting: (campaignId, key, value) => {
    set({ [key]: value });
    // Persist after update
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
}));

export default useSettingsStore;
