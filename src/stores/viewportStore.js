import { create } from 'zustand';

/**
 * Shared viewport state so components outside MapCanvas (e.g. WidgetLayer)
 * can read the current pan/zoom without prop-drilling.
 *
 * MapCanvas calls setViewport() whenever stagePos or stageScale changes.
 * WidgetLayer reads { x, y, scale } to transform canvas-space widget positions
 * into screen-space coordinates.
 */
const useViewportStore = create((set) => ({
  x:     0,
  y:     0,
  scale: 1,
  setViewport: (x, y, scale) => set({ x, y, scale }),
}));

export default useViewportStore;
