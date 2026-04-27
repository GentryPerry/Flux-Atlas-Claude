import { useMemo, useRef } from 'react';
import { Polygon, X, Check } from '@phosphor-icons/react';
import CustomSelect from '../common/CustomSelect';
import useNodeStore from '../../stores/nodeStore';

const OWNER_TYPES = ['faction', 'religion', 'polity'];
const TYPE_COLORS  = { faction: '#fb923c', religion: '#fbbf24', polity: '#e879a8' };

const PRESET_COLORS = [
  '#fb923c', '#fbbf24', '#e879a8', '#60a5fa', '#4ade80',
  '#f87171', '#c084fc', '#38bdf8', '#a3e635', '#fb7185',
];

/**
 * Always-visible floating pill pinned above the MapLegend.
 * Collapsed: a single "Draw Territory" trigger button.
 * Expanded (drawingMode === 'polygon'): full drawing controls.
 */
export default function TerritoryToolbar({
  drawingMode,
  setDrawingMode,
  territoryOwnerId,
  setTerritoryOwnerId,
  territoryColor,
  setTerritoryColor,
  polygonPointCount,
  onFinishDrawing,
}) {
  const colorInputRef = useRef(null);
  const allNodes      = useNodeStore((s) => s.nodes);

  const ownerOptions = useMemo(() => {
    return allNodes
      .filter((n) => OWNER_TYPES.includes(n.type) && n.fields?.name)
      .map((n) => ({
        id:    n.id,
        name:  n.fields.name,
        type:  n.type,
        color: TYPE_COLORS[n.type] || '#8890a0',
      }))
      .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  }, [allNodes]);

  const handleOwnerChange = (newOwnerId) => {
    setTerritoryOwnerId(newOwnerId || null);
    if (newOwnerId) {
      const owner = ownerOptions.find((o) => o.id === newOwnerId);
      if (owner) setTerritoryColor(owner.color);
    }
  };

  // ── Collapsed trigger ────────────────────────────────────────────────────────
  if (drawingMode !== 'polygon') {
    return (
      <button
        className="territory-trigger-btn"
        onClick={() => setDrawingMode('polygon')}
        title="Draw a territory polygon"
      >
        <Polygon size={13} weight="fill" />
        <span>Draw Territory</span>
      </button>
    );
  }

  // ── Active drawing controls ──────────────────────────────────────────────────
  return (
    <div className="territory-toolbar">
      <div className="territory-toolbar-header">
        <Polygon size={15} weight="fill" />
        <span>Drawing Territory</span>
        {polygonPointCount > 0 && (
          <span className="territory-point-count">{polygonPointCount} pts</span>
        )}
      </div>

      <div className="territory-toolbar-section">
        <label className="territory-toolbar-label">Assign to:</label>
        <CustomSelect
          value={territoryOwnerId || ''}
          onChange={handleOwnerChange}
          placeholder="Unassigned"
          style={{ minWidth: 150 }}
          options={[
            { value: '', label: 'Unassigned' },
            ...ownerOptions.map((o) => ({ value: o.id, label: `${o.name} (${o.type})` })),
          ]}
        />
      </div>

      <div className="territory-toolbar-section">
        <label className="territory-toolbar-label">Color:</label>
        <div className="territory-color-swatches">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              className={`territory-swatch${territoryColor === c ? ' active' : ''}`}
              style={{ background: c }}
              onClick={() => setTerritoryColor(c)}
              title={c}
            />
          ))}
          <button
            className="territory-swatch territory-swatch-custom"
            style={{ background: PRESET_COLORS.includes(territoryColor) ? 'var(--bg-inset)' : territoryColor }}
            onClick={() => colorInputRef.current?.click()}
            title="Custom color"
          >
            +
          </button>
          <input
            ref={colorInputRef}
            type="color"
            className="territory-color-input-hidden"
            value={territoryColor}
            onChange={(e) => setTerritoryColor(e.target.value)}
          />
        </div>
      </div>

      <div className="territory-toolbar-actions">
        <button
          className="btn-territory-finish"
          disabled={polygonPointCount < 3}
          onClick={onFinishDrawing}
          title={polygonPointCount < 3 ? 'Need at least 3 points' : 'Finish drawing'}
        >
          <Check size={13} weight="bold" /> Finish
        </button>
        <button
          className="btn-territory-cancel"
          onClick={() => setDrawingMode(null)}
          title="Cancel drawing"
        >
          <X size={13} weight="bold" /> Cancel
        </button>
      </div>
    </div>
  );
}
