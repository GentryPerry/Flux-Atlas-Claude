import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, Note, Gauge, Clock, Lightning, GitBranch, DiceSix } from '@phosphor-icons/react';
import useSettingsStore from '../../stores/settingsStore';
import useWidgetStore from '../../stores/widgetStore';
import useViewportStore from '../../stores/viewportStore';
import useCampaignStore from '../../stores/campaignStore';
import { NODE_TYPES } from '../../utils/nodeSchemas';
import { DEFAULT_TYPE_COLORS } from '../../utils/typeColors';
import { resolveIcon } from '../../utils/iconRegistry';

const WIDGET_TYPES = [
  { id: 'sticky-note',    label: 'Sticky Note',     Icon: Note      },
  { id: 'linear-tracker', label: 'Linear Tracker',  Icon: Gauge     },
  { id: 'clock-widget',   label: 'Clock',           Icon: Clock     },
  { id: 'thread-tracker', label: 'Thread Tracker',  Icon: GitBranch },
  { id: 'trouble-engine', label: 'Trouble Engine',  Icon: Lightning },
  { id: 'table-roller',   label: 'Table Roller',    Icon: DiceSix   },
];

/**
 * Floating action button for the mobile map view.
 * Opens a sheet with two sections: Place Node and Add Widget.
 */
export default function MobileNodePlacer({ placingType, setPlacingType }) {
  const [open, setOpen] = useState(false);
  const sheetRef = useRef(null);
  const fabRef   = useRef(null);

  const campaignId    = useCampaignStore((s) => s.activeCampaignId);
  const addWidget     = useWidgetStore((s) => s.addWidget);

  const nodeTypeOverrides = useSettingsStore((s) => s.nodeTypeOverrides) || {};
  const customNodeTypes   = useSettingsStore((s) => s.customNodeTypes)   || [];

  const allTypes = useMemo(() => {
    const builtIn = Object.entries(NODE_TYPES).map(([type, schema]) => {
      const ovr = nodeTypeOverrides[type] || {};
      return {
        type,
        label: ovr.label || schema.label,
        color: ovr.color || DEFAULT_TYPE_COLORS[type] || '#8890a0',
        icon:  ovr.icon  || schema.icon,
      };
    });
    const custom = customNodeTypes.map((ct) => ({
      type:  ct.id,
      label: ct.label,
      color: ct.color || '#8890a0',
      icon:  ct.icon  || 'Star',
    }));
    return [...builtIn, ...custom];
  }, [nodeTypeOverrides, customNodeTypes]);

  // Close on outside tap
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (
        sheetRef.current && !sheetRef.current.contains(e.target) &&
        fabRef.current   && !fabRef.current.contains(e.target)
      ) setOpen(false);
    };
    document.addEventListener('pointerdown', handler);
    return () => document.removeEventListener('pointerdown', handler);
  }, [open]);

  const handleSelectNode = (type) => {
    setPlacingType(placingType === type ? null : type);
    setOpen(false);
  };

  const handleAddWidget = (widgetType) => {
    addWidget(campaignId, widgetType, useViewportStore.getState());
    setOpen(false);
  };

  return (
    <div className="mobile-fab">

      {/* Sheet */}
      {open && (
        <div ref={sheetRef} className="mobile-placer-sheet">

          {/* ── Nodes section ── */}
          <div className="mobile-placer-section-label">Place Node</div>
          {allTypes.map(({ type, label, color, icon }) => {
            const IconComp = resolveIcon(icon);
            const isActive = placingType === type;
            return (
              <button
                key={type}
                className={`mobile-placer-item${isActive ? ' active' : ''}`}
                onClick={() => handleSelectNode(type)}
              >
                <span className="mobile-placer-item-dot" style={{ background: color }} />
                <IconComp size={15} color={isActive ? color : undefined} />
                <span>{label}</span>
              </button>
            );
          })}

          {/* ── Widgets section ── */}
          <div className="mobile-placer-section-label" style={{ marginTop: 6 }}>Add Widget</div>
          {WIDGET_TYPES.map(({ id, label, Icon: WIcon }) => {
            const WidgetIcon = WIcon;
            return (
              <button
                key={id}
                className="mobile-placer-item"
                onClick={() => handleAddWidget(id)}
              >
                <span className="mobile-placer-item-dot" style={{ background: 'var(--accent)' }} />
                <WidgetIcon size={15} color="var(--accent)" />
                <span>{label}</span>
              </button>
            );
          })}

        </div>
      )}

      {/* FAB button */}
      <button
        ref={fabRef}
        className={`mobile-fab-btn${open ? ' open' : ''}`}
        onClick={() => {
          if (placingType) { setPlacingType(null); setOpen(false); }
          else setOpen((v) => !v);
        }}
        title={placingType ? `Cancel placing ${placingType}` : 'Add node or widget'}
      >
        <Plus size={24} weight="bold" />
      </button>
    </div>
  );
}
