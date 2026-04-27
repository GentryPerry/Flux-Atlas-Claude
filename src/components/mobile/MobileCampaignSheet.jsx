import { useState, useRef, useMemo, useCallback } from 'react';
import { X, Plus, MapTrifold, Trash, Check, Globe } from '@phosphor-icons/react';
import useMapStore from '../../stores/mapStore';
import useCampaignStore from '../../stores/campaignStore';
import useNodeStore from '../../stores/nodeStore';
import { uploadImage } from '../../utils/api';

/**
 * Slide-up sheet for selecting campaigns and maps on mobile.
 */
export default function MobileCampaignSheet({ onClose }) {
  const campaignId        = useCampaignStore((s) => s.activeCampaignId);
  const campaigns         = useCampaignStore((s) => s.campaigns);
  const setActiveCampaign = useCampaignStore((s) => s.setActiveCampaign);
  const createCampaign    = useCampaignStore((s) => s.createCampaign);

  const allMaps      = useMapStore((s) => s.maps);
  const activeMapId  = useMapStore((s) => s.activeMapId);
  const setActiveMap = useMapStore((s) => s.setActiveMap);
  const createMap    = useMapStore((s) => s.createMap);
  const deleteMap    = useMapStore((s) => s.deleteMap);

  const allNodes = useNodeStore((s) => s.nodes);

  const campaign = useMemo(
    () => campaigns.find((c) => c.id === campaignId) || null,
    [campaigns, campaignId]
  );

  const rootMaps = useMemo(
    () => allMaps.filter((m) => {
      if (!m.parentMapId) return true;
      const ownerNode = allNodes.find((n) => n.id === m.parentMapId);
      return !ownerNode;
    }),
    [allMaps, allNodes]
  );

  const [showNewMap,        setShowNewMap]        = useState(false);
  const [newMapName,        setNewMapName]         = useState('');
  const [pendingImage,      setPendingImage]       = useState(null);
  const [showCampaignPicker, setShowCampaignPicker] = useState(false);
  const [creatingCampaign,  setCreatingCampaign]  = useState(false);
  const [newCampaignName,   setNewCampaignName]   = useState('');
  const fileInputRef = useRef(null);

  const handleBackdropClick = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const url = await uploadImage(file);
      setPendingImage(url);
      setShowNewMap(true);
    } catch (err) {
      console.error('Map image upload failed:', err);
      alert('Image upload failed. Please try again.');
    }
  };

  const handleCreateMap = () => {
    if (!newMapName.trim()) return;
    createMap(campaignId, newMapName.trim(), pendingImage);
    setNewMapName('');
    setPendingImage(null);
    setShowNewMap(false);
  };

  const handleSelectMap = (mapId) => {
    setActiveMap(mapId);
    onClose();
  };

  const handleCreateCampaign = () => {
    if (!newCampaignName.trim()) return;
    createCampaign(newCampaignName.trim());
    setNewCampaignName('');
    setCreatingCampaign(false);
    setShowCampaignPicker(false);
  };

  return (
    <div className="mobile-sheet-backdrop" onClick={handleBackdropClick}>
      <div className="mobile-sheet">
        <div className="mobile-sheet-handle" />

        <div className="mobile-sheet-header">
          <button
            className="mobile-sheet-campaign-btn"
            onClick={() => setShowCampaignPicker((v) => !v)}
          >
            <Globe size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span className="mobile-sheet-campaign-name">{campaign?.name || 'No Campaign'}</span>
          </button>
          <button className="mobile-header-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {showCampaignPicker && (
          <div className="mobile-campaign-picker">
            {campaigns.map((c) => (
              <button
                key={c.id}
                className={`mobile-campaign-picker-item${c.id === campaignId ? ' active' : ''}`}
                onClick={() => { setActiveCampaign(c.id); setShowCampaignPicker(false); onClose(); }}
              >
                {c.id === campaignId && <Check size={12} style={{ color: 'var(--accent)' }} />}
                <span>{c.name}</span>
              </button>
            ))}
            <div className="mobile-campaign-picker-divider" />
            {creatingCampaign ? (
              <div style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <input
                  value={newCampaignName}
                  onChange={(e) => setNewCampaignName(e.target.value)}
                  placeholder="Campaign name..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleCreateCampaign();
                    if (e.key === 'Escape') setCreatingCampaign(false);
                  }}
                />
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={handleCreateCampaign}>Create</button>
                  <button className="btn btn-secondary btn-sm" onClick={() => setCreatingCampaign(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="mobile-campaign-picker-item" onClick={() => setCreatingCampaign(true)}>
                <Plus size={12} style={{ color: 'var(--text-muted)' }} />
                <span style={{ color: 'var(--text-secondary)' }}>New Campaign</span>
              </button>
            )}
          </div>
        )}

        <div className="mobile-sheet-section-title">Maps</div>

        <div className="mobile-sheet-map-list">
          {rootMaps.map((map) => (
            <button
              key={map.id}
              className={`mobile-sheet-map-item${map.id === activeMapId ? ' active' : ''}`}
              onClick={() => handleSelectMap(map.id)}
            >
              <MapTrifold
                size={15}
                style={{ color: map.id === activeMapId ? 'var(--accent)' : 'var(--text-muted)', flexShrink: 0 }}
              />
              <span>{map.name}</span>
              <button
                className="mobile-sheet-map-delete"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`Delete "${map.name}"?`)) deleteMap(campaignId, map.id);
                }}
              >
                <Trash size={13} />
              </button>
            </button>
          ))}
          {rootMaps.length === 0 && !showNewMap && (
            <p className="mobile-sheet-empty">No maps yet. Create one below.</p>
          )}
        </div>

        <div className="mobile-sheet-actions">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleImageSelect}
          />
          {!showNewMap ? (
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                className="btn btn-ghost btn-sm"
                style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus size={13} /> New Map
              </button>
              <button
                className="btn btn-ghost btn-sm"
                style={{ flexShrink: 0 }}
                onClick={() => { setPendingImage(null); setShowNewMap(true); }}
              >
                Blank
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {pendingImage && (
                <img
                  src={pendingImage}
                  alt="preview"
                  style={{ width: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--border)', maxHeight: 120, objectFit: 'cover' }}
                />
              )}
              <input
                value={newMapName}
                onChange={(e) => setNewMapName(e.target.value)}
                placeholder="Map name..."
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateMap();
                  if (e.key === 'Escape') { setShowNewMap(false); setPendingImage(null); }
                }}
              />
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={handleCreateMap}>Create</button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setShowNewMap(false); setPendingImage(null); }}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
