import { useState, useRef, useMemo } from 'react';
import { MapTrifold, Plus, Trash, CaretLeft, CaretRight } from '@phosphor-icons/react';
import useMapStore from '../../stores/mapStore';
import useCampaignStore from '../../stores/campaignStore';

export default function MapSidebar() {
  const campaignId = useCampaignStore((s) => s.activeCampaignId);
  const campaigns = useCampaignStore((s) => s.campaigns);
  const allMaps = useMapStore((s) => s.maps);
  const activeMapId = useMapStore((s) => s.activeMapId);
  const setActiveMap = useMapStore((s) => s.setActiveMap);
  const createMap = useMapStore((s) => s.createMap);
  const deleteMap = useMapStore((s) => s.deleteMap);

  // Derive values with useMemo instead of calling store methods in selectors
  const campaign = useMemo(
    () => campaigns.find((c) => c.id === campaignId) || null,
    [campaigns, campaignId]
  );
  const maps = useMemo(
    () => allMaps.filter((m) => !m.parentMapId),
    [allMaps]
  );

  const [showNewMap, setShowNewMap] = useState(false);
  const [newMapName, setNewMapName] = useState('');
  const fileInputRef = useRef(null);
  const [pendingImage, setPendingImage] = useState(null);
  const [collapsed, setCollapsed] = useState(false);

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setPendingImage(ev.target.result);
      setShowNewMap(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCreateMap = () => {
    if (!newMapName.trim()) return;
    createMap(campaignId, newMapName.trim(), pendingImage);
    setNewMapName('');
    setPendingImage(null);
    setShowNewMap(false);
  };

  return (
    <div className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Toggle button on the right edge */}
      <button
        className="sidebar-toggle"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <CaretRight size={16} /> : <CaretLeft size={16} />}
      </button>

      {!collapsed && (
        <>
          <div className="sidebar-header">
            <h2>{campaign?.name || 'Campaign'}</h2>
          </div>

          <div className="sidebar-section">
            <div className="sidebar-section-title">Maps</div>

            {maps.map((map) => (
              <div
                key={map.id}
                className={`map-list-item ${map.id === activeMapId ? 'active' : ''}`}
                onClick={() => setActiveMap(map.id)}
              >
                <MapTrifold size={16} />
                <span style={{ flex: 1 }}>{map.name}</span>
                <button
                  className="btn-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`Delete map "${map.name}"?`)) {
                      deleteMap(campaignId, map.id);
                    }
                  }}
                  style={{ opacity: 0.4 }}
                >
                  <Trash size={14} />
                </button>
              </div>
            ))}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageSelect}
            />

            {!showNewMap ? (
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}
                onClick={() => fileInputRef.current?.click()}
              >
                <Plus size={14} /> New Map
              </button>
            ) : (
              <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pendingImage && (
                  <img
                    src={pendingImage}
                    alt="preview"
                    style={{ width: '100%', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}
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
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={handleCreateMap}>
                    Create
                  </button>
                  <button className="btn btn-secondary btn-sm" onClick={() => { setShowNewMap(false); setPendingImage(null); }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {maps.length === 0 && !showNewMap && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 10px' }}>
                Upload a map image to get started. Click "New Map" above.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
