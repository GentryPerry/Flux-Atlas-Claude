import { useState, useRef, useEffect } from 'react';
import { X, ArrowUp } from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useCampaignStore from '../../stores/campaignStore';
import NodeIcon from '../common/NodeIcon';
import { getTypeColor } from '../../utils/typeColors';

export default function MobileNodeSheet({ nodeId, onClose, onOpenDetail }) {
  const nodes            = useNodeStore((s) => s.nodes);
  const updateNodeFields = useNodeStore((s) => s.updateNodeFields);
  const campaignId       = useCampaignStore((s) => s.activeCampaignId);

  const node = nodes.find((n) => n.id === nodeId);

  const [nameValue, setNameValue]  = useState(node?.fields?.name        || '');
  const [descValue, setDescValue]  = useState(node?.fields?.description || '');

  const nameRef = useRef(null);
  const descRef = useRef(null);

  // Auto-focus name on fresh placement (name is empty)
  useEffect(() => {
    if (node && !node.fields?.name) {
      setTimeout(() => nameRef.current?.focus(), 200);
    }
  }, [nodeId]); // eslint-disable-line react-hooks/exhaustive-deps

  const commitName = () => {
    const v = nameValue.trim();
    if (v !== (node?.fields?.name || ''))
      updateNodeFields(campaignId, nodeId, { name: v || 'Unnamed' });
  };

  const commitDesc = () => {
    const v = descValue.trim();
    if (v !== (node?.fields?.description || ''))
      updateNodeFields(campaignId, nodeId, { description: v });
  };

  // ── Swipe-up gesture ─────────────────────────────────────────────────────
  // Works on the handle bar AND on the sheet body (but not inside inputs/textareas)
  const swipeStartY  = useRef(null);
  const swipeStartEl = useRef(null);

  const onSwipeStart = (e) => {
    swipeStartY.current  = e.touches[0].clientY;
    swipeStartEl.current = e.target;
  };

  const onSwipeEnd = (e) => {
    if (swipeStartY.current === null) return;
    const tag = swipeStartEl.current?.tagName;
    // Don't steal swipe from textarea / input
    if (tag === 'TEXTAREA' || tag === 'INPUT') { swipeStartY.current = null; return; }
    const delta = swipeStartY.current - e.changedTouches[0].clientY;
    if (delta > 50) onOpenDetail();
    swipeStartY.current = null;
  };

  if (!node) return null;

  const type      = node.type || 'character';
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const typeColor = getTypeColor(type);

  return (
    <div
      className="mobile-node-sheet"
      onClick={(e) => e.stopPropagation()}
      onTouchStart={onSwipeStart}
      onTouchEnd={onSwipeEnd}
    >
      {/* ── Handle – visual + tap target ── */}
      <div className="mobile-node-sheet-handle-bar" onClick={onOpenDetail}>
        <div className="mobile-node-sheet-handle" />
      </div>

      <div className="mobile-node-sheet-content">

        {/* ── Header: icon + name + type + close ── */}
        <div className="mobile-node-sheet-header">
          <div
            className="mobile-node-sheet-icon"
            style={{ background: `${typeColor}22`, border: `1.5px solid ${typeColor}55` }}
          >
            <NodeIcon node={node} size={22} showOverlays={false} />
          </div>

          <div className="mobile-node-sheet-title-area">
            <input
              ref={nameRef}
              className="mobile-node-sheet-name-input"
              value={nameValue}
              onChange={(e) => setNameValue(e.target.value)}
              onBlur={commitName}
              onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
              placeholder="Name this node..."
            />
            <span className="mobile-node-sheet-type" style={{ color: typeColor }}>
              {typeLabel}
            </span>
          </div>

          <button className="mobile-node-sheet-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* ── Editable description ── */}
        <textarea
          ref={descRef}
          className="mobile-node-sheet-desc-input"
          value={descValue}
          onChange={(e) => setDescValue(e.target.value)}
          onBlur={commitDesc}
          placeholder="Add a description..."
          rows={3}
        />

        {/* ── Expand CTA ── */}
        <button className="btn btn-primary mobile-node-sheet-cta" onClick={onOpenDetail}>
          <ArrowUp size={14} weight="bold" />
          Edit Full Details
        </button>

      </div>
    </div>
  );
}
