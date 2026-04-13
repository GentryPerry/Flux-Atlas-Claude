import { create } from 'zustand';
import { v4 as uuid } from 'uuid';

/**
 * Connection store — manages connections between nodes.
 */
const useConnectionStore = create((set, get) => ({
  connections: [],

  loadConnections: (campaignId) => {
    const raw = localStorage.getItem(`flux_connections_${campaignId}`);
    const connections = raw ? JSON.parse(raw) : [];
    set({ connections });
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
      direction: options.direction || 'a-to-b', // 'a-to-b', 'b-to-a', 'both'
    };
    const connections = [...get().connections, connection];
    set({ connections });
    localStorage.setItem(`flux_connections_${campaignId}`, JSON.stringify(connections));
    return connection;
  },

  updateConnection: (campaignId, connectionId, updates) => {
    const connections = get().connections.map((c) =>
      c.id === connectionId ? { ...c, ...updates } : c
    );
    set({ connections });
    localStorage.setItem(`flux_connections_${campaignId}`, JSON.stringify(connections));
  },

  deleteConnection: (campaignId, connectionId) => {
    const connections = get().connections.filter((c) => c.id !== connectionId);
    set({ connections });
    localStorage.setItem(`flux_connections_${campaignId}`, JSON.stringify(connections));
  },

  /** Get connections involving a specific node */
  getConnectionsForNode: (nodeId) => {
    return get().connections.filter(
      (c) => c.nodeAId === nodeId || c.nodeBId === nodeId
    );
  },

  /** Get connections between nodes on a given map */
  getConnectionsForMap: (mapId, nodes) => {
    const nodeIds = new Set(nodes.map((n) => n.id));
    return get().connections.filter(
      (c) => nodeIds.has(c.nodeAId) && nodeIds.has(c.nodeBId)
    );
  },
}));

export default useConnectionStore;
