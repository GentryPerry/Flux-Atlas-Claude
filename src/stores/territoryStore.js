import { create } from 'zustand';
import { v4 as uuid } from 'uuid';

/**
 * Territory store — manages territory shapes (polygons, rectangles, circles)
 * for the active campaign. Each territory can be linked to a node.
 */
const useTerritoryStore = create((set, get) => ({
  territories: [],

  /** Load territories for a campaign */
  loadTerritories: (campaignId) => {
    const raw = localStorage.getItem(`flux_territories_${campaignId}`);
    const territories = raw ? JSON.parse(raw) : [];
    set({ territories });
  },

  _persist: (campaignId) => {
    localStorage.setItem(`flux_territories_${campaignId}`, JSON.stringify(get().territories));
  },

  /** Create a new territory */
  createTerritory: (campaignId, mapId, shapeType, data = {}) => {
    const territory = {
      id: uuid(),
      campaignId,
      mapId,
      nodeId: data.nodeId || null,
      name: data.name || `Territory ${new Date().toLocaleTimeString()}`,
      shapeType, // 'polygon' | 'rectangle' | 'circle'

      // For polygons: array of { x, y }
      points: data.points || [],

      // For circles: { cx, cy, radius }
      center: data.center || null,
      radius: data.radius || 0,

      // For rectangles: { x, y, width, height }
      x: data.x !== undefined ? data.x : 0,
      y: data.y !== undefined ? data.y : 0,
      width: data.width !== undefined ? data.width : 0,
      height: data.height !== undefined ? data.height : 0,

      // Styling
      color: data.color || '#8890a0',
      opacity: data.opacity !== undefined ? data.opacity : 0.15,
      strokeColor: data.strokeColor || '#8890a0',
      strokeWidth: data.strokeWidth !== undefined ? data.strokeWidth : 2,

      createdAt: new Date().toISOString(),
    };
    const territories = [...get().territories, territory];
    set({ territories });
    localStorage.setItem(`flux_territories_${campaignId}`, JSON.stringify(territories));
    return territory;
  },

  /** Update a territory */
  updateTerritory: (campaignId, territoryId, updates) => {
    const territories = get().territories.map((t) =>
      t.id === territoryId ? { ...t, ...updates } : t
    );
    set({ territories });
    localStorage.setItem(`flux_territories_${campaignId}`, JSON.stringify(territories));
  },

  /** Delete a territory */
  deleteTerritory: (campaignId, territoryId) => {
    const territories = get().territories.filter((t) => t.id !== territoryId);
    set({ territories });
    localStorage.setItem(`flux_territories_${campaignId}`, JSON.stringify(territories));
  },

  /** Link a territory to a node */
  linkToNode: (campaignId, territoryId, nodeId) => {
    const territories = get().territories.map((t) =>
      t.id === territoryId ? { ...t, nodeId } : t
    );
    set({ territories });
    localStorage.setItem(`flux_territories_${campaignId}`, JSON.stringify(territories));
  },

  /** Get territories for a specific map */
  getTerritoriesForMap: (mapId) => {
    return get().territories.filter((t) => t.mapId === mapId);
  },
}));

export default useTerritoryStore;
