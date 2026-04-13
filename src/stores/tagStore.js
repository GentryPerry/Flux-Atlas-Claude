import { create } from 'zustand';
import { v4 as uuid } from 'uuid';

/**
 * Tag store — manages tags (node-reference and status-label).
 */
const useTagStore = create((set, get) => ({
  tags: [],

  loadTags: (campaignId) => {
    const raw = localStorage.getItem(`flux_tags_${campaignId}`);
    const tags = raw ? JSON.parse(raw) : [];
    set({ tags });
  },

  _persist: (campaignId) => {
    localStorage.setItem(`flux_tags_${campaignId}`, JSON.stringify(get().tags));
  },

  /** Create a tag. nodeId = null for status-label tags. */
  createTag: (campaignId, name, color = '#888888', nodeId = null) => {
    const tag = {
      id: uuid(),
      campaignId,
      name,
      color,
      nodeId, // if set, this tag resolves to a node (node-reference tag)
    };
    const tags = [...get().tags, tag];
    set({ tags });
    localStorage.setItem(`flux_tags_${campaignId}`, JSON.stringify(tags));
    return tag;
  },

  /** Update a tag */
  updateTag: (campaignId, tagId, updates) => {
    const tags = get().tags.map((t) =>
      t.id === tagId ? { ...t, ...updates } : t
    );
    set({ tags });
    localStorage.setItem(`flux_tags_${campaignId}`, JSON.stringify(tags));
  },

  /** Delete a tag */
  deleteTag: (campaignId, tagId) => {
    const tags = get().tags.filter((t) => t.id !== tagId);
    set({ tags });
    localStorage.setItem(`flux_tags_${campaignId}`, JSON.stringify(tags));
  },

  /** Get tag by ID */
  getTag: (tagId) => get().tags.find((t) => t.id === tagId),

  /** Get all tags for a campaign */
  getTagsForCampaign: (campaignId) => get().tags.filter((t) => t.campaignId === campaignId),

  /** Search tags by name */
  searchTags: (query) => {
    const q = query.toLowerCase();
    return get().tags.filter((t) => t.name.toLowerCase().includes(q));
  },
}));

export default useTagStore;
