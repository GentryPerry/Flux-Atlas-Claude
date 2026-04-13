import { useMemo } from 'react';
import { Shield, Cross, Crown, X, Check, Polygon } from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useMapStore from '../../stores/mapStore';

const OWNER_TYPES = ['faction', 'religion', 'realm'];
const TYPE_ICONS = { faction: Shield, religion: Cross, realm: Crown };
const TYPE_COLORS = {
  faction: '#fb923c',
  religion: '#fbbf24',
  realm: '#e879a8',
};

/**
 * Floating toolbar shown during territory drawing mode.
 * Lets user pick which entity (faction/religion/realm) to assign,
 * shows point count, and has Finish / Cancel buttons.
 */
export default function TerritoryToolbar({
  drawingMode,
  setDrawingMode,
  territoryOwnerId,
  setTerritoryOwnerId,
  polygonPointCount,
  onFinishDrawing,
}) {
  if (drawingMode !== 'polygon') return null;

  const allNodes = useNodeStore((s) => s.nodes);
  const activeMapId = useMapStore((s) => s.activeMapId);

  // Get available faction/religion/realm nodes for assignment
  const ownerOptions = useMemo(() => {
    return allNodes
      .filter((n) => OWNER_TYPES.includes(n.type) && n.fields?.name)
      .map((n) => ({
        id: n.id,
        name: n.fields.name,
        type: n.type,
        color: TYPE_COLORS[n.type] || '#8890a0',
      }))
      .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  }, [allNodes]);

  const selectedOwner = ownerOptions.find((o) => o.id === territoryOwnerId);

  return (
    <div className="territory-toolbar">
      <div className="territory-toolbar-header">
        <Polygon size={16} weight="fill" />
        <span>Draw Territory</span>
        <span className="territory-point-count">
          {polygonPointCount} point{polygonPointCount !== 1 ? 's' : ''}
        </span>
      </div>

      <div className="territory-toolbar-section">
        <label className="territory-toolbar-label">Assign to:</label>
        <select
          className="territory-owner-select"
          value={territoryOwnerId || ''}
          onChange={(e) => setTerritoryOwnerId(e.target.value || null)}
        >
          <option value="">Unassigned</option>
          {ownerOptions.map((opt) => {
            const Icon = TYPE_ICONS[opt.type];
            return (
              <option key={opt.id} value={opt.id}>
                {opt.name} ({opt.type})
              </option>
            );
          })}
        </select>
        {selectedOwner && (
          <div
            className="territory-color-preview"
            style={{ background: selectedOwner.color }}
          />
        )}
      </div>

      <div className="territory-toolbar-actions">
        <button
          className="btn-territory-finish"
          disabled={polygonPointCount < 3}
          onClick={onFinishDrawing}
          title={polygonPointCount < 3 ? 'Need at least 3 points' : 'Finish drawing territory'}
        >
          <Check size={14} weight="bold" />
          Finish
        </button>
        <button
          className="btn-territory-cancel"
          onClick={() => setDrawingMode(null)}
          title="Cancel drawing"
        >
          <X size={14} weight="bold" />
          Cancel
        </button>
      </div>
    </div>
  );
}
