import { useState, useEffect, useCallback, useRef } from 'react';
import { X, ArrowLeft, ArrowRight, Check, ChartBar } from '@phosphor-icons/react';
import useSettingsStore from '../../stores/settingsStore';
import useWidgetStore from '../../stores/widgetStore';
import useCampaignStore from '../../stores/campaignStore';
import useViewportStore from '../../stores/viewportStore';

const STORAGE_KEY = 'flux_onboarding_seen';

// ── Step definitions ───────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Flux Atlas',
    body: "Your campaign world, all in one place — a living map of characters, factions, locations, and events. Let's take a quick tour so you know where everything is.",
    target: null,
    position: 'center',
  },
  {
    id: 'canvas',
    title: 'The Campaign Canvas',
    body: 'This is your map. Drag to pan, scroll to zoom. Nodes appear here as markers you can place and move freely across the world.',
    target: '[data-tour="canvas"]',
    position: 'center-in',
  },
  {
    id: 'split-view',
    title: 'Split View',
    body: 'Toggle between full-canvas mode and split view — map on the left, node browser on the right. Hit the button below to enable it.',
    target: '[data-tour="split-toggle"]',
    position: 'above',
    action: { label: 'Enable Split View', type: 'split' },
  },
  {
    id: 'panel',
    title: 'The Node Panel',
    body: 'Browse every character, location, faction, event, and more. Click any card to open its detail view and fill in fields, tags, and linked nodes.',
    target: '[data-tour="card-panel"]',
    position: 'left',
  },
  {
    id: 'nodes',
    title: 'Placing Nodes',
    body: 'Pick a node type from the toolbar palette, then click anywhere on the canvas to drop it. Spatial nodes live on the map; abstract types (concepts, items, timelines) stay in the panel.',
    target: '[data-tour="node-palette"]',
    position: 'below',
  },
  {
    id: 'tags',
    title: 'Tags & Connections',
    body: 'Color-coded tags help you organize at a glance. Node refs let you link characters to factions, locations to events — building a web of relationships across your world.',
    target: '[data-tour="card-panel"]',
    position: 'left',
  },
  {
    id: 'widgets',
    title: 'Canvas Widgets',
    body: 'Widgets float on the canvas — sticky notes, progress trackers, clocks, and more. Great for session prep and live tracking. Try adding one now.',
    target: '[data-tour="widget-btn"]',
    position: 'below-left',
    action: { label: 'Add a Linear Tracker', type: 'widget' },
  },
  {
    id: 'snapshots',
    title: 'Snapshots & History',
    body: 'Flux Atlas auto-saves rolling snapshots of your world so you can always roll back. Take manual snapshots before big changes. Access them via Game Tools → History.',
    target: '[data-tour="history-btn"]',
    position: 'below-left',
  },
  {
    id: 'settings',
    title: 'More in Settings',
    body: "Customize node types, field schemas, layout, themes, and more. Import your world from markdown. Relaunch this tour anytime from Settings → Account. You're all set!",
    target: '[data-tour="settings-btn"]',
    position: 'below-left',
    isLast: true,
  },
];

// ── Positioning ────────────────────────────────────────────────────────────────

const CARD_W   = 320;
const CARD_GAP = 14;
const MARGIN   = 16;

function clampX(x) { return Math.max(MARGIN, Math.min(window.innerWidth  - CARD_W - MARGIN, x)); }
function clampY(y) { return Math.max(MARGIN, Math.min(window.innerHeight - 260    - MARGIN, y)); }

function computeCardStyle(target, position) {
  if (!target || position === 'center' || position === 'center-in') {
    return { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
  }

  const el = document.querySelector(target);
  if (!el) return { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };

  const r  = el.getBoundingClientRect();
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  switch (position) {
    case 'below':
      return { top: r.bottom + CARD_GAP, left: clampX(r.left + r.width / 2 - CARD_W / 2) };
    case 'below-left':
      return { top: r.bottom + CARD_GAP, left: clampX(r.right - CARD_W) };
    case 'above':
      return { bottom: vh - r.top + CARD_GAP, left: clampX(r.left + r.width / 2 - CARD_W / 2) };
    case 'left':
      return { top: clampY(r.top + r.height / 2 - 130), right: vw - r.left + CARD_GAP };
    case 'right':
      return { top: clampY(r.top + r.height / 2 - 130), left: r.right + CARD_GAP };
    default:
      return { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };
  }
}

function computeHighlight(target, position) {
  if (!target || position === 'center' || position === 'center-in') return null;
  const el = document.querySelector(target);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { top: r.top - 4, left: r.left - 4, width: r.width + 8, height: r.height + 8 };
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingTour() {
  const [visible,  setVisible]  = useState(false);
  const [step,     setStep]     = useState(0);
  const [cardPos,  setCardPos]  = useState({});
  const [hlPos,    setHlPos]    = useState(null);
  const [actionDone, setActionDone] = useState(false);

  const campaignId = useCampaignStore((s) => s.activeCampaignId);

  // ── Show automatically for first-time users ────────────────────────────────
  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      // Small delay so workspace fully mounts first
      const t = setTimeout(() => { setVisible(true); setStep(0); }, 800);
      return () => clearTimeout(t);
    }
  }, []);

  // ── Listen for manual launch event ────────────────────────────────────────
  useEffect(() => {
    const handler = () => { setStep(0); setActionDone(false); setVisible(true); };
    window.addEventListener('flux:startTour', handler);
    return () => window.removeEventListener('flux:startTour', handler);
  }, []);

  // ── Recompute card/highlight positions ────────────────────────────────────
  const recompute = useCallback(() => {
    const s = STEPS[step];
    if (!s) return;
    setCardPos(computeCardStyle(s.target, s.position));
    setHlPos(computeHighlight(s.target, s.position));
  }, [step]);

  useEffect(() => {
    if (!visible) return;
    // slight delay for DOM to settle (e.g. split view appearing)
    const t = setTimeout(recompute, 80);
    window.addEventListener('resize', recompute);
    return () => { clearTimeout(t); window.removeEventListener('resize', recompute); };
  }, [visible, step, recompute]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const close = useCallback(() => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
  }, []);

  const goNext = useCallback(() => {
    const s = STEPS[step];
    if (s?.isLast) { close(); return; }
    setActionDone(false);
    setStep((p) => Math.min(STEPS.length - 1, p + 1));
  }, [step, close]);

  const goPrev = useCallback(() => {
    setActionDone(false);
    setStep((p) => Math.max(0, p - 1));
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    const handler = (e) => {
      if (e.key === 'Escape')     close();
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft')  goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible, close, goNext, goPrev]);

  // ── Action handlers ────────────────────────────────────────────────────────
  const handleAction = useCallback(() => {
    const s = STEPS[step];
    if (!s?.action) return;

    if (s.action.type === 'split') {
      const { setSetting } = useSettingsStore.getState();
      if (campaignId) setSetting(campaignId, 'layout', 'split');
      setActionDone(true);
      // Advance after a tick so the panel has time to appear
      setTimeout(goNext, 300);
    }

    if (s.action.type === 'widget') {
      const { addWidget } = useWidgetStore.getState();
      const viewport = useViewportStore.getState();
      if (campaignId) addWidget(campaignId, 'linear-tracker', viewport);
      setActionDone(true);
      setTimeout(goNext, 300);
    }
  }, [step, campaignId, goNext]);

  if (!visible) return null;

  const current = STEPS[step];

  return (
    <>
      {/* Dim overlay — doesn't block clicks */}
      <div className="tour-backdrop" />

      {/* Highlight ring around target element */}
      {hlPos && (
        <div
          className="tour-highlight"
          style={{ top: hlPos.top, left: hlPos.left, width: hlPos.width, height: hlPos.height }}
        />
      )}

      {/* Tour card */}
      <div className="tour-card" style={{ ...cardPos }}>
        {/* Header */}
        <div className="tour-card-header">
          <span className="tour-card-title">{current.title}</span>
          <button className="btn-icon tour-card-close" onClick={close} title="Skip tour">
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <p className="tour-card-body">{current.body}</p>

        {/* Optional action button */}
        {current.action && !actionDone && (
          <button className="btn btn-secondary btn-sm tour-action-btn" onClick={handleAction}>
            {current.action.label}
          </button>
        )}

        {/* Footer nav */}
        <div className="tour-card-footer">
          <span className="tour-progress">{step + 1} / {STEPS.length}</span>

          <button
            className="btn btn-ghost btn-sm tour-skip-link"
            onClick={close}
          >
            Skip
          </button>

          {step > 0 && (
            <button className="btn btn-secondary btn-sm" onClick={goPrev}>
              <ArrowLeft size={12} /> Prev
            </button>
          )}

          <button
            className={`btn btn-sm ${current.isLast ? 'btn-primary' : 'btn-secondary'}`}
            onClick={goNext}
          >
            {current.isLast
              ? <><Check size={12} /> Done</>
              : <><span>Next</span><ArrowRight size={12} /></>
            }
          </button>
        </div>
      </div>
    </>
  );
}
