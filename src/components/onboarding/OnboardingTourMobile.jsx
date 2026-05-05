import { useState, useEffect, useCallback } from 'react';
import {
  X, ArrowRight, Check,
  MapTrifold, Kanban, Cards, GearSix, Note,
  Camera, Tag, ArrowsLeftRight,
} from '@phosphor-icons/react';

const STORAGE_KEY = 'flux_onboarding_seen';

// ── Mobile step definitions ────────────────────────────────────────────────────
// No coach-marks here — bottom sheet slides with icons that match the UI

const STEPS = [
  {
    id: 'welcome',
    icon: MapTrifold,
    title: 'Welcome to Flux Atlas',
    body: "Your campaign world, all in one place. Let's take a quick tour of the mobile views so you know where everything is.",
  },
  {
    id: 'map',
    icon: MapTrifold,
    title: 'Map View',
    body: 'Tap the Map tab to see your world canvas. Pinch to zoom, drag to pan. Nodes appear as markers — tap one to view its details.',
  },
  {
    id: 'board',
    icon: Kanban,
    title: 'Board View',
    body: 'The Board tab gives you a Kanban-style view of your nodes grouped by type. Great for session prep and tracking active threads.',
  },
  {
    id: 'nodes',
    icon: Cards,
    title: 'Node Browser',
    body: 'The Nodes tab lists every character, location, faction, event, and more. Tap any card to open its full detail — fields, tags, and connections.',
  },
  {
    id: 'tags',
    icon: Tag,
    title: 'Tags & Connections',
    body: 'Inside a node, color-coded tags help you organize at a glance. Node refs let you link characters to factions, locations to events.',
  },
  {
    id: 'widgets',
    icon: Note,
    title: 'Widgets on the Map',
    body: 'On desktop, widgets float on the canvas — sticky notes, trackers, clocks, and more. On mobile they\'re visible but best managed from a larger screen.',
  },
  {
    id: 'snapshots',
    icon: Camera,
    title: 'Snapshots & History',
    body: 'Flux Atlas auto-saves rolling snapshots of your world so you can always roll back. Access them via Settings → History on desktop.',
  },
  {
    id: 'settings',
    icon: GearSix,
    title: 'Settings',
    body: "The Settings tab lets you manage your campaign, import nodes from markdown, and access your account. You can relaunch this tour from Settings → Account anytime.",
    isLast: true,
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function OnboardingTourMobile() {
  const [visible, setVisible] = useState(false);
  const [step,    setStep]    = useState(0);

  // Show automatically for first-time users
  useEffect(() => {
    if (!localStorage.getItem(STORAGE_KEY)) {
      const t = setTimeout(() => { setVisible(true); setStep(0); }, 600);
      return () => clearTimeout(t);
    }
  }, []);

  // Listen for manual launch
  useEffect(() => {
    const handler = () => { setStep(0); setVisible(true); };
    window.addEventListener('flux:startTour', handler);
    return () => window.removeEventListener('flux:startTour', handler);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    localStorage.setItem(STORAGE_KEY, '1');
  }, []);

  const goNext = useCallback(() => {
    const s = STEPS[step];
    if (s?.isLast) { close(); return; }
    setStep((p) => Math.min(STEPS.length - 1, p + 1));
  }, [step, close]);

  // Swipe right to advance (simple touch handler)
  useEffect(() => {
    if (!visible) return;
    let startX = 0;
    const onStart = (e) => { startX = e.touches[0].clientX; };
    const onEnd   = (e) => {
      const dx = e.changedTouches[0].clientX - startX;
      if (dx < -50) goNext();
      if (dx > 50)  setStep((p) => Math.max(0, p - 1));
    };
    document.addEventListener('touchstart', onStart, { passive: true });
    document.addEventListener('touchend',   onEnd,   { passive: true });
    return () => {
      document.removeEventListener('touchstart', onStart);
      document.removeEventListener('touchend',   onEnd);
    };
  }, [visible, goNext]);

  if (!visible) return null;

  const current = STEPS[step];
  const StepIcon = current.icon;

  return (
    <div className="tour-mobile-overlay" onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="tour-mobile-sheet">
        {/* Progress pips */}
        <div className="tour-mobile-pip-row">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`tour-mobile-pip${i === step ? ' active' : ''}`}
              onClick={() => setStep(i)}
            />
          ))}
        </div>

        {/* Icon */}
        <div className="tour-mobile-icon">
          <StepIcon size={22} weight="duotone" />
        </div>

        {/* Content */}
        <div className="tour-mobile-title">{current.title}</div>
        <div className="tour-mobile-body">{current.body}</div>

        {/* Footer */}
        <div className="tour-mobile-footer">
          <button className="tour-mobile-skip" onClick={close}>
            {current.isLast ? '' : 'Skip tour'}
          </button>
          <div className="tour-mobile-nav">
            {step > 0 && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setStep((p) => Math.max(0, p - 1))}
              >
                Back
              </button>
            )}
            <button
              className={`btn btn-sm ${current.isLast ? 'btn-primary' : 'btn-secondary'}`}
              onClick={goNext}
            >
              {current.isLast
                ? <><Check size={14} /> Done</>
                : <><span>Next</span><ArrowRight size={14} /></>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
