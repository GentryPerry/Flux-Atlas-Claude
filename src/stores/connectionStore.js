import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { saveStore, loadCampaign } from '../utils/api';

let _connSaveTimer = null;

function debouncedConnectionSave(campaignId, connections) {
  const snapshot = [...connections];
  if (_connSaveTimer) clearTimeout(_connSaveTimer);
  _connSaveTimer = setTimeout(() => {
    saveStore(campaignId, 'connections', snapshot).catch((e) =>
      console.warn('Connection save failed:', e)
    );
    _connSaveTimer = null;
  }, 400);
}

const useConnectionStore = create((set, get) => ({
  connections: [],

  loadConnections: async (campaignId) => {
    try {
      const data = await loadCampaign(campaignId);
      const connections = Array.isArray(data.connections) ? data.connections : [];
      set({ connections });
    } catch (e) {
      console.warn('loadConnections failed:', e);
      set({ connections: [] });
    }
  },

  _persist: (campaignId) => {
    debouncedConnectionSave(campaignId, get().connections);
  },

  createConnection: (campaignId, nodeAId, nodeBId, options = {}) => {
    const connection = {
      id: uuid(),
      campaignId,
      nodeAId,
      nodeBId,
      color: options.color || '#ffffff',
      label: options.label || '',
      directional: options.directional || false,
      direction: options.direction || 'a-to-b',
    };
    const connections = [...get().connections, connection];
    set({ connections });
    get()._persist(campaignId);
    return connection;
  },

  updateConnection: (campaignId, connectionId, updates) => {
    const connections = get().connections.map((c) =>
      c.id === connectionId ? { ...c, ...updates } : c
    );
    set({ connections });
    get()._persist(campaignId);
  },

  deleteConnection: (campaignId, connectionId) => {
    const connections = get().connections.filter((c) => c.id !== connectionId);
    set({ connections });
    get()._persist(campaignId);
  },

  getConnectionsForNode: (nodeId) =>
    get().connections.filter((c) => c.nodeAId === nodeId || c.nodeBId === nodeId),

  getConnectionsForMap: (mapId, nodes) => {
    const nodeIds = new Set(nodes.map((n) => n.id));
    return get().connections.filter(
      (c) => nodeIds.has(c.nodeAId) && nodeIds.has(c.nodeBId)
    );
  },
}));

export default useConnectionStore;
