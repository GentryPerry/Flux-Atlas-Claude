import { create } from 'zustand';
import { v4 as uuid } from 'uuid';

const STORAGE_KEY        = (cid) => `flux_snapshots_${cid}`;
const CURRENT_KEY        = (cid) => `flux_snapshot_current_${cid}`;

const useSnapshotStore = create((set, get) => ({
  snapshots:         [],
  currentSnapshotId: null, // ID of the snapshot whose worldState == live state

  /** Load snapshots + currentSnapshotId for a campaign from localStorage */
  loadSnapshots: (campaignId) => {
    try {
      const raw      = localStorage.getItem(STORAGE_KEY(campaignId));
      const snapshots = raw ? JSON.parse(raw) : [];
      const currentId = localStorage.getItem(CURRENT_KEY(campaignId)) || null;
      set({ snapshots, currentSnapshotId: currentId });
    } catch {
      set({ snapshots: [], currentSnapshotId: null });
    }
  },

  _persist: (campaignId) => {
    try {
      // Merge in-memory with whatever is in localStorage so a cold store never
      // destroys existing history. In-memory entries win on ID conflict.
      const inMemory = get().snapshots.filter((s) => s.campaignId === campaignId);
      const raw = localStorage.getItem(STORAGE_KEY(campaignId));
      const stored = raw ? JSON.parse(raw) : [];
      const byId = {};
      stored.forEach((s)   => { byId[s.id] = s; });
      inMemory.forEach((s) => { byId[s.id] = s; }); // in-memory wins
      const merged = Object.values(byId)
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      localStorage.setItem(STORAGE_KEY(campaignId), JSON.stringify(merged));
    } catch (e) {
      console.warn('Snapshot persist failed:', e);
    }
  },

  _persistCurrentId: (campaignId, id) => {
    try {
      if (id) localStorage.setItem(CURRENT_KEY(campaignId), id);
      else     localStorage.removeItem(CURRENT_KEY(campaignId));
    } catch (e) {
      console.warn('Snapshot current-id persist failed:', e);
    }
  },

  /**
   * Capture a snapshot of a world state.
   * Parent is determined by `currentSnapshotId` (the live-state snapshot),
   * enabling true branching when you restore + re-advance.
   *
   * After calling this, `currentSnapshotId` is updated to the new snapshot.
   */
  takeSnapshot: (campaignId, name, worldState, summary = '') => {
    // Defensive: if the in-memory store is empty for this campaign (e.g. after a
    // page refresh before loadSnapshots was called), pull from localStorage first
    // so we don't lose existing history and compute the correct parent ID.
    let existing = get().snapshots.filter((s) => s.campaignId === campaignId);
    if (existing.length === 0) {
      try {
        const raw = localStorage.getItem(STORAGE_KEY(campaignId));
        const stored = raw ? JSON.parse(raw) : [];
        if (stored.length > 0) {
          const mergedAll = [
            ...get().snapshots.filter((s) => s.campaignId !== campaignId),
            ...stored,
          ];
          const storedCurrentId = localStorage.getItem(CURRENT_KEY(campaignId)) || null;
          set({
            snapshots: mergedAll,
            currentSnapshotId: get().currentSnapshotId || storedCurrentId,
          });
          existing = stored;
        }
      } catch (e) {
        // Silently ignore — we'll proceed with empty existing
      }
    }

    // Parent = the snapshot that represents the current live state.
    // Falls back to the most recent snapshot if currentSnapshotId is unset.
    const parentId =
      get().currentSnapshotId ||
      (existing.length > 0 ? existing[existing.length - 1].id : null);

    const snapshot = {
      id:               uuid(),
      campaignId,
      name:             name || `Snapshot ${existing.length + 1}`,
      parentSnapshotId: parentId,
      createdAt:        new Date().toISOString(),
      summary,
      worldState: {
        nodes:       JSON.parse(JSON.stringify(worldState.nodes       || [])),
        territories: JSON.parse(JSON.stringify(worldState.territories || [])),
      },
    };

    const snapshots = [...get().snapshots, snapshot];
    set({ snapshots, currentSnapshotId: snapshot.id });
    get()._persist(campaignId);
    get()._persistCurrentId(campaignId, snapshot.id);
    return snapshot;
  },

  /** Get all snapshots for a campaign, oldest first */
  getSnapshots: (campaignId) => {
    return get().snapshots
      .filter((s) => s.campaignId === campaignId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  },

  /** Delete a snapshot (does not cascade to children) */
  deleteSnapshot: (campaignId, snapshotId) => {
    const snapshots = get().snapshots.filter((s) => s.id !== snapshotId);
    // If deleted snapshot was current, clear currentSnapshotId
    const currentId = get().currentSnapshotId === snapshotId ? null : get().currentSnapshotId;
    set({ snapshots, currentSnapshotId: currentId });
    get()._persist(campaignId);
    get()._persistCurrentId(campaignId, currentId);
  },

  /**
   * Write a snapshot's world state to localStorage so loadNodes/loadTerritories
   * will pick it up. Also sets currentSnapshotId to this snapshot — future
   * commits will branch from here.
   */
  writeSnapshotToLiveStorage: (snapshotId) => {
    const snapshot = get().snapshots.find((s) => s.id === snapshotId);
    if (!snapshot) return false;
    const { campaignId, worldState } = snapshot;
    try {
      localStorage.setItem(`flux_nodes_${campaignId}`,       JSON.stringify(worldState.nodes));
      localStorage.setItem(`flux_territories_${campaignId}`, JSON.stringify(worldState.territories));
      // Update current head — next commit will branch from this snapshot
      set({ currentSnapshotId: snapshotId });
      get()._persistCurrentId(campaignId, snapshotId);
      return true;
    } catch (e) {
      console.warn('Snapshot restore failed:', e);
      return false;
    }
  },
}));

export default useSnapshotStore;
