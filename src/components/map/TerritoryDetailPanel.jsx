import { useMemo, useCallback } from 'react';
import { X, Trash, Shield, Cross, Crown } from '@phosphor-icons/react';
import useTerritoryStore from '../../stores/territoryStore';
import useNodeStore from '../../stores/nodeStore';
import useCampaignStore from '../../stores/campaignStore';

const OWNER_TYPES = ['faction', 'religion', 'realm'];
const TYPE_ICONS = { faction: Shield, religion: Cross, realm: Crown };
const TYPE_COLORS = {
  faction: '#fb923c',
  religion: '#fbbf24',
  realm: '#e879a8',
};

export default function TerritoryDetailPanel({ territoryId, onClose }) {
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
        color: TYPE_COLORS[n.type] || '#8890a0',
      }))
      .sort((a, b) => a.type.localeCompare(b.type) || a.name.localeCompare(b.name));
  }, [allNodes]);

  const currentOwner = ownerOptions.find((o) => o.id === territory?.nodeId);

  const handleReassign = useCallback((newOwnerId) => {
    if (!territory) return;
    const ownerNode = newOwnerId ? allNodes.find((n) => n.id === newOwnerId) : null;
    const color = ownerNode ? (TYPE_COLORS[ownerNode.type] || '#8890a0') : '#8890a0';
    updateTerritory(campaignId, territoryId, {
      nodeId: newOwnerId || null,
      name: ownerNode ? `${ownerNode.fields?.name} Territory` : territory.name,
      color,
      strokeColor: color,
    });
  }, [territory, allNodes, campaignId, territoryId, updateTerritory]);

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
        <select
          className="territory-owner-select"
          value={territory.nodeId || ''}
          onChange={(e) => handleReassign(e.target.value || null)}
        >
          <option value="">Unassigned</option>
          {ownerOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.name} ({opt.type})
            </option>
          ))}
        </select>

        {currentOwner && (
          <div className="territory-owner-badge" style={{ borderColor: currentOwner.color }}>
            {(() => {
              const Icon = TYPE_ICONS[currentOwner.type];
              return Icon ? <Icon size={14} color={currentOwner.color} /> : null;
            })()}
            <span>{currentOwner.name}</span>
          </div>
        )}

        <div className="territory-detail-meta">
          <span>{territory.shapeType}</span>
          {territory.points && <span>{territory.points.length} points</span>}
        </div>

        <button className="btn-danger-sm" onClick={handleDelete}>
          <Trash size={14} />
          Delete Territory
        </button>
      </div>
    </div>
  );
}
