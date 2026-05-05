import { useState, useCallback, useEffect, useRef } from 'react';
import {
  X, CaretLeft, CaretRight, DiceSix,
  CheckCircle, Lightning, Skull, Star, Warning,
  Check, Plus, Circle, Users, ArrowFatUp, Confetti,
  ArrowCounterClockwise, ClockCounterClockwise,
} from '@phosphor-icons/react';
import useWidgetStore from '../../stores/widgetStore';
import useNodeStore from '../../stores/nodeStore';
import useCampaignStore from '../../stores/campaignStore';
import useViewportStore from '../../stores/viewportStore';
import { saveStore, loadCampaign } from '../../utils/api';
import { recordUsage } from '../../utils/entitlements';
import { invalidateAccountStatus } from '../../hooks/useAccountStatus';

// ── Blades in the Dark — Trouble Engine data ──────────────────────────────────

// Heat band × roll outcome → trouble severity
const CREW_TABLE = {
  low:  { '1-3': 'none',  '4-5': 'light', '6': 'light', crit: 'heavy' },
  mid:  { '1-3': 'light', '4-5': 'light', '6': 'heavy', crit: 'heavy' },
  high: { '1-3': 'light', '4-5': 'heavy', '6': 'heavy', crit: 'heavy' },
};

const LIGHT_TROUBLES = [
  'Asking Around',
  'Gang Trouble',
  'Debt Collected',
  'Increased Patrols',
  'Informant Surfaces',
  'Rival Makes a Move',
  'Lost Contact',
  'Associate Arrested',
  'Reputation Hit',
  'Heat Increases',
  'Bounty Posted',
  'Old Grudge Resurfaces',
];

const HEAVY_TROUBLES = [
  'Flipped',
  'Challenged Claim',
  'Invasion',
  'Show of Force',
  'Assassination Attempt',
  'Key Member Arrested',
];

// Step 3: Local Trouble modifiers (base 2d, adjustments shift the pool)
const LOCAL_MODS = [
  { key: 'hostile',   label: 'Citizenry is hostile toward the crew',         delta: -1 },
  { key: 'war',       label: 'Active war involving the crew',                 delta: -1 },
  { key: 'clockHit',  label: 'Enemy faction clock completed against the crew',delta: -1 },
  { key: 'helped',    label: 'Crew helped locals recently',                   delta: +1 },
  { key: 'standing',  label: 'Crew in good standing with area factions',      delta: +1 },
];

// ── Persistence ───────────────────────────────────────────────────────────────

const KEY       = (cid) => `flux_troubles_${cid}`;
const loadTroubles = async (cid) => { try { const d = await loadCampaign(cid); return Array.isArray(d.troubles) ? d.troubles : []; } catch { return []; } };
const saveTroubles = (cid, t) => { saveStore(cid, 'troubles', t).catch(() => {}); };

// ── Dice helpers (math only) ──────────────────────────────────────────────────

function heatBand(heat)  { return heat <= 3 ? 'low'  : heat <= 5 ? 'mid' : 'high'; }
function heatLabel(heat) { return heat <= 3 ? `${heat} — Low` : heat <= 5 ? `${heat} — Mid` : `${heat} — High`; }
function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function uid() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

// ── Animated dice roller hook ─────────────────────────────────────────────────

function useDiceRoller() {
  const [phase,  setPhase]  = useState('idle');   // 'idle' | 'rolling' | 'settled'
  const [shown,  setShown]  = useState([]);
  const [result, setResult] = useState(null);
  const intervalRef = useRef(null);
  const ticksRef    = useRef(0);

  // Clean up on unmount
  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const roll = useCallback((n) => {
    const isZeroPool = n === 0;
    const count      = isZeroPool ? 2 : Math.max(1, n);
    const finals     = Array.from({ length: count }, () => Math.ceil(Math.random() * 6));

    if (intervalRef.current) clearInterval(intervalRef.current);
    ticksRef.current = 0;

    setPhase('rolling');
    setResult(null);
    setShown(Array.from({ length: count }, () => Math.ceil(Math.random() * 6)));

    intervalRef.current = setInterval(() => {
      ticksRef.current += 1;
      if (ticksRef.current < 10) {
        setShown(Array.from({ length: count }, () => Math.ceil(Math.random() * 6)));
      } else {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        setShown(finals);
        const value  = isZeroPool ? Math.min(...finals) : Math.max(...finals);
        const isCrit = !isZeroPool && finals.filter((d) => d === 6).length >= 2;
        setResult({ dice: finals, value, isCrit, isZeroPool });
        setPhase('settled');
      }
    }, 60);
  }, []);

  return { phase, shown, result, roll };
}

// Derived outcome from settled result
function outcomeKey(result) {
  if (!result) return null;
  if (result.isCrit)        return 'crit';
  if (result.value >= 6)    return '6';
  if (result.value >= 4)    return '4-5';
  return '1-3';
}

// ── AnimatedDiceRow ───────────────────────────────────────────────────────────

function AnimatedDiceRow({ shown, phase, result }) {
  const isRolling  = phase === 'rolling';
  const isSettled  = phase === 'settled';
  const decidingValue = result
    ? (result.isZeroPool ? Math.min(...result.dice) : Math.max(...result.dice))
    : null;

  return (
    <div className="te-dice-row">
      {shown.map((d, i) => {
        const isDeciding = isSettled && result && result.dice[i] === decidingValue;
        const isSix      = isSettled && d === 6;
        return (
          <span
            key={i}
            className={[
              'te-die',
              isRolling  ? 'te-die-rolling'  : '',
              isSix      ? 'te-die-six'       : '',
              isDeciding ? 'te-die-deciding'  : '',
            ].filter(Boolean).join(' ')}
          >
            {d}
          </span>
        );
      })}
    </div>
  );
}

// ── Clock / trouble helpers ───────────────────────────────────────────────────

function findMatchingClock(name, clockWidgets) {
  for (const w of clockWidgets) {
    const clock = (w.data.clocks || []).find(
      (c) => c.label.toLowerCase().trim() === name.toLowerCase().trim()
    );
    if (clock) return { widget: w, clock };
  }
  return null;
}

function tickOrCreateClock(name, severity, campaignId, clockWidgets, addWidget, updateWidgetData) {
  const match = findMatchingClock(name, clockWidgets);
  if (match) {
    const { widget, clock } = match;
    const ticks     = severity === 'heavy' ? 2 : 1;
    const newFilled = Math.min(clock.segments, clock.filled + ticks);
    updateWidgetData(widget.id, {
      clocks: widget.data.clocks.map((c) => c.id === clock.id ? { ...c, filled: newFilled } : c),
    });
  } else {
    // Create a new clock widget for this trouble
    const vp     = useViewportStore.getState();
    const widget = addWidget(campaignId, 'clock-widget', vp);
    const color  = severity === 'heavy' ? '#e0617a' : '#f59242';
    const segs   = severity === 'heavy' ? 8 : 6;
    updateWidgetData(widget.id, {
      title:  name,
      clocks: [{ id: uid(), label: name, segments: segs, filled: severity === 'heavy' ? 2 : 1, color }],
    });
  }
}

// ── Step 1: Faction Clocks ────────────────────────────────────────────────────

const CLOCK_TICK_OPTS = [
  { label: '1–3', ticks: 1 },
  { label: '4/5', ticks: 2 },
  { label: '6',   ticks: 3 },
  { label: 'Crit',ticks: 5 },
];

function StepFactionClocks({ campaignId, allNodes, clockWidgets, addWidget, updateWidgetData }) {
  const factions = allNodes.filter((n) => n.campaignId === campaignId && n.type === 'faction');

  // links: { [factionId]: { widgetId, clockId } | null }
  const [links,      setLinks]      = useState({});
  const [pickerFor,  setPickerFor]  = useState(null); // factionId showing picker
  const [newFaction, setNewFaction] = useState('');   // manual name entry
  const [extras,     setExtras]     = useState([]);   // manually added faction entries

  const allClockOptions = clockWidgets.flatMap((w) =>
    (w.data.clocks || []).map((c) => ({
      widgetId:    w.id,
      clockId:     c.id,
      label:       c.label,
      widgetTitle: w.data.title,
      color:       c.color,
      filled:      c.filled,
      segments:    c.segments,
    }))
  );

  const factionRows = [
    ...factions.map((n) => ({ id: n.id, name: n.fields?.name || 'Unnamed Faction', isNode: true })),
    ...extras,
  ];

  const getLinkInfo = (fId) => {
    const link = links[fId];
    if (!link) return null;
    const w = clockWidgets.find((w) => w.id === link.widgetId);
    if (!w) return null;
    return { widget: w, clock: (w.data.clocks || []).find((c) => c.id === link.clockId) || null };
  };

  const tickClock = (fId, ticks) => {
    const info = getLinkInfo(fId);
    if (!info?.clock) return;
    const { widget, clock } = info;
    const newFilled = Math.min(clock.segments, Math.max(0, clock.filled + ticks));
    updateWidgetData(widget.id, {
      clocks: widget.data.clocks.map((c) => c.id === clock.id ? { ...c, filled: newFilled } : c),
    });
  };

  const createClockForFaction = (fId, name) => {
    const vp     = useViewportStore.getState();
    const widget = addWidget(campaignId, 'clock-widget', vp);
    const clockId = uid();
    updateWidgetData(widget.id, {
      title:  `${name} Clock`,
      clocks: [{ id: clockId, label: name, segments: 6, filled: 0, color: '#4a8fd4' }],
    });
    setLinks((prev) => ({ ...prev, [fId]: { widgetId: widget.id, clockId } }));
    setPickerFor(null);
  };

  const addManualFaction = () => {
    const name = newFaction.trim();
    if (!name) return;
    const id = uid();
    setExtras((prev) => [...prev, { id, name, isNode: false }]);
    setNewFaction('');
  };

  if (factionRows.length === 0) {
    return (
      <div className="te-step-body">
        <p className="te-step-intro">
          Review faction clocks and advance them based on the fiction. Each faction's clock tracks their progress toward a goal.
        </p>
        <div className="te-step-empty">
          <Users size={28} weight="thin" style={{ opacity: 0.4, marginBottom: 8 }} />
          No factions in this campaign yet.
          <span style={{ marginTop: 4, fontSize: 11, color: 'var(--text-muted)' }}>
            Create Faction nodes on the map, or add one below.
          </span>
        </div>
        <div className="te-faction-add-row">
          <input
            className="te-faction-input"
            placeholder="Faction name…"
            value={newFaction}
            onChange={(e) => setNewFaction(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addManualFaction()}
          />
          <button className="te-add-btn" onClick={addManualFaction}>
            <Plus size={13} /> Add
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="te-step-body">
      <p className="te-step-intro">
        Advance faction clocks based on their actions this downtime. Link a clock to each faction, then apply roll results.
      </p>

      <div className="te-faction-list">
        {factionRows.map((f) => {
          const info    = getLinkInfo(f.id);
          const clock   = info?.clock;
          const widget  = info?.widget;
          const isFull  = clock && clock.filled >= clock.segments;
          const pct     = clock ? clock.filled / clock.segments : 0;

          return (
            <div key={f.id} className="te-faction-row">
              {/* Faction header */}
              <div className="te-faction-header">
                <div className="te-faction-name">
                  <Users size={12} weight="bold" style={{ opacity: 0.6 }} />
                  {f.name}
                </div>
                {pickerFor !== f.id ? (
                  <button
                    className="te-link-btn"
                    onClick={() => setPickerFor(f.id)}
                    title="Link or change clock"
                  >
                    {clock ? 'Change clock' : 'Link clock'}
                  </button>
                ) : (
                  <button
                    className="te-link-btn te-link-btn-cancel"
                    onClick={() => setPickerFor(null)}
                  >
                    Cancel
                  </button>
                )}
              </div>

              {/* Clock picker dropdown */}
              {pickerFor === f.id && (
                <div className="te-clock-picker">
                  {allClockOptions.length > 0 && (
                    <>
                      <div className="te-picker-label">Link existing clock</div>
                      {allClockOptions.map((opt) => (
                        <button
                          key={`${opt.widgetId}-${opt.clockId}`}
                          className="te-picker-opt"
                          onClick={() => {
                            setLinks((prev) => ({ ...prev, [f.id]: { widgetId: opt.widgetId, clockId: opt.clockId } }));
                            setPickerFor(null);
                          }}
                        >
                          <span
                            className="te-picker-dot"
                            style={{ background: opt.color }}
                          />
                          <span className="te-picker-name">{opt.label}</span>
                          <span className="te-picker-count">{opt.filled}/{opt.segments}</span>
                        </button>
                      ))}
                      <div className="te-picker-divider" />
                    </>
                  )}
                  <button
                    className="te-picker-opt te-picker-create"
                    onClick={() => createClockForFaction(f.id, f.name)}
                  >
                    <Plus size={11} /> Create new clock for {f.name}
                  </button>
                </div>
              )}

              {/* Linked clock display */}
              {clock && (
                <div className="te-faction-clock">
                  <div className="te-clock-bar-row">
                    <span
                      className="te-clock-dot"
                      style={{ background: clock.color }}
                    />
                    <span className="te-clock-name">{clock.label}</span>
                    <div className="te-clock-bar">
                      <div
                        className="te-clock-fill"
                        style={{ width: `${pct * 100}%`, background: clock.color, opacity: isFull ? 1 : 0.75 }}
                      />
                    </div>
                    <span
                      className="te-clock-count"
                      style={{ color: isFull ? clock.color : undefined }}
                    >
                      {clock.filled}/{clock.segments}
                    </span>
                  </div>
                  <div className="te-clock-btns">
                    {CLOCK_TICK_OPTS.map(({ label, ticks }) => (
                      <button
                        key={label}
                        className="te-tick-btn"
                        disabled={isFull}
                        title={`+${ticks} tick${ticks > 1 ? 's' : ''}`}
                        onClick={() => tickClock(f.id, ticks)}
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      className="te-tick-btn te-tick-minus"
                      disabled={!clock || clock.filled === 0}
                      title="-1 tick"
                      onClick={() => tickClock(f.id, -1)}
                    >
                      −1
                    </button>
                  </div>
                  {isFull && (
                    <div className="te-clock-full-badge">
                      <CheckCircle size={11} weight="fill" /> Clock complete — this faction achieved their goal!
                    </div>
                  )}
                </div>
              )}

              {!clock && pickerFor !== f.id && (
                <div className="te-faction-no-clock">
                  No clock linked — use "Link clock" to track this faction.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add manual faction */}
      <div className="te-faction-add-row">
        <input
          className="te-faction-input"
          placeholder="Add faction by name…"
          value={newFaction}
          onChange={(e) => setNewFaction(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addManualFaction()}
        />
        <button className="te-add-btn" onClick={addManualFaction}>
          <Plus size={13} /> Add
        </button>
      </div>
    </div>
  );
}

// ── Step 2: Crew Trouble ──────────────────────────────────────────────────────

function StepCrewTrouble({ troubles, setTroubles, campaignId, clockWidgets, addWidget, updateWidgetData }) {
  const [heat,   setHeat]   = useState(0);
  const [wanted, setWanted] = useState(1);
  const [logged, setLogged] = useState(false);
  const [roll,   setRoll]   = useState(null); // settled result data

  const [limitError, setLimitError] = useState(null);
  const { phase, shown, result, roll: doRoll } = useDiceRoller();

  const handleRoll = async () => {
    setLimitError(null);
    try {
      await recordUsage('trouble');
      invalidateAccountStatus();
    } catch (e) {
      setLimitError(e.message || 'Trouble limit reached.');
      return;
    }
    setRoll(null);
    setLogged(false);
    doRoll(wanted);
  };

  // When dice settle, compute the crew trouble result
  useEffect(() => {
    if (phase !== 'settled' || !result) return;
    const oc      = outcomeKey(result);
    const sev     = CREW_TABLE[heatBand(heat)][oc];
    const trouble = sev !== 'none' ? randomFrom(sev === 'light' ? LIGHT_TROUBLES : HEAVY_TROUBLES) : null;
    setRoll({ ...result, oc, severity: sev, trouble });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result]);

  const logTrouble = () => {
    if (!roll?.trouble) return;
    tickOrCreateClock(roll.trouble, roll.severity, campaignId, clockWidgets, addWidget, updateWidgetData);
    const updated = [...troubles, { id: uid(), name: roll.trouble, severity: roll.severity, source: 'crew', ongoing: true }];
    setTroubles(updated);
    saveTroubles(campaignId, updated);
    setLogged(true);
  };

  const oc       = roll ? outcomeKey(roll) : null;
  const band     = heatBand(heat);

  return (
    <div className="te-step-body">
      <p className="te-step-intro">
        Roll a number of dice equal to your Wanted Level. Find the result in the column matching current Heat to determine crew trouble severity.
      </p>

      {/* Reference table */}
      <div className="te-crew-table">
        <div className="te-ct-header">
          <span />
          <span className={band === 'low'  ? 'te-ct-active-col' : ''}>Heat 0–3</span>
          <span className={band === 'mid'  ? 'te-ct-active-col' : ''}>Heat 4–5</span>
          <span className={band === 'high' ? 'te-ct-active-col' : ''}>Heat 6+</span>
        </div>
        {[['1–3','1-3'],['4/5','4-5'],['6','6'],['Crit','crit']].map(([display, key]) => (
          <div
            key={key}
            className={`te-ct-row${oc === key ? ' te-ct-active-row' : ''}`}
          >
            <span className="te-ct-roll">{display}</span>
            {['low','mid','high'].map((b) => {
              const sev   = CREW_TABLE[b][key];
              const isHit = oc === key && band === b;
              return (
                <span
                  key={b}
                  className={`te-ct-cell te-ct-${sev}${isHit ? ' te-ct-hit' : ''}`}
                >
                  {sev === 'none' ? '—' : sev === 'light' ? 'Light' : 'Heavy'}
                </span>
              );
            })}
          </div>
        ))}
      </div>

      {/* Steppers */}
      <div className="te-controls">
        <div className="te-control-row">
          <span className="te-label">Heat</span>
          <div className="te-stepper">
            <button className="te-step-btn" onClick={() => { setHeat((h) => Math.max(0, h - 1)); setRoll(null); }}>−</button>
            <span className="te-step-val">{heatLabel(heat)}</span>
            <button className="te-step-btn" onClick={() => { setHeat((h) => Math.min(9, h + 1)); setRoll(null); }}>+</button>
          </div>
        </div>
        <div className="te-control-row">
          <span className="te-label">Wanted Level</span>
          <div className="te-stepper">
            <button className="te-step-btn" onClick={() => { setWanted((w) => Math.max(0, w - 1)); setRoll(null); }}>−</button>
            <span className="te-step-val">{wanted === 0 ? '0 (2d, keep lowest)' : `${wanted}d`}</span>
            <button className="te-step-btn" onClick={() => { setWanted((w) => Math.min(6, w + 1)); setRoll(null); }}>+</button>
          </div>
        </div>
      </div>

      {limitError && (
        <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{limitError}</p>
      )}
      <button
        className={`te-roll-btn${phase === 'rolling' ? ' rolling' : ''}`}
        onClick={handleRoll}
        disabled={phase === 'rolling'}
      >
        <DiceSix size={15} />
        {phase === 'rolling' ? 'Rolling…' : 'Roll Crew Trouble'}
      </button>

      {/* Animated dice */}
      {shown.length > 0 && (
        <AnimatedDiceRow shown={shown} phase={phase} result={result} />
      )}

      {/* Result */}
      {roll && phase === 'settled' && (
        <div className={`te-result te-result-${roll.severity}`}>
          <div className="te-result-headline">
            {roll.severity === 'none'  && <><CheckCircle size={15} weight="fill" style={{ color: '#3da86b' }} /> No crew trouble this downtime.</>}
            {roll.severity === 'light' && <><Lightning   size={15} weight="fill" style={{ color: '#f59242' }} /> Light Trouble</>}
            {roll.severity === 'heavy' && <><Skull       size={15} weight="fill" style={{ color: '#e0617a' }} /> Heavy Trouble</>}
          </div>
          {roll.trouble && <div className="te-result-trouble">{roll.trouble}</div>}
          {roll.trouble && (
            <div className="te-result-actions">
              {!logged ? (
                <button className="te-log-btn" onClick={logTrouble}>
                  <ClockCounterClockwise size={13} /> Log &amp; track as ongoing
                </button>
              ) : (
                <span className="te-logged-note">
                  <CheckCircle size={13} weight="fill" /> Logged — clock created or advanced
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step 3: Local Trouble ─────────────────────────────────────────────────────

function StepLocalTrouble({ troubles, setTroubles, campaignId, clockWidgets, addWidget, updateWidgetData }) {
  const [mods,   setMods]   = useState({});
  const [logged, setLogged] = useState(false);
  const [roll,   setRoll]   = useState(null);

  const [limitError, setLimitError] = useState(null);
  const { phase, shown, result, roll: doRoll } = useDiceRoller();

  const modifier  = LOCAL_MODS.reduce((sum, m) => sum + (mods[m.key] ? m.delta : 0), 0);
  const diceCount = Math.max(1, 2 + modifier);

  const handleRoll = async () => {
    setLimitError(null);
    try {
      await recordUsage('trouble');
      invalidateAccountStatus();
    } catch (e) {
      setLimitError(e.message || 'Trouble limit reached.');
      return;
    }
    setRoll(null);
    setLogged(false);
    doRoll(diceCount);
  };

  useEffect(() => {
    if (phase !== 'settled' || !result) return;
    const oc = outcomeKey(result);
    let outcome;
    if (oc === 'crit') {
      outcome = { type: 'festival', label: 'Fortune smiles — a festival or good omen graces the area.' };
    } else if (oc === '6') {
      outcome = { type: 'none',    label: 'No local trouble this downtime.' };
    } else if (oc === '4-5') {
      outcome = { type: 'none',    label: 'Quiet — the area stays calm.' };
    } else {
      outcome = { type: 'light', trouble: randomFrom(LIGHT_TROUBLES), label: 'Light local trouble' };
    }
    setRoll({ ...result, oc, ...outcome });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result]);

  const toggleMod = (key) => { setMods((m) => ({ ...m, [key]: !m[key] })); setRoll(null); };

  const logTrouble = () => {
    if (!roll?.trouble) return;
    tickOrCreateClock(roll.trouble, 'light', campaignId, clockWidgets, addWidget, updateWidgetData);
    const updated = [...troubles, { id: uid(), name: roll.trouble, severity: 'light', source: 'local', ongoing: true }];
    setTroubles(updated);
    saveTroubles(campaignId, updated);
    setLogged(true);
  };

  return (
    <div className="te-step-body">
      <p className="te-step-intro">
        Roll the area's base 2d pool for local troubles from ordinary affairs. Situational factors adjust the dice count.
      </p>

      {/* Modifier toggles */}
      <div className="te-modifiers">
        <div className="te-mod-header">Situational Modifiers</div>
        {LOCAL_MODS.map((m) => {
          const active = !!mods[m.key];
          return (
            <button
              key={m.key}
              className={`te-mod-toggle${active ? ' active' : ''}`}
              onClick={() => toggleMod(m.key)}
            >
              <span className="te-mod-check">
                {active
                  ? <CheckCircle size={15} weight="fill" />
                  : <Circle      size={15} />}
              </span>
              <span className={`te-mod-delta ${m.delta > 0 ? 'pos' : 'neg'}`}>
                {m.delta > 0 ? '+1d' : '−1d'}
              </span>
              <span className="te-mod-label">{m.label}</span>
            </button>
          );
        })}
        <div className="te-mod-pool">
          Rolling <strong>{diceCount}d6</strong>, take highest
          {modifier !== 0 && (
            <span
              className="te-mod-adjustment"
              style={{ color: modifier > 0 ? '#3da86b' : '#e0617a' }}
            >
              {modifier > 0 ? ` (+${modifier}d from base 2)` : ` (${modifier}d from base 2)`}
            </span>
          )}
        </div>
      </div>

      {limitError && (
        <p style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 8 }}>{limitError}</p>
      )}
      <button
        className={`te-roll-btn${phase === 'rolling' ? ' rolling' : ''}`}
        onClick={handleRoll}
        disabled={phase === 'rolling'}
      >
        <DiceSix size={15} />
        {phase === 'rolling' ? 'Rolling…' : 'Roll Local Trouble'}
      </button>

      {shown.length > 0 && (
        <AnimatedDiceRow shown={shown} phase={phase} result={result} />
      )}

      {roll && phase === 'settled' && (
        <div className={`te-result te-result-${roll.type}`}>
          <div className="te-result-headline">
            {roll.type === 'festival' && <><Star    size={15} weight="fill" style={{ color: '#8b65c9' }} /> {roll.label}</>}
            {roll.type === 'none'     && <><CheckCircle size={15} weight="fill" style={{ color: '#3da86b' }} /> {roll.label}</>}
            {roll.type === 'light'    && <><Lightning size={15} weight="fill" style={{ color: '#f59242' }} /> {roll.label}</>}
          </div>
          {roll.trouble && <div className="te-result-trouble">{roll.trouble}</div>}
          {roll.trouble && (
            <div className="te-result-actions">
              {!logged ? (
                <button className="te-log-btn" onClick={logTrouble}>
                  <ClockCounterClockwise size={13} /> Log &amp; track as ongoing
                </button>
              ) : (
                <span className="te-logged-note">
                  <CheckCircle size={13} weight="fill" /> Logged — clock created or advanced
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Step 4: Escalations ───────────────────────────────────────────────────────

function StepEscalations({ troubles, setTroubles, campaignId }) {
  const ongoing   = troubles.filter((t) => t.ongoing);
  const diceCount = Math.max(1, Math.ceil(ongoing.length / 2));
  const [roll, setRoll] = useState(null);

  const { phase, shown, result, roll: doRoll } = useDiceRoller();

  const handleRoll = () => {
    if (ongoing.length === 0) return;
    setRoll(null);
    doRoll(diceCount);
  };

  useEffect(() => {
    if (phase !== 'settled' || !result) return;
    const oc    = outcomeKey(result);
    const count = oc === 'crit' ? 3 : oc === '6' ? 2 : oc === '4-5' ? 1 : 0;
    setRoll({ ...result, oc, count });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, result]);

  const resolve = (id) => {
    const updated = troubles.filter((t) => t.id !== id);
    setTroubles(updated);
    saveTroubles(campaignId, updated);
  };

  return (
    <div className="te-step-body">
      <p className="te-step-intro">
        Roll 1d per 2 ongoing troubles (rounded up). The result determines how many troubles escalate or worsen this downtime.
      </p>

      {/* Ongoing list */}
      {ongoing.length === 0 ? (
        <div className="te-step-empty">
          <CheckCircle size={28} weight="thin" style={{ opacity: 0.4, marginBottom: 8 }} />
          No ongoing troubles — skip this step.
        </div>
      ) : (
        <div className="te-troubles-list">
          {ongoing.map((t) => (
            <div key={t.id} className={`te-trouble-item te-trouble-${t.severity}`}>
              <span className={`te-sev-pip te-sev-${t.severity}`} />
              <span className="te-trouble-name">{t.name}</span>
              <span className="te-trouble-src">({t.source})</span>
              <button
                className="te-resolve-btn"
                onClick={() => resolve(t.id)}
                title="Mark resolved"
              >
                <Check size={11} weight="bold" /> Resolve
              </button>
            </div>
          ))}
        </div>
      )}

      {ongoing.length > 0 && (
        <>
          <div className="te-roll-info">
            {ongoing.length} ongoing → roll <strong>{diceCount}d6</strong>
          </div>
          <button
            className={`te-roll-btn${phase === 'rolling' ? ' rolling' : ''}`}
            onClick={handleRoll}
            disabled={phase === 'rolling'}
          >
            <DiceSix size={15} />
            {phase === 'rolling' ? 'Rolling…' : 'Roll Escalations'}
          </button>

          {shown.length > 0 && (
            <AnimatedDiceRow shown={shown} phase={phase} result={result} />
          )}

          {roll && phase === 'settled' && (
            <div className={`te-result te-result-${roll.count > 0 ? (roll.count >= 3 ? 'heavy' : 'light') : 'none'}`}>
              <div className="te-result-headline">
                {roll.count === 0 && <><CheckCircle size={15} weight="fill" style={{ color: '#3da86b' }} /> No escalations — troubles hold steady.</>}
                {roll.count === 1 && <><ArrowFatUp  size={15} weight="fill" style={{ color: '#f59242' }} /> 1 escalation — worsen one ongoing trouble.</>}
                {roll.count === 2 && <><ArrowFatUp  size={15} weight="fill" style={{ color: '#f59242' }} /> 2 escalations — worsen two troubles.</>}
                {roll.count === 3 && <><Skull       size={15} weight="fill" style={{ color: '#e0617a' }} /> 3 escalations — serious worsening across the board.</>}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

const STEPS = [
  { id: 'clocks',      label: 'Faction Clocks', num: 1 },
  { id: 'crew',        label: 'Crew Trouble',   num: 2 },
  { id: 'local',       label: 'Local Trouble',  num: 3 },
  { id: 'escalations', label: 'Escalations',    num: 4 },
];

export default function TroubleEngineModal({ onClose }) {
  const campaignId     = useCampaignStore((s) => s.activeCampaignId);
  const allNodes       = useNodeStore((s) => s.nodes);
  const widgets        = useWidgetStore((s) => s.widgets);
  const addWidget      = useWidgetStore((s) => s.addWidget);
  const updateWidgetData = useWidgetStore((s) => s.updateWidgetData);

  const clockWidgets = widgets.filter((w) => w.campaignId === campaignId && w.type === 'clock-widget');

  const [step,     setStep]     = useState(0);
  const [troubles, setTroubles] = useState([]);

  useEffect(() => {
    loadTroubles(campaignId).then(setTroubles);
  }, [campaignId]);

  const sharedProps = { troubles, setTroubles, campaignId, clockWidgets, addWidget, updateWidgetData };

  return (
    <div
      className="modal-overlay"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="te-modal">

        {/* Header */}
        <div className="te-header">
          <div className="te-title">
            <Warning size={14} weight="fill" style={{ color: 'var(--accent)', marginRight: 6 }} />
            Trouble Engine
          </div>
          <button className="btn-icon te-close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {/* Step tabs */}
        <div className="te-steps">
          {STEPS.map((s, i) => (
            <button
              key={s.id}
              className={`te-step-tab${step === i ? ' active' : ''}${i < step ? ' done' : ''}`}
              onClick={() => setStep(i)}
            >
              <span className="te-step-num">
                {i < step
                  ? <Check size={10} weight="bold" />
                  : s.num}
              </span>
              <span className="te-step-name">{s.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="te-content">
          {step === 0 && (
            <StepFactionClocks
              campaignId={campaignId}
              allNodes={allNodes}
              clockWidgets={clockWidgets}
              addWidget={addWidget}
              updateWidgetData={updateWidgetData}
            />
          )}
          {step === 1 && <StepCrewTrouble   {...sharedProps} />}
          {step === 2 && <StepLocalTrouble  {...sharedProps} />}
          {step === 3 && <StepEscalations   {...sharedProps} />}
        </div>

        {/* Footer */}
        <div className="te-footer">
          <button
            className="te-nav-btn"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            <CaretLeft size={13} /> Back
          </button>
          <span className="te-step-indicator">{step + 1} / {STEPS.length}</span>
          {step < STEPS.length - 1 ? (
            <button
              className="te-nav-btn te-nav-primary"
              onClick={() => setStep((s) => s + 1)}
            >
              Next <CaretRight size={13} />
            </button>
          ) : (
            <button className="te-nav-btn te-nav-primary" onClick={onClose}>
              Done
            </button>
          )}
        </div>

      </div>
    </div>
  );
}
