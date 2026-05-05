import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import { saveStore, loadCampaign } from '../utils/api';
import useUndoStore from './undoStore';

// Per-campaign timers — same rationale as nodeStore: prevents a rapid campaign
// switch from cancelling a pending save for a different campaign.
const _widgetSaveTimers = new Map(); // campaignId → timerId

function debouncedWidgetSave(campaignId, widgets) {
  // Filter to this campaign at call-time so the closure captures the right slice.
  const snapshot = widgets.filter((w) => w.campaignId === campaignId);
  if (_widgetSaveTimers.has(campaignId)) clearTimeout(_widgetSaveTimers.get(campaignId));
  const id = setTimeout(() => {
    _widgetSaveTimers.delete(campaignId);
    saveStore(campaignId, 'widgets', snapshot).catch((e) =>
      console.warn('Widget save failed:', e)
    );
  }, 400);
  _widgetSaveTimers.set(campaignId, id);
}

function defaultData(type) {
  switch (type) {
    case 'sticky-note':
      return { title: 'New Note', content: '', color: 'yellow', width: 260, height: 160 };
    case 'linear-tracker':
      return {
        title: 'Tracker',
        tracks: [{ id: uuid(), label: 'Track', value: 0, mode: 'unipolar', color: '#f59242' }],
        width: 300,
      };
    case 'clock-widget':
      return {
        title: 'Clocks',
        clocks: [{ id: uuid(), label: 'Progress', segments: 6, filled: 0, color: '#f59242' }],
        width: 280,
      };
    case 'trouble-engine':
      return { title: 'Trouble Engine', lastRun: null, width: 280 };
    case 'table-roller':
      return { title: 'Table Roller', tableId: null, rollCount: 1, lastResults: [], width: 340 };
    case 'image-frame':
      return { title: 'Image', imageUrl: null, width: 300, height: 220 };
    case 'thread-tracker':
      return {
        title: 'Narrative Arc',
        threads: [{
          id: uuid(),
          label: 'Main Plot',
          color: '#4a8fd4',
          linkedNodeIds: [],
          milestones: [
            { id: uuid(), label: 'Inciting Incident', status: 'solid' },
            { id: uuid(), label: 'Rising Action',     status: 'active' },
            { id: uuid(), label: 'Climax',            status: 'dim' },
          ],
        }],
        width: 600,
      };
    default:
      return {};
  }
}

const useWidgetStore = create((set, get) => ({
  widgets: [],

  loadWidgets: async (campaignId) => {
    try {
      const data = await loadCampaign(campaignId);
      const widgets = Array.isArray(data.widgets) ? data.widgets : [];
      set({ widgets });
    } catch (e) {
      console.warn('loadWidgets failed:', e);
      set({ widgets: [] });
    }
  },

  _persist: (campaignId) => {
    debouncedWidgetSave(campaignId, get().widgets);
  },

  addWidget: (campaignId, type, viewportState) => {
    useUndoStore.getState().captureSnapshot();
    const vx    = viewportState?.x     ?? 0;
    const vy    = viewportState?.y     ?? 0;
    const scale = viewportState?.scale ?? 1;
    const canvasX = Math.round((window.innerWidth  / 2 - vx) / scale - 130);
    const canvasY = Math.round((window.innerHeight / 2 - vy) / scale - 80);

    const widget = {
      id: uuid(),
      campaignId,
      type,
      position: { x: canvasX, y: canvasY },
      isMinimized: false,
      data: defaultData(type),
    };
    const widgets = [...get().widgets, widget];
    set({ widgets });
    get()._persist(campaignId);
    return widget;
  },

  updateWidget: (id, changes) => {
    const widgets = get().widgets.map((w) => (w.id === id ? { ...w, ...changes } : w));
    set({ widgets });
    const w = widgets.find((w) => w.id === id);
    if (w) get()._persist(w.campaignId);
  },

  updateWidgetData: (id, dataChanges) => {
    const widgets = get().widgets.map((w) =>
      w.id === id ? { ...w, data: { ...w.data, ...dataChanges } } : w
    );
    set({ widgets });
    const w = widgets.find((w) => w.id === id);
    if (w) get()._persist(w.campaignId);
  },

  removeWidget: (id) => {
    useUndoStore.getState().captureSnapshot();
    const w = get().widgets.find((w) => w.id === id);
    const widgets = get().widgets.filter((w) => w.id !== id);
    set({ widgets });
    if (w) get()._persist(w.campaignId);
  },

  /**
   * Bulk-set widgets — used by undo restore.
   * Persists each campaign's widgets to the API.
   */
  _setDirect: (widgets) => {
    set({ widgets });
    // Group by campaign and save each
    const byCampaign = {};
    for (const w of widgets) {
      if (!byCampaign[w.campaignId]) byCampaign[w.campaignId] = [];
      byCampaign[w.campaignId].push(w);
    }
    for (const [cid, ws] of Object.entries(byCampaign)) {
      saveStore(cid, 'widgets', ws).catch((e) =>
        console.warn('_setDirect widget save failed:', e)
      );
    }
  },
}));

export default useWidgetStore;
