import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import {
  X, Eye, Cube, MapTrifold,
  SquareSplitHorizontal, Rows,
  Plus, Trash, Sun, Moon, ListDashes, ArrowCounterClockwise, Key,
  Images, Link, DownloadSimple, Upload, FileText, Check, Question,
  Copy, LockKey, Warning, Tag, PencilSimple,
} from '@phosphor-icons/react';
import { useAuth } from '../../context/AuthContext';
import { adminListKeys, adminCreateKeys, adminRevokeKey } from '../../utils/api';
import useNodeStore from '../../stores/nodeStore';
import useMapStore from '../../stores/mapStore';
import useTagStore from '../../stores/tagStore';
import useSettingsStore from '../../stores/settingsStore';
import useCampaignStore from '../../stores/campaignStore';
import { NODE_TYPES, getFieldSchema, DEFAULT_CUSTOM_FIELDS } from '../../utils/nodeSchemas';
import { DEFAULT_TYPE_COLORS } from '../../utils/typeColors';
import { resolveIcon } from '../../utils/iconRegistry';
import IconPickerModal from '../common/IconPickerModal';
import { exportToMarkdown, exportToJSON, downloadFile, safeFilename } from '../../utils/exportUtils';
import AccountUsagePanel from '../account/AccountUsagePanel';
import UpgradePage from '../account/UpgradePage';

const CATEGORIES = [
  { id: 'view',      label: 'View',       icon: Eye,            description: 'Layout, canvas, and display preferences' },
  { id: 'nodeTypes', label: 'Node Types', icon: Cube,           description: 'Customize and add node type schemas' },
  { id: 'fields',    label: 'Fields',     icon: ListDashes,     description: 'Global field schemas for each node type' },
  { id: 'tags',      label: 'Tags',       icon: Tag,            description: 'Manage, rename, and delete campaign tags' },
  { id: 'images',    label: 'Images',     icon: Images,         description: 'Campaign image pool — available to all nodes' },
  { id: 'import',    label: 'Import',     icon: DownloadSimple, description: 'Bulk import nodes from markdown' },
  // { id: 'pinterest', label: 'Pinterest', icon: Key, description: 'Session token for board access' },
  { id: 'campaign',  label: 'Campaign',   icon: MapTrifold,     description: 'Campaign details and export options' },
  { id: 'account',   label: 'Account',    icon: Key,            description: 'Plan, usage, and upgrade options'       },
];

const PRESET_COLORS = [
  '#f87171', '#fb923c', '#f5b042', '#4ade80', '#60a5fa',
  '#6e8efb', '#a78bfa', '#c084fc', '#d8b4fe', '#f0abfc',
  '#fda4af', '#86efac', '#67e8f9', '#fcd34d', '#e2e8f0',
];

// ── Beta Key Manager (admin only) ─────────────────────────────────────────────

function BetaKeysPanel() {
  const [keys,       setKeys]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [genCount,   setGenCount]   = useState(5);
  const [genNote,    setGenNote]    = useState('');
  const [generating, setGenerating] = useState(false);
  const [copied,     setCopied]     = useState(null); // key string that was just copied
  const [revoking,   setRevoking]   = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { keys: k } = await adminListKeys();
      setKeys(k || []);
    } catch { /* not admin or error */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function generate() {
    setGenerating(true);
    try {
      await adminCreateKeys(genCount, genNote);
      setGenNote('');
      await load();
    } catch (e) { alert(e.message); }
    finally { setGenerating(false); }
  }

  async function revoke(key) {
    if (!confirm(`Revoke key ${key}? This cannot be undone.`)) return;
    setRevoking(key);
    try { await adminRevokeKey(key); await load(); }
    catch (e) { alert(e.message); }
    finally { setRevoking(null); }
  }

  function copyKey(key) {
    navigator.clipboard.writeText(key).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1800);
  }

  function copyAll() {
    const unused = keys.filter((k) => !k.used_by).map((k) => k.key).join('\n');
    navigator.clipboard.writeText(unused).catch(() => {});
    setCopied('__all__');
    setTimeout(() => setCopied(null), 1800);
  }

  const unused = keys.filter((k) => !k.used_by);
  const used   = keys.filter((k) =>  k.used_by);

  if (loading) return <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '12px 0' }}>Loading keys…</div>;

  return (
    <div style={{ marginTop: 20, padding: '16px 4px 0', borderTop: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <LockKey size={14} style={{ color: 'var(--accent)' }} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>Beta Access Keys</span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
          {unused.length} unused · {used.length} used
        </span>
      </div>

      {/* Generator */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
        <input
          type="number"
          min={1}
          max={50}
          value={genCount}
          onChange={(e) => setGenCount(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
          style={{ width: 52, fontSize: 12, padding: '4px 6px', borderRadius: 6,
                   border: '1px solid var(--border)', background: 'var(--bg-inset)',
                   color: 'var(--text-primary)', textAlign: 'center' }}
        />
        <input
          type="text"
          placeholder="Label (e.g. Discord batch)"
          value={genNote}
          onChange={(e) => setGenNote(e.target.value)}
          style={{ flex: 1, fontSize: 12, padding: '4px 8px', borderRadius: 6,
                   border: '1px solid var(--border)', background: 'var(--bg-inset)',
                   color: 'var(--text-primary)' }}
        />
        <button
          className="btn btn-primary btn-sm"
          onClick={generate}
          disabled={generating}
          style={{ whiteSpace: 'nowrap' }}
        >
          <Plus size={12} />
          {generating ? 'Generating…' : 'Generate'}
        </button>
      </div>

      {/* Copy all unused */}
      {unused.length > 0 && (
        <button
          className="btn btn-secondary btn-sm"
          onClick={copyAll}
          style={{ marginBottom: 10, fontSize: 11 }}
        >
          {copied === '__all__' ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy all unused</>}
        </button>
      )}

      {/* Key list */}
      {keys.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '8px 0' }}>
          No keys yet — generate some above.
        </div>
      )}

      {unused.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Unused</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {unused.map((k) => (
              <div key={k.key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <code style={{ flex: 1, fontSize: 11, fontFamily: 'monospace', color: 'var(--text-primary)',
                               background: 'var(--bg-inset)', padding: '3px 8px', borderRadius: 5,
                               letterSpacing: '0.04em' }}>
                  {k.key}
                </code>
                {k.note && (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', maxWidth: 80, overflow: 'hidden',
                                 textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={k.note}>
                    {k.note}
                  </span>
                )}
                <button className="btn-icon" title="Copy" style={{ width: 24, height: 24 }}
                  onClick={() => copyKey(k.key)}>
                  {copied === k.key ? <Check size={11} style={{ color: 'var(--success)' }} /> : <Copy size={11} />}
                </button>
                <button className="btn-icon" title="Revoke" style={{ width: 24, height: 24, opacity: revoking === k.key ? 0.4 : 1 }}
                  onClick={() => revoke(k.key)} disabled={revoking === k.key}>
                  <Trash size={11} style={{ color: 'var(--error, #f87171)' }} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {used.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Used</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {used.map((k) => (
              <div key={k.key} style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.55 }}>
                <code style={{ flex: 1, fontSize: 11, fontFamily: 'monospace', color: 'var(--text-secondary)',
                               background: 'var(--bg-inset)', padding: '3px 8px', borderRadius: 5,
                               letterSpacing: '0.04em', textDecoration: 'line-through' }}>
                  {k.key}
                </code>
                <span style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', maxWidth: 130,
                               overflow: 'hidden', textOverflow: 'ellipsis' }}
                      title={k.used_by_email}>
                  {k.used_by_email || 'unknown'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function SettingsPanel({ mobileEmbed = false }) {
  const { user } = useAuth();
  const isAdmin  = user?.plan_key === 'admin_unlimited';

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

  const nodes = useNodeStore((s) => s.nodes);
  const tags  = useTagStore((s) => s.tags);
  const [exportFeedback, setExportFeedback] = useState(null); // 'md' | 'json' | null

  function flashFeedback(type) {
    setExportFeedback(type);
    setTimeout(() => setExportFeedback(null), 2000);
  }

  function handleExportMarkdown() {
    const content  = exportToMarkdown(nodes, tags);
    const filename = `${safeFilename(campaign?.name)}-export.md`;
    downloadFile(content, filename, 'text/markdown');
    flashFeedback('md');
  }

  function handleExportJSON() {
    const content  = exportToJSON(campaignId, campaign?.name);
    const filename = `${safeFilename(campaign?.name)}-backup.json`;
    downloadFile(content, filename, 'application/json');
    flashFeedback('json');
  }

  function renderPane() {
    return (
      <>
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
                    <ThemeButton value="dark" current={theme} onClick={() => setSetting(campaignId, 'theme', 'dark')} icon={Moon} label="Dark" />
                    <ThemeButton value="light" current={theme} onClick={() => setSetting(campaignId, 'theme', 'light')} icon={Sun} label="Light" />
                  </div>
                </SettingsRow>
              </div>
            </div>
            {!mobileEmbed && (
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
            )}
            <div className="settings-section">
              <div className="settings-section-title">Canvas</div>
              <div className="settings-card">
                <SettingsToggleRow label="Grid dots" description="Show subtle grid on empty canvas" value={canvasGridVisible} onChange={(v) => setSetting(campaignId, 'canvasGridVisible', v)} />
                <SettingsToggleRow label="Node labels" description="Show names below node markers" value={showNodeLabels} onChange={(v) => setSetting(campaignId, 'showNodeLabels', v)} />
                <SettingsToggleRow label="Status overlays" description="Dead/hidden indicators on nodes" value={showStatusOverlays} onChange={(v) => setSetting(campaignId, 'showStatusOverlays', v)} />
                <SettingsToggleRow label="Show connections" description="Display connection lines when opening a map" value={showConnections} onChange={(v) => setSetting(campaignId, 'showConnections', v)} />
              </div>
            </div>
          </div>
        )}
        {settingsCategory === 'nodeTypes' && <NodeTypesPane campaignId={campaignId} />}
        {settingsCategory === 'fields' && <FieldsPane campaignId={campaignId} />}
        {settingsCategory === 'tags' && <TagsPane campaignId={campaignId} />}
        {settingsCategory === 'images' && <ImagePoolPane campaignId={campaignId} />}
        {settingsCategory === 'import' && <ImportPane campaignId={campaignId} />}
        {settingsCategory === 'campaign' && (
          <div className="settings-pane">
            <div className="settings-pane-header">
              <MapTrifold size={28} weight="duotone" />
              <div><h3>Campaign</h3><p>Details, export, and template management</p></div>
            </div>
            <div className="settings-section">
              <div className="settings-section-title">Details</div>
              <div className="settings-card">
                <div className="settings-card-body">
                  <div className="field-group">
                    <label>Campaign Name</label>
                    <input value={campaign?.name || ''} onChange={(e) => updateCampaign(campaignId, { name: e.target.value })} />
                  </div>
                  <div className="field-group">
                    <label>Description</label>
                    <textarea value={campaign?.description || ''} onChange={(e) => updateCampaign(campaignId, { description: e.target.value })} rows={3} />
                  </div>
                </div>
              </div>
            </div>
            <div className="settings-section">
              <div className="settings-section-title">Export</div>
              <div className="settings-card">
                <div className="settings-row-deep">
                  <div>
                    <span className="settings-row-label">Markdown</span>
                    <span className="settings-row-desc">All nodes as importable <code>.md</code> — portable and human-readable</span>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={handleExportMarkdown}
                  >
                    {exportFeedback === 'md'
                      ? <><Check size={14} weight="bold" /> Saved</>
                      : <><FileText size={14} /> Export</>
                    }
                  </button>
                </div>
                <div className="settings-row-deep">
                  <div>
                    <span className="settings-row-label">Full backup</span>
                    <span className="settings-row-desc">Complete campaign data as <code>.json</code> — includes widgets &amp; settings</span>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}
                    onClick={handleExportJSON}
                  >
                    {exportFeedback === 'json'
                      ? <><Check size={14} weight="bold" /> Saved</>
                      : <><DownloadSimple size={14} /> Export</>
                    }
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        {settingsCategory === 'account' && (
          <div className="settings-pane">
            <div className="settings-pane-header">
              <Key size={28} weight="duotone" />
              <div><h3>Account</h3><p>Plan, usage limits, and upgrade options</p></div>
            </div>
            <AccountUsagePanel />
            <div style={{ marginTop: 16, padding: '0 4px' }}>
              <UpgradePage onClose={null} />
            </div>
            {isAdmin && <BetaKeysPanel />}

            <div style={{ marginTop: 20, padding: '16px 4px 0', borderTop: '1px solid var(--border)' }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8, color: 'var(--text-secondary)' }}>Help</div>
              <button
                className="btn btn-secondary btn-sm tour-launch-btn"
                onClick={() => { window.dispatchEvent(new CustomEvent('flux:startTour')); }}
              >
                <Question size={14} />
                Show Tutorial
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  if (mobileEmbed) {
    return (
      <div className="settings-content settings-content-mobile">
        {renderPane()}
      </div>
    );
  }

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
          {renderPane()}
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

/* ── Tags Pane ── */
function TagsPane({ campaignId }) {
  const tags       = useTagStore((s) => s.tags).filter((t) => t.campaignId === campaignId);
  const updateTag  = useTagStore((s) => s.updateTag);
  const deleteTag  = useTagStore((s) => s.deleteTag);
  const updateNodeFields = useNodeStore((s) => s.updateNodeFields);
  const allNodes   = useNodeStore((s) => s.nodes);

  const [editingId, setEditingId]   = useState(null);
  const [editName, setEditName]     = useState('');
  const [editColor, setEditColor]   = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const startEdit = (tag) => {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color || '#888888');
    setConfirmDeleteId(null);
  };

  const commitEdit = () => {
    if (!editName.trim()) return;
    updateTag(campaignId, editingId, { name: editName.trim(), color: editColor });
    setEditingId(null);
  };

  const handleDelete = (tagId) => {
    // Sweep tag ID out of every node's tag fields in this campaign
    const affected = allNodes.filter(
      (n) => n.campaignId === campaignId &&
        Object.values(n.fields || {}).some(
          (v) => Array.isArray(v) && v.includes(tagId)
        )
    );
    for (const node of affected) {
      const cleaned = {};
      for (const [k, v] of Object.entries(node.fields || {})) {
        cleaned[k] = Array.isArray(v) ? v.filter((id) => id !== tagId) : v;
      }
      updateNodeFields(campaignId, node.id, cleaned);
    }
    deleteTag(campaignId, tagId);
    setConfirmDeleteId(null);
  };

  const sortedTags = [...tags].sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="settings-pane">
      <div className="settings-pane-header">
        <Tag size={28} weight="duotone" />
        <div><h3>Tags</h3><p>Rename or delete tags across this campaign</p></div>
      </div>

      {sortedTags.length === 0 ? (
        <div className="settings-section">
          <div className="settings-card">
            <div className="settings-card-body" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
              No tags yet — they're created automatically when you type in a tag field on a node.
            </div>
          </div>
        </div>
      ) : (
        <div className="settings-section">
          <div className="settings-section-title">
            Campaign Tags ({sortedTags.length})
          </div>
          <div className="settings-card">
            <div className="settings-card-body" style={{ padding: 0 }}>
              {sortedTags.map((tag, i) => {
                const isEditing = editingId === tag.id;
                const isConfirming = confirmDeleteId === tag.id;
                const usageCount = allNodes.filter(
                  (n) => n.campaignId === campaignId &&
                    Object.values(n.fields || {}).some(
                      (v) => Array.isArray(v) && v.includes(tag.id)
                    )
                ).length;

                return (
                  <div
                    key={tag.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 12px',
                      borderBottom: i < sortedTags.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    {/* Color swatch / picker */}
                    {isEditing ? (
                      <input
                        type="color"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        style={{ width: 28, height: 28, border: 'none', background: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
                        title="Tag color"
                      />
                    ) : (
                      <span
                        style={{
                          width: 12, height: 12, borderRadius: '50%',
                          background: tag.color || '#888888',
                          flexShrink: 0, display: 'inline-block',
                        }}
                      />
                    )}

                    {/* Name */}
                    {isEditing ? (
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') commitEdit(); if (e.key === 'Escape') setEditingId(null); }}
                        autoFocus
                        style={{ flex: 1, fontSize: 13, background: 'var(--input-bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 6px', color: 'var(--text)' }}
                      />
                    ) : (
                      <span style={{ flex: 1, fontSize: 13 }}>{tag.name}</span>
                    )}

                    {/* Usage count */}
                    {!isEditing && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                        {usageCount} {usageCount === 1 ? 'node' : 'nodes'}
                      </span>
                    )}

                    {/* Actions */}
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon" onClick={commitEdit} title="Save" style={{ color: 'var(--accent)' }}><Check size={14} /></button>
                        <button className="btn-icon" onClick={() => setEditingId(null)} title="Cancel"><X size={14} /></button>
                      </div>
                    ) : isConfirming ? (
                      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Delete?</span>
                        <button className="btn-icon" onClick={() => handleDelete(tag.id)} title="Confirm delete" style={{ color: '#f87171' }}><Check size={14} /></button>
                        <button className="btn-icon" onClick={() => setConfirmDeleteId(null)} title="Cancel"><X size={14} /></button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button className="btn-icon" onClick={() => startEdit(tag)} title="Rename tag"><PencilSimple size={14} /></button>
                        <button className="btn-icon" onClick={() => setConfirmDeleteId(tag.id)} title="Delete tag" style={{ color: '#f87171' }}><Trash size={14} /></button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
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
                  campaignId={campaignId}
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
          <div className="settings-card" style={{ gap: 20, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius)',
                background: `${newColor}22`, color: newColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {(() => { const I = resolveIcon(newIcon); return <I size={20} weight="duotone" />; })()}
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
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Icon</div>
              <IconPicker value={newIcon} onChange={setNewIcon} />
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Color</div>
              <ColorPicker value={newColor} onChange={setNewColor} />
            </div>

            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Behaviour</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[['spatial', 'Spatial', 'Can be placed & nested on the map'], ['abstract', 'Organizational', 'Tag-based relationships only (like Faction, Religion)']].map(([k, label, hint]) => (
                  <button
                    key={k}
                    onClick={() => setNewKind(k)}
                    title={hint}
                    style={{
                      flex: 1, padding: '9px 12px', borderRadius: 'var(--radius)',
                      border: '1px solid', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                      borderColor: newKind === k ? 'var(--accent)' : 'var(--border)',
                      background: newKind === k ? 'var(--accent-dim)' : 'transparent',
                      color: newKind === k ? 'var(--accent)' : 'var(--text-secondary)',
                    }}
                  >{label}</button>
                ))}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.6 }}>
                {newKind === 'abstract'
                  ? 'Nodes of this type won\'t nest spatially. Relationships are assigned by dragging in the board.'
                  : 'Nodes of this type can be placed on the map and nested inside locations or other spatial nodes.'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
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
function CustomTypeRow({ ct, IconComp, onUpdate, onDelete, campaignId }) {
  const [expanded, setExpanded] = useState(false);
  const addNodeTypeField = useSettingsStore((s) => s.addNodeTypeField);
  const nodeFieldOverrides = useSettingsStore((s) => s.nodeFieldOverrides) || {};

  const isAbstract = ct.kind === 'abstract';
  const hasHierarchy = ct.drillDown === 'hierarchy';

  const toggleHierarchy = (e) => {
    e.stopPropagation();
    const enabling = !hasHierarchy;
    onUpdate({ drillDown: enabling ? 'hierarchy' : 'detail' });

    // When enabling, auto-add a parent field if one doesn't already exist
    if (enabling) {
      const existingAdded = nodeFieldOverrides[ct.id]?.added || [];
      const alreadyHasParent = existingAdded.some(
        (f) => f.type === 'tags' && f.filterTypes?.includes(ct.id)
      );
      if (!alreadyHasParent) {
        const fieldKey = `parent_${ct.id}`;
        addNodeTypeField(campaignId, ct.id, {
          key: fieldKey,
          label: `Parent ${ct.label}`,
          type: 'tags',
          default: [],
          filterTypes: [ct.id],
          singular: true,
        });
      }
    }
  };

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
        {isAbstract && (
          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 'var(--radius-pill)', background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>
            org
          </span>
        )}
        {isAbstract && hasHierarchy && (
          <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 'var(--radius-pill)', background: 'rgba(245,200,66,0.15)', color: '#f5c842', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0 }}>
            tree
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

          {/* Hierarchy toggle — only for abstract/org types */}
          {isAbstract && (
            <div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Hierarchy View</div>
              <button
                onClick={toggleHierarchy}
                style={{
                  width: '100%', padding: '7px 10px', borderRadius: 'var(--radius)', border: '1px solid',
                  cursor: 'pointer', fontSize: 11, fontWeight: 600, textAlign: 'left',
                  borderColor: hasHierarchy ? '#f5c84250' : 'var(--border)',
                  background: hasHierarchy ? 'rgba(245,200,66,0.1)' : 'transparent',
                  color: hasHierarchy ? '#f5c842' : 'var(--text-secondary)',
                  display: 'flex', alignItems: 'center', gap: 7,
                }}
              >
                <span style={{ fontSize: 14 }}>{hasHierarchy ? '✦' : '○'}</span>
                {hasHierarchy
                  ? 'Hierarchy enabled — shows org tree in detail panel'
                  : 'Enable hierarchy view for this type'}
              </button>
              {hasHierarchy && (
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
                  A <strong>Parent {ct.label}</strong> field has been added automatically.
                  Use it to build parent–child trees between {ct.label} nodes.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Pinterest Pane ── */
// ── Image Pool pane ───────────────────────────────────────────────────────────

function ImagePoolPane({ campaignId }) {
  const imagePool          = useSettingsStore((s) => s.imagePool)          || [];
  const addToImagePool     = useSettingsStore((s) => s.addToImagePool);
  const removeFromImagePool = useSettingsStore((s) => s.removeFromImagePool);
  const updateImagePoolItem = useSettingsStore((s) => s.updateImagePoolItem);
  const clearImagePool     = useSettingsStore((s) => s.clearImagePool);

  const [urlDraft,   setUrlDraft]   = useState('');
  const [labelDraft, setLabelDraft] = useState('');
  const [adding,     setAdding]     = useState(false);
  const [editingId,  setEditingId]  = useState(null);
  const [editLabel,  setEditLabel]  = useState('');

  const commit = () => {
    const url = urlDraft.trim();
    if (!url) return;
    addToImagePool(campaignId, url, labelDraft.trim());
    setUrlDraft('');
    setLabelDraft('');
    setAdding(false);
  };

  return (
    <div className="settings-pane">
      <div className="settings-pane-header">
        <Images size={28} weight="duotone" />
        <div>
          <h3>Image Pool</h3>
          <p>A shared library of images available to all nodes in this campaign</p>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Pool images ({imagePool.length})</span>
          {imagePool.length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ color: 'var(--text-muted)', fontSize: 11 }}
              onClick={() => { if (window.confirm('Clear all pool images?')) clearImagePool(campaignId); }}
            >
              Clear all
            </button>
          )}
        </div>

        {/* Image grid */}
        {imagePool.length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 12, padding: '12px 0', fontStyle: 'italic' }}>
            No images in pool yet. Add URLs below to build your moodboard library.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10, marginBottom: 12 }}>
            {imagePool.map((img) => (
              <div key={img.id} style={{ position: 'relative', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', aspectRatio: '1', background: 'rgba(0,0,0,0.2)' }}>
                <img src={img.url} alt={img.label || ''} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {/* Label overlay */}
                {img.label && (
                  <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.65)', padding: '3px 6px', fontSize: 10, color: 'rgba(255,255,255,0.8)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {img.label}
                  </div>
                )}
                {/* Hover remove */}
                <button
                  onClick={() => removeFromImagePool(campaignId, img.id)}
                  title="Remove from pool"
                  style={{ position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: '50%', background: 'rgba(239,68,68,0.85)', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', opacity: 0, transition: 'opacity 0.1s' }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '0'}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add form */}
        {adding ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, border: '1px solid var(--border)' }}>
            <input
              autoFocus
              placeholder="Image URL  (https://...)"
              value={urlDraft}
              onChange={(e) => setUrlDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setAdding(false); }}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}
            />
            <input
              placeholder="Label (optional)"
              value={labelDraft}
              onChange={(e) => setLabelDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setAdding(false); }}
              style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 6, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12, outline: 'none' }}
            />
            {urlDraft && (
              <img src={urlDraft} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'contain', borderRadius: 6, background: 'rgba(0,0,0,0.3)' }} onError={(e) => e.currentTarget.style.display = 'none'} />
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={commit} disabled={!urlDraft.trim()}>
                <Plus size={13} /> Add to pool
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setAdding(false); setUrlDraft(''); setLabelDraft(''); }}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button className="btn btn-secondary btn-sm" style={{ gap: 6, alignSelf: 'flex-start' }} onClick={() => setAdding(true)}>
            <Plus size={13} /> Add image URL
          </button>
        )}
      </div>

      <div className="settings-section">
        <div className="settings-section-title">How it works</div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Images added here are available as a shared pool across all nodes in this campaign.
          In any node's detail panel, open the image gallery and click <strong>From pool</strong> to attach a pooled image to that node.
        </div>
      </div>
    </div>
  );
}

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

// ── Import pane ───────────────────────────────────────────────────────────────

const IMPORT_TEMPLATE = `# NPC: Gareth Ironhand
Faction: The Silver Order
Religion: The Lightbringer
Motivation: Protect the northern border
Status: alive
---
A battle-scarred veteran who commands the garrison at Stormwatch Keep.

# NPC: Miriel Dawnweaver
Faction: Circle of Whispers
Religion: The Old Ways
Motivation: Uncover the truth about the Sundering
Status: alive
---
An elven scholar who has spent centuries studying ancient texts.

# Location: Stormwatch Keep
Region: Northern Marches
---
A massive stone fortress perched on the edge of the Windbreak Cliffs.

# Faction: The Silver Order
Alignment: Lawful Good
---
A knightly order dedicated to defending the realm from darkness.

# Religion: The Lightbringer
Deity: Solarius
---
An ancient faith centered on the worship of the sun god Solarius.

# Event: Battle of Ashen Fields
Date: Third Age, Year 847
Status: resolved
---
A devastating conflict that nearly destroyed the Silver Order.

# Item: Oathkeeper Blade
---
An enchanted longsword passed down through Silver Order commanders.
`;

function parseImportMarkdown(text) {
  const nodes = [];
  const blocks = text.split(/^# /m).filter(Boolean);
  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const headerMatch = lines[0].match(/^(\w+):\s*(.+)$/);
    if (!headerMatch) continue;
    const typeLabel = headerMatch[1].trim().toLowerCase();
    const name = headerMatch[2].trim();
    const typeKey = Object.entries(NODE_TYPES).find(
      ([key, schema]) => schema.label.toLowerCase() === typeLabel || key === typeLabel
    )?.[0];
    if (!typeKey) continue;
    // Inline minimal field builder to avoid circular imports
    const schema = NODE_TYPES[typeKey];
    const fields = {};
    for (const f of schema?.fields || []) fields[f.key] = f.default ?? '';
    fields.name = name;
    let descLines = [];
    let pastSep = false;
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.trim() === '---') { pastSep = true; continue; }
      if (!pastSep) {
        const fm = line.match(/^([A-Za-z\s]+):\s*(.+)$/);
        if (fm) {
          const fl = fm[1].trim().toLowerCase();
          const fv = fm[2].trim();
          const fd = schema?.fields.find(
            (f) => f.label.toLowerCase() === fl || f.key.toLowerCase() === fl
          );
          if (fd) {
            if (fd.type === 'tags') {
              fields[`__tagNames_${fd.key}`] = fv.split(',').map((s) => s.trim()).filter(Boolean);
              fields[fd.key] = [];
            } else {
              fields[fd.key] = fv;
            }
          }
        }
      } else {
        descLines.push(line);
      }
    }
    if (descLines.length > 0) fields.description = descLines.join('\n').trim();
    nodes.push({ type: typeKey, fields });
  }
  return nodes;
}

function ImportPane({ campaignId }) {
  const activeMapId      = useMapStore((s) => s.activeMapId);
  const createNode       = useNodeStore((s) => s.createNode);
  const updateNodeFields = useNodeStore((s) => s.updateNodeFields);
  const tags             = useTagStore((s) => s.tags);
  const createTag        = useTagStore((s) => s.createTag);

  const [text, setText]           = useState('');
  const [done, setDone]           = useState(false);
  const [doneCount, setDoneCount] = useState(0);
  const fileRef                   = useRef(null);

  const preview = useMemo(() => {
    if (!text.trim()) return [];
    return parseImportMarkdown(text);
  }, [text]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setText(ev.target.result);
    reader.readAsText(file);
    e.target.value = '';
  };

  const resolveTag = (name) => {
    let tag = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (!tag) tag = createTag(campaignId, name);
    return tag.id;
  };

  const handleImport = () => {
    if (preview.length === 0) return;
    const cols = Math.ceil(Math.sqrt(preview.length));
    for (let i = 0; i < preview.length; i++) {
      const node = preview[i];
      const x = 200 + (i % cols) * 120;
      const y = 200 + Math.floor(i / cols) * 120;
      const resolvedFields = { ...node.fields };
      for (const key of Object.keys(resolvedFields)) {
        if (key.startsWith('__tagNames_')) {
          const fk = key.replace('__tagNames_', '');
          resolvedFields[fk] = resolvedFields[key].map((n) => resolveTag(n));
          delete resolvedFields[key];
        }
      }
      const created = createNode(campaignId, activeMapId, node.type, x, y);
      updateNodeFields(campaignId, created.id, resolvedFields);
    }
    setDoneCount(preview.length);
    setDone(true);
    setText('');
  };

  const TYPE_DOT = {
    character: 'var(--node-character)', location: 'var(--node-location)',
    faction:   'var(--node-faction)',   religion: 'var(--node-religion)',
    event:     'var(--node-event)',     polity:   'var(--node-polity)',
    thing:     'var(--node-thing)',
  };

  return (
    <div className="settings-pane">
      <div className="settings-pane-header">
        <DownloadSimple size={28} weight="duotone" />
        <div>
          <h3>Import</h3>
          <p>Bulk import nodes from a markdown file</p>
        </div>
      </div>

      {done ? (
        <div style={{ textAlign: 'center', padding: '48px 20px' }}>
          <Check size={48} weight="bold" color="var(--success)" />
          <div style={{ marginTop: 12, fontSize: 16, fontWeight: 600 }}>
            {doneCount} node{doneCount !== 1 ? 's' : ''} imported!
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 13 }}>
            Nodes have been placed on the current map.
          </p>
          <button className="btn btn-secondary" onClick={() => setDone(false)} style={{ marginTop: 20 }}>
            Import more
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="settings-hint-box">
            <div style={{ fontWeight: 600, marginBottom: 6, fontSize: 12 }}>Format</div>
            <pre style={{ fontSize: 11, lineHeight: 1.6, margin: 0, color: 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>{`# NPC: Character Name\nFaction: Some Faction\n---\nDescription text here.\n\n# Location: Place Name\n---\nA description.`}</pre>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <input
              ref={fileRef}
              type="file"
              accept=".md,.txt,.markdown"
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
            <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
              <Upload size={14} /> Upload file
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => setText(IMPORT_TEMPLATE)}>
              <FileText size={14} /> Insert template
            </button>
          </div>

          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`Paste your markdown here…\n\n# NPC: Character Name\nFaction: Some Faction\n---\nDescription text here.`}
            style={{ minHeight: 200, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}
          />

          {preview.length > 0 && (
            <div>
              <label style={{ marginBottom: 8, display: 'block' }}>
                Preview — {preview.length} node{preview.length !== 1 ? 's' : ''} detected
              </label>
              <div className="import-results">
                {preview.map((node, i) => (
                  <div key={i} className="import-result-item">
                    <div className="dot" style={{ background: TYPE_DOT[node.type] || 'var(--text-muted)' }} />
                    <span style={{ fontWeight: 600 }}>{node.fields?.name || 'Unnamed'}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 'auto' }}>
                      {NODE_TYPES[node.type]?.label || node.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary"
              disabled={preview.length === 0}
              onClick={handleImport}
              style={preview.length === 0 ? { opacity: 0.5, cursor: 'default' } : {}}
            >
              Import {preview.length > 0 ? `${preview.length} node${preview.length !== 1 ? 's' : ''}` : ''}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
