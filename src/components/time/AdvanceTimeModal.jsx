import { useState, useCallback, useEffect, useMemo } from 'react';
import { X, Clock, Lightning, Leaf, Wind, ArrowRight, ArrowLeft } from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useTerritoryStore from '../../stores/territoryStore';
import useSettingsStore from '../../stores/settingsStore';
import useSnapshotStore from '../../stores/snapshotStore';
import { generateScenarios, applyChangesToWorldState, TIMEFRAME_LABELS } from '../../engine/timeEngine';
import { saveStore } from '../../utils/api';
import ScenarioCard from './ScenarioCard';

// ── Constants ─────────────────────────────────────────────────────────────────

const TIMEFRAME_PRESETS = [
  { id: '1_month',  label: '1 Month',   desc: 'Short-term ripples' },
  { id: '6_months', label: '6 Months',  desc: 'A season of change' },
  { id: '1_year',   label: '1 Year',    desc: 'A year passes' },
  { id: '3_years',  label: '3 Years',   desc: 'Meaningful drift' },
  { id: '10_years', label: '10 Years',  desc: 'A generation later' },
];

const VOLATILITY_OPTIONS = [
  {
    id: 'stable',
    label: 'Stable',
    desc: 'Minor changes, mostly quiet',
    Icon: Leaf,
    color: '#5ae892',
  },
  {
    id: 'balanced',
    label: 'Balanced',
    desc: 'Moderate activity, some surprises',
    Icon: Wind,
    color: '#f5b042',
  },
  {
    id: 'volatile',
    label: 'Volatile',
    desc: 'Major upheaval, high stakes',
    Icon: Lightning,
    color: '#f47070',
  },
];

const STEP_LABELS = ['Timeframe', 'Settings', 'Generating', 'Review'];

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * AdvanceTimeModal
 *
 * Props:
 *   campaignId  string
 *   onClose     () => void
 */
export default function AdvanceTimeModal({ campaignId, onClose }) {
  const [step, setStep]           = useState(1);
  const [timeframe, setTimeframe] = useState('1_year');
  const [volatility, setVolatility] = useState('balanced');
  const [count, setCount]         = useState(2);
  const [scenarios, setScenarios] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [approvedIds, setApprovedIds] = useState({}); // scenarioId → Set<changeId>
  const [isCommitting, setIsCommitting] = useState(false);
  const [snapshotName, setSnapshotName] = useState('');
  const [committed, setCommitted]  = useState(false);
  const [appliedChanges, setAppliedChanges] = useState([]);

  // Stores
  const nodes       = useNodeStore((s) => s.nodes);
  const loadNodes   = useNodeStore((s) => s.loadNodes);
  const territories = useTerritoryStore((s) => s.territories);
  const loadTerritories = useTerritoryStore((s) => s.loadTerritories);
  const customNodeTypes = useSettingsStore((s) => s.customNodeTypes) || [];
  const takeSnapshot        = useSnapshotStore((s) => s.takeSnapshot);
  const getSnapshots        = useSnapshotStore((s) => s.getSnapshots);
  const currentSnapshotId   = useSnapshotStore((s) => s.currentSnapshotId);
  const loadSnapshots       = useSnapshotStore((s) => s.loadSnapshots);

  // Capture world state at modal open
  const sourceWorldState = useMemo(() => ({
    nodes:       JSON.parse(JSON.stringify(nodes)),
    territories: JSON.parse(JSON.stringify(territories)),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []); // intentionally captured once

  // Pre-populate snapshot name
  useEffect(() => {
    const preset = TIMEFRAME_LABELS[timeframe] || timeframe;
    setSnapshotName(`After ${preset}`);
  }, [timeframe]);

  // Load snapshots on open
  useEffect(() => {
    loadSnapshots(campaignId);
  }, [campaignId, loadSnapshots]);

  // ── Step navigation ──

  const canGoNext = () => {
    if (step === 1) return !!timeframe;
    if (step === 2) return !!volatility && count >= 1;
    return false;
  };

  const handleGenerate = useCallback(() => {
    setStep(3);

    // Run engine on next tick so React can render the loading state first
    setTimeout(() => {
      const scenarioSettings = Array.from({ length: count }, (_, i) => ({
        id: `s${i}`,
        volatility,
      }));

      const generated = generateScenarios({
        sourceWorldState,
        timeDelta: { preset: timeframe },
        scenarioSettings,
        customNodeTypes,
      });

      setScenarios(generated);

      // Default: all changes approved for each scenario
      const initApproved = {};
      generated.forEach((sc) => {
        initApproved[sc.id] = new Set((sc.allChanges || []).map((c) => c.id));
      });
      setApprovedIds(initApproved);

      // Auto-select first
      if (generated.length > 0) setSelectedId(generated[0].id);

      setStep(4);
    }, 50);
  }, [count, volatility, sourceWorldState, timeframe, customNodeTypes]);

  const handleToggleChange = useCallback((scenarioId, changeId) => {
    setApprovedIds((prev) => {
      const set = new Set(prev[scenarioId] || []);
      if (set.has(changeId)) set.delete(changeId);
      else set.add(changeId);
      return { ...prev, [scenarioId]: set };
    });
  }, []);

  const handleCommit = useCallback(async () => {
    const scenario = scenarios.find((s) => s.id === selectedId);
    if (!scenario) return;

    setIsCommitting(true);

    const approved = approvedIds[selectedId] || new Set();
    const approvedChanges = (scenario.allChanges || []).filter((c) => approved.has(c.id));
    const resultingWorldState = applyChangesToWorldState(sourceWorldState, approvedChanges);

    // If there are no snapshots yet (first ever commit), auto-save the current
    // live state as an "Initial State" root node before branching.
    const existingSnaps = getSnapshots(campaignId);
    if (existingSnaps.length === 0 && !currentSnapshotId) {
      takeSnapshot(
        campaignId,
        'Initial State',
        sourceWorldState,
        'Campaign starting point — before any time advancement.',
      );
      // currentSnapshotId is now set to this initial snapshot by takeSnapshot
    }

    // Save the RESULTING state as the committed timeline snapshot.
    // Parent = currentSnapshotId (the live-state snapshot before this advance).
    // This creates a true branch when the user restores + re-advances.
    takeSnapshot(
      campaignId,
      snapshotName || scenario.title,
      resultingWorldState,
      scenario.summary,
    );

    // Write resulting world state to D1 and reload live stores
    try {
      await Promise.all([
        saveStore(campaignId, 'nodes',       resultingWorldState.nodes),
        saveStore(campaignId, 'territories', resultingWorldState.territories),
      ]);
    } catch (e) {
      console.warn('Failed to write resulting world state:', e);
    }

    loadNodes(campaignId);
    loadTerritories(campaignId);
    loadSnapshots(campaignId);

    setAppliedChanges(approvedChanges);
    setIsCommitting(false);
    setCommitted(true);
  }, [
    scenarios, selectedId, approvedIds, sourceWorldState,
    takeSnapshot, getSnapshots, currentSnapshotId,
    campaignId, snapshotName,
    loadNodes, loadTerritories, loadSnapshots,
  ]);

  // ── Render ──

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 500 }}>
      <div
        className="advance-time-modal"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="advance-time-modal__header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Clock size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} weight="duotone" />
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>
                Advance Time
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Generate scenario proposals for the world
              </div>
            </div>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={16} />
          </button>
        </div>

        {/* Step indicator */}
        <div className="advance-time-modal__steps">
          {STEP_LABELS.map((label, i) => {
            const n = i + 1;
            const isActive = n === step;
            const isDone   = n < step;
            return (
              <div key={label} className="time-step-indicator">
                <div className={`time-step-dot ${isActive ? 'active' : isDone ? 'done' : ''}`}>
                  {isDone ? <span style={{ fontSize: 9 }}>✓</span> : n}
                </div>
                <span className={`time-step-label ${isActive ? 'active' : ''}`}>{label}</span>
                {i < STEP_LABELS.length - 1 && (
                  <div className={`time-step-line ${isDone ? 'done' : ''}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="advance-time-modal__body">

          {/* ── Step 1: Timeframe ── */}
          {step === 1 && (
            <div className="time-step-content">
              <p className="time-step-description">
                How much time passes in the world?
              </p>
              <div className="timeframe-grid">
                {TIMEFRAME_PRESETS.map(({ id, label, desc }) => (
                  <button
                    key={id}
                    className={`timeframe-btn${timeframe === id ? ' timeframe-btn--active' : ''}`}
                    onClick={() => setTimeframe(id)}
                  >
                    <span className="timeframe-btn__label">{label}</span>
                    <span className="timeframe-btn__desc">{desc}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* ── Step 2: Volatility + Count ── */}
          {step === 2 && (
            <div className="time-step-content">
              <p className="time-step-description">
                Configure the intensity of change and how many alternate timelines to generate.
              </p>

              <div style={{ marginBottom: 20 }}>
                <label className="field-label" style={{ marginBottom: 10 }}>Volatility</label>
                <div className="volatility-grid">
                  {VOLATILITY_OPTIONS.map(({ id, label, desc, Icon, color }) => (
                    <button
                      key={id}
                      className={`volatility-btn${volatility === id ? ' volatility-btn--active' : ''}`}
                      style={volatility === id ? { borderColor: `${color}88`, background: `${color}11` } : {}}
                      onClick={() => setVolatility(id)}
                    >
                      <Icon size={20} weight="duotone" style={{ color }} />
                      <span className="volatility-btn__label" style={{ color: volatility === id ? color : undefined }}>
                        {label}
                      </span>
                      <span className="volatility-btn__desc">{desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="field-label" style={{ marginBottom: 8 }}>
                  Number of scenarios to generate
                </label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[1, 2, 3].map((n) => (
                    <button
                      key={n}
                      className={`scenario-count-btn${count === n ? ' scenario-count-btn--active' : ''}`}
                      onClick={() => setCount(n)}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                  More scenarios give you more choices, each seeded differently.
                </p>
              </div>
            </div>
          )}

          {/* ── Step 3: Generating ── */}
          {step === 3 && (
            <div className="time-step-content time-step-content--center">
              <div className="time-generating-spinner" />
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 16 }}>
                Weaving the threads of fate…
              </p>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                Generating {count} scenario{count > 1 ? 's' : ''} across {TIMEFRAME_LABELS[timeframe]}
              </p>
            </div>
          )}

          {/* ── Step 4: Review scenarios ── */}
          {step === 4 && (
            <div className="time-step-content time-step-content--review">

              {committed ? (
                <div style={{ padding: '24px 0' }}>
                  <div style={{ textAlign: 'center', marginBottom: 20 }}>
                    <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
                    <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--success)', marginBottom: 4 }}>
                      Timeline committed!
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      World state updated · snapshot saved to history
                    </p>
                  </div>

                  {/* Applied changes summary */}
                  {appliedChanges.length > 0 ? (
                    <div style={{
                      background: 'var(--bg-inset)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      padding: '12px 14px',
                      marginBottom: 20,
                    }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        What changed
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {appliedChanges.map((c) => (
                          <div key={c.id} style={{ fontSize: 12, color: 'var(--text-secondary)', display: 'flex', gap: 8 }}>
                            <span style={{ color: 'var(--text-muted)', minWidth: 8 }}>·</span>
                            <span>{c.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div style={{
                      background: 'var(--bg-inset)',
                      borderRadius: 'var(--radius)',
                      border: '1px solid var(--border)',
                      padding: '12px 14px',
                      marginBottom: 20,
                      fontSize: 12,
                      color: 'var(--text-muted)',
                    }}>
                      No changes were approved — world state unchanged.
                    </div>
                  )}

                  <div style={{ textAlign: 'center' }}>
                    <button className="btn btn-secondary" onClick={onClose}>
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Snapshot name */}
                  <div style={{ marginBottom: 16 }}>
                    <label className="field-label" style={{ marginBottom: 6 }}>
                      Snapshot name (saved before committing)
                    </label>
                    <input
                      className="field-input"
                      value={snapshotName}
                      onChange={(e) => setSnapshotName(e.target.value)}
                      placeholder="e.g. Before the war, Year 1142…"
                    />
                  </div>

                  {/* Scenario hint */}
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
                    Select a timeline to review. Toggle individual changes to approve or reject them, then commit.
                  </p>

                  {/* Scenario cards */}
                  <div className="scenario-cards-list">
                    {scenarios.map((scenario) => (
                      <ScenarioCard
                        key={scenario.id}
                        scenario={scenario}
                        isSelected={selectedId === scenario.id}
                        onSelect={() => setSelectedId(scenario.id)}
                        approvedIds={approvedIds[scenario.id]}
                        onToggleChange={(changeId) => handleToggleChange(scenario.id, changeId)}
                        onCommit={handleCommit}
                        isCommitting={isCommitting}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer nav */}
        {step < 3 && !committed && (
          <div className="advance-time-modal__footer">
            <button
              className="btn btn-secondary"
              onClick={() => (step === 1 ? onClose() : setStep((s) => s - 1))}
            >
              <ArrowLeft size={14} />
              {step === 1 ? 'Cancel' : 'Back'}
            </button>

            {step < 2 ? (
              <button
                className="btn btn-primary"
                onClick={() => setStep((s) => s + 1)}
                disabled={!canGoNext()}
              >
                Next
                <ArrowRight size={14} />
              </button>
            ) : (
              <button
                className="btn btn-primary"
                onClick={handleGenerate}
                disabled={!canGoNext()}
              >
                Generate Scenarios
                <Lightning size={14} weight="fill" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
