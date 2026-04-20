import { useMemo, useCallback, useRef } from 'react';
import { X, Trash, Shield, Cross, Crown, PencilSimple } from '@phosphor-icons/react';
import CustomSelect from '../common/CustomSelect';
import useTerritoryStore from '../../stores/territoryStore';
import useNodeStore from '../../stores/nodeStore';
import useCampaignStore from '../../stores/campaignStore';

const OWNER_TYPES = ['faction', 'religion', 'polity'];
const TYPE_ICONS = { faction: Shield, religion: Cross, polity: Crown };

const PRESET_COLORS = [
  '#fb923c', '#fbbf24', '#e879a8', '#60a5fa', '#4ade80',
  '#f87171', '#c084fc', '#38bdf8', '#a3e635', '#fb7185',
];

export default function TerritoryDetailPanel({ territoryId, onClose, editingPoints, onToggleEditPoints }) {
  const colorInputRef = useRef(null);
  const campaignId = useCampaignStore((s) => s.activeCampaignId);
  const allTerritories = useTerritoryStore((s) => s.territories);
  const updateTerritory = useTerritoryStore((s) => s.updateTerritory);
  const deleteTerritory = useTerritoryStore((s) => s.deleteTerritory);
  const allNodes = useNodeStore((s) => s.nodes);

  const territory = allTerritories.find((t) => t.id === territoryId);

  const ownerOptions = useMemo(() => {
    return allNodes
      .filter((n) => OWNER_TYPES.includes(n.type) && n.fields?.name)
      .map((n) => ({
        id: n.id,
        name: n.fields.name,
        type: n.type,
      }))
      .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  }, [allNodes]);

  const currentOwner = ownerOptions.find((o) => o.id === territory?.nodeId);

  const handleReassign = useCallback((newOwnerId) => {
    if (!territory) return;
    const ownerNode = newOwnerId ? allNodes.find((n) => n.id === newOwnerId) : null;
    updateTerritory(campaignId, territoryId, {
      nodeId: newOwnerId || null,
      name: ownerNode ? `${ownerNode.fields?.name} Territory` : territory.name,
    });
  }, [territory, allNodes, campaignId, territoryId, updateTerritory]);

  const handleColorChange = useCallback((color) => {
    updateTerritory(campaignId, territoryId, {
      color,
      strokeColor: color,
    });
  }, [campaignId, territoryId, updateTerritory]);

  const handleDelete = useCallback(() => {
    deleteTerritory(campaignId, territoryId);
    onClose();
  }, [campaignId, territoryId, deleteTerritory, onClose]);

  if (!territory) return null;

  return (
    <div className="territory-detail-panel">
      <div className="territory-detail-header">
        <div className="territory-detail-title">
          <div
            className="territory-color-swatch"
            style={{ background: territory.color }}
          />
          <span>{territory.name}</span>
        </div>
        <button className="btn-icon" onClick={onClose} title="Close">
          <X size={16} />
        </button>
      </div>

      <div className="territory-detail-body">
        <label className="territory-detail-label">Owner</label>
        <CustomSelect
          value={territory.nodeId || ''}
          onChange={(val) => handleReassign(val || null)}
          placeholder="Unassigned"
          options={[
            { value: '', label: 'Unassigned' },
            ...ownerOptions.map((o) => ({ value: o.id, label: `${o.name} (${o.type})` })),
          ]}
        />

        {currentOwner && (
          <div className="territory-owner-badge" style={{ borderColor: territory.color }}>
            {(() => {
              const Icon = TYPE_ICONS[currentOwner.type];
              return Icon ? <Icon size={14} color={territory.color} /> : null;
            })()}
            <span>{currentOwner.name}</span>
          </div>
        )}

        <label className="territory-detail-label">Color</label>
        <div className="territory-color-swatches">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              className={`territory-swatch ${territory.color === c ? 'active' : ''}`}
              style={{ background: c }}
              onClick={() => handleColorChange(c)}
              title={c}
            />
          ))}
          <button
            className="territory-swatch territory-swatch-custom"
            style={{ background: PRESET_COLORS.includes(territory.color) ? 'var(--bg-inset)' : territory.color }}
            onClick={() => colorInputRef.current?.click()}
            title="Custom color"
          >
            +
          </button>
          <input
            ref={colorInputRef}
            type="color"
            className="territory-color-input-hidden"
            value={territory.color}
            onChange={(e) => handleColorChange(e.target.value)}
          />
        </div>

        <div className="territory-detail-meta">
          <span>{territory.shapeType}</span>
          {territory.points && <span>{territory.points.length} points</span>}
        </div>

        {territory.shapeType === 'polygon' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button
              className={`btn btn-sm ${editingPoints ? 'btn-primary' : 'btn-secondary'}`}
              onClick={onToggleEditPoints}
              style={{ gap: 6, alignSelf: 'flex-start' }}
            >
              <PencilSimple size={13} weight={editingPoints ? 'fill' : 'regular'} />
              {editingPoints ? 'Done editing' : 'Edit points'}
            </button>
            {editingPoints && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Drag handles to reposition. Shift+click a handle to remove it.
              </div>
            )}
          </div>
        )}

        <button className="btn-danger-sm" onClick={handleDelete}>
          <Trash size={14} />
          Delete Territory
        </button>
      </div>
    </div>
  );
}
