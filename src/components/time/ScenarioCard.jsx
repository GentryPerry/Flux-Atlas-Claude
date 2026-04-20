import { useState } from 'react';
import { Check, X, ChartLineUp, ChartLineDown, Skull, Buildings, ArrowsOut } from '@phosphor-icons/react';
import MapPreviewCanvas from './MapPreviewCanvas';

const VOLATILITY_COLORS = {
  stable:   '#5ae892',
  balanced: '#f5b042',
  volatile: '#f47070',
};

const VOLATILITY_LABELS = {
  stable:   'Stable',
  balanced: 'Balanced',
  volatile: 'Volatile',
};

const CHANGE_TYPE_ICONS = {
  'node.died':             Skull,
  'node.destroyed':        Buildings,
  'node.repurposed':       Buildings,
  'node.moved':            ArrowsOut,
  'territory.expanded':    ChartLineUp,
  'territory.contracted':  ChartLineDown,
  'territory.shifted':     ArrowsOut,
};

const CHANGE_TYPE_COLORS = {
  'node.died':             'var(--danger)',
  'node.destroyed':        'var(--danger)',
  'node.repurposed':       'var(--warning)',
  'node.moved':            'var(--text-secondary)',
  'territory.expanded':    'var(--success)',
  'territory.contracted':  'var(--danger)',
  'territory.shifted':     'var(--warning)',
};

const SEVERITY_DOT = {
  critical: '#f47070',
  major:    '#f5b042',
  moderate: '#5ae892',
  minor:    '#8ea1a4',
};

/**
 * ScenarioCard — displays one generated scenario proposal.
 *
 * Props:
 *   scenario           — ScenarioProposal from generateScenarios()
 *   isSelected         — bool, highlights this card
 *   onSelect           — () => void
 *   approvedIds        — Set<changeId> of approved change ids
 *   onToggleChange     — (changeId) => void
 *   onCommit           — () => void  (commits with current approvedIds)
 *   isCommitting       — bool
 */
export default function ScenarioCard({
  scenario,
  isSelected,
  onSelect,
  approvedIds,
  onToggleChange,
  onCommit,
  isCommitting = false,
}) {
  const [showMap, setShowMap] = useState(true);
  const [expanded, setExpanded] = useState(false);

  const volColor = VOLATILITY_COLORS[scenario.volatility] || 'var(--text-muted)';
  const totalChanges = scenario.allChanges?.length ?? 0;
  const approvedCount = approvedIds?.size ?? 0;

  // Split changes: critical (require approval) vs others
  const criticalChanges = (scenario.allChanges || []).filter((c) => c.requiresApproval);
  const otherChanges    = (scenario.allChanges || []).filter((c) => !c.requiresApproval);
  const displayChanges  = expanded ? scenario.allChanges : [...criticalChanges, ...otherChanges].slice(0, 6);
  const hasMore = totalChanges > 6 && !expanded;

  return (
    <div
      className={`scenario-card${isSelected ? ' scenario-card--selected' : ''}`}
      onClick={onSelect}
    >
      {/* ── Header ── */}
      <div className="scenario-card__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
          <span
            className="scenario-volatility-badge"
            style={{ background: `${volColor}22`, color: volColor, borderColor: `${volColor}44` }}
          >
            {VOLATILITY_LABELS[scenario.volatility]}
          </span>
          <span className="scenario-card__title" title={scenario.title}>
            {scenario.title}
          </span>
        </div>

        <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
          {totalChanges} change{totalChanges !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Summary narrative ── */}
      <p className="scenario-card__summary">{scenario.summary}</p>

      {/* ── Map preview toggle ── */}
      {(scenario.mapPreviewData?.territoryUpdates?.length > 0 ||
        scenario.mapPreviewData?.destroyedNodeIds?.length > 0 ||
        scenario.mapPreviewData?.diedNodeIds?.length > 0) && (
        <div style={{ marginBottom: 10 }}>
          <button
            className="btn-text"
            onClick={(e) => { e.stopPropagation(); setShowMap((v) => !v); }}
            style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}
          >
            {showMap ? '▾ Map Preview' : '▸ Map Preview'}
          </button>
          {showMap && (
            <MapPreviewCanvas
              sourceWorldState={scenario.resultingWorldState}
              resultingWorldState={scenario.resultingWorldState}
              mapPreviewData={scenario.mapPreviewData}
              height={140}
            />
          )}
        </div>
      )}

      {/* ── Change list ── */}
      {totalChanges > 0 ? (
        <div className="scenario-changes-list">
          {displayChanges.map((change) => {
            const isApproved = approvedIds?.has(change.id) ?? true;
            const Icon = CHANGE_TYPE_ICONS[change.type] || ChartLineUp;
            const color = CHANGE_TYPE_COLORS[change.type] || 'var(--text-secondary)';
            const dotColor = SEVERITY_DOT[change.severity] || '#8ea1a4';

            return (
              <div
                key={change.id}
                className={`change-item${!isApproved ? ' change-item--rejected' : ''}`}
                onClick={(e) => { e.stopPropagation(); onToggleChange?.(change.id); }}
                title={change.description}
              >
                {/* Approve / reject toggle */}
                <div
                  className={`change-item__toggle${isApproved ? ' change-item__toggle--approved' : ''}`}
                  onClick={(e) => { e.stopPropagation(); onToggleChange?.(change.id); }}
                >
                  {isApproved ? <Check size={10} weight="bold" /> : <X size={10} weight="bold" />}
                </div>

                {/* Icon */}
                <Icon size={13} style={{ color, flexShrink: 0 }} weight="duotone" />

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span className="change-item__title">{change.title}</span>
                </div>

                {/* Severity dot */}
                <span
                  className="change-item__dot"
                  style={{ background: dotColor }}
                  title={change.severity}
                />
              </div>
            );
          })}

          {hasMore && (
            <button
              className="btn-text"
              style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, padding: '2px 0' }}
              onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
            >
              + {totalChanges - 6} more changes…
            </button>
          )}
        </div>
      ) : (
        <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', margin: '8px 0' }}>
          No significant changes in this timeline.
        </p>
      )}

      {/* ── Commit button ── */}
      {isSelected && (
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
            {approvedCount} / {totalChanges} changes approved
          </span>
          <button
            className="btn btn-primary"
            onClick={(e) => { e.stopPropagation(); onCommit?.(); }}
            disabled={isCommitting}
            style={{ flexShrink: 0 }}
          >
            {isCommitting ? 'Committing…' : 'Commit Timeline →'}
          </button>
        </div>
      )}
    </div>
  );
}
