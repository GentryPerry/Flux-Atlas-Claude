import { useState, useRef, useEffect } from 'react';
import { X, ArrowsInSimple, ArrowsOutSimple, Image, UploadSimple, ArrowsClockwise } from '@phosphor-icons/react';
import { uploadImage } from '../../utils/api';

export default function ImageWidget({ widget, onUpdate, onUpdateData, onRemove, onContextMenu }) {
  const { isMinimized, data } = widget;
  const width    = data.width    ?? 300;
  const height   = data.height   ?? 220;
  const title    = data.title    ?? 'Image';
  const imageUrl = data.imageUrl ?? null;

  const fileInputRef   = useRef(null);
  const [uploading,  setUploading]  = useState(false);
  const [error,      setError]      = useState(null);
  const [editTitle,  setEditTitle]  = useState(false);
  const [titleDraft, setTitleDraft] = useState(title);
  const [hovering,   setHovering]   = useState(false);

  useEffect(() => { setTitleDraft(title); }, [title]);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setError(null);
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onUpdateData({ imageUrl: url });
    } catch (err) {
      setError('Upload failed — try again');
      console.warn('ImageWidget upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const triggerPick = () => fileInputRef.current?.click();

  return (
    <div
      className={`widget-shell image-frame-widget ${isMinimized ? 'widget-minimized' : ''}`}
      style={{ width: isMinimized ? 'fit-content' : width }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e); }}
    >
      {/* ── Title bar ── */}
      <div className="ifw-titlebar" data-drag-handle="true">
        <Image size={12} style={{ opacity: 0.5, flexShrink: 0 }} />

        {editTitle ? (
          <input
            className="ifw-title-input"
            value={titleDraft}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => { setEditTitle(false); onUpdateData({ title: titleDraft.trim() || 'Image' }); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); }}
          />
        ) : (
          <span
            className="ifw-title"
            onDoubleClick={() => setEditTitle(true)}
            title="Double-click to rename"
          >
            {title}
          </span>
        )}

        <div className="widget-controls">
          <button
            className="widget-ctrl-btn"
            onClick={() => onUpdate({ isMinimized: !isMinimized })}
            title={isMinimized ? 'Expand' : 'Minimise'}
          >
            {isMinimized ? <ArrowsOutSimple size={11} /> : <ArrowsInSimple size={11} />}
          </button>
          <button className="widget-ctrl-btn close" onClick={onRemove} title="Remove widget">
            <X size={11} />
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      {!isMinimized && (
        <div
          className="ifw-body"
          style={{ height }}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          {imageUrl ? (
            /* ── Loaded state ── */
            <>
              <img
                className="ifw-image"
                src={imageUrl}
                alt={title}
                draggable={false}
              />
              {/* Replace button — visible on hover */}
              {hovering && !uploading && (
                <button
                  className="ifw-replace-btn"
                  onClick={triggerPick}
                  title="Replace image"
                >
                  <ArrowsClockwise size={12} />
                  Replace
                </button>
              )}
              {uploading && (
                <div className="ifw-uploading-overlay">
                  <span className="ifw-spinner" />
                  Uploading…
                </div>
              )}
            </>
          ) : (
            /* ── Empty / upload state ── */
            <button
              className="ifw-upload-zone"
              onClick={triggerPick}
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <span className="ifw-spinner" />
                  <span>Uploading…</span>
                </>
              ) : (
                <>
                  <UploadSimple size={28} style={{ opacity: 0.35 }} />
                  <span className="ifw-upload-label">Click to upload image</span>
                  <span className="ifw-upload-hint">PNG, JPG, GIF, WebP</span>
                </>
              )}
              {error && <span className="ifw-error">{error}</span>}
            </button>
          )}

          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
        </div>
      )}

      {/* ── Resize handle ── */}
      {!isMinimized && (
        <div className="widget-resize-handle" data-resize-handle="true" title="Drag to resize" />
      )}
    </div>
  );
}
