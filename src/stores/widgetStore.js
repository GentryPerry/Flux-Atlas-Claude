import { create } from 'zustand';
import { v4 as uuid } from 'uuid';

const STORAGE_KEY = (cid) => `flux_widgets_${cid}`;

function defaultData(type) {
  switch (type) {
    case 'sticky-note':
      return { title: 'New Note', content: '', color: 'yellow', width: 260, height: 160 };
    case 'linear-tracker':
      return {
        title:  'Tracker',
        tracks: [{ id: uuid(), label: 'Track', value: 0, mode: 'unipolar', color: '#f59242' }],
        width:  300,
      };
    case 'clock-widget':
      return {
        title: 'Clocks',
        clocks: [
          { id: uuid(), label: 'Progress', segments: 6, filled: 0, color: '#f59242' },
        ],
        width: 280,
      };
    case 'thread-tracker':
      return {
        title: 'Narrative Arc',
        threads: [
          {
            id: uuid(),
            label: 'Main Plot',
            color: '#4a8fd4',
            linkedNodeIds: [],
            milestones: [
              { id: uuid(), label: 'Inciting Incident', status: 'solid' },
              { id: uuid(), label: 'Rising Action',     status: 'active' },
              { id: uuid(), label: 'Climax',            status: 'dim' },
            ],
          },
        ],
        width: 600,
      };
    default:
      return {};
  }
}

const useWidgetStore = create((set, get) => ({
  widgets: [],

  loadWidgets: (campaignId) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY(campaignId));
      const widgets = raw ? JSON.parse(raw) : [];
      set({ widgets });
    } catch (e) {
      console.warn('loadWidgets failed:', e);
      set({ widgets: [] });
    }
  },

  _persist: (campaignId) => {
    try {
      const widgets = get().widgets.filter((w) => w.campaignId === campaignId);
      localStorage.setItem(STORAGE_KEY(campaignId), JSON.stringify(widgets));
    } catch (e) {
      console.warn('Widget persist failed:', e);
    }
  },

  /**
   * Create a new widget positioned at the centre of the current viewport,
   * stored in canvas/world-space coordinates.
   */
  addWidget: (campaignId, type, viewportState) => {
    const vx    = viewportState?.x     ?? 0;
    const vy    = viewportState?.y     ?? 0;
    const scale = viewportState?.scale ?? 1;

    const canvasX = Math.round((window.innerWidth  / 2 - vx) / scale - 130);
    const canvasY = Math.round((window.innerHeight / 2 - vy) / scale - 80);

    const widget = {
      id:          uuid(),
      campaignId,
      type,
      position:    { x: canvasX, y: canvasY },
      isMinimized: false,
      data:        defaultData(type),
    };
    const widgets = [...get().widgets, widget];
    set({ widgets });
    get()._persist(campaignId);
    return widget;
  },

  /** Update top-level widget fields (position, isMinimized…) */
  updateWidget: (id, changes) => {
    const widgets = get().widgets.map((w) => (w.id === id ? { ...w, ...changes } : w));
    set({ widgets });
    const w = widgets.find((w) => w.id === id);
    if (w) get()._persist(w.campaignId);
  },

  /** Merge changes into widget.data */
  updateWidgetData: (id, dataChanges) => {
    const widgets = get().widgets.map((w) =>
      w.id === id ? { ...w, data: { ...w.data, ...dataChanges } } : w,
    );
    set({ widgets });
    const w = widgets.find((w) => w.id === id);
    if (w) get()._persist(w.campaignId);
  },

  removeWidget: (id) => {
    const w = get().widgets.find((w) => w.id === id);
    const widgets = get().widgets.filter((w) => w.id !== id);
    set({ widgets });
    if (w) get()._persist(w.campaignId);
  },
}));

export default useWidgetStore;
