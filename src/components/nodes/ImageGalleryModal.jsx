import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Star, Trash, ArrowLeft, ArrowRight, Plus } from '@phosphor-icons/react';

/**
 * ImageGalleryModal
 *
 * Pinterest-style scrollable image gallery for a node's image collection.
 * Clicking a thumbnail zooms to full-screen lightbox view with prev/next nav.
 *
 * Props:
 *   images        – array of { id, url }
 *   heroImageId   – id of the current hero image
 *   startIndex    – which image to scroll to / highlight initially (optional)
 *   poolImages    – array of { id, url } from the campaign image pool (optional)
 *   onClose       – fn()
 *   onSetHero     – fn(imageId)
 *   onRemove      – fn(imageId)
 *   onAddFromPool – fn(url) — called when user picks a pool image
 */
export default function ImageGalleryModal({
  images = [],
  heroImageId,
  startIndex = null,
  poolImages = [],
  onClose,
  onSetHero,
  onRemove,
  onAddFromPool,
}) {
  // null = masonry grid, number = zoomed into that index
  const [zoomedIndex, setZoomedIndex] = useState(startIndex);
  const [poolOpen,    setPoolOpen]    = useState(false);
  const heroRef = useRef(null);

  // Scroll hero image into view on open
  useEffect(() => {
    if (startIndex === null && heroRef.current) {
      heroRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [startIndex]);

  const zoom = (idx) => setZoomedIndex(idx);
  const back = () => setZoomedIndex(null);
  const prev = useCallback(() => setZoomedIndex((i) => Math.max(0, i - 1)), []);
  const next = useCallback(() => setZoomedIndex((i) => Math.min(images.length - 1, i + 1)), [images.length]);

  // Keyboard nav
  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') {
        if (zoomedIndex !== null) back();
        else onClose();
      }
      if (zoomedIndex !== null) {
        if (e.key === 'ArrowLeft')  prev();
        if (e.key === 'ArrowRight') next();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomedIndex, onClose, prev, next]);

  const alreadyAdded = new Set(images.map((img) => img.url));
  const availablePool = poolImages.filter((p) => !alreadyAdded.has(p.url));

  // ── Zoomed view ────────────────────────────────────────────────────────────
  if (zoomedIndex !== null && images[zoomedIndex]) {
    const img  = images[zoomedIndex];
    const isHero = img.id === heroImageId;
    return (
      <div className="modal-overlay img-gallery-overlay" onClick={back} style={{ zIndex: 400 }}>
        <div className="img-gallery-zoom" onClick={(e) => e.stopPropagation()}>
          {/* Back to grid */}
          <button className="img-gallery-back" onClick={back} title="Back to gallery">
            <ArrowLeft size={15} /> All images
          </button>

          <img src={img.url} alt="" className="img-gallery-zoom-img" />

          {/* Nav arrows */}
          {zoomedIndex > 0 && (
            <button className="img-gallery-arrow left" onClick={prev} title="Previous">
              <ArrowLeft size={20} />
            </button>
          )}
          {zoomedIndex < images.length - 1 && (
            <button className="img-gallery-arrow right" onClick={next} title="Next">
              <ArrowRight size={20} />
            </button>
          )}

          {/* Counter + actions */}
          <div className="img-gallery-zoom-bar">
            <span className="img-gallery-zoom-count">
              {zoomedIndex + 1} / {images.length}
              {isHero && <span className="img-gallery-hero-badge">★ Hero</span>}
            </span>
            <div className="img-gallery-zoom-actions">
              {!isHero && (
                <button
                  className="img-gallery-zoom-btn"
                  onClick={() => { onSetHero(img.id); back(); }}
                  title="Set as hero image"
                >
                  <Star size={14} /> Set as hero
                </button>
              )}
              <button
                className="img-gallery-zoom-btn danger"
                onClick={() => {
                  onRemove(img.id);
                  if (images.length <= 1) { onClose(); return; }
                  setZoomedIndex((i) => Math.max(0, i - 1));
                }}
                title="Remove image"
              >
                <Trash size={14} /> Remove
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── Masonry grid view ──────────────────────────────────────────────────────
  return (
    <div className="modal-overlay img-gallery-overlay" onClick={onClose} style={{ zIndex: 400 }}>
      <div className="img-gallery-panel" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="img-gallery-header">
          <span className="img-gallery-title">
            Images <span className="img-gallery-count-badge">{images.length}</span>
          </span>
          <div className="img-gallery-header-actions">
            {availablePool.length > 0 && (
              <button
                className="img-gallery-pool-btn"
                onClick={() => setPoolOpen((o) => !o)}
              >
                <Plus size={13} /> From pool ({availablePool.length})
              </button>
            )}
            <button className="btn-icon" onClick={onClose} title="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Pool picker — shows when toggled */}
        {poolOpen && availablePool.length > 0 && (
          <div className="img-gallery-pool-strip">
            <div className="img-gallery-pool-label">Campaign image pool — click to add</div>
            <div className="img-gallery-pool-row">
              {availablePool.map((p) => (
                <button
                  key={p.id}
                  className="img-gallery-pool-thumb"
                  onClick={() => { onAddFromPool(p.url); }}
                  title="Add to node images"
                >
                  <img src={p.url} alt="" />
                  <div className="img-gallery-pool-thumb-overlay"><Plus size={16} /></div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Masonry grid */}
        {images.length === 0 ? (
          <div className="img-gallery-empty">No images yet</div>
        ) : (
          <div className="img-gallery-masonry">
            {images.map((img, idx) => {
              const isHero = img.id === heroImageId;
              return (
                <div
                  key={img.id}
                  ref={isHero ? heroRef : null}
                  className={`img-gallery-item ${isHero ? 'is-hero' : ''}`}
                  onClick={() => zoom(idx)}
                >
                  <img src={img.url} alt="" loading="lazy" />
                  {isHero && <div className="img-gallery-item-hero-badge">★</div>}

                  {/* Hover overlay */}
                  <div className="img-gallery-item-overlay">
                    {!isHero && (
                      <button
                        className="img-gallery-item-btn"
                        onClick={(e) => { e.stopPropagation(); onSetHero(img.id); }}
                        title="Set as hero"
                      >
                        <Star size={13} />
                      </button>
                    )}
                    <button
                      className="img-gallery-item-btn danger"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemove(img.id);
                      }}
                      title="Remove"
                    >
                      <Trash size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
