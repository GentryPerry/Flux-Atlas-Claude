import { useState, useRef, useMemo } from 'react';
import {
  X, Trash, Image as ImageIcon, Plus, ArrowSquareIn, MapTrifold,
  CaretLeft, CaretRight, Upload,
} from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useTagStore from '../../stores/tagStore';
import useMapStore from '../../stores/mapStore';
import useCampaignStore from '../../stores/campaignStore';
import { NODE_TYPES, getFieldSchema } from '../../utils/nodeSchemas';
import NodeIcon from '../common/NodeIcon';

export default function DetailPanel() {
  const campaignId = useCampaignStore((s) => s.activeCampaignId);
  const allNodes = useNodeStore((s) => s.nodes);
  const selectedNodeId = useNodeStore((s) => s.selectedNodeId);

  const node = useMemo(
    () => allNodes.find((n) => n.id === selectedNodeId) || null,
    [allNodes, selectedNodeId]
  );
  const updateNodeFields = useNodeStore((s) => s.updateNodeFields);
  const updateNode = useNodeStore((s) => s.updateNode);
  const deleteNode = useNodeStore((s) => s.deleteNode);
  const deselectNode = useNodeStore((s) => s.deselectNode);
  const addNodeImage = useNodeStore((s) => s.addNodeImage);
  const removeNodeImage = useNodeStore((s) => s.removeNodeImage);
  const tags = useTagStore((s) => s.tags);
  const createTag = useTagStore((s) => s.createTag);
  const maps = useMapStore((s) => s.maps);
  const drillDown = useMapStore((s) => s.drillDown);
  const createMap = useMapStore((s) => s.createMap);

  const fileInputRef = useRef(null);
  const mapFileRef = useRef(null);
  const [tagInput, setTagInput] = useState({});
  const [albumOpen, setAlbumOpen] = useState(false);
  const [albumIndex, setAlbumIndex] = useState(0);

  if (!node) return null;

  const schema = getFieldSchema(node.type);
  const typeInfo = NODE_TYPES[node.type];
  const images = node.images || [];
  const hasImages = images.length > 0;

  const handleFieldChange = (key, value) => {
    updateNodeFields(campaignId, node.id, { [key]: value });
  };

  const handleStatusToggle = (flag) => {
    updateNode(campaignId, node.id, {
      statusFlags: { ...node.statusFlags, [flag]: !node.statusFlags[flag] },
    });
  };

  const handleImageUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        addNodeImage(campaignId, node.id, ev.target.result);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  const handleAddTag = (fieldKey, value) => {
    if (!value.trim()) return;
    let tag = tags.find((t) => t.name.toLowerCase() === value.toLowerCase());
    if (!tag) {
      tag = createTag(campaignId, value.trim());
    }
    const currentTags = node.fields[fieldKey] || [];
    if (!currentTags.includes(tag.id)) {
      handleFieldChange(fieldKey, [...currentTags, tag.id]);
    }
    setTagInput((prev) => ({ ...prev, [fieldKey]: '' }));
  };

  const handleRemoveTag = (fieldKey, tagId) => {
    const currentTags = node.fields[fieldKey] || [];
    handleFieldChange(fieldKey, currentTags.filter((id) => id !== tagId));
  };

  const handleDelete = () => {
    if (confirm('Delete this node?')) {
      deleteNode(campaignId, node.id);
    }
  };

  const openAlbum = (idx = 0) => {
    setAlbumIndex(idx);
    setAlbumOpen(true);
  };

  const childMap = maps.find((m) => m.parentMapId === node.id);
  const typeColor = `var(--node-${node.type})`;

  return (
    <>
      <div className="detail-panel">
        {/* Hero image banner */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={handleImageUpload}
        />

        {hasImages ? (
          <div className="detail-hero" onClick={() => openAlbum(0)}>
            <img src={images[0].url} alt="" />
            <div className="hero-overlay" />
            {images.length > 1 && (
              <span className="hero-count">{images.length} images</span>
            )}
          </div>
        ) : (
          <div className="detail-hero-empty" onClick={() => fileInputRef.current?.click()}>
            <Upload size={24} />
            <span>Add a portrait or scene</span>
          </div>
        )}

        {/* Name / type header */}
        <div className="detail-header">
          <NodeIcon node={node} size={28} />
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
          <button className="btn-icon" onClick={deselectNode}><X size={18} /></button>
        </div>

        <div className="detail-body">
          {/* Image strip (when multiple images) */}
          {images.length > 1 && (
            <div className="field-group">
              <label>Gallery</label>
              <div className="detail-image-row">
                {images.map((img, idx) => (
                  <div key={img.id} className="image-thumb" onClick={() => openAlbum(idx)}>
                    <img src={img.url} alt="" />
                    <button
                      className="remove-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeNodeImage(campaignId, node.id, img.id);
                      }}
                    >
                      &times;
                    </button>
                  </div>
                ))}
                <div
                  className="image-thumb"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-muted)',
                    background: 'var(--bg-inset)',
                    border: '1px dashed var(--border-strong)',
                  }}
                >
                  <Plus size={16} />
                </div>
              </div>
            </div>
          )}

          {/* Add image button when no extra images */}
          {images.length <= 1 && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              style={{ alignSelf: 'flex-start' }}
            >
              <ImageIcon size={14} /> {hasImages ? 'Add more images' : 'Add Image'}
            </button>
          )}

          {/* Status Flags — type-specific */}
          <div className="field-group">
            <label>Status</label>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {typeInfo?.statusFlags && Object.entries(typeInfo.statusFlags).map(([flagKey, flagDef]) => {
                const isOn = node.statusFlags?.[flagKey] ?? flagDef.default;
                const styleClass = flagKey === 'revealed'
                  ? (isOn ? 'status-revealed' : 'status-hidden')
                  : (isOn ? 'status-alive' : 'status-dead');
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

          {/* Dynamic Fields */}
          {schema.map((field) => {
            const value = node.fields?.[field.key];

            if (field.type === 'text') {
              return (
                <div key={field.key} className="field-group">
                  <label>{field.label}</label>
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
                  <label>{field.label}</label>
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
                  <select value={value || field.default} onChange={(e) => handleFieldChange(field.key, e.target.value)}>
                    {field.options?.map((opt) => (
                      <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                    ))}
                  </select>
                </div>
              );
            }

            if (field.type === 'tags') {
              const tagIds = Array.isArray(value) ? value : [];
              return (
                <div key={field.key} className="field-group">
                  <label>{field.label}</label>
                  <div className="tag-list">
                    {tagIds.map((tagId) => {
                      const tag = tags.find((t) => t.id === tagId);
                      if (!tag) return null;
                      return (
                        <span
                          key={tagId}
                          className="tag"
                          style={{ borderColor: tag.color, color: tag.color, background: `${tag.color}15` }}
                        >
                          {tag.name}
                          <span className="remove" onClick={() => handleRemoveTag(field.key, tagId)}>&times;</span>
                        </span>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input
                      value={tagInput[field.key] || ''}
                      onChange={(e) => setTagInput((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddTag(field.key, e.target.value);
                        }
                      }}
                      placeholder="Add tag..."
                      style={{ flex: 1 }}
                    />
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleAddTag(field.key, tagInput[field.key] || '')}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              );
            }

            return null;
          })}

          {/* Drill-down / Child Map */}
          {node.type === 'location' && (
            <div className="field-group">
              <label>Interior Map</label>
              {childMap ? (
                <button
                  className="btn btn-secondary"
                  onClick={() => drillDown(childMap.id)}
                >
                  <ArrowSquareIn size={16} /> Enter {node.fields?.name || 'Location'}
                </button>
              ) : (
                <>
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
                        const map = createMap(
                          campaignId,
                          node.fields?.name || 'Interior',
                          ev.target.result,
                          node.id
                        );
                        drillDown(map.id);
                      };
                      reader.readAsDataURL(file);
                      e.target.value = '';
                    }}
                  />
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => mapFileRef.current?.click()}
                    style={{ alignSelf: 'flex-start' }}
                  >
                    <MapTrifold size={14} /> Add interior map
                  </button>
                </>
              )}
            </div>
          )}

          {/* Delete */}
          <button
            className="btn btn-danger btn-sm"
            onClick={handleDelete}
            style={{ alignSelf: 'flex-start', marginTop: 8 }}
          >
            <Trash size={14} /> Delete Node
          </button>
        </div>
      </div>

      {/* ══ Album / Lightbox overlay ══ */}
      {albumOpen && images.length > 0 && (
        <div className="image-album-overlay" onClick={() => setAlbumOpen(false)}>
          <div className="image-album-header">
            <h3>{node.fields?.name || 'Images'} — Gallery</h3>
            <button className="btn-icon" onClick={() => setAlbumOpen(false)} style={{ color: '#fff' }}>
              <X size={20} />
            </button>
          </div>
          <div className="image-album-main" onClick={(e) => e.stopPropagation()}>
            {images.length > 1 && (
              <button
                className="image-album-nav"
                onClick={() => setAlbumIndex((albumIndex - 1 + images.length) % images.length)}
                style={{ marginRight: 16 }}
              >
                <CaretLeft size={20} />
              </button>
            )}
            <img src={images[albumIndex]?.url} alt="" />
            {images.length > 1 && (
              <button
                className="image-album-nav"
                onClick={() => setAlbumIndex((albumIndex + 1) % images.length)}
                style={{ marginLeft: 16 }}
              >
                <CaretRight size={20} />
              </button>
            )}
          </div>
          {images.length > 1 && (
            <div className="image-album-strip" onClick={(e) => e.stopPropagation()}>
              {images.map((img, idx) => (
                <div
                  key={img.id}
                  className={`image-album-thumb ${idx === albumIndex ? 'active' : ''}`}
                  onClick={() => setAlbumIndex(idx)}
                >
                  <img src={img.url} alt="" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
