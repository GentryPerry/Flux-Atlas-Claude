import { useState, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { X, ArrowsInSimple, ArrowsOutSimple, Plus } from '@phosphor-icons/react';

// ── Constants ─────────────────────────────────────────────────────────────────

const CLOCK_COLORS    = ['#f59242', '#e0617a', '#4a8fd4', '#3da86b', '#8b65c9', '#f5c842', '#94a3b8'];
const SEGMENT_OPTIONS = [4, 6, 8, 12];
const MAX_CLOCKS      = 5;
const GAP_DEG         = 3.5;

// ViewBox space: 0 0 100 100
const CX      = 50;
const CY      = 50;
const R_OUTER = 42;
const R_INNER = 18;

// Auto layout: single row, clocks condense as more are added
function getLayout(count) {
  // [clockSize px, widgetWidth px]
  const table = [
    [150, 196],   // 1 clock — large, fills widget
    [108, 268],   // 2 clocks
    [88,  324],   // 3 clocks
    [76,  372],   // 4 clocks
    [68,  412],   // 5 clocks (max)
  ];
  const [clockSize, widgetWidth] = table[Math.max(0, Math.min(count - 1, MAX_CLOCKS - 1))];
  return { clockSize, widgetWidth };
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function toRad(deg) { return (deg * Math.PI) / 180; }

function segmentPath(index, total) {
  const slice    = 360 / total;
  const halfGap  = GAP_DEG / 2;
  const startDeg = -90 + index * slice + halfGap;
  const endDeg   = -90 + (index + 1) * slice - halfGap;
  const large    = (endDeg - startDeg) > 180 ? 1 : 0;

  const s = toRad(startDeg);
  const e = toRad(endDeg);

  const ox1 = CX + R_OUTER * Math.cos(s);
  const oy1 = CY + R_OUTER * Math.sin(s);
  const ox2 = CX + R_OUTER * Math.cos(e);
  const oy2 = CY + R_OUTER * Math.sin(e);
  const ix1 = CX + R_INNER * Math.cos(e);
  const iy1 = CY + R_INNER * Math.sin(e);
  const ix2 = CX + R_INNER * Math.cos(s);
  const iy2 = CY + R_INNER * Math.sin(s);

  return [
    `M ${ox1.toFixed(2)} ${oy1.toFixed(2)}`,
    `A ${R_OUTER} ${R_OUTER} 0 ${large} 1 ${ox2.toFixed(2)} ${oy2.toFixed(2)}`,
    `L ${ix1.toFixed(2)} ${iy1.toFixed(2)}`,
    `A ${R_INNER} ${R_INNER} 0 ${large} 0 ${ix2.toFixed(2)} ${iy2.toFixed(2)}`,
    'Z',
  ].join(' ');
}

// ── Single clock face ─────────────────────────────────────────────────────────

function ClockFace({ clock, size, onUpdate, onRemove }) {
  const [editingName, setEditingName] = useState(false);
  const [nameDraft,   setNameDraft]   = useState(clock.label);
  const [hovered,     setHovered]     = useState(false);
  const [hovSeg,      setHovSeg]      = useState(null);

  useEffect(() => { setNameDraft(clock.label); }, [clock.label]);

  const { segments, filled, color } = clock;
  const isFull = filled >= segments;

  const handleSegmentClick = (i) => {
    // Click on filled segment → unfill down to that index
    // Click on empty segment → fill up to that index + 1
    const newFilled = i < filled ? i : i + 1;
    onUpdate({ filled: newFilled });
  };

  const cycleSegments = (e) => {
    e.stopPropagation();
    const idx  = SEGMENT_OPTIONS.indexOf(segments);
    const next = SEGMENT_OPTIONS[(idx + 1) % SEGMENT_OPTIONS.length];
    onUpdate({ segments: next, filled: Math.min(filled, next) });
  };

  const cycleColor = (e) => {
    e.stopPropagation();
    const idx = CLOCK_COLORS.indexOf(color);
    onUpdate({ color: CLOCK_COLORS[(idx + 1) % CLOCK_COLORS.length] });
  };

  // Scale text slightly with clock size
  const fontSize = size >= 130 ? 9.5 : size >= 100 ? 9 : size >= 80 ? 8.5 : 8;

  return (
    <div
      className="cw-clock"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => { setHovered(false); setHovSeg(null); }}
    >
      {/* Remove button */}
      {hovered && (
        <button className="cw-clock-remove" onClick={onRemove} title="Remove clock">
          <X size={9} />
        </button>
      )}

      {/* SVG face — uses viewBox 0 0 100 100, rendered at clockSize px */}
      <svg
        width={size}
        height={size}
        viewBox="0 0 100 100"
        className={`cw-svg ${isFull ? 'cw-full' : ''}`}
        style={isFull ? { '--cw-color': color } : undefined}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onUpdate({ filled: Math.max(0, filled - 1) });
        }}
      >
        {/* Background ring */}
        <circle
          cx={CX} cy={CY}
          r={(R_OUTER + R_INNER) / 2}
          fill="none"
          stroke="rgba(255,255,255,0.05)"
          strokeWidth={R_OUTER - R_INNER}
        />

        {/* Segments */}
        {Array.from({ length: segments }, (_, i) => {
          const isFilled    = i < filled;
          const isHov       = hovSeg === i;
          const wouldFill   = i >= filled && isHov;
          const wouldUnfill = i < filled  && isHov;

          const fill = isFilled
            ? (wouldUnfill ? `${color}99` : color)
            : (wouldFill  ? `${color}55` : 'rgba(255,255,255,0.07)');

          return (
            <path
              key={i}
              d={segmentPath(i, segments)}
              fill={fill}
              className="cw-segment"
              onClick={(e) => { e.stopPropagation(); handleSegmentClick(i); }}
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onUpdate({ filled: Math.max(0, filled - 1) });
              }}
              onMouseEnter={() => setHovSeg(i)}
              onMouseLeave={() => setHovSeg(null)}
              style={{ transition: 'fill 0.12s' }}
            />
          );
        })}

        {/* Completion glow */}
        {isFull && (
          <circle
            cx={CX} cy={CY}
            r={(R_OUTER + R_INNER) / 2}
            fill="none"
            stroke={color}
            strokeWidth={R_OUTER - R_INNER}
            opacity={0.18}
            style={{ filter: 'blur(3px)' }}
            pointerEvents="none"
          />
        )}

        {/* Center counter */}
        <text
          x={CX} y={CY + 0.5}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={fontSize}
          fill={isFull ? color : 'rgba(255,255,255,0.4)'}
          fontWeight={isFull ? 700 : 400}
          style={{ userSelect: 'none', pointerEvents: 'none', fontFamily: 'var(--font-ui, sans-serif)' }}
        >
          {filled}/{segments}
        </text>
      </svg>

      {/* Name label */}
      {editingName ? (
        <input
          className="cw-name-input"
          value={nameDraft}
          autoFocus
          onClick={(e) => e.stopPropagation()}
          onChange={(e) => setNameDraft(e.target.value)}
          onBlur={() => { setEditingName(false); onUpdate({ label: nameDraft.trim() || 'Clock' }); }}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); }}
        />
      ) : (
        <span
          className="cw-name"
          onDoubleClick={() => setEditingName(true)}
          title="Double-click to rename"
        >
          {clock.label}
        </span>
      )}

      {/* Controls: segment count + color dot */}
      <div className="cw-controls">
        <button
          className="cw-seg-btn"
          onClick={cycleSegments}
          title={`${segments} segments — click to cycle`}
        >
          {segments}
        </button>
        <button
          className="cw-color-dot"
          style={{ background: color }}
          onClick={cycleColor}
          title="Change color"
        />
      </div>
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────

export default function ClockWidget({ widget, onUpdate, onUpdateData, onRemove, onContextMenu }) {
  const { isMinimized, data } = widget;
  const title  = data.title  ?? 'Clocks';
  const clocks = data.clocks ?? [];

  const atMax = clocks.length >= MAX_CLOCKS;
  const { clockSize, widgetWidth } = getLayout(Math.max(1, clocks.length));

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft,   setTitleDraft]   = useState(title);
  useEffect(() => { setTitleDraft(title); }, [title]);

  const updateClock = (clockId, ch) =>
    onUpdateData({ clocks: clocks.map((c) => (c.id === clockId ? { ...c, ...ch } : c)) });

  const removeClock = (clockId) =>
    onUpdateData({ clocks: clocks.filter((c) => c.id !== clockId) });

  const addClock = () => {
    if (atMax) return;
    const color = CLOCK_COLORS[clocks.length % CLOCK_COLORS.length];
    onUpdateData({
      clocks: [...clocks, { id: uuid(), label: 'New Clock', segments: 6, filled: 0, color }],
    });
  };

  return (
    <div
      className={`widget-shell clock-widget ${isMinimized ? 'widget-minimized' : ''}`}
      style={{ width: isMinimized ? 'fit-content' : widgetWidth }}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu?.(e); }}
    >
      {/* ── Title bar ── */}
      <div className="cw-titlebar" data-drag-handle="true">
        {editingTitle ? (
          <input
            className="cw-title-input"
            value={titleDraft}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => setTitleDraft(e.target.value)}
            onBlur={() => { setEditingTitle(false); onUpdateData({ title: titleDraft.trim() || 'Clocks' }); }}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') e.target.blur(); }}
          />
        ) : (
          <span className="cw-title" onDoubleClick={() => setEditingTitle(true)}>{title}</span>
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

      {/* ── Clock row ── */}
      {!isMinimized && (
        <div className="cw-body">
          {clocks.length === 0 && (
            <div className="cw-empty">Add a clock below</div>
          )}

          {/* Single-row, no wrap — widget width auto-grows */}
          <div className="cw-row">
            {clocks.map((clock) => (
              <ClockFace
                key={clock.id}
                clock={clock}
                size={clockSize}
                onUpdate={(ch) => updateClock(clock.id, ch)}
                onRemove={() => removeClock(clock.id)}
              />
            ))}
          </div>

          <button
            className={`cw-add-btn${atMax ? ' disabled' : ''}`}
            onClick={addClock}
            disabled={atMax}
            title={atMax ? `Maximum ${MAX_CLOCKS} clocks` : 'Add a clock'}
          >
            <Plus size={12} />
            {atMax ? `Max ${MAX_CLOCKS}` : 'Add clock'}
          </button>
        </div>
      )}

      {/* No resize handle — widget width is auto-computed from clock count */}
    </div>
  );
}
