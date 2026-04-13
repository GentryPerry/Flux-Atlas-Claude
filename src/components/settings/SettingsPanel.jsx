import { useState, useMemo } from 'react';
import {
  X, Eye, Palette, Cube, Gear, CaretRight,
  Layout, GridFour, Tag, LinkSimple, MapTrifold,
  Export, ArrowsLeftRight, SquareSplitHorizontal, Rows,
  Plus, Trash, PencilSimple,
} from '@phosphor-icons/react';
import useSettingsStore from '../../stores/settingsStore';
import useCampaignStore from '../../stores/campaignStore';
import { NODE_TYPES } from '../../utils/nodeSchemas';

const CATEGORIES = [
  { id: 'view', label: 'View', icon: Eye, description: 'Layout, canvas, and display preferences' },
  { id: 'legend', label: 'Legend', icon: Palette, description: 'Color meanings for nodes and connections' },
  { id: 'nodeTypes', label: 'Node Types', icon: Cube, description: 'Built-in and custom node type schemas' },
  { id: 'campaign', label: 'Campaign', icon: MapTrifold, description: 'Campaign details and export options' },
];

const PRESET_COLORS = [
  '#f87171', '#fb923c', '#f5b042', '#4ade80', '#60a5fa',
  '#6e8efb', '#a78bfa', '#c084fc', '#d8b4fe', '#f0abfc',
  '#fda4af', '#86efac', '#67e8f9', '#fcd34d', '#e2e8f0',
];

const TYPE_COLORS = {
  character: 'var(--node-character)',
  location: 'var(--node-location)',
  faction: 'var(--node-faction)',
  religion: 'var(--node-religion)',
  event: 'var(--node-event)',
  realm: 'var(--node-realm)',
  thing: 'var(--node-thing)',
};

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
    layout, mapSide, showConnections, showNodeLabels,
    showStatusOverlays, canvasGridVisible,
    legendEntries, addLegendEntry, updateLegendEntry, removeLegendEntry,
    setSetting,
  } = useSettingsStore();

  const [newLegendColor, setNewLegendColor] = useState('#6e8efb');
  const [newLegendMeaning, setNewLegendMeaning] = useState('');

  const handleAddLegend = () => {
    if (!newLegendMeaning.trim()) return;
    addLegendEntry(campaignId, newLegendColor, newLegendMeaning.trim());
    setNewLegendMeaning('');
  };

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
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">Connections</div>
                <div className="settings-card">
                  <SettingsToggleRow
                    label="Show by default"
                    description="Display connection lines when opening a map"
                    value={showConnections}
                    onChange={(v) => setSetting(campaignId, 'showConnections', v)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ──── Legend ──── */}
          {settingsCategory === 'legend' && (
            <div className="settings-pane">
              <div className="settings-pane-header">
                <Palette size={28} weight="duotone" />
                <div>
                  <h3>Legend</h3>
                  <p>Node type colors (auto) + custom connection meanings</p>
                </div>
              </div>

              {/* Auto-generated node type legend */}
              <div className="settings-section">
                <div className="settings-section-title">Node Types (Auto)</div>
                <div className="settings-card">
                  {Object.entries(NODE_TYPES).map(([key, schema]) => (
                    <div key={key} className="legend-entry-row">
                      <div className="legend-swatch" style={{ background: TYPE_COLORS[key] }} />
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>
                        {schema.label}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Auto</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">Custom Connection Colors</div>
                <div className="settings-card">
                  {legendEntries.length === 0 && (
                    <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 18px' }}>
                      Add custom meanings for connection line colors.
                    </div>
                  )}

                  {legendEntries.map((entry) => (
                    <div key={entry.id} className="legend-entry-row">
                      <div
                        className="legend-swatch"
                        style={{ background: entry.color }}
                      />
                      <input
                        className="legend-meaning-input"
                        value={entry.meaning}
                        onChange={(e) => updateLegendEntry(campaignId, entry.id, { meaning: e.target.value })}
                      />
                      <button
                        className="btn-icon"
                        onClick={() => removeLegendEntry(campaignId, entry.id)}
                        style={{ color: 'var(--danger)', opacity: 0.6 }}
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  ))}

                  {/* Add new */}
                  <div className="legend-add-row">
                    <div className="legend-color-picker">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          className={`legend-color-dot ${newLegendColor === c ? 'active' : ''}`}
                          style={{ background: c }}
                          onClick={() => setNewLegendColor(c)}
                        />
                      ))}
                    </div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input
                        value={newLegendMeaning}
                        onChange={(e) => setNewLegendMeaning(e.target.value)}
                        placeholder="Meaning (e.g. Alliance, Conflict)"
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddLegend(); }}
                        style={{ flex: 1 }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={handleAddLegend}>
                        <Plus size={14} /> Add
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ──── Node Types ──── */}
          {settingsCategory === 'nodeTypes' && (
            <div className="settings-pane">
              <div className="settings-pane-header">
                <Cube size={28} weight="duotone" />
                <div>
                  <h3>Node Types</h3>
                  <p>View built-in types. Custom types coming in Phase 2.</p>
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">Built-in Types</div>
                <div className="settings-card">
                  {Object.entries(NODE_TYPES).map(([key, schema]) => (
                    <div key={key} className="settings-type-row">
                      <div className={`settings-type-dot type-${key}`} />
                      <span style={{ flex: 1, fontWeight: 500 }}>{schema.label}</span>
                      <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>Built-in</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="settings-section">
                <div className="settings-section-title">Custom Types</div>
                <div className="settings-card">
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '8px 0' }}>
                    Create custom node types with your own field schemas. Available in Phase 2.
                  </div>
                </div>
              </div>
            </div>
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
