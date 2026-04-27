import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { saveStore, loadCampaign } from '../utils/api';

const useHierarchyStore = create((set, get) => ({
  hierarchies: [],

  loadHierarchies: async (cid) => {
    try {
      const data = await loadCampaign(cid);
      const hierarchies = Array.isArray(data.hierarchies) ? data.hierarchies : [];
      set({ hierarchies });
    } catch (e) {
      console.warn('loadHierarchies failed:', e);
      set({ hierarchies: [] });
    }
  },

  /** Wipe all hierarchies for a campaign */
  clearCampaign: (campaignId) => {
    const hierarchies = get().hierarchies.filter((h) => h.campaignId !== campaignId);
    set({ hierarchies });
    saveStore(campaignId, 'hierarchies', []).catch(() => {});
  },

  _persist: (cid) => {
    const data = get().hierarchies.filter((h) => h.campaignId === cid);
    saveStore(cid, 'hierarchies', data).catch((e) =>
      console.warn('Hierarchy save failed:', e)
    );
  },

  // ── Hierarchy CRUD ─────────────────────────────────────────────────────────

  createHierarchy: (campaignId, name, sourceNodeId = null) => {
    const h = {
      id:           uuid(),
      campaignId,
      name:         name || 'New Hierarchy',
      sourceNodeId: sourceNodeId || null,   // links to a faction/religion/polity node
      layers:       [{ id: uuid(), name: 'Rank 1' }],
      members:      [],   // [{ nodeId, layerId, title }]
    };
    const hierarchies = [...get().hierarchies, h];
    set({ hierarchies });
    get()._persist(campaignId);
    return h;
  },

  updateHierarchy: (id, changes) => {
    const hierarchies = get().hierarchies.map((h) => h.id === id ? { ...h, ...changes } : h);
    set({ hierarchies });
    const h = hierarchies.find((h) => h.id === id);
    if (h) get()._persist(h.campaignId);
  },

  deleteHierarchy: (id) => {
    const h = get().hierarchies.find((h) => h.id === id);
    const hierarchies = get().hierarchies.filter((h) => h.id !== id);
    set({ hierarchies });
    if (h) get()._persist(h.campaignId);
  },

  // ── Layer operations ───────────────────────────────────────────────────────

  addLayer: (hierarchyId, name, atIndex) => {
    const newLayer = { id: uuid(), name: name || 'New Rank' };
    const hierarchies = get().hierarchies.map((h) => {
      if (h.id !== hierarchyId) return h;
      const layers = [...h.layers];
      if (atIndex !== undefined) layers.splice(atIndex, 0, newLayer);
      else layers.push(newLayer);
      return { ...h, layers };
    });
    set({ hierarchies });
    const h = hierarchies.find((h) => h.id === hierarchyId);
    if (h) get()._persist(h.campaignId);
    return newLayer;
  },

  updateLayer: (hierarchyId, layerId, changes) => {
    const hierarchies = get().hierarchies.map((h) => {
      if (h.id !== hierarchyId) return h;
      return { ...h, layers: h.layers.map((l) => l.id === layerId ? { ...l, ...changes } : l) };
    });
    set({ hierarchies });
    const h = hierarchies.find((h) => h.id === hierarchyId);
    if (h) get()._persist(h.campaignId);
  },

  removeLayer: (hierarchyId, layerId) => {
    const hierarchies = get().hierarchies.map((h) => {
      if (h.id !== hierarchyId) return h;
      return {
        ...h,
        layers:  h.layers.filter((l) => l.id !== layerId),
        members: h.members.filter((m) => m.layerId !== layerId),
      };
    });
    set({ hierarchies });
    const h = hierarchies.find((h) => h.id === hierarchyId);
    if (h) get()._persist(h.campaignId);
  },

  moveLayer: (hierarchyId, layerId, delta) => {
    const hierarchies = get().hierarchies.map((h) => {
      if (h.id !== hierarchyId) return h;
      const layers = [...h.layers];
      const idx    = layers.findIndex((l) => l.id === layerId);
      const newIdx = idx + delta;
      if (idx < 0 || newIdx < 0 || newIdx >= layers.length) return h;
      [layers[idx], layers[newIdx]] = [layers[newIdx], layers[idx]];
      return { ...h, layers };
    });
    set({ hierarchies });
    const h = hierarchies.find((h) => h.id === hierarchyId);
    if (h) get()._persist(h.campaignId);
  },

  // ── Member operations ──────────────────────────────────────────────────────

  /** Assign a node to a layer (moves them if already in another layer of this hierarchy) */
  addMember: (hierarchyId, layerId, nodeId) => {
    const hierarchies = get().hierarchies.map((h) => {
      if (h.id !== hierarchyId) return h;
      const members = h.members.filter((m) => m.nodeId !== nodeId);
      return { ...h, members: [...members, { nodeId, layerId, title: '' }] };
    });
    set({ hierarchies });
    const h = hierarchies.find((h) => h.id === hierarchyId);
    if (h) get()._persist(h.campaignId);
  },

  updateMember: (hierarchyId, nodeId, changes) => {
    const hierarchies = get().hierarchies.map((h) => {
      if (h.id !== hierarchyId) return h;
      return { ...h, members: h.members.map((m) => m.nodeId === nodeId ? { ...m, ...changes } : m) };
    });
    set({ hierarchies });
    const h = hierarchies.find((h) => h.id === hierarchyId);
    if (h) get()._persist(h.campaignId);
  },

  /** Find an existing hierarchy for a node, or create one on first access */
  findOrCreateForNode: (campaignId, nodeId, name) => {
    const existing = get().hierarchies.find(
      (h) => h.sourceNodeId === nodeId && h.campaignId === campaignId
    );
    if (existing) return existing;
    return get().createHierarchy(campaignId, name, nodeId);
  },

  removeMember: (hierarchyId, nodeId) => {
    const hierarchies = get().hierarchies.map((h) => {
      if (h.id !== hierarchyId) return h;
      return { ...h, members: h.members.filter((m) => m.nodeId !== nodeId) };
    });
    set({ hierarchies });
    const h = hierarchies.find((h) => h.id === hierarchyId);
    if (h) get()._persist(h.campaignId);
  },
}));

export default useHierarchyStore;
