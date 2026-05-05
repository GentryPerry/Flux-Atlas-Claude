import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { saveStore, loadCampaign as apiLoad } from '../utils/api';
import { getCachedStatus } from '../hooks/useAccountStatus';

// Campaigns list lives under a special meta key — it's user-level, not campaign-level
const META = '__meta__';

const useCampaignStore = create((set, get) => ({
  campaigns: [],
  activeCampaignId: null,

  /** Load all campaigns for the logged-in user */
  loadCampaigns: async () => {
    try {
      const data = await apiLoad(META);
      const campaigns = Array.isArray(data.campaigns) ? data.campaigns : [];
      set({ campaigns });
    } catch (e) {
      console.warn('loadCampaigns failed:', e);
      set({ campaigns: [] });
    }
  },

  /** Create a new campaign */
  createCampaign: async (name, description = '') => {
    // ── Client-side limit check (server enforces too) ──
    const status = getCachedStatus();
    if (status) {
      const { used, limit } = status.usage.campaigns;
      if (limit !== null && limit !== undefined && used >= limit) {
        const e = new Error(
          `Free accounts can create up to ${limit} campaigns. Upgrade options are coming soon.`
        );
        e.code    = 'CAMPAIGN_LIMIT_REACHED';
        e.limit   = limit;
        e.current = used;
        throw e;
      }
    }

    const campaign = {
      id: uuid(),
      name,
      description,
      createdAt: new Date().toISOString(),
    };
    const campaigns = [...get().campaigns, campaign];
    set({ campaigns, activeCampaignId: campaign.id });
    await saveStore(META, 'campaigns', campaigns);
    return campaign;
  },

  /** Set the active campaign */
  setActiveCampaign: (id) => set({ activeCampaignId: id }),

  /** Get the active campaign object */
  getActiveCampaign: () => {
    const { campaigns, activeCampaignId } = get();
    return campaigns.find((c) => c.id === activeCampaignId) || null;
  },

  /** Update campaign details */
  updateCampaign: async (id, updates) => {
    const campaigns = get().campaigns.map((c) =>
      c.id === id ? { ...c, ...updates } : c
    );
    set({ campaigns });
    await saveStore(META, 'campaigns', campaigns);
  },

  /** Delete a campaign */
  deleteCampaign: async (id) => {
    const campaigns = get().campaigns.filter((c) => c.id !== id);
    const activeCampaignId = get().activeCampaignId === id ? null : get().activeCampaignId;
    set({ campaigns, activeCampaignId });
    await saveStore(META, 'campaigns', campaigns);
  },
}));

export default useCampaignStore;
