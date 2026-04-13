import { create } from 'zustand';
import { v4 as uuid } from 'uuid';

/**
 * Campaign store — manages campaigns and active campaign selection.
 * Storage-agnostic: all persistence goes through actions that can be
 * swapped to PocketBase or any other backend.
 */
const useCampaignStore = create((set, get) => ({
  campaigns: [],
  activeCampaignId: null,

  /** Load all campaigns from localStorage (swap to PB later) */
  loadCampaigns: () => {
    const raw = localStorage.getItem('flux_campaigns');
    const campaigns = raw ? JSON.parse(raw) : [];
    set({ campaigns });
  },

  /** Create a new campaign */
  createCampaign: (name, description = '') => {
    const campaign = {
      id: uuid(),
      name,
      description,
      createdAt: new Date().toISOString(),
      legendEntries: [],
      customTypes: {},
    };
    const campaigns = [...get().campaigns, campaign];
    localStorage.setItem('flux_campaigns', JSON.stringify(campaigns));
    set({ campaigns, activeCampaignId: campaign.id });
    return campaign;
  },

  /** Set the active campaign */
  setActiveCampaign: (id) => {
    set({ activeCampaignId: id });
  },

  /** Get the active campaign object */
  getActiveCampaign: () => {
    const { campaigns, activeCampaignId } = get();
    return campaigns.find((c) => c.id === activeCampaignId) || null;
  },

  /** Update campaign details */
  updateCampaign: (id, updates) => {
    const campaigns = get().campaigns.map((c) =>
      c.id === id ? { ...c, ...updates } : c
    );
    localStorage.setItem('flux_campaigns', JSON.stringify(campaigns));
    set({ campaigns });
  },

  /** Delete a campaign */
  deleteCampaign: (id) => {
    const campaigns = get().campaigns.filter((c) => c.id !== id);
    localStorage.setItem('flux_campaigns', JSON.stringify(campaigns));
    const activeCampaignId = get().activeCampaignId === id ? null : get().activeCampaignId;
    set({ campaigns, activeCampaignId });
  },
}));

export default useCampaignStore;
