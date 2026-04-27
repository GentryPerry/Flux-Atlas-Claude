import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import { MapTrifold, Plus, Trash, CaretLeft, CaretRight, CaretDown, Check, Globe, PencilSimple } from '@phosphor-icons/react';
import useMapStore from '../../stores/mapStore';
import useCampaignStore from '../../stores/campaignStore';
import useNodeStore from '../../stores/nodeStore';
import { uploadImage } from '../../utils/api';

// ── Campaign Dropdown ─────────────────────────────────────────────────────────

function CampaignDropdown({ campaign, campaigns, onSelect, onCreate }) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const dropdownRef = useRef(null);
  const inputRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
        setCreating(false);
        setNewName('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Focus input when entering create mode
  useEffect(() => {
    if (creating && inputRef.current) inputRef.current.focus();
  }, [creating]);

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    onCreate(trimmed);
    setNewName('');
    setCreating(false);
    setOpen(false);
  };

  return (
    <div ref={dropdownRef} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      {/* Trigger */}
      <button
        className="campaign-dropdown-trigger"
        onClick={() => { setOpen((v) => !v); setCreating(false); setNewName(''); }}
        title="Switch campaign"
      >
        <Globe size={14} style={{ flexShrink: 0, color: 'var(--accent)' }} />
        <span style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--text-primary)',
        }}>
          {campaign?.name || 'No Campaign'}
        </span>
        <CaretDown
          size={12}
          style={{
            flexShrink: 0,
            color: 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s',
          }}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="campaign-dropdown-menu">
          {campaigns.map((c) => (
            <button
              key={c.id}
              className={`campaign-dropdown-item ${c.id === campaign?.id ? 'active' : ''}`}
              onClick={() => { onSelect(c.id); setOpen(false); }}
            >
              {c.id === campaign?.id && <Check size={11} style={{ color: 'var(--accent)', flexShrink: 0 }} />}
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.name}
              </span>
            </button>
          ))}

          <div className="campaign-dropdown-divider" />

          {creating ? (
            <div style={{ padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
              <input
                ref={inputRef}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Campaign name..."
                style={{ fontSize: 12 }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                  if (e.key === 'Escape') { setCreating(false); setNewName(''); }
                }}
              />
              <div style={{ display: 'flex', gap: 4 }}>
                <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={handleCreate}>
                  Create
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => { setCreating(false); setNewName(''); }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="campaign-dropdown-item"
              onClick={() => setCreating(true)}
            >
              <Plus size={11} style={{ flexShrink: 0, color: 'var(--text-muted)' }} />
              <span style={{ color: 'var(--text-secondary)' }}>New Campaign</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Map Tree ──────────────────────────────────────────────────────────────────

/**
 * Recursive map tree item.
 *
 * Sub-maps store `parentMapId = ownerNode.id` (the node ID, NOT a map ID).
 * So we receive pre-computed `childMaps` rather than filtering allMaps directly.
 */
function MapTreeItem({ map, allMaps, allNodes, activeMapId, depth, onSelect, onDelete, onRename }) {
  const [expanded, setExpanded]     = useState(true);
  const [renaming, setRenaming]     = useState(false);
  const [renameVal, setRenameVal]   = useState('');
  const renameInputRef              = useRef(null);

  useEffect(() => {
    if (renaming && renameInputRef.current) renameInputRef.current.focus();
  }, [renaming]);

  const startRename = (e) => {
    e.stopPropagation();
    setRenameVal(map.name);
    setRenaming(true);
  };

  const commitRename = () => {
    const trimmed = renameVal.trim();
    if (trimmed && trimmed !== map.name) onRename(map.id, trimmed);
    setRenaming(false);
  };

  // Find children of this map:
  // A sub-map M is a child of this map if the owner node (M.parentMapId == node.id)
  // lives on this map (node.mapId == map.id).
  const children = useMemo(() => {
    return allMaps.filter((m) => {
      if (!m.parentMapId) return false;
      const ownerNode = allNodes.find((n) => n.id === m.parentMapId);
      return ownerNode?.mapId === map.id;
    });
  }, [allMaps, allNodes, map.id]);

  const hasChildren = children.length > 0;
  const isActive = map.id === activeMapId;

  return (
    <div>
      <div
        className={`map-list-item ${isActive ? 'active' : ''}`}
        style={{ paddingLeft: 8 + depth * 16 }}
        onClick={() => !renaming && onSelect(map.id)}
      >
        {hasChildren ? (
          <button
            className="btn-icon"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            style={{ padding: 0, width: 16, height: 16, flexShrink: 0 }}
          >
            <CaretDown
              size={11}
              style={{
                transform: expanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                transition: 'transform 0.15s',
              }}
            />
          </button>
        ) : (
          <span style={{ width: 16, flexShrink: 0 }} />
        )}
        <MapTrifold size={14} style={{ flexShrink: 0, opacity: depth > 0 ? 0.7 : 1 }} />

        {renaming ? (
          <input
            ref={renameInputRef}
            value={renameVal}
            onChange={(e) => setRenameVal(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') setRenaming(false);
              e.stopPropagation();
            }}
            style={{ flex: 1, fontSize: depth > 0 ? 12 : 13, padding: '1px 4px', minWidth: 0 }}
          />
        ) : (
          <span
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: depth > 0 ? 12 : 13,
              color: isActive ? 'var(--accent)' : depth > 0 ? 'var(--text-secondary)' : 'var(--text-primary)',
            }}
            onDoubleClick={startRename}
            title="Double-click to rename"
          >
            {map.name}
          </span>
        )}

        {depth > 0 && !renaming && (
          <span style={{
            fontSize: 9,
            color: 'var(--text-muted)',
            flexShrink: 0,
            background: 'var(--bg-elevated)',
            padding: '1px 4px',
            borderRadius: 3,
            border: '1px solid var(--border)',
          }}>
            sub
          </span>
        )}
        {!renaming && (
          <>
            <button
              className="btn-icon"
              onClick={startRename}
              style={{ opacity: 0.35, flexShrink: 0 }}
              title="Rename map"
            >
              <PencilSimple size={12} />
            </button>
            <button
              className="btn-icon"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Delete map "${map.name}"?`)) onDelete(map.id);
              }}
              style={{ opacity: 0.35, flexShrink: 0 }}
              title="Delete map"
            >
              <Trash size={12} />
            </button>
          </>
        )}
      </div>

      {hasChildren && expanded && (
        <div>
          {children.map((child) => (
            <MapTreeItem
              key={child.id}
              map={child}
              allMaps={allMaps}
              allNodes={allNodes}
              activeMapId={activeMapId}
              depth={depth + 1}
              onSelect={onSelect}
              onDelete={onDelete}
              onRename={onRename}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function MapSidebar() {
  const campaignId        = useCampaignStore((s) => s.activeCampaignId);
  const campaigns         = useCampaignStore((s) => s.campaigns);
  const setActiveCampaign = useCampaignStore((s) => s.setActiveCampaign);
  const createCampaign    = useCampaignStore((s) => s.createCampaign);

  const allMaps     = useMapStore((s) => s.maps);
  const activeMapId = useMapStore((s) => s.activeMapId);
  const setActiveMap = useMapStore((s) => s.setActiveMap);
  const createMap   = useMapStore((s) => s.createMap);
  const deleteMap   = useMapStore((s) => s.deleteMap);
  const updateMap   = useMapStore((s) => s.updateMap);

  const allNodes = useNodeStore((s) => s.nodes);

  const campaign = useMemo(
    () => campaigns.find((c) => c.id === campaignId) || null,
    [campaigns, campaignId]
  );

  // Root maps: maps with no parentMapId, OR whose parentMapId doesn't match any node
  // (i.e., orphaned sub-maps treated as roots)
  const rootMaps = useMemo(
    () => allMaps.filter((m) => {
      if (!m.parentMapId) return true;
      // It's a sub-map if its parentMapId matches a real node
      const ownerNode = allNodes.find((n) => n.id === m.parentMapId);
      return !ownerNode; // no owner node → treat as root
    }),
    [allMaps, allNodes]
  );

  const [showNewMap, setShowNewMap]   = useState(false);
  const [newMapName, setNewMapName]   = useState('');
  const [pendingImage, setPendingImage] = useState(null);
  const [collapsed, setCollapsed]     = useState(false);
  const fileInputRef = useRef(null);

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

  const handleSelect = useCallback((mapId) => {
    setActiveMap(mapId);
  }, [setActiveMap]);

  const handleDelete = useCallback((mapId) => {
    deleteMap(campaignId, mapId);
  }, [campaignId, deleteMap]);

  const handleRename = useCallback((mapId, newName) => {
    updateMap(campaignId, mapId, { name: newName });
  }, [campaignId, updateMap]);

  const handleCampaignSelect = useCallback((id) => {
    setActiveCampaign(id);
  }, [setActiveCampaign]);

  const handleCampaignCreate = useCallback((name) => {
    createCampaign(name);
  }, [createCampaign]);

  return (
    <div className={`sidebar ${collapsed ? 'sidebar-collapsed' : ''}`}>
      <button
        className="sidebar-toggle"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? <CaretRight size={16} /> : <CaretLeft size={16} />}
      </button>

      {!collapsed && (
        <>
          {/* Campaign selector header */}
          <div className="sidebar-header" style={{ padding: '10px 12px', gap: 4 }}>
            <CampaignDropdown
              campaign={campaign}
              campaigns={campaigns}
              onSelect={handleCampaignSelect}
              onCreate={handleCampaignCreate}
            />
          </div>

          {/* Map tree */}
          <div className="sidebar-section">
            <div className="sidebar-section-title">Maps</div>

            {rootMaps.map((map) => (
              <MapTreeItem
                key={map.id}
                map={map}
                allMaps={allMaps}
                allNodes={allNodes}
                activeMapId={activeMapId}
                depth={0}
                onSelect={handleSelect}
                onDelete={handleDelete}
                onRename={handleRename}
              />
            ))}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleImageSelect}
            />

            {!showNewMap ? (
              <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ flex: 1, justifyContent: 'center' }}
                  onClick={() => fileInputRef.current?.click()}
                  title="Create a new map from an image"
                >
                  <Plus size={13} /> New Map
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ flexShrink: 0, padding: '4px 8px' }}
                  