import { create } from 'zustand';
import { saveStore, loadCampaign } from '../utils/api';

const usePlayerRevealStore = create((set, get) => ({
  revealedNodeIds: [],

  loadReveal: async (campaignId) => {
    try {
      const data = await loadCampaign(campaignId);
      set({ revealedNodeIds: Array.isArray(data.player_reveal) ? data.player_reveal : [] });
    } catch {
      set({ revealedNodeIds: [] });
    }
  },

  _persist: (campaignId) => {
    saveStore(campaignId, 'player_reveal', get().revealedNodeIds).catch(() => {});
  },

  revealNode: (campaignId, nodeId) => {
    if (get().revealedNodeIds.includes(nodeId)) return;
    const next = [...get().revealedNodeIds, nodeId];
    set({ revealedNodeIds: next });
    get()._persist(campaignId);
  },

  unrevealNode: (campaignId, nodeId) => {
    const next = get().revealedNodeIds.filter((id) => id !== nodeId);
    set({ revealedNodeIds: next });
    get()._persist(campaignId);
  },

  isRevealed: (nodeId) => get().revealedNodeIds.includes(nodeId),
}));

export default usePlayerRevealStore;
