import { useState, useRef, useMemo } from 'react';

const NODE_PRESET_COLORS = [
  '#fb923c', '#fbbf24', '#e879a8', '#60a5fa', '#4ade80',
  '#f87171', '#c084fc', '#38bdf8', '#a3e635', '#fb7185',
];
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
  NODE_TYPES, getFieldSchema, DEFAULT_CUSTOM_FIELDS, DEFAULT_CUSTOM_ABSTRACT_FIELDS,
  DEFAULT_CUSTOM_STATUS_FLAGS, isAbstractType, MAP_MAX_DEPTH,
} from '../../utils/nodeSchemas';
import { getTypeIcon, getTypeColor } from '../../utils/typeColors';
import { resolveIcon } from '../../utils/iconRegistry';
import NodeIcon from '../common/NodeIcon';
import IconPickerModal from '../common/IconPickerModal';
import CustomSelect from '../common/CustomSelect';
import PinterestPickerModal from './PinterestPickerModal';
import ImageGalleryModal from './ImageGalleryModal';
import HierarchyView from './HierarchyView';
import { uploadImage } from '../../utils/api';

const RECIPROCAL_FIELD_MAP = {
  character: { event: 'involvedParties' },
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
  const [noderefInput, setNoderefInput]         = useState({});
  const [noderefFocused, setNoderefFocused]     = useState(null);
  const [noderefHighlight, setNoderefHighlight] = useState(-1);
  // Memberships section (character panel — add to org search)
  const [membSearch,    setMembSearch]    = useState('');
  const [membFocused,   setMembFocused]   = useState(false);
  const [membHighlight, setMembHighlight] = useState(-1);
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

  const baseSchema = builtinInfo
    ? getFieldSchema(node.type)
    : (customInfo?.kind === 'abstract' ? DEFAULT_CUSTOM_ABSTRACT_FIELDS : DEFAULT_CUSTOM_FIELDS);

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
  // Resolved display color — custom overrides type default
  const resolvedTypeColor = getTypeColor(node.type, nodeTypeOverrides, customNodeTypes);

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

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    for (const file of files) {
      try {
        const url = await uploadImage(file);
        addNodeImage(campaignId, node.id, url);
      } catch (err) {
        console.error('Node image upload failed:', err);
      }
    }
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

  const handleHeroDrop = async (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (isAdjustingHero) return;
    for (const file of Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith('image/'))) {
      try {
        const url = await uploadImage(file);
        addNodeImage(campaignId, node.id, url);
      } catch (err) {
        console.error('Node image drop upload failed:', err);
      }
    }
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

  // ── noderefs field helpers (stores node IDs directly, no tag layer) ───────────
  const getNoderefSuggestions = (fieldKey) => {
    const query = (noderefInput[fieldKey] || '').trim().toLowerCase();
    if (!query) return [];
    const field = schema.find((f) => f.key === fieldKey);
    const filterTypes = field?.filterTypes;
    const currentIds = Array.isArray(node.fields?.[fieldKey]) ? node.fields[fieldKey] : [];
    return allNodes
      .filter((n) => {
        if (n.id === selectedNodeId) return false;
        if (n.campaignId !== campaignId) return false;
        if (filterTypes?.length && !filterTypes.includes(n.type)) return false;
        if (!n.fields?.name) return false;
        if (currentIds.includes(n.id)) return false;
        return n.fields.name.toLowerCase().includes(query);
      })
      .slice(0, 8)
      .map((n) => ({ id: n.id, name: n.fields.name, type: n.type }));
  };

  const handleAddNoderef = (fieldKey, nodeId) => {
    const current = Array.isArray(node.fields?.[fieldKey]) ? node.fields[fieldKey] : [];
    if (!current.includes(nodeId)) {
      handleFieldChange(fieldKey, [...current, nodeId]);
    }
    setNoderefInput((prev) => ({ ...prev, [fieldKey]: '' }));
    setNoderefHighlight(-1);
  };

  const handleRemoveNoderef = (fieldKey, nodeId) => {
    const current = Array.isArray(node.fields?.[fieldKey]) ? node.fields[fieldKey] : [];
    handleFieldChange(fieldKey, current.filter((id) => id !== nodeId));
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

    if (field.type === 'noderefs') {
      const nodeIds = Array.isArray(value) ? value : [];
      const suggestions = noderefFocused === field.key ? getNoderefSuggestions(field.key) : [];

      return (
        <div key={field.key} className="field-group">
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {field.label}
            {removable && (
              <button
                className="btn-icon field-remove-btn"
                title="Remove this field"
                onClick={() => handleRemoveFieldLocally(field.key)}
                style={{ opacity: 0.45, fontSize: 11 }}
              >
                <Minus size={12} />
              </button>
            )}
          </label>

          <div className="tag-list">
            {nodeIds.map((nId) => {
              const refNode = nodeMap[nId];
              if (!refNode) return null;
              const refColor = `var(--node-${refNode.type}, var(--text-muted))`;
              return (
                <span
                  key={nId}
                  className="tag"
                  style={{ borderColor: refColor, color: refColor, background: `${refColor}15`, cursor: 'pointer' }}
                  onClick={() => selectNode(nId)}
                  title="Open in detail panel"
                >
                  {refNode.fields?.name || '???'}
                  <span
                    className="remove"
                    onClick={(e) => { e.stopPropagation(); handleRemoveNoderef(field.key, nId); }}
                  >&times;</span>
                </span>
              );
            })}
          </div>

          <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                value={noderefInput[field.key] || ''}
                onChange={(e) => {
                  setNoderefInput((prev) => ({ ...prev, [field.key]: e.target.value }));
                  setNoderefHighlight(-1);
                }}
                onFocus={() => setNoderefFocused(field.key)}
                onBlur={() => setTimeout(() => setNoderefFocused(null), 150)}
                onKeyDown={(e) => {
                  const sugg = getNoderefSuggestions(field.key);
                  if (e.key === 'ArrowDown') { e.preventDefault(); setNoderefHighlight((p) => Math.min(p + 1, sugg.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setNoderefHighlight((p) => Math.max(p - 1, -1)); }
                  else if (e.key === 'Enter') {
                    e.preventDefault();
                    if (noderefHighlight >= 0 && sugg[noderefHighlight]) handleAddNoderef(field.key, sugg[noderefHighlight].id);
                    setNoderefHighlight(-1);
                  } else if (e.key === 'Escape') { setNoderefFocused(null); setNoderefHighlight(-1); }
                }}
                placeholder={field.filterTypes?.length ? `Search ${field.filterTypes.join(' / ')}…` : 'Search…'}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const sugg = getNoderefSuggestions(field.key);
                  if (noderefHighlight >= 0 && sugg[noderefHighlight]) handleAddNoderef(field.key, sugg[noderefHighlight].id);
                  setNoderefHighlight(-1);
                }}
              >
                <Plus size={14} />
              </button>
            </div>

            {noderefFocused === field.key && suggestions.length > 0 && (
              <div className="tag-autocomplete">
                {suggestions.map((s, idx) => (
                  <div
                    key={s.id}
                    className={`tag-autocomplete-item ${idx === noderefHighlight ? 'highlighted' : ''}`}
                    onMouseDown={(e) => { e.preventDefault(); handleAddNoderef(field.key, s.id); setNoderefHighlight(-1); }}
                    onMouseEnter={() => setNoderefHighlight(idx)}
                  >
                    <span className="tag-ac-name">{s.name}</span>
                    <span className="tag-ac-type" style={{ color: `var(--node-${s.type})` }}>
                      {NODE_TYPES[s.type]?.label || customNodeTypes.find((c) => c.id === s.type)?.label || s.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span
                className={`type-badge type-${node.type}`}
                style={{ background: `${typeColor}18`, color: typeColor }}
              >
                {typeInfo?.label || node.type}
              </span>
            </div>

            {/* ── Color swatches (preset + custom) ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 4 }}>
              {NODE_PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => updateNode(campaignId, node.id, { color: c })}
                  title={c}
                  style={{
                    width: 16, height: 16, borderRadius: '50%', background: c, padding: 0,
                    border: node.color === c ? '2px solid #fff' : '2px solid transparent',
                    boxShadow: node.color === c ? `0 0 0 1px ${c}` : 'none',
                    cursor: 'pointer', flexShrink: 0, transition: 'transform 0.1s',
                  }}
                />
              ))}
              {/* Custom color */}
              <label style={{ position: 'relative', cursor: 'pointer' }} title="Custom color">
                <span style={{
                  width: 16, height: 16, borderRadius: '50%', display: 'flex',
                  alignItems: 'center', justifyContent: 'center',
                  background: node.color && !NODE_PRESET_COLORS.includes(node.color) ? node.color : 'var(--bg-inset)',
                  border: '1.5px dashed var(--border-strong)',
                  fontSize: 11, color: 'var(--text-muted)',
                }}>+</span>
                <input
                  type="color"
                  value={node.color || resolvedTypeColor}
                  onChange={(e) => updateNode(campaignId, node.id, { color: e.target.value })}
                  style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
                />
              </label>
              {node.color && (
                <button
                  title="Reset to type color"
                  onClick={() => updateNode(campaignId, node.id, { color: null })}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: '0 3px',
                    fontSize: 10, color: 'var(--text-muted)', borderRadius: 'var(--radius)', lineHeight: 1.4,
                  }}
                >
                  reset
                </button>
              )}
            </div>
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

          {/* ── Memberships (character only) — derived from org nodes' fields.members ── */}
          {node.type === 'character' && (() => {
            // Collect all abstract org types (built-in + custom)
            const abstractTypes = [
              ...Object.entries(NODE_TYPES)
                .filter(([, v]) => v.kind === 'abstract')
                .map(([typeId, v]) => ({ typeId, label: v.label })),
              ...customNodeTypes
                .filter((c) => c.kind === 'abstract')
                .map((c) => ({ typeId: c.id, label: c.label })),
            ];

            const memberships = abstractTypes
              .map(({ typeId, label }) => {
                const orgs = allNodes.filter(
                  (n) => n.campaignId === campaignId &&
                         n.type === typeId &&
                         Array.isArray(n.fields?.members) &&
                         n.fields.members.includes(node.id)
                );
                return orgs.length > 0 ? { typeId, label, orgs } : null;
              })
              .filter(Boolean);

            const orgCandidates = membFocused && membSearch.trim()
              ? allNodes.filter((n) => {
                  if (n.campaignId !== campaignId) return false;
                  if (!abstractTypes.some((a) => a.typeId === n.type)) return false;
                  if (!n.fields?.name) return false;
                  // Already a member?
                  if (Array.isArray(n.fields?.members) && n.fields.members.includes(node.id)) return false;
                  return n.fields.name.toLowerCase().includes(membSearch.toLowerCase());
                }).slice(0, 8)
              : [];

            const addToOrg = (orgNode) => {
              const cur = Array.isArray(orgNode.fields?.members) ? orgNode.fields.members : [];
              if (!cur.includes(node.id)) {
                updateNodeFields(campaignId, orgNode.id, { members: [...cur, node.id] });
              }
              setMembSearch('');
              setMembHighlight(-1);
            };

            const removeFromOrg = (orgNode) => {
              const cur = Array.isArray(orgNode.fields?.members) ? orgNode.fields.members : [];
              updateNodeFields(campaignId, orgNode.id, { members: cur.filter((id) => id !== node.id) });
            };

            return (
              <div className="field-group">
                <label>Memberships</label>

                {memberships.length === 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>
                    Not a member of any organization.
                  </div>
                )}

                {memberships.map(({ typeId, label, orgs }) => (
                  <div key={typeId} style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: `var(--node-${typeId}, var(--text-muted))`, fontWeight: 600, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      {label}
                    </div>
                    <div className="tag-list">
                      {orgs.map((org) => {
                        const orgColor = `var(--node-${org.type}, var(--text-muted))`;
                        return (
                          <span
                            key={org.id}
                            className="tag"
                            style={{ borderColor: orgColor, color: orgColor, background: `${orgColor}15`, cursor: 'pointer' }}
                            onClick={() => selectNode(org.id)}
                            title={`Open ${org.fields?.name || org.type}`}
                          >
                            {org.fields?.name || '—'}
                            <span
                              className="remove"
                              title="Remove from this organization"
                              onClick={(e) => { e.stopPropagation(); removeFromOrg(org); }}
                            >&times;</span>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Add to an org */}
                <div style={{ position: 'relative' }}>
                  <input
                    value={membSearch}
                    onChange={(e) => { setMembSearch(e.target.value); setMembHighlight(-1); }}
                    onFocus={() => setMembFocused(true)}
                    onBlur={() => setTimeout(() => setMembFocused(false), 150)}
                    onKeyDown={(e) => {
                      if (e.key === 'ArrowDown') { e.preventDefault(); setMembHighlight((p) => Math.min(p + 1, orgCandidates.length - 1)); }
                      else if (e.key === 'ArrowUp') { e.preventDefault(); setMembHighlight((p) => Math.max(p - 1, -1)); }
                      else if (e.key === 'Enter' && membHighlight >= 0 && orgCandidates[membHighlight]) {
                        e.preventDefault();
                        addToOrg(orgCandidates[membHighlight]);
                      } else if (e.key === 'Escape') setMembFocused(false);
                    }}
                    placeholder="Add to faction, religion, polity…"
                    style={{ width: '100%' }}
                  />
                  {membFocused && orgCandidates.length > 0 && (
                    <div className="tag-autocomplete">
                      {orgCandidates.map((n, idx) => {
                        const typeLabel = NODE_TYPES[n.type]?.label || customNodeTypes.find((c) => c.id === n.type)?.label || n.type;
                        return (
                          <div
                            key={n.id}
                            className={`tag-autocomplete-item ${idx === membHighlight ? 'highlighted' : ''}`}
                            onMouseDown={(e) => { e.preventDefault(); addToOrg(n); }}
                            onMouseEnter={() => setMembHighlight(idx)}
                          >
                            <span className="tag-ac-name">{n.fields?.name}</span>
                            <span className="tag-ac-type" style={{ color: `var(--node-${n.type})` }}>{typeLabel}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

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
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              e.target.value = '';
              try {
                const url = await uploadImage(file);
                createMap(campaignId, `${node.fields?.name || 'Unnamed'} Map`, url, node.id);
              } catch (err) {
                console.error('Map upload failed:', err);
              }
            }}
          />

          {/* ── Hierarchy view (faction / religion / polity + custom hierarchy types) ── */}
          {(NODE_TYPES[node.type]?.drillDown === 'hierarchy' ||
            customNodeTypes.find((c) => c.id === node.type)?.drillDown === 'hierarchy') && (
            <HierarchyView
              node={node}
              allNodes={allNodes}
              onSelectNode={selectNode}
              nodeTypeOverrides={nodeTypeOverrides}
              customNodeTypes={customNodeTypes}
              nodeFieldOverrides={nodeFieldOverrides}
            />
          )}

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
