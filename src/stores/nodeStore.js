import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { buildDefaultFields, buildDefaultStatusFlags } from '../utils/nodeSchemas';

/**
 * Debounced localStorage writer — batches rapid updates into a single write.
 * This is critical for performance with 70+ nodes.
 */
let _persistTimer = null;
let _persistCampaignId = null;

function debouncedPersist(campaignId, getNodes) {
  _persistCampaignId = campaignId;
  if (_persistTimer) clearTimeout(_persistTimer);
  _persistTimer = setTimeout(() => {
    try {
      localStorage.setItem(`flux_nodes_${_persistCampaignId}`, JSON.stringify(getNodes()));
    } catch (e) {
      console.warn('Node persist failed:', e);
    }
    _persistTimer = null;
  }, 300);
}

/**
 * Node store — manages all nodes for the active campaign.
 */
const useNodeStore = create((set, get) => ({
  nodes: [],
  selectedNodeId: null,

  /** Load nodes for a campaign */
  loadNodes: (campaignId) => {
    const raw = localStorage.getItem(`flux_nodes_${campaignId}`);
    const nodes = raw ? JSON.parse(raw) : [];
    set({ nodes, selectedNodeId: null });
  },

  /** Create a node on a specific map at a position */
  createNode: (campaignId, mapId, nodeType, x, y) => {
    const fields = buildDefaultFields(nodeType);
    const node = {
      id: uuid(),
      campaignId,
      mapId,
      type: nodeType,
      x,
      y,
      fields,
      statusFlags: buildDefaultStatusFlags(nodeType),
      icon: null,
      customIcon: null,
      images: [],
      tagIds: [],
      drillDownTargets: [],
      createdAt: new Date().toISOString(),
    };
    const nodes = [...get().nodes, node];
    set({ nodes, selectedNodeId: node.id });
    debouncedPersist(campaignId, () => get().nodes);
    return node;
  },

  /** Update a node's position */
  moveNode: (campaignId, nodeId, x, y) => {
    const nodes = get().nodes.map((n) =>
      n.id === nodeId ? { ...n, x, y } : n
    );
    set({ nodes });
    debouncedPersist(campaignId, () => get().nodes);
  },

  /** Update a node's fields */
  updateNodeFields: (campaignId, nodeId, fieldUpdates) => {
    const nodes = get().nodes.map((n) =>
      n.id === nodeId ? { ...n, fields: { ...n.fields, ...fieldUpdates } } : n
    );
    set({ nodes });
    debouncedPersist(campaignId, () => get().nodes);
  },

  /** Update any top-level node property */
  updateNode: (campaignId, nodeId, updates) => {
    const nodes = get().nodes.map((n) =>
      n.id === nodeId ? { ...n, ...updates } : n
    );
    set({ nodes });
    debouncedPersist(campaignId, () => get().nodes);
  },

  /** Select a node */
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),

  /** Deselect */
  deselectNode: () => set({ selectedNodeId: null }),

  /** Get selected node */
  getSelectedNode: () => {
    const { nodes, selectedNodeId } = get();
    return nodes.find((n) => n.id === selectedNodeId) || null;
  },

  /** Get nodes for a specific map */
  getNodesForMap: (mapId) => {
    return get().nodes.filter((n) => n.mapId === mapId);
  },

  /** Delete a node */
  deleteNode: (campaignId, nodeId) => {
    const nodes = get().nodes.filter((n) => n.id !== nodeId);
    const selectedNodeId = get().selectedNodeId === nodeId ? null : get().selectedNodeId;
    set({ nodes, selectedNodeId });
    debouncedPersist(campaignId, () => get().nodes);
  },

  /** Add an image to a node */
  addNodeImage: (campaignId, nodeId, imageDataUrl) => {
    const nodes = get().nodes.map((n) => {
      if (n.id !== nodeId) return n;
      return { ...n, images: [...n.images, { id: uuid(), url: imageDataUrl, sortOrder: n.images.length }] };
    });
    set({ nodes });
    debouncedPersist(campaignId, () => get().nodes);
  },

  /** Remove an image from a node */
  removeNodeImage: (campaignId, nodeId, imageId) => {
    const nodes = get().nodes.map((n) => {
      if (n.id !== nodeId) return n;
      return { ...n, images: n.images.filter((img) => img.id !== imageId) };
    });
    set({ nodes });
    debouncedPersist(campaignId, () => get().nodes);
  },
}));

export default useNodeStore;
