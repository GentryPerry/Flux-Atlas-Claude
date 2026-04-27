import { useMemo } from 'react';
import { saveStore, loadCampaign } from '../../utils/api';
import { Warning, Lightning, Skull, ArrowFatUp, DiceSix, Check, ArrowsInSimple, ArrowsOutSimple, X } from '@phosphor-icons/react';

// ── Persistence helpers (mirrors TroubleEngineModal) ──────────────────────────

const KEY       = (cid) => `flux_troubles_${cid}`;
const loadTroubles = async (cid) => {
  try { const d = await loadCampaign(cid); return Array.isArray(d.troubles) ? d.troubles : []; }
  catch { return []; }
};
const saveTroubles = (cid, t) => { saveStore(cid, 'troubles', t).catch(() => {}); };

// ── Severity helpers ──────────────────────────────────────────────────────────

function SeverityIcon({ severity }) {
  if (severity === 'heavy') return <Skull    size={11} weight="fill" style={{ color: '#e0617a' }} />;
  if (severity === 'light') return <Lightning size={11} weight="fill" style={{ color: '#f59242' }} />;
  return null;
}

// ── Widget ────────────────────────────────────────────────────────────────────

export default function TroubleEngineWidget({ widget, onUpdate, onUpdateData, onRemove, onContextMenu }) {
  const { data }      = widget;
  const campaignId    = data.campaignId || widget.campaignId;
  const isMinimized   = widget.isMinimized;

  // Load live trouble data from D1 (same key as modal)
  // data._refresh is a timestamp nudged on resolve to force re-read
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const troubles = useMemo(() => loadTroubles(campaignId), [campaignId, data._refresh]);
  const ongoing  = troubles.filter((t) => t.ongoing);
  const heavy    = ongoing.filter((t) => t.severity === 'heavy').length;
  const light    = ongoing.filter((t) => t.severity === 'light').length;
  const lastRun  = data.lastRun ? new Date(data.lastRun).toLocaleDateString() : null;

  const resolve = (id) => {
    const updated = troubles.filter((t) => t.id !== id);
    saveTroubles(campaignId, updated);
    // Force re-render by nudging widget data
    onUpdateData({ _refresh: Date.now() });
  };

  const openEngine = () => {
    window.dispatchEvent(new CustomEvent('flux:openTroubleEngine'));
  };

  return (
    <div
      className={`widget-shell te-widget ${isMinimized ? 'widget-minimized' : ''}`}
      style={{ width: isMinimized ? 220 : (data.width || 280) }}
      onContextMenu={onContextMenu}
    >
      {/* Drag handle / title bar */}
      <div className="te-widget-titlebar" data-drag-handle="true">
        <Warning size={11} weight="fill" style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span className="te-widget-title">{data.title || 'Trouble Engine'}</span>
        <div className="widget-controls">
          {!isMinimized && (
            <button
              className="te-widget-run-btn"
              onClick={openEngine}
              title="Open Trouble Engine"
            >
              <DiceSix size={12} /> Run
            </button>
          )}
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

      {!isMinimized && (
        <div className="te-widget-body">
          {/* Summary row */}
          <div className="te-widget-summary">
            <div className={`te-widget-stat ${ongoing.length > 0 ? 'active' : 'quiet'}`}>
              <span className="te-widget-stat-val">{ongoing.length}</span>
              <span className="te-widget-stat-label">Ongoing</span>
            </div>
            {heavy > 0 && (
              <div className="te-widget-stat danger">
                <Skull size={12} weight="fill" />
                <span className="te-widget-stat-val">{heavy}</span>
                <span className="te-widget-stat-label">Heavy</span>
              </div>
            )}
            {light > 0 && (
              <div className="te-widget-stat warning">
                <Lightning size={12} weight="fill" />
                <span className="te-widget-stat-val">{light}</span>
                <span className="te-widget-stat-label">Light</span>
              </div>
            )}
            {lastRun && (
              <span className="te-widget-last-run">Last run {lastRun}</span>
            )}
          </div>

          {/* Trouble list (max 5) */}
          {ongoing.length === 0 ? (
            <div className="te-widget-empty">
              No ongoing troubles. Run the engine after downtime.
            </div>
          ) : (
            <div className="te-widget-troubles">
              {ongoing.slice(0, 5).map((t) => (
                <div key={t.id} className={`te-widget-trouble te-wtrouble-${t.severity}`}>
                  <SeverityIcon severity={t.severity} />
                  <span className="te-widget-trouble-name">{t.name}</span>
                  <button
                    className="te-widget-resolve"
                    onClick={() => resolve(t.id)}
                    title="Mark resolved"
                  >
                    <Check size={10} weight="bold" />
                  </button>
                </div>
              ))}
              {ongoing.length > 5 && (
                <div className="te-widget-more">+{ongoing.length - 5} more…</div>
              )}
            </div>
          )}

          {/* Open button */}
          <button className="te-widget-open-btn" onClick={openEngine}>
            <DiceSix size={13} /> Open Trouble Engine
          </button>
        </div>
      )}
    </div>
  );
}
