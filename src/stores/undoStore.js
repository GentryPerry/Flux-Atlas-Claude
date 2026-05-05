/**
 * undoStore — lightweight in-memory undo stack.
 *
 * Keeps up to MAX_HISTORY snapshots of { nodes, territories, widgets }.
 * Snapshots are deep-cloned at capture time so later mutations don't mutate
 * historical entries.
 *
 * The snapshot system (snapshotStore) is completely separate and unaffected.
 *
 * Circular dep note: this file imports nodeStore / territoryStore / widgetStore,
 * and those stores import this file. ES modules resolve circular deps lazily —
 * all accesses happen inside function bodies (never at module-evaluation time),
 * so this is safe with Vite/Rollup.
 */
import { create } from 'zustand';
import useNodeStore      from './nodeStore';
import useTerritoryStore from './territoryStore';
import useWidgetStore    from './widgetStore';

const MAX_HISTORY = 50;
let _debounceTimer = null;

const useUndoStore = create((set, get) => ({
  /** Stack of { nodes, territories, widgets } deep-clones. */
  history: [],

  /**
   * Immediately capture a snapshot of all three stores.
   * Call this BEFORE a structural mutation (create, delete, nest, etc.).
   */
  captureSnapshot: () => {
    const nodes       = useNodeStore.getState().nodes;
    const territories = useTerritoryStore.getState().territories;
    const widgets     = useWidgetStore.getState().widgets;
    // structuredClone is faster than JSON round-trip and handles edge cases
    // (undefined values, etc.) without silently dropping data.
    const entry = {
      nodes:       structuredClone(nodes),
      territories: structuredClone(territories),
      widgets:     structuredClone(widgets),
    };
    const history = [...get().history, entry].slice(-MAX_HISTORY);
    set({ history });
  },

  /**
   * Debounced capture (1.5 s) for high-frequency events like text field edits.
   * Groups rapid changes into a single undo checkpoint.
   */
  captureDebouncedSnapshot: () => {
    if (_debounceTimer) clearTimeout(_debounceTimer);
    _debounceTimer = setTimeout(() => {
      _debounceTimer = null;
      useUndoStore.getState().captureSnapshot();
    }, 1500);
  },

  /** True when there is at least one step to undo. */
  canUndo: () => get().history.length > 0,

  /**
   * Pop the most recent checkpoint and restore all three stores.
   * Returns true on success, false when history is empty.
   */
  undo: (campaignId) => {
    const history = [...get().history];
    if (history.length === 0) return false;
    const entry = history.pop();
    set({ history });

    // Restore each store — their bulk-setters also persist to the API.
    useNodeStore.getState().setNodes(campaignId, entry.nodes);
    useTerritoryStore.getState().setTerritories(campaignId, entry.territories);
    useWidgetStore.getState()._setDirect(entry.widgets);
    return true;
  },

  /** Drop all history (called on campaign switch so old history can't bleed across). */
  clearHistory: () => {
    if (_debounceTimer) { clearTimeout(_debounceTimer); _debounceTimer = null; }
    set({ history: [] });
  },
}));

export default useUndoStore;
