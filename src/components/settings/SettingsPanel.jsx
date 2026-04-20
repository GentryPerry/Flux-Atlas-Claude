import { useState, useMemo } from 'react';
import {
  X, Eye, Cube, MapTrifold,
  SquareSplitHorizontal, Rows,
  Plus, Trash, Sun, Moon, ListDashes, ArrowCounterClockwise, Key,
} from '@phosphor-icons/react';
import useSettingsStore from '../../stores/settingsStore';
import useCampaignStore from '../../stores/campaignStore';
import { NODE_TYPES, getFieldSchema, DEFAULT_CUSTOM_FIELDS } from '../../utils/nodeSchemas';
import { DEFAULT_TYPE_COLORS } from '../../utils/typeColors';
import { resolveIcon } from '../../utils/iconRegistry';
import IconPickerModal from '../common/IconPickerModal';

const CATEGORIES = [
  { id: 'view',      label: 'View',       icon: Eye,         description: 'Layout, canvas, and display preferences' },
  { id: 'nodeTypes', label: 'Node Types', icon: Cube,        description: 'Customize and add node type schemas' },
  { id: 'fields',    label: 'Fields',     icon: ListDashes,  description: 'Global field schemas for each node type' },
  // { id: 'pinterest', label: 'Pinterest', icon: Key, description: 'Session token for board access' },
  { id: 'campaign',  label: 'Campaign',   icon: MapTrifold,  description: 'Campaign details and export options' },
];

const PRESET_COLORS = [
  '#f87171', '#fb923c', '#f5b042', '#4ade80', '#60a5fa',
  '#6e8efb', '#a78bfa', '#c084fc', '#d8b4fe', '#f0abfc',
  '#fda4af', '#86efac', '#67e8f9', '#fcd34d', '#e2e8f0',
];

export default function SettingsPanel() {
  const campaignId = useCampaignStore((s) => s.activeCampaignId);
  const allCampaigns = useCampaignStore((s) => s.campaigns);
  const campaign = useMemo(
    () => allCampaigns.find((c) => c.id === campaignId) || null,
    [allCampaigns, campaignId]
  );
  const updateCampaign = useCampaignStore((s) => s.updateCampaign);

  const {
    settingsCategory, setSettingsCategory, closeSettings,
    layout, mapSide, showNodeLabels, showConnections,
    showStatusOverlays, canvasGridVisible,
    theme, setSetting,
  } = useSettingsStore();

  return (
    <div className="modal-overlay" onClick={closeSettings}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>

        {/* Left sidebar — categories */}
        <div className="settings-sidebar">
          <div className="settings-sidebar-header">
            <h2>Settings</h2>
            <button className="btn-icon" onClick={closeSettings}><X size={18} /></button>
          </div>
          <div className="settings-sidebar-list">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  className={`settings-nav-item ${settingsCategory === cat.id ? 'active' : ''}`}
                  onClick={() => setSettingsCategory(cat.id)}
                >
                  <Icon size={18} weight={settingsCategory === cat.id ? 'duotone' : 'regular'} />
                  <span>{cat.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right content — active pane */}
        <div className="settings-content">

          {/* ──── View Settings ──── */}
          {settingsCategory === 'view' && (
            <div className="settings-pane">
              <div className="settings-pane-header">
                <Eye size={28} weight="duotone" />
                <div>
                  <h3>View</h3>
                  <p>Layout, canvas, and display preferences</p>
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">Appearance</div>
                <div className="settings-card">
                  <SettingsRow label="Theme">
                    <div style={{ display: 'flex', gap: 8 }}>
                      <ThemeButton
                        value="dark"
                        current={theme}
                        onClick={() => setSetting(campaignId, 'theme', 'dark')}
                        icon={Moon}
                        label="Dark"
                      />
                      <ThemeButton
                        value="light"
                        current={theme}
                        onClick={() => setSetting(campaignId, 'theme', 'light')}
                        icon={Sun}
                        label="Light"
                      />
                    </div>
                  </SettingsRow>
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">Layout</div>
                <div className="settings-card">
                  <SettingsRow label="Mode">
                    <SegmentedControl
                      options={[
                        { value: 'full', label: 'Full Canvas' },
                        { value: 'split', label: 'Split View' },
                      ]}
                      value={layout}
                      onChange={(v) => setSetting(campaignId, 'layout', v)}
                    />
                  </SettingsRow>

                  {layout === 'split' && (
                    <SettingsRow label="Map position">
                      <SegmentedControl
                        options={[
                          { value: 'left', label: 'Left' },
                          { value: 'right', label: 'Right' },
                        ]}
                        value={mapSide}
                        onChange={(v) => setSetting(campaignId, 'mapSide', v)}
                      />
                    </SettingsRow>
                  )}
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">Canvas</div>
                <div className="settings-card">
                  <SettingsToggleRow
                    label="Grid dots"
                    description="Show subtle grid on empty canvas"
                    value={canvasGridVisible}
                    onChange={(v) => setSetting(campaignId, 'canvasGridVisible', v)}
                  />
                  <SettingsToggleRow
                    label="Node labels"
                    description="Show names below node markers"
                    value={showNodeLabels}
                    onChange={(v) => setSetting(campaignId, 'showNodeLabels', v)}
                  />
                  <SettingsToggleRow
                    label="Status overlays"
                    description="Dead/hidden indicators on nodes"
                    value={showStatusOverlays}
                    onChange={(v) => setSetting(campaignId, 'showStatusOverlays', v)}
                  />
                  <SettingsToggleRow
                    label="Show connections"
                    description="Display connection lines when opening a map"
                    value={showConnections}
                    onChange={(v) => setSetting(campaignId, 'showConnections', v)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ──── Node Types ──── */}
          {settingsCategory === 'nodeTypes' && (
            <NodeTypesPane campaignId={campaignId} />
          )}

          {/* ──── Fields ──── */}
          {settingsCategory === 'fields' && (
            <FieldsPane campaignId={campaignId} />
          )}

          {/* ──── Pinterest ──── */}
          {settingsCategory === 'pinterest' && (
            <PinterestPane campaignId={campaignId} />
          )}

          {/* ──── Campaign ──── */}
          {settingsCategory === 'campaign' && (
            <div className="settings-pane">
              <div className="settings-pane-header">
                <MapTrifold size={28} weight="duotone" />
                <div>
                  <h3>Campaign</h3>
                  <p>Details, export, and template management</p>
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">Details</div>
                <div className="settings-card">
                  <div className="field-group">
                    <label>Campaign Name</label>
                    <input
                      value={campaign?.name || ''}
                      onChange={(e) => updateCampaign(campaignId, { name: e.target.value })}
                    />
                  </div>
                  <div className="field-group" style={{ marginTop: 12 }}>
                    <label>Description</label>
                    <textarea
                      value={campaign?.description || ''}
                      onChange={(e) => updateCampaign(campaignId, { description: e.target.value })}
                      rows={3}
                    />
                  </div>
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">Export</div>
                <div className="settings-card">
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '4px 0' }}>
                    Campaign templates, markdown vault export, and legend presets — coming in Phase 2.
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Theme button ── */
function ThemeButton({ value, current, onClick, icon: Icon, label }) {
  const active = current === value;
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: '7px 14px',
        borderRadius: 'var(--radius)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--border-strong)'}`,
        background: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        fontSize: 13, fontWeight: 500,
        cursor: 'pointer',
        transition: 'all var(--transition)',
      }}
    >
      <Icon size={15} weight={active ? 'duotone' : 'regular'} />
      {label}
    </button>
  );
}

/* ── Reusable sub-components ── */
function SettingsRow({ label, children }) {
  return (
    <div className="settings-row-deep">
      <span className="settings-row-label">{label}</span>
      {children}
    </div>
  );
}

function SegmentedControl({ options, value, onChange }) {
  return (
    <div className="segmented-control">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={`segmented-option ${value === opt.value ? 'active' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SettingsToggleRow({ label, description, value, onChange }) {
  return (
    <div className="settings-row-deep">
      <div>
        <span className="settings-row-label">{label}</span>
        {description && <span className="settings-row-desc">{description}</span>}
      </div>
      <button
        className={`settings-toggle-switch ${value ? 'on' : ''}`}
        onClick={() => onChange(!value)}
      >
        <div className="settings-toggle-knob" />
      </button>
    </div>
  );
}

/* ── Icon Picker trigger ── */
function IconPicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const Icon = resolveIcon(value);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '6px 10px',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--border-strong)',
          background: 'var(--bg-inset)',
          color: 'var(--text-primary)',
          cursor: 'pointer',
          fontSize: 13,
        }}
      >
        <Icon size={16} weight="duotone" />
        <span>{value}</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 2 }}>change…</span>
      </button>
      {open && (
        <IconPickerModal
          current={value}
          onSelect={(name) => { onChange(name); setOpen(false); }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

/* ── Color dot row ── */
function ColorPicker({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
      {PRESET_COLORS.map((c) => (
        <button
          key={c}
          onClick={() => onChange(c)}
          style={{
            width: 18, height: 18, borderRadius: '50%', background: c, padding: 0, flexShrink: 0,
            border: value === c ? '2.5px solid var(--text-primary)' : '2px solid transparent',
            cursor: 'pointer',
          }}
        />
      ))}
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title="Custom color"
        style={{ width: 22, height: 22, padding: 0, border: 'none', background: 'none', cursor: 'pointer', borderRadius: 4 }}
      />
    </div>
  );
}

/* ── Node Types Pane ── */
function NodeTypesPane({ campaignId }) {
  const nodeTypeOverrides = useSettingsStore((s) => s.nodeTypeOverrides) || {};
  const customNodeTypes   = useSettingsStore((s) => s.customNodeTypes)   || [];
  const setSetting             = useSettingsStore((s) => s.setSetting);
  const addCustomNodeType      = useSettingsStore((s) => s.addCustomNodeType);
  const updateCustomNodeType   = useSettingsStore((s) => s.updateCustomNodeType);
  const removeCustomNodeType   = useSettingsStore((s) => s.removeCustomNodeType);

  const [addingNew, setAddingNew] = useState(false);
  const [newLabel, setNewLabel]   = useState('');
  const [newIcon,  setNewIcon]    = useState('Star');
  const [newColor, setNewColor]   = useState('#a78bfa');
  const [newKind,  setNewKind]    = useState('spatial'); // 'spatial' | 'abstract'

  const handleBuiltInOverride = (typeKey, field, value) => {
    const current = nodeTypeOverrides[typeKey] || {};
    setSetting(campaignId, 'nodeTypeOverrides', {
      ...nodeTypeOverrides,
      [typeKey]: { ...current, [field]: value },
    });
  };

  const handleAddCustom = () => {
    if (!newLabel.trim()) return;
    addCustomNodeType(campaignId, {
      label: newLabel.trim(),
      icon: newIcon,
      color: newColor,
      kind: newKind,
    });
    setNewLabel('');
    setNewIcon('Star');
    setNewColor('#a78bfa');
    setNewKind('spatial');
    setAddingNew(false);
  };

  return (
    <div className="settings-pane">
      <div className="settings-pane-header">
        <Cube size={28} weight="duotone" />
        <div>
          <h3>Node Types</h3>
          <p>Customize names, icons, and colors for each type</p>
        </div>
      </div>

      {/* Built-in types */}
      <div className="settings-section">
        <div className="settings-section-title">Built-in Types</div>
        <div className="settings-card" style={{ gap: 0 }}>
          {Object.entries(NODE_TYPES).map(([key, schema]) => {
            const ovr = nodeTypeOverrides[key] || {};
            const currentColor = ovr.color || DEFAULT_TYPE_COLORS[key] || '#8890a0';
            const currentLabel = ovr.label || schema.label;
            const currentIcon  = ovr.icon  || schema.icon;
            const IconComp = resolveIcon(currentIcon);
            return (
              <BuiltInTypeRow
                key={key}
                typeKey={key}
                label={currentLabel}
                icon={currentIcon}
                color={currentColor}
                IconComp={IconComp}
                onLabelChange={(v) => handleBuiltInOverride(key, 'label', v)}
                onIconChange={(v)  => handleBuiltInOverride(key, 'icon',  v)}
                onColorChange={(v) => handleBuiltInOverride(key, 'color', v)}
              />
            );
          })}
        </div>
      </div>

      {/* Custom types */}
      {customNodeTypes.length > 0 && (
        <div className="settings-section">
          <div className="settings-section-title">Custom Types</div>
          <div className="settings-card" style={{ gap: 0 }}>
            {customNodeTypes.map((ct) => {
              const IconComp = resolveIcon(ct.icon);
              return (
                <CustomTypeRow
                  key={ct.id}
                  ct={ct}
                  IconComp={IconComp}
                  onUpdate={(updates) => updateCustomNodeType(campaignId, ct.id, updates)}
                  onDelete={() => removeCustomNodeType(campaignId, ct.id)}
                />
              );
            })}
          </div>
        </div>
      )}

      {/* Add new custom type */}
      <div className="settings-section">
        <div className="settings-section-title">Add Custom Type</div>
        {addingNew ? (
          <div className="settings-card" style={{ gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 'var(--radius)',
                background: `${newColor}22`, color: newColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {(() => { const I = resolveIcon(newIcon); return <I size={18} weight="duotone" />; })()}
              </div>
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Type name (e.g. Creature, Quest)"
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustom(); if (e.key === 'Escape') setAddingNew(false); }}
                autoFocus
                style={{ flex: 1 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Icon</div>
              <IconPicker value={newIcon} onChange={setNewIcon} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Color</div>
              <ColorPicker value={newColor} onChange={setNewColor} />
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Behaviour</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {[['spatial', 'Spatial', 'Can be placed & nested on the map'], ['abstract', 'Organizational', 'Tag-based relationships only (like Faction, Religion)']].map(([k, label, hint]) => (
                  <button
                    key={k}
                    onClick={() => setNewKind(k)}
                    title={hint}
                    style={{
                      flex: 1, padding: '7px 10px', borderRadius: 'var(--radius)',
                      border: '1px solid', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                      borderColor: newKind === k ? 'var(--accent)' : 'var(--border)',
                      background: newKind === k ? 'var(--accent-dim)' : 'transparent',
                      color: newKind === k ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >{label}</button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                {newKind === 'abstract'
                  ? 'Nodes of this type won\'t nest spatially. Relationships are assigned by dragging in the board.'
                  : 'Nodes of this type can be placed on the map and nested inside locations or other spatial nodes.'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={handleAddCustom} style={{ gap: 6 }}>
                <Plus size={14} /> Add Type
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => setAddingNew(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            className="btn btn-secondary"
            onClick={() => setAddingNew(true)}
            style={{ gap: 6, alignSelf: 'flex-start' }}
          >
            <Plus size={15} /> New type
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Built-in type row with expand/collapse ── */
function BuiltInTypeRow({ typeKey, label, icon, color, IconComp, onLabelChange, onIconChange, onColorChange }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '10px 16px', cursor: 'pointer',
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 'var(--radius)',
          background: `${color}22`, color, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconComp size={16} weight="duotone" />
        </div>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{label}</span>
        <span style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginRight: 4 }}>{typeKey}</span>
        <span style={{ color: 'var(--text-muted)', fontSize: 12, transform: expanded ? 'rotate(90deg)' : '', transition: 'transform 0.15s' }}>›</span>
      </div>
      {expanded && (
        <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</div>
            <input value={label} onChange={(e) => onLabelChange(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Icon</div>
            <IconPicker value={icon} onChange={onIconChange} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Color</div>
            <ColorPicker value={color} onChange={onColorChange} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Custom type row ── */
function CustomTypeRow({ ct, IconComp, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', cursor: 'pointer' }}
        onClick={() => setExpanded((v) => !v)}
      >
        <div style={{
          width: 28, height: 28, borderRadius: 'var(--radius)',
          background: `${ct.color}22`, color: ct.color, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <IconComp size={16} weight="duotone" />
        </div>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{ct.label}</span>
        {ct.kind === 'abstract' && (
          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 'var(--radius-pill)', background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>
            org
          </span>
        )}
        <button
          className="btn-icon"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          title="Delete custom type"
          style={{ color: 'var(--danger)', opacity: 0.7 }}
        >
          <Trash size={14} />
        </button>
        <span style={{ color: 'var(--text-muted)', fontSize: 12, transform: expanded ? 'rotate(90deg)' : '', transition: 'transform 0.15s' }}>›</span>
      </div>
      {expanded && (
        <div style={{ padding: '0 16px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Name</div>
            <input value={ct.label} onChange={(e) => onUpdate({ label: e.target.value })} style={{ width: '100%' }} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Icon</div>
            <IconPicker value={ct.icon} onChange={(v) => onUpdate({ icon: v })} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Color</div>
            <ColorPicker value={ct.color} onChange={(v) => onUpdate({ color: v })} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Behaviour</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[['spatial', 'Spatial'], ['abstract', 'Organizational']].map(([k, label]) => {
                const active = (ct.kind || 'spatial') === k;
                return (
                  <button key={k} onClick={() => onUpdate({ kind: k })}
                    style={{ flex: 1, padding: '6px 8px', borderRadius: 'var(--radius)', border: '1px solid', cursor: 'pointer', fontSize: 11, fontWeight: 600, borderColor: active ? 'var(--accent)' : 'var(--border)', background: active ? 'var(--accent-dim)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text-secondary)' }}
                  >{label}</button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Pinterest Pane ── */
function PinterestPane({ campaignId }) {
  const pinterestSession    = useSettingsStore((s) => s.pinterestSession) || '';
  const setPinterestSession = useSettingsStore((s) => s.setPinterestSession);
  const [draft, setDraft]   = useState(pinterestSession);
  const [saved, setSaved]   = useState(false);

  const handleSave = () => {
    setPinterestSession(campaignId, draft.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = () => {
    setDraft('');
    setPinterestSession(campaignId, '');
  };

  const hasSession = !!pinterestSession;

  return (
    <div className="settings-pane">
      <div className="settings-pane-header">
        <Key size={28} weight="duotone" />
        <div>
          <h3>Pinterest</h3>
          <p>Session token for browsing private and full boards</p>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Cookie String</div>
        <div className="settings-card" style={{ gap: 14 }}>

          {/* Status badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
              background: hasSession ? '#4ade80' : 'var(--text-muted)',
            }} />
            <span style={{ fontSize: 13, color: hasSession ? '#4ade80' : 'var(--text-muted)' }}>
              {hasSession ? 'Session active — full board access enabled' : 'No session — limited to ~15 pins per board'}
            </span>
          </div>

          {/* Instructions */}
          <div style={{
            fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.8,
            padding: '10px 12px', borderRadius: 'var(--radius)',
            background: 'var(--bg-inset)', border: '1px solid var(--border-subtle)',
          }}>
            <strong style={{ color: 'var(--text-primary)', display: 'block', marginBottom: 6 }}>
              How to copy your cookie string:
            </strong>
            1. Open <strong>pinterest.com</strong> in this browser and sign in.<br />
            2. Press <strong>F12</strong> → <strong>Network</strong> tab → reload the page.<br />
            3. Click any request to <strong>www.pinterest.com</strong> in the list.<br />
            4. In <strong>Request Headers</strong>, find the <code style={{ fontSize: 11, background: 'var(--bg-surface)', padding: '1px 4px', borderRadius: 3 }}>cookie</code> header.<br />
            5. Right-click it → <strong>Copy value</strong>.<br />
            6. Paste below and click Save.
          </div>

          {/* Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="password"
              value={draft}
              onChange={(e) => { setDraft(e.target.value); setSaved(false); }}
              placeholder="Paste full cookie string from Network tab…"
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
              style={{ fontFamily: 'monospace', fontSize: 12 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn btn-primary btn-sm"
                onClick={handleSave}
                disabled={draft === pinterestSession}
                style={{ gap: 6 }}
              >
                {saved ? '✓ Saved' : 'Save'}
              </button>
              {hasSession && (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleClear}
                  style={{ gap: 6 }}
                >
                  <Trash size={13} /> Clear
                </button>
              )}
            </div>
          </div>

          <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            This token is stored locally in your browser and is only used to authenticate
            requests to Pinterest's API. It never leaves your machine.
          </div>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Notes</div>
        <div className="settings-card">
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Changes take effect <strong>immediately</strong> — no restart required. Sessions
            typically last 30–90 days. If boards stop loading, your session has expired and
            you'll need to paste a fresh cookie value from pinterest.com.
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Fields Pane — global per-type field schema editor ── */
const FIELD_TYPE_OPTIONS = [
  { value: 'text',     label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number',   label: 'Number' },
  { value: 'select',   label: 'Dropdown' },
  { value: 'tags',     label: 'References' },
];

function FieldsPane({ campaignId }) {
  const nodeTypeOverrides  = useSettingsStore((s) => s.nodeTypeOverrides) || {};
  const customNodeTypes    = useSettingsStore((s) => s.customNodeTypes)   || [];
  const nodeFieldOverrides = useSettingsStore((s) => s.nodeFieldOverrides) || {};
  const addNodeTypeField     = useSettingsStore((s) => s.addNodeTypeField);
  const removeNodeTypeField  = useSettingsStore((s) => s.removeNodeTypeField);
  const restoreNodeTypeField = useSettingsStore((s) => s.restoreNodeTypeField);

  // Merge built-in + custom types into a single list
  const allTypes = useMemo(() => {
    const builtIn = Object.entries(NODE_TYPES).map(([id, schema]) => {
      const ovr = nodeTypeOverrides[id] || {};
      return { id, label: ovr.label || schema.label, isCustom: false };
    });
    const custom = customNodeTypes.map((ct) => ({ id: ct.id, label: ct.label, isCustom: true }));
    return [...builtIn, ...custom];
  }, [nodeTypeOverrides, customNodeTypes]);

  const [selectedTypeId, setSelectedTypeId] = useState(allTypes[0]?.id || null);

  const selectedType = allTypes.find((t) => t.id === selectedTypeId);
  const isBuiltIn    = selectedType && !selectedType.isCustom;
  const baseFields   = isBuiltIn ? getFieldSchema(selectedTypeId) : DEFAULT_CUSTOM_FIELDS;
  const overrides    = nodeFieldOverrides[selectedTypeId] || {};
  const removedSet   = new Set(overrides.removed || []);
  const addedFields  = overrides.added || [];

  // All active fields (base minus removed + added globally)
  const activeFields = [
    ...baseFields.filter((f) => !removedSet.has(f.key)),
    ...addedFields,
  ];
  // Removed base fields (restorable)
  const hiddenFields = baseFields.filter((f) => removedSet.has(f.key));

  // "Add field" state
  const [adding, setAdding] = useState(false);
  const [newLabel, setNewLabel] = useState('');

  const handleAdd = () => {
    if (!newLabel.trim() || !selectedTypeId) return;
    addNodeTypeField(campaignId, selectedTypeId, {
      label: newLabel.trim(),
      type: 'text',
      default: '',
    });
    setNewLabel('');
    setAdding(false);
  };

  return (
    <div className="settings-pane">
      <div className="settings-pane-header">
        <ListDashes size={28} weight="duotone" />
        <div>
          <h3>Fields</h3>
          <p>Add or remove fields globally for each node type</p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, height: 360, minHeight: 0, overflow: 'hidden' }}>
        {/* Left: type selector */}
        <div style={{
          width: 160,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          overflowY: 'auto',
        }}>
          {allTypes.map((t) => {
            const hasOverrides = !!(nodeFieldOverrides[t.id]?.added?.length || nodeFieldOverrides[t.id]?.removed?.length);
            return (
              <button
                key={t.id}
                onClick={() => { setSelectedTypeId(t.id); setAdding(false); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 8, padding: '7px 10px', borderRadius: 'var(--radius)',
                  border: 'none', textAlign: 'left', cursor: 'pointer',
                  background: selectedTypeId === t.id ? 'var(--accent-dim)' : 'transparent',
                  color: selectedTypeId === t.id ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: 13, fontWeight: selectedTypeId === t.id ? 600 : 400,
                  transition: 'all 0.12s',
                }}
              >
                <span>{t.label}</span>
                {hasOverrides && (
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--accent)', flexShrink: 0,
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Divider */}
        <div style={{ width: 1, background: 'var(--border)', flexShrink: 0 }} />

        {/* Right: field list for selected type */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!selectedType ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: 8 }}>Select a type to edit its fields.</div>
          ) : (
            <>
              {/* Active fields */}
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '0 2px' }}>
                Active Fields — {selectedType.label}
              </div>
              {activeFields.length === 0 && (
                <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '4px 2px' }}>No fields.</div>
              )}
              {activeFields.map((f) => {
                const isAdded  = addedFields.some((af) => af.key === f.key);
                const isBase   = !isAdded;
                return (
                  <div
                    key={f.key}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 12px', borderRadius: 'var(--radius)',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        {f.label}
                        {isAdded && (
                          <span style={{
                            fontSize: 10, fontWeight: 600, color: 'var(--accent)',
                            background: 'var(--accent-dim)', padding: '1px 6px', borderRadius: 4,
                            textTransform: 'uppercase', letterSpacing: '0.04em',
                          }}>custom</span>
                        )}
                      </div>
                    </div>
                    {/* Only allow hiding built-in fields or deleting custom ones */}
                    <button
                      className="btn-icon"
                      title={isBase ? 'Hide this field globally' : 'Remove custom field'}
                      onClick={() => removeNodeTypeField(campaignId, selectedTypeId, f.key)}
                      style={{ color: 'var(--danger)', opacity: 0.7, flexShrink: 0 }}
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                );
              })}

              {/* Hidden fields restore section */}
              {hiddenFields.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '8px 2px 0' }}>
                    Hidden Fields
                  </div>
                  {hiddenFields.map((f) => (
                    <div
                      key={f.key}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', borderRadius: 'var(--radius)',
                        background: 'var(--bg-inset)',
                        border: '1px solid var(--border-subtle)',
                        opacity: 0.65,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{f.label}</div>
                      </div>
                      <button
                        className="btn-icon"
                        title="Restore this field"
                        onClick={() => restoreNodeTypeField(campaignId, selectedTypeId, f.key)}
                        style={{ color: 'var(--accent)', flexShrink: 0 }}
                      >
                        <ArrowCounterClockwise size={14} />
                      </button>
                    </div>
                  ))}
                </>
              )}

              {/* Add field */}
              {adding ? (
                <div style={{
                  padding: '12px', borderRadius: 'var(--radius)',
                  border: '1px dashed var(--accent)', background: 'var(--accent-dim)',
                  display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4,
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                    New Global Field
                  </div>
                  <input
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    placeholder="Field name"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAdding(false); }}
                    autoFocus
                  />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button className="btn btn-primary btn-sm" onClick={handleAdd} style={{ gap: 6 }}>
                      <Plus size={13} /> Add
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setAdding(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setAdding(true)}
                  style={{ gap: 6, alignSelf: 'flex-start', marginTop: 4 }}
                >
                  <Plus size={13} /> Add field to all {selectedType.label}s
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
