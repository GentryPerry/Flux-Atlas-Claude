import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { saveStore, loadCampaign } from '../utils/api';

const useSnapshotStore = create((set, get) => ({
  snapshots: [],
  currentSnapshotId: null,
  autoSnapshots: [],       // rolling auto-saves (max 3, loaded per campaign)
  autoSnapsLoaded: null,   // campaignId whose auto-snaps are loaded

  loadSnapshots: async (campaignId) => {
    try {
      const data = await loadCampaign(campaignId);
      const snapshots = Array.isArray(data.snapshots) ? data.snapshots : [];
      const currentSnapshotId = data.snapshot_current || null;
      const autoSnapshots = Array.isArray(data.auto_snapshots) ? data.auto_snapshots : [];
      set({ snapshots, currentSnapshotId, autoSnapshots, autoSnapsLoaded: campaignId });
    } catch {
      set({ snapshots: [], currentSnapshotId: null, autoSnapshots: [], autoSnapsLoaded: null });
    }
  },

  _persist: async (campaignId) => {
    const snaps = get().snapshots.filter((s) => s.campaignId === campaignId);
    await Promise.all([
      saveStore(campaignId, 'snapshots', snaps),
      saveStore(campaignId, 'snapshot_current', get().currentSnapshotId),
    ]).catch((e) => console.warn('Snapshot save failed:', e));
  },

  takeSnapshot: async (campaignId, name, worldState, summary = '') => {
    const existing = get().snapshots.filter((s) => s.campaignId === campaignId);
    const parentId =
      get().currentSnapshotId ||
      (existing.length > 0 ? existing[existing.length - 1].id : null);

    const snapshot = {
      id: uuid(),
      campaignId,
      name: name || `Snapshot ${existing.length + 1}`,
      parentSnapshotId: parentId,
      createdAt: new Date().toISOString(),
      summary,
      worldState: {
        nodes:       JSON.parse(JSON.stringify(worldState.nodes       || [])),
        territories: JSON.parse(JSON.stringify(worldState.territories || [])),
      },
    };

    const snapshots = [...get().snapshots, snapshot];
    set({ snapshots, currentSnapshotId: snapshot.id });
    await get()._persist(campaignId);
    return snapshot;
  },

  getSnapshots: (campaignId) =>
    get().snapshots
      .filter((s) => s.campaignId === campaignId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),

  deleteSnapshot: async (campaignId, snapshotId) => {
    const snapshots = get().snapshots.filter((s) => s.id !== snapshotId);
    const currentId = get().currentSnapshotId === snapshotId ? null : get().currentSnapshotId;
    set({ snapshots, currentSnapshotId: currentId });
    await get()._persist(campaignId);
  },

  writeSnapshotToLiveStorage: async (snapshotId) => {
    const snapshot = get().snapshots.find((s) => s.id === snapshotId);
    if (!snapshot) return false;
    const { campaignId, worldState } = snapshot;
    try {
      await Promise.all([
        saveStore(campaignId, 'nodes',       worldState.nodes),
        saveStore(campaignId, 'territories', worldState.territories),
      ]);
      set({ currentSnapshotId: snapshotId });
      await saveStore(campaignId, 'snapshot_current', snapshotId);
      return true;
    } catch (e) {
      console.warn('Snapshot restore failed:', e);
      return false;
    }
  },

  /** Restore an auto-snapshot by index (0 = oldest of the 3, 2 = newest) */
  restoreAutoSnapshot: async (campaignId, snapIndex) => {
    const snaps = get().autoSnapshots;
    const snap  = snaps[snapIndex];
    if (!snap) return false;
    try {
      await Promise.all([
        saveStore(campaignId, 'nodes',       snap.nodes       || []),
        saveStore(campaignId, 'territories', snap.territories || []),
      ]);
      return true;
    } catch (e) {
      console.warn('Auto-snapshot restore failed:', e);
      return false;
    }
  },
}));

export default useSnapshotStore;
