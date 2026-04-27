import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { saveStore, loadCampaign } from '../utils/api';

const useTagStore = create((set, get) => ({
  tags: [],

  loadTags: async (campaignId) => {
    try {
      const data = await loadCampaign(campaignId);
      const tags = Array.isArray(data.tags) ? data.tags : [];
      set({ tags });
    } catch (e) {
      console.warn('loadTags failed:', e);
      set({ tags: [] });
    }
  },

  _persist: (campaignId) => {
    saveStore(campaignId, 'tags', get().tags).catch((e) =>
      console.warn('Tag save failed:', e)
    );
  },

  createTag: (campaignId, name, color = '#888888', nodeId = null) => {
    const tag = { id: uuid(), campaignId, name, color, nodeId };
    const tags = [...get().tags, tag];
    set({ tags });
    get()._persist(campaignId);
    return tag;
  },

  updateTag: (campaignId, tagId, updates) => {
    const tags = get().tags.map((t) => (t.id === tagId ? { ...t, ...updates } : t));
    set({ tags });
    get()._persist(campaignId);
  },

  deleteTag: (campaignId, tagId) => {
    const tags = get().tags.filter((t) => t.id !== tagId);
    set({ tags });
    get()._persist(campaignId);
  },

  getTag: (tagId) => get().tags.find((t) => t.id === tagId),
  getTagsForCampaign: (campaignId) => get().tags.filter((t) => t.campaignId === campaignId),
  searchTags: (query) => {
    const q = query.toLowerCase();
    return get().tags.filter((t) => t.name.toLowerCase().includes(q));
  },

  clearCampaign: (campaignId) => {
    const tags = get().tags.filter((t) => t.campaignId !== campaignId);
    set({ tags });
    saveStore(campaignId, 'tags', []).catch(() => {});
  },
}));

export default useTagStore;
