import { useState, useRef, useMemo } from 'react';
import {
  X, Trash, Plus, ArrowSquareIn, MapTrifold,
  Upload, PencilSimple, Check, Minus, Eye,
} from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useTagStore from '../../stores/tagStore';
import useMapStore from '../../stores/mapStore';
import useCampaignStore from '../../stores/campaignStore';
import useSettingsStore from '../../stores/settingsStore';
import {
  NODE_TYPES, getFieldSchema, DEFAULT_CUSTOM_FIELDS, DEFAULT_CUSTOM_STATUS_FLAGS,
  isAbstractType, MAP_MAX_DEPTH,
} from '../../utils/nodeSchemas';
import { getTypeIcon, getTypeColor } from '../../utils/typeColors';
import { resolveIcon } from '../../utils/iconRegistry';
import NodeIcon from '../common/NodeIcon';
import IconPickerModal from '../common/IconPickerModal';
import CustomSelect from '../common/CustomSelect';
import PinterestPickerModal from './PinterestPickerModal';
import ImageGalleryModal from './ImageGalleryModal';

const RECIPROCAL_FIELD_MAP = {
  character: { faction: 'faction', religion: 'religion', event: 'involvedParties' },
  location: { character: 'notableNPCs', faction: 'controllingFaction', thing: 'location', event: 'involvedParties', location: 'subLocations' },
  faction: { character: 'leader', faction: 'allies', polity: 'allies', location: 'allies', event: 'involvedParties' },
  religion: { character: 'leadership', location: 'holySites', event: 'involvedParties' },
  event: { character: 'involvedParties', location: 'involvedParties', faction: 'involvedParties', religion: 'involvedParties', polity: 'involvedParties', thing: 'involvedParties' },
  polity: { character: 'ruler', faction: 'allies', polity: 'allies', event: 'involvedParties' },
  thing: { character: 'owner', location: 'location' },
};

function getReciprocalField(targetNodeType, sourceNodeType, preferredField) {
  const schema = getFieldSchema(targetNodeType);
  const tagsFields = schema.filter((f) => f.type === 'tags');
  if (!tagsFields.length) return null;

  const semantic = RECIPROCAL_FIELD_MAP[targetNodeType]?.[sourceNodeType];
  if (semantic && tagsFields.some((f) => f.key === semantic)) return semantic;
  if (tagsFields.some((f) => f.key === preferredField)) return preferredField;

  return tagsFields[0].key;
}

function PinterestGlyph({ size = 13 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#e60023" aria-hidden="true">
      <path d="M12 0C5.373 0 0 5.373 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.218-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.561-5.418 5.207 0 1.031.397 2.138.893 2.738a.36.36 0 0 1 .083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.889-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.359-.632-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0z" />
    </svg>
  );
}

function AddFieldRow({ onAdd, onCancel }) {
  const [label, setLabel] = useState('');

  const commit = () => {
    if (!label.trim()) return;
    const key = `custom_${label.toLowerCase().replace(/\W+/g, '_')}_${Date.now().toString(36)}`;
    onAdd({ key, label: label.trim(), type: 'text', default: '' });
    setLabel('');
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        placeholder="Field name…"
        autoFocus
        style={{ flex: 1, minWidth: 100 }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') onCancel();
        }}
      />
      <button className="btn btn-primary btn-sm" onClick={commit} disabled={!label.trim()}>
        <Check size={13} /> Add
      </button>
      <button className="btn btn-secondary btn-sm" onClick={onCancel}>
        <X size={13} />
      </button>
    </div>
  );
}

export default function DetailPanel() {
  const campaignId = useCampaignStore((s) => s.activeCampaignId);
  const allNodes = useNodeStore((s) => s.nodes);
  const selectedNodeId = useNodeStore((s) => s.selectedNodeId);

  const node = useMemo(
    () => allNodes.find((n) => n.id === selectedNodeId) || null,
    [allNodes, selectedNodeId]
  );

  const selectNode = useNodeStore((s) => s.selectNode);
  const updateNodeFields = useNodeStore((s) => s.updateNodeFields);
  const updateNode = useNodeStore((s) => s.updateNode);
  const deleteNode = useNodeStore((s) => s.deleteNode);
  const deselectNode = useNodeStore((s) => s.deselectNode);
  const addNodeImage = useNodeStore((s) => s.addNodeImage);
  const removeNodeImage = useNodeStore((s) => s.removeNodeImage);
  const tags = useTagStore((s) => s.tags);
  const createTag = useTagStore((s) => s.createTag);
  const maps = useMapStore((s) => s.maps);
  const mapStack = useMapStore((s) => s.mapStack);
  const drillDown = useMapStore((s) => s.drillDown);
  const createMap = useMapStore((s) => s.createMap);

  const customNodeTypes    = useSettingsStore((s) => s.customNodeTypes)    || [];
  const nodeFieldOverrides = useSettingsStore((s) => s.nodeFieldOverrides) || {};
  const nodeTypeOverrides  = useSettingsStore((s) => s.nodeTypeOverrides)  || {};
  const imagePool          = useSettingsStore((s) => s.imagePool)          || [];
  const addToImagePool     = useSettingsStore((s) => s.addToImagePool);

  const fileInputRef = useRef(null);
  const mapFileRef = useRef(null);
  const heroRef = useRef(null);
  const heroDragStartRef = useRef(null);

  const [tagInput, setTagInput] = useState({});
  const [tagFocused, setTagFocused] = useState(null);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const [pinterestOpen, setPinterestOpen] = useState(false);
  // Persist Pinterest board state across modal open/close
  const [pinterestBoard, setPinterestBoard]       = useState(null);
  const [pinterestImages, setPinterestImages]     = useState(null);
  const [pinterestNextBM, setPinterestNextBM]     = useState(null);
  const [addingField, setAddingField] = useState(false);

  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex]   = useState(null); // unified image lightbox (kept for direct open)
  const [galleryOpen,   setGalleryOpen]     = useState(false); // pinterest-style gallery
  const [urlInputOpen,  setUrlInputOpen]    = useState(false);
  const [urlDraft,      setUrlDraft]        = useState('');
  const [isDragOver,    setIsDragOver]      = useState(false);

  const [isAdjustingHero, setIsAdjustingHero] = useState(false);
  const [isDraggingHero, setIsDraggingHero] = useState(false);

  // Node lookup map for chiplets
  const nodeMap = useMemo(() => {
    const m = {};
    for (const n of allNodes) m[n.id] = n;
    return m;
  }, [allNodes]);

  if (!node) return null;

  const builtinInfo = NODE_TYPES[node.type] || null;
  const customInfo = customNodeTypes.find((c) => c.id === node.type) || null;
  const typeInfo = builtinInfo || {
    label: customInfo?.label || node.type,
    statusFlags: DEFAULT_CUSTOM_STATUS_FLAGS,
  };

  const baseSchema = builtinInfo ? getFieldSchema(node.type) : DEFAULT_CUSTOM_FIELDS;

  const globalOverride = nodeFieldOverrides[node.type] || {};
  const removedGlobally = new Set(globalOverride.removed || []);
  const addedGlobally = globalOverride.added || [];

  const removedLocally = new Set(node.removedFields || []);
  const addedLocally = node.customFields || [];

  const schema = [
    ...baseSchema.filter((f) => !removedGlobally.has(f.key) && !removedLocally.has(f.key)),
    ...addedGlobally.filter((f) => !removedLocally.has(f.key)),
    ...addedLocally,
  ];

  const images = node.images || [];
  const hasImages = images.length > 0;
  const heroImageId = node.heroImageId || images[0]?.id || null;
  const heroPositionX = node.heroPositionX ?? 50;
  const heroPositionY = node.heroPositionY ?? 50;
  const heroImage = images.find((img) => img.id === heroImageId) || images[0] || null;
  const childMap = maps.find((m) => m.parentMapId === node.id);
  const typeColor = `var(--node-${node.type})`;

  const getTagSuggestions = (fieldKey) => {
    const query = (tagInput[fieldKey] || '').trim().toLowerCase();
    if (!query) return [];

    const field = schema.find((f) => f.key === fieldKey);
    const filterTypes = field?.filterTypes;
    const currentTags = Array.isArray(node?.fields?.[fieldKey]) ? node.fields[fieldKey] : [];
    const currentTagNodeIds = currentTags
      .map((id) => tags.find((t) => t.id === id)?.nodeId)
      .filter(Boolean);

    return allNodes
      .filter((n) => {
        if (n.id === selectedNodeId) return false;
        if (filterTypes?.length && !filterTypes.includes(n.type)) return false;
        const name = n.fields?.name;
        if (!name) return false;
        if (currentTagNodeIds.includes(n.id)) return false;
        return name.toLowerCase().includes(query);
      })
      .slice(0, 8)
      .map((n) => ({ id: n.id, name: n.fields.name, type: n.type }));
  };

  const handleFieldChange = (key, value) => {
    updateNodeFields(campaignId, node.id, { [key]: value });
  };

  const handleStatusToggle = (flag) => {
    updateNode(campaignId, node.id, {
      statusFlags: { ...node.statusFlags, [flag]: !node.statusFlags?.[flag] },
    });
  };

  const handleImageUpload = (e) => {
    Array.from(e.target.files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => addNodeImage(campaignId, node.id, ev.target.result);
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleAddImageUrl = () => { setUrlInputOpen(true); setUrlDraft(''); };

  const commitImageUrl = () => {
    const trimmed = urlDraft.trim();
    setUrlInputOpen(false);
    setUrlDraft('');
    if (!trimmed) return;
    try { new URL(trimmed); } catch { return; }
    addNodeImage(campaignId, node.id, trimmed);
  };

  const handleHeroDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isAdjustingHero) return;
    Array.from(e.dataTransfer.files)
      .filter((f) => f.type.startsWith('image/'))
      .forEach((file) => {
        const reader = new FileReader();
        reader.onload = (ev) => addNodeImage(campaignId, node.id, ev.target.result);
        reader.readAsDataURL(file);
      });
  };

  const handleAddTag = (fieldKey, value, refNodeId = null) => {
    if (!value.trim()) return;

    let tag;
    if (refNodeId) {
      tag = tags.find((t) => t.nodeId === refNodeId);
      if (!tag) tag = createTag(campaignId, value.trim(), '#888888', refNodeId);
    } else {
      tag = tags.find((t) => t.name.toLowerCase() === value.toLowerCase() && !t.nodeId);
      if (!tag) tag = createTag(campaignId, value.trim());
    }

    const currentTags = Array.isArray(node.fields?.[fieldKey]) ? node.fields[fieldKey] : [];
    if (!currentTags.includes(tag.id)) {
      handleFieldChange(fieldKey, [...currentTags, tag.id]);
    }

    if (refNodeId) {
      const targetNode = allNodes.find((n) => n.id === refNodeId);
      if (targetNode && targetNode.id !== node.id) {
        const recipField = getReciprocalField(targetNode.type, node.type, fieldKey);
        if (recipField) {
          let backTag = tags.find((t) => t.nodeId === node.id);
          if (!backTag) backTag = createTag(campaignId, node.fields?.name || 'Unknown', '#888888', node.id);

          const targetFieldTags = Array.isArray(targetNode.fields?.[recipField])
            ? targetNode.fields[recipField]
            : [];

          if (!targetFieldTags.includes(backTag.id)) {
            updateNodeFields(campaignId, targetNode.id, {
              [recipField]: [...targetFieldTags, backTag.id],
            });
          }
        }
      }
    }

    setTagInput((prev) => ({ ...prev, [fieldKey]: '' }));
  };

  const handleRemoveTag = (fieldKey, tagId) => {
    const currentTags = Array.isArray(node.fields?.[fieldKey]) ? node.fields[fieldKey] : [];
    handleFieldChange(fieldKey, currentTags.filter((id) => id !== tagId));

    const tag = tags.find((t) => t.id === tagId);
    if (tag?.nodeId) {
      const targetNode = allNodes.find((n) => n.id === tag.nodeId);
      if (targetNode) {
        const backTag = tags.find((t) => t.nodeId === node.id);
        if (backTag) {
          const tSchema = getFieldSchema(targetNode.type);
          for (const f of tSchema.filter((f) => f.type === 'tags')) {
            const fieldTags = Array.isArray(targetNode.fields?.[f.key]) ? targetNode.fields[f.key] : [];
            if (fieldTags.includes(backTag.id)) {
              updateNodeFields(campaignId, targetNode.id, {
                [f.key]: fieldTags.filter((id) => id !== backTag.id),
              });
              break;
            }
          }
        }
      }
    }
  };

  const handleSetHeroImage = (imageId) => {
    updateNode(campaignId, node.id, { heroImageId: imageId });
  };

  const handleHeroContextMenu = (e) => {
    e.preventDefault();
    if (!hasImages) return;

    setIsAdjustingHero((prev) => !prev);
    setIsDraggingHero(false);
    heroDragStartRef.current = null;
  };

  const handleHeroMouseDown = (e) => {
    if (!isAdjustingHero || !heroRef.current) return;
    e.preventDefault();

    heroDragStartRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startHeroX: heroPositionX,
      startHeroY: heroPositionY,
    };

    setIsDraggingHero(true);
  };

  const handleHeroMouseMove = (e) => {
    if (!isAdjustingHero || !isDraggingHero || !heroRef.current || !heroDragStartRef.current) return;

    const rect = heroRef.current.getBoundingClientRect();
    const dxPx = e.clientX - heroDragStartRef.current.startMouseX;
    const dyPx = e.clientY - heroDragStartRef.current.startMouseY;

    const dxPercent = (dxPx / rect.width) * 100;
    const dyPercent = (dyPx / rect.height) * 100;

    const nextX = Math.max(0, Math.min(100, heroDragStartRef.current.startHeroX - dxPercent));
    const nextY = Math.max(0, Math.min(100, heroDragStartRef.current.startHeroY - dyPercent));

    updateNode(campaignId, node.id, {
      heroPositionX: nextX,
      heroPositionY: nextY,
    });
  };

  const handleHeroMouseUp = () => {
    if (!isAdjustingHero) return;
    setIsDraggingHero(false);
    heroDragStartRef.current = null;
  };

  const handleDelete = () => {
    if (confirm('Delete this node?')) deleteNode(campaignId, node.id);
  };

  const handleRemoveFieldLocally = (fieldKey) => {
    const removed = [...new Set([...(node.removedFields || []), fieldKey])];
    updateNode(campaignId, node.id, { removedFields: removed });
  };

  const handleRestoreFieldLocally = (fieldKey) => {
    const removed = (node.removedFields || []).filter((k) => k !== fieldKey);
    updateNode(campaignId, node.id, { removedFields: removed });
  };

  const handleAddCustomField = (field) => {
    const customFields = [...(node.customFields || []), field];
    updateNode(campaignId, node.id, { customFields });
    setAddingField(false);
  };

  const handleRemoveCustomField = (fieldKey) => {
    const customFields = (node.customFields || []).filter((f) => f.key !== fieldKey);
    updateNode(campaignId, node.id, { customFields });
  };

  const renderField = (field, removable = false) => {
    const value = node.fields?.[field.key];

    if (field.type === 'text') {
      return (
        <div key={field.key} className="field-group" style={{ position: 'relative' }}>
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {field.label}
            {removable && (
              <button
                className="btn-icon field-remove-btn"
                title="Remove this field from this node"
                onClick={() => handleRemoveFieldLocally(field.key)}
                style={{ opacity: 0.45, fontSize: 11 }}
              >
                <Minus size={12} />
              </button>
            )}
          </label>
          <input
            value={value || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
        </div>
      );
    }

    if (field.type === 'textarea') {
      return (
        <div key={field.key} className="field-group">
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {field.label}
            {removable && (
              <button
                className="btn-icon field-remove-btn"
                title="Remove this field from this node"
                onClick={() => handleRemoveFieldLocally(field.key)}
                style={{ opacity: 0.45, fontSize: 11 }}
              >
                <Minus size={12} />
              </button>
            )}
          </label>
          <textarea
            value={value || ''}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={`Enter ${field.label.toLowerCase()}...`}
          />
        </div>
      );
    }

    if (field.type === 'select') {
      return (
        <div key={field.key} className="field-group">
          <label>{field.label}</label>
          <CustomSelect
            value={value || field.default}
            onChange={(val) => handleFieldChange(field.key, val)}
            options={(field.options || []).map((opt) => ({
              value: opt,
              label: opt.charAt(0).toUpperCase() + opt.slice(1),
            }))}
          />
        </div>
      );
    }

    if (field.type === 'tags') {
      const tagIds = Array.isArray(value) ? value : [];

      return (
        <div key={field.key} className="field-group">
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {field.label}
            {removable && (
              <button
                className="btn-icon field-remove-btn"
                title="Remove this field from this node"
                onClick={() => handleRemoveFieldLocally(field.key)}
                style={{ opacity: 0.45, fontSize: 11 }}
              >
                <Minus size={12} />
              </button>
            )}
          </label>

          <div className="tag-list">
            {tagIds.map((tagId) => {
              const tag = tags.find((t) => t.id === tagId);
              if (!tag) return null;

              return (
                <span
                  key={tagId}
                  className="tag"
                  style={{
                    borderColor: tag.color,
                    color: tag.color,
                    background: `${tag.color}15`,
                  }}
                >
                  {tag.name}
                  <span className="remove" onClick={() => handleRemoveTag(field.key, tagId)}>
                    &times;
                  </span>
                </span>
              );
            })}
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                value={tagInput[field.key] || ''}
                onChange={(e) => {
                  setTagInput((prev) => ({ ...prev, [field.key]: e.target.value }));
                  setHighlightIndex(-1);
                }}
                onFocus={() => setTagFocused(field.key)}
                onBlur={() => setTimeout(() => setTagFocused(null), 150)}
                onKeyDown={(e) => {
                  const suggestions = getTagSuggestions(field.key);

                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setHighlightIndex((prev) => Math.min(prev + 1, suggestions.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setHighlightIndex((prev) => Math.max(prev - 1, -1));
                  } else if (e.key === 'Enter') {
                    e.preventDefault();

                    if (highlightIndex >= 0 && suggestions[highlightIndex]) {
                      const s = suggestions[highlightIndex];
                      handleAddTag(field.key, s.name, s.id);
                    } else {
                      handleAddTag(field.key, tagInput[field.key] || '');
                    }

                    setHighlightIndex(-1);
                  } else if (e.key === 'Escape') {
                    setTagFocused(null);
                    setHighlightIndex(-1);
                  }
                }}
                placeholder={
                  field.filterTypes?.length
                    ? `Search ${field.filterTypes.join(' / ')}…`
                    : 'Add tag…'
                }
                style={{ flex: 1 }}
              />

              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  handleAddTag(field.key, tagInput[field.key] || '');
                  setHighlightIndex(-1);
                }}
              >
                <Plus size={14} />
              </button>
            </div>

            {tagFocused === field.key && (() => {
              const suggestions = getTagSuggestions(field.key);
              if (!suggestions.length) return null;

              return (
                <div className="tag-autocomplete">
                  {suggestions.map((s, idx) => (
                    <div
                      key={s.id}
                      className={`tag-autocomplete-item ${idx === highlightIndex ? 'highlighted' : ''}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        handleAddTag(field.key, s.name, s.id);
                        setHighlightIndex(-1);
                      }}
                      onMouseEnter={() => setHighlightIndex(idx)}
                    >
                      <span className="tag-ac-name">{s.name}</span>
                      <span className="tag-ac-type" style={{ color: `var(--node-${s.type})` }}>
                        {NODE_TYPES[s.type]?.label ||
                          customNodeTypes.find((c) => c.id === s.type)?.label ||
                          s.type}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <>
      <div className="detail-panel">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleImageUpload}
        />

        {hasImages ? (
          <div
            ref={heroRef}
            className={`detail-hero ${isDragOver ? 'drag-over' : ''}`}
            onContextMenu={handleHeroContextMenu}
            onMouseDown={handleHeroMouseDown}
            onMouseMove={handleHeroMouseMove}
            onMouseUp={handleHeroMouseUp}
            onMouseLeave={handleHeroMouseUp}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleHeroDrop}
            style={{
              cursor: isAdjustingHero ? (isDraggingHero ? 'grabbing' : 'grab') : 'pointer',
              outline: isAdjustingHero ? '2px solid var(--accent)' : isDragOver ? '2px dashed var(--accent)' : 'none',
              outlineOffset: '-2px',
            }}
            title={isAdjustingHero ? 'Drag to reposition hero image' : 'Drop images here • Right-click to adjust position'}
          >
            <img
              src={heroImage?.url}
              alt=""
              style={{ objectPosition: `${heroPositionX}% ${heroPositionY}%` }}
            />
            <div className="hero-overlay" />
            {images.length > 1 && <span className="hero-count">{images.length} images</span>}

            {isAdjustingHero && (
              <div
                style={{
                  position: 'absolute',
                  top: 10,
                  left: 10,
                  background: 'rgba(0,0,0,0.72)',
                  color: '#fff',
                  fontSize: 11,
                  padding: '6px 10px',
                  borderRadius: 999,
                  zIndex: 2,
                }}
              >
                Drag to reposition • Right-click to exit
              </div>
            )}
          </div>
        ) : (
          <div
            className={`detail-hero-empty ${isDragOver ? 'drag-over' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={handleHeroDrop}
          >
            <Upload size={24} />
            <span>{isDragOver ? 'Drop to add image' : 'Upload or drop an image'}</span>
          </div>
        )}

        <div className="detail-header">
          <button
            onClick={() => setIconPickerOpen(true)}
            title="Change icon"
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              display: 'inline-flex', borderRadius: 'var(--radius)',
              opacity: 0.9, transition: 'opacity 0.12s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.9'}
          >
            <NodeIcon node={node} size={28} showOverlays={false} />
          </button>

          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)' }}>
              {node.fields?.name || 'Unnamed'}
            </div>

            <span
              className={`type-badge type-${node.type}`}
              style={{ background: `${typeColor}18`, color: typeColor }}
            >
              {typeInfo?.label || node.type}
            </span>
          </div>

          <button className="btn-icon" onClick={deselectNode}>
            <X size={18} />
          </button>
        </div>

        <div className="detail-body">
          {/* ── Image moodboard strip (always shown) ── */}
          <div className="field-group">
            <label>Images</label>
            <div className="detail-image-strip">
              {images.map((img, idx) => {
                const isHero = img.id === heroImageId;
                return (
                  <div
                    key={img.id}
                    className={`detail-strip-thumb ${isHero ? 'is-hero' : ''}`}
                    onClick={() => { setLightboxIndex(idx); setGalleryOpen(true); }}
                    title={isHero ? 'Hero image — click to view all' : 'Click to view all images'}
                  >
                    <img src={img.url} alt="" />
                    {isHero && <div className="detail-strip-hero-badge" title="Hero image">★</div>}
                    <div className="detail-strip-hover-actions">
                      {!isHero && (
                        <button
                          className="detail-strip-action"
                          onClick={(e) => { e.stopPropagation(); handleSetHeroImage(img.id); }}
                          title="Set as hero"
                        >★</button>
                      )}
                      <button
                        className="detail-strip-action danger"
                        onClick={(e) => { e.stopPropagation(); removeNodeImage(campaignId, node.id, img.id); }}
                        title="Remove image"
                      >×</button>
                    </div>
                  </div>
                );
              })}

              {/* Upload tile */}
              <div
                className="detail-strip-thumb detail-strip-add"
                onClick={() => fileInputRef.current?.click()}
                title="Upload image"
              >
                <Plus size={18} />
              </div>
            </div>

            {/* Action row: URL input + pool button */}
            <div className="detail-image-actions">
              {urlInputOpen ? (
                <div className="detail-url-input-row">
                  <input
                    className="detail-url-input"
                    autoFocus
                    placeholder="https://..."
                    value={urlDraft}
                    onChange={(e) => setUrlDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter')  commitImageUrl();
                      if (e.key === 'Escape') { setUrlInputOpen(false); setUrlDraft(''); }
                    }}
                  />
                  <button className="btn btn-secondary btn-sm" onClick={commitImageUrl}>Add</button>
                  <button className="btn-icon" onClick={() => { setUrlInputOpen(false); setUrlDraft(''); }}>
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <button className="btn btn-secondary btn-sm" onClick={handleAddImageUrl}>
                  <Plus size={13} /> Add URL
                </button>
              )}

              {imagePool.length > 0 && !urlInputOpen && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setGalleryOpen(true)}
                  title="Open gallery / add from image pool"
                >
                  <Eye size={13} /> Gallery
                </button>
              )}
            </div>
          </div>

          <div className="field-group">
            <label>Status</label>

            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {typeInfo?.statusFlags && Object.entries(typeInfo.statusFlags).map(([flagKey, flagDef]) => {
                const isOn = node.statusFlags?.[flagKey] ?? flagDef.default;

                if (flagKey === 'revealed') return null;

                const styleClass = isOn ? 'status-alive' : 'status-dead';

                return (
                  <button
                    key={flagKey}
                    className={`status-badge ${styleClass}`}
                    onClick={() => handleStatusToggle(flagKey)}
                  >
                    {isOn ? flagDef.label : flagDef.offLabel}
                  </button>
                );
              })}
            </div>
          </div>

          {schema.map((field) => {
            const isPerNodeCustom = addedLocally.some((f) => f.key === field.key);
            const removable = field.key !== 'name';
            const rendered = renderField(field, removable);
            if (!rendered) return null;

            if (isPerNodeCustom) {
              return (
                <div key={field.key} style={{ position: 'relative' }}>
                  {rendered}
                  <button
                    className="btn-icon field-remove-btn"
                    title="Delete this custom field from this node"
                    onClick={() => handleRemoveCustomField(field.key)}
                    style={{ position: 'absolute', top: 0, right: 0, opacity: 0.45 }}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            }

            return rendered;
          })}

          <div className="field-group" style={{ marginTop: 4 }}>
            {addingField ? (
              <AddFieldRow onAdd={handleAddCustomField} onCancel={() => setAddingField(false)} />
            ) : (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setAddingField(true)}
                style={{ gap: 6 }}
              >
                <Plus size={13} /> Add field
              </button>
            )}
          </div>

          {/* ── Drill-down to existing child map ── */}
          {childMap && (
            <div className="field-group">
              <label>Sub-map</label>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => mapStack.length < MAP_MAX_DEPTH - 1 && drillDown(childMap.id)}
                disabled={mapStack.length >= MAP_MAX_DEPTH - 1}
                title={mapStack.length >= MAP_MAX_DEPTH - 1
                  ? `Max map depth (${MAP_MAX_DEPTH}) reached — navigate back first`
                  : `Open ${childMap.name}`}
                style={{ gap: 6, opacity: mapStack.length >= MAP_MAX_DEPTH - 1 ? 0.45 : 1 }}
              >
                <MapTrifold size={14} /> Open {childMap.name}
              </button>
            </div>
          )}

          {/* ── Create sub-map (location types only) ── */}
          <input
            ref={mapFileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const reader = new FileReader();
              reader.onload = (ev) => {
                createMap(campaignId, `${node.fields?.name || 'Unnamed'} Map`, ev.target.result, node.id);
              };
              reader.readAsDataURL(file);
              e.target.value = '';
            }}
          />

          {/* ── Relationship chiplets ── */}
          {(() => {
            const seenIds = new Set();
            const chips = [];

            const pushChip = (refNode) => {
              if (!refNode || seenIds.has(refNode.id)) return;
              seenIds.add(refNode.id);
              const chipColor    = getTypeColor(refNode.type, nodeTypeOverrides, customNodeTypes);
              const chipIconName = getTypeIcon(refNode.type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
              const ChipIcon     = resolveIcon(chipIconName);
              chips.push({ refNode, chipColor, ChipIcon });
            };

            // 1. Abstract-type tag field references (use merged schema so custom fields are included)
            const tagFields = schema.filter((f) => f.type === 'tags');
            for (const field of tagFields) {
              if (!field.filterTypes?.length) continue;
              const raw = node.fields?.[field.key];
              if (!Array.isArray(raw) || raw.length === 0) continue;
              for (const refId of raw) {
                const refNode = nodeMap[refId];
                if (!refNode) continue;
                if (!isAbstractType(refNode.type, customNodeTypes)) continue;
                pushChip(refNode);
              }
            }

            // 2. Parent node (spatial container)
            if (node.parentNodeId) pushChip(nodeMap[node.parentNodeId]);

            // 3. Children nodes (nodes nested inside this one)
            const children = Object.values(nodeMap).filter((n) => n.parentNodeId === node.id);
            for (const child of children.slice(0, 6)) pushChip(child);
            const overflow = children.length > 6 ? children.length - 6 : 0;

            if (chips.length === 0 && overflow === 0) return null;

            return (
              <div className="field-group">
                <label style={{ marginBottom: 6 }}>Connections</label>
                <div className="node-card-chiplets" style={{ flexWrap: 'wrap', gap: '5px 6px' }}>
                  {chips.map(({ refNode, chipColor, ChipIcon }) => (
                    <span
                      key={refNode.id}
                      className="rel-chiplet"
                      style={{
                        borderColor: `${chipColor}50`,
                        color: chipColor,
                        background: `${chipColor}14`,
                        cursor: 'pointer',
                      }}
                      onClick={() => selectNode(refNode.id)}
                      title={`Open ${refNode.fields?.name || refNode.type}`}
                    >
                      <ChipIcon size={9} weight="fill" />
                      {refNode.fields?.name || '—'}
                    </span>
                  ))}
                  {overflow > 0 && (
                    <span
                      className="rel-chiplet"
                      style={{ borderColor: 'var(--border-strong)', color: 'var(--text-muted)', background: 'var(--bg-inset)' }}
                    >
                      +{overflow}
                    </span>
                  )}
                </div>
              </div>
            );
          })()}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
            {!childMap && (NODE_TYPES[node.type]?.drillDown === 'spatial' || (!NODE_TYPES[node.type] && !isAbstractType(node.type, customNodeTypes))) && (() => {
              const atDepthLimit = mapStack.length >= MAP_MAX_DEPTH - 1;
              return (
                <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => !atDepthLimit && mapFileRef.current?.click()}
                    disabled={atDepthLimit}
                    title={atDepthLimit ? `Max map depth (${MAP_MAX_DEPTH}) reached` : 'Create sub-map from image'}
                    style={{ gap: 6, opacity: atDepthLimit ? 0.45 : 1 }}
                  >
                    <MapTrifold size={14} /> Sub-map
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      if (atDepthLimit) return;
                      createMap(campaignId, `${node.fields?.name || 'Unnamed'} Map`, null, node.id);
                    }}
                    disabled={atDepthLimit}
                    title={atDepthLimit ? `Max map depth (${MAP_MAX_DEPTH}) reached` : 'Create blank sub-map (no image)'}
                    style={{ gap: 6, opacity: atDepthLimit ? 0.45 : 1, fontSize: 11 }}
                  >
                    + Blank
                  </button>
                </div>
              );
            })()}
            <button
              className="btn btn-danger btn-sm"
              onClick={handleDelete}
              style={{ marginLeft: 'auto', gap: 6 }}
            >
              <Trash size={13} /> Delete
            </button>
          </div>
        </div>
      </div>

      {/* ── Icon picker ── */}
      {iconPickerOpen && (
        <IconPickerModal
          current={node.icon || ''}
          onSelect={(name) => {
            updateNode(campaignId, node.id, { icon: name });
            setIconPickerOpen(false);
          }}
          onClose={() => setIconPickerOpen(false)}
        />
      )}

      {/* ── Pinterest picker ── */}
      {pinterestOpen && (
        <PinterestPickerModal
          onSelect={(url) => addNodeImage(campaignId, node.id, url)}
          onClose={() => setPinterestOpen(false)}
          initialBoard={pinterestBoard}
          initialImages={pinterestImages}
          initialNextBookmark={pinterestNextBM}
          onStateChange={({ activeBoard, images, nextBookmark }) => {
            setPinterestBoard(activeBoard);
            setPinterestImages(images);
            setPinterestNextBM(nextBookmark);
          }}
        />
      )}

      {/* ── Image gallery (Pinterest-style masonry + lightbox) ── */}
      {galleryOpen && (
        <ImageGalleryModal
          images={images}
          heroImageId={heroImageId}
          startIndex={lightboxIndex}
          poolImages={imagePool}
          onClose={() => { setGalleryOpen(false); setLightboxIndex(null); }}
          onSetHero={(imgId) => handleSetHeroImage(imgId)}
          onRemove={(imgId) => removeNodeImage(campaignId, node.id, imgId)}
          onAddFromPool={(url) => addNodeImage(campaignId, node.id, url)}
        />
      )}
    </>
  );
}
