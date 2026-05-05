import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { buildDefaultFields, buildDefaultStatusFlags } from '../utils/nodeSchemas';
import { saveStore, loadCampaign } from '../utils/api';
import { getCachedStatus } from '../hooks/useAccountStatus';
import useUndoStore from './undoStore';

/**
 * Debounced API save — batches rapid updates (drag, typing) into one write.
 * Critical for canvas drag performance with 70+ nodes.
 * Node images are now R2 URLs (short strings), so payload size is no longer
 * a concern and nodes can be saved as-is.
 *
 * Per-campaign timers: using a Map so rapid campaign switching never silently
 * drops a pending save for campaign A when campaign B triggers a new save.
 */
const _saveTimers = new Map(); // campaignId → timerId

function debouncedSave(campaignId, nodes) {
  // Snapshot at call-time so the closure captures the exact state requested.
  const snapshot = [...nodes];
  if (_saveTimers.has(campaignId)) clearTimeout(_saveTimers.get(campaignId));
  const id = setTimeout(() => {
    _saveTimers.delete(campaignId);
    saveStore(campaignId, 'nodes', snapshot).catch((e) =>
      console.warn('Node save failed:', e)
    );
  }, 400);
  _saveTimers.set(campaignId, id);
}

const useNodeStore = create((set, get) => ({
  nodes: [],
  selectedNodeId: null,

  /** Load nodes for a campaign from D1 */
  loadNodes: async (campaignId) => {
    try {
      const data = await loadCampaign(campaignId);
      const nodes = Array.isArray(data.nodes) ? data.nodes : [];
      set({ nodes, selectedNodeId: null });
    } catch (e) {
      console.warn('loadNodes failed:', e);
      set({ nodes: [], selectedNodeId: null });
    }
  },

  /** Create a node on a specific map at a position */
  createNode: (campaignId, mapId, nodeType, x, y) => {
    useUndoStore.getState().captureSnapshot();
    // ── Client-side limit check (server enforces too) ──
    const status = getCachedStatus();
    if (status) {
      const { used, limit } = status.usage.nodes;
      if (limit !== null && limit !== undefined && used >= limit) {
        const e = new Error(
          `Free accounts can create up to ${limit} nodes. Upgrade options are coming soon.`
        );
        e.code    = 'NODE_LIMIT_REACHED';
        e.limit   = limit;
        e.current = used;
        throw e;
      }
    }

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
      parentNodeId: null,
      createdAt: new Date().toISOString(),
    };
    const nodes = [...get().nodes, node];
    set({ nodes, selectedNodeId: node.id });
    debouncedSave(campaignId, get().nodes);
    return node;
  },

  /** Update a node's position */
  moveNode: (campaignId, nodeId, x, y) => {
    const nodes = get().nodes.map((n) =>
      n.id === nodeId ? { ...n, x, y } : n
    );
    set({ nodes });
    debouncedSave(campaignId, get().nodes);
  },

  /** Update a node's fields */
  updateNodeFields: (campaignId, nodeId, fieldUpdates) => {
    useUndoStore.getState().captureDebouncedSnapshot();
    const now = new Date().toISOString();
    const nodes = get().nodes.map((n) =>
      n.id === nodeId ? { ...n, updatedAt: now, fields: { ...n.fields, ...fieldUpdates } } : n
    );
    set({ nodes });
    debouncedSave(campaignId, get().nodes);
  },

  /** Update any top-level node property */
  updateNode: (campaignId, nodeId, updates) => {
    useUndoStore.getState().captureSnapshot();
    const now = new Date().toISOString();
    const nodes = get().nodes.map((n) =>
      n.id === nodeId ? { ...n, updatedAt: now, ...updates } : n
    );
    set({ nodes });
    debouncedSave(campaignId, get().nodes);
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
  getNodesForMap: (mapId) => get().nodes.filter((n) => n.mapId === mapId),

  /** Nest a node inside a parent */
  nestNode: (campaignId, childId, parentId) => {
    useUndoStore.getState().captureSnapshot();
    const nodes = get().nodes.map((n) =>
      n.id === childId ? { ...n, parentNodeId: parentId } : n
    );
    set({ nodes });
    debouncedSave(campaignId, get().nodes);
  },

  /** Unnest a node — restore to top level at given position */
  unnestNode: (campaignId, nodeId, x, y) => {
    useUndoStore.getState().captureSnapshot();
    const nodes = get().nodes.map((n) =>
      n.id === nodeId ? { ...n, parentNodeId: null, x: x ?? n.x, y: y ?? n.y } : n
    );
    set({ nodes });
    debouncedSave(campaignId, get().nodes);
  },

  /** Delete a node and ALL its descendants (recursive cascade) */
  deleteNode: (campaignId, nodeId) => {
    useUndoStore.getState().captureSnapshot();
    const allNodes = get().nodes;
    const toDelete = new Set([nodeId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const n of allNodes) {
        if (n.parentNodeId && toDelete.has(n.parentNodeId) && !toDelete.has(n.id)) {
          toDelete.add(n.id);
          changed = true;
        }
      }
    }
    const nodes = allNodes.filter((n) => !toDelete.has(n.id));
    const selectedNodeId = toDelete.has(get().selectedNodeId) ? null : get().selectedNodeId;
    set({ nodes, selectedNodeId });
    debouncedSave(campaignId, get().nodes);
  },

  /** Wipe all nodes for a campaign */
  clearCampaign: (campaignId) => {
    const nodes = get().nodes.filter((n) => n.campaignId !== campaignId);
    set({ nodes, selectedNodeId: null });
    saveStore(campaignId, 'nodes', []).catch(() => {});
  },

  /** Add an image to a node */
  addNodeImage: (campaignId, nodeId, imageDataUrl) => {
    useUndoStore.getState().captureSnapshot();
    const nodes = get().nodes.map((n) => {
      if (n.id !== nodeId) return n;
      return {
        ...n,
        images: [...n.images, { id: uuid(), url: imageDataUrl, sortOrder: n.images.length }],
      };
    });
    set({ nodes });
    debouncedSave(campaignId, get().nodes);
  },

  /** Remove an image from a node */
  removeNodeImage: (campaignId, nodeId, imageId) => {
    useUndoStore.getState().captureSnapshot();
    const nodes = get().nodes.map((n) => {
      if (n.id !== nodeId) return n;
      return { ...n, images: n.images.filter((img) => img.id !== imageId) };
    });
    set({ nodes });
    debouncedSave(campaignId, get().nodes);
  },

  /** Bulk-set nodes (used by import and snapshot restore) */
  setNodes: (campaignId, nodes) => {
    set({ nodes });
    saveStore(campaignId, 'nodes', nodes).catch((e) =>
      console.warn('setNodes save failed:', e)
    );
  },
}));

export default useNodeStore;
