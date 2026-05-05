/**
 * LandingPage — shown before login/signup.
 * Sells Flux Atlas features, ends with a plan comparison table.
 * onGetStarted(mode) — called with 'signup' or 'login'
 */

import { useRef, useEffect } from 'react';
import TopoBackground from '../common/TopoBackground';
import {
  MapTrifold, Lightning, Timer, ClockCounterClockwise,
  ArrowRight, Check, X as XIcon, Sparkle,
} from '@phosphor-icons/react';

// ── Node type decorators shown in hero ────────────────────────────────────────

const NODE_CHIPS = [
  { label: 'Location',  color: '#6db3ff', x: '8%',  y: '28%', delay: 0    },
  { label: 'Character', color: '#c48dff', x: '88%', y: '22%', delay: 0.4  },
  { label: 'Faction',   color: '#ff9f43', x: '82%', y: '62%', delay: 0.8  },
  { label: 'Event',     color: '#ff7b7b', x: '12%', y: '68%', delay: 1.2  },
  { label: 'Polity',    color: '#e879a8', x: '78%', y: '42%', delay: 0.6  },
  { label: 'Religion',  color: '#fbbf24', x: '14%', y: '46%', delay: 1.0  },
];

const FEATURES = [
  {
    icon: MapTrifold,
    title: 'Living Map Canvas',
    color: '#6db3ff',
    body: 'Drag and place characters, locations, factions, and events directly on a custom map. Draw territories, connect nodes with typed relationships, and see your whole world at a glance.',
  },
  {
    icon: Lightning,
    title: 'Trouble Engine',
    color: '#ff7b7b',
    body: 'Run downtime between sessions with structured dice workflows. Roll crew trouble, advance faction clocks, track local tensions, and watch escalations compound across your campaign.',
  },
  {
    icon: Timer,
    title: 'Flux System',
    color: '#ff9248',
    body: 'Advance time and watch your world evolve. Generate scenario proposals across months or years — factions rise, characters age, and dormant threats resurface on their own timeline.',
  },
  {
    icon: ClockCounterClockwise,
    title: 'World Snapshots',
    color: '#5aeea0',
    body: 'Save your campaign state at any moment. Name it, annotate it, and restore or branch from it later. Full timeline history so nothing is ever truly lost.',
  },
];

// ── Plan data ─────────────────────────────────────────────────────────────────

const PLAN_ROWS = [
  { label: 'Campaigns',              free: '2',             pro: 'Unlimited'     },
  { label: 'Nodes',                  free: '100',           pro: 'Unlimited'     },
  { label: 'Storage',                free: '100 MB',        pro: '2 GB'          },
  { label: 'Custom Node Types',      free: '5',             pro: 'Unlimited'     },
  { label: 'Trouble Engine',         free: '10 rolls / mo', pro: 'Unlimited'     },
  { label: 'Flux System',            free: '10 uses / mo',  pro: 'Unlimited'     },
  { label: 'World History',          free: 'Last 25',       pro: 'Full history'  },
  { label: 'Restore from History',   free: false,           pro: true            },
  { label: 'Priority support',       free: false,           pro: true            },
];

// ── PlanCell ──────────────────────────────────────────────────────────────────

function PlanCell({ value }) {
  if (value === true)  return <span className="lp-plan-check"><Check size={14} weight="bold" /></span>;
  if (value === false) return <span className="lp-plan-x"><XIcon size={13} weight="bold" /></span>;
  return <span className="lp-plan-val">{value}</span>;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function LandingPage({ onGetStarted }) {
  const heroRef = useRef(null);

  // Parallax tilt on the hero node chips
  useEffect(() => {
    const hero = heroRef.current;
    if (!hero) return;
    const move = (e) => {
      const { left, top, width, height } = hero.getBoundingClientRect();
      const dx = (e.clientX - left - width  / 2) / width;
      const dy = (e.clientY - top  - height / 2) / height;
      hero.querySelectorAll('.lp-chip').forEach((el, i) => {
        const depth = 0.6 + (i % 3) * 0.3;
        el.style.transform = `translate(${dx * 18 * depth}px, ${dy * 12 * depth}px)`;
      });
    };
    hero.addEventListener('mousemove', move);
    return () => hero.removeEventListener('mousemove', move);
  }, []);

  return (
    <div className="lp-root">

      {/* ── Hero ── */}
      <section className="lp-hero" ref={heroRef}>
        <TopoBackground opacity={0.7} style={{ position: 'absolute', inset: 0 }} />

        {/* Ambient glow orbs */}
        <div className="lp-orb lp-orb-a" />
        <div className="lp-orb lp-orb-b" />

        {/* Floating node type chips */}
        {NODE_CHIPS.map((chip) => (
          <div
            key={chip.label}
            className="lp-chip"
            style={{ left: chip.x, top: chip.y, '--chip-color': chip.color, '--chip-delay': `${chip.delay}s` }}
          >
            <span className="lp-chip-dot" />
            {chip.label}
          </div>
        ))}

        {/* Hero content */}
        <div className="lp-hero-content">
          <img
            src="/logo/splash.svg"
            alt="Flux Atlas"
            className="lp-hero-logo"
          />
          <p className="lp-hero-sub">Campaign World Manager</p>
          <h1 className="lp-hero-headline">
            Your campaign world,<br />
            <span className="lp-headline-accent">alive.</span>
          </h1>
          <p className="lp-hero-body">
            Map it. Connect it. Watch it evolve.
          </p>
          <div className="lp-hero-ctas">
            <button className="lp-cta-primary" onClick={() => onGetStarted('signup')}>
              <Sparkle size={16} weight="fill" />
              Create free account
            </button>
            <button className="lp-cta-ghost" onClick={() => onGetStarted('login')}>
              Sign in
              <ArrowRight size={15} />
            </button>
          </div>
          <p className="lp-hero-fine">Free forever. No credit card required.</p>
        </div>

        <div className="lp-hero-scroll-hint">
          <span />
        </div>
      </section>

      {/* ── Features ── */}
      <section className="lp-features">
        <div className="lp-section-inner">
          <p className="lp-section-eyebrow">What's inside</p>
          <h2 className="lp-section-heading">Everything your world needs</h2>
          <p className="lp-section-sub">
            Built for tabletop campaigns — from a single session to a decade-long saga.
          </p>

          <div className="lp-feature-grid">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div className="lp-feature-card" key={f.title} style={{ '--feat-color': f.color }}>
                  <div className="lp-feat-icon">
                    <Icon size={22} weight="fill" />
                  </div>
                  <h3 className="lp-feat-title">{f.title}</h3>
                  <p className="lp-feat-body">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Plan Comparison ── */}
      <section className="lp-plans">
        <div className="lp-section-inner">
          <p className="lp-section-eyebrow">Pricing</p>
          <h2 className="lp-section-heading">Start free. Grow when you're ready.</h2>
          <p className="lp-section-sub">
            Paid plans are on the way. For now, everything you need is free.
          </p>

          <div className="lp-plan-table-wrap">
            <table className="lp-plan-table">
              <thead>
                <tr>
                  <th className="lp-plan-th-label" />
                  <th className="lp-plan-th">
                    <div className="lp-plan-col-head">
                      <span className="lp-plan-name">Free</span>
                      <span className="lp-plan-price">$0 <span className="lp-plan-period">/ mo</span></span>
                      <button className="lp-cta-primary lp-cta-sm" onClick={() => onGetStarted('signup')}>
                        Get started
                      </button>
                    </div>
                  </th>
                  <th className="lp-plan-th lp-plan-th-pro">
                    <div className="lp-plan-col-head">
                      <span className="lp-plan-badge">Coming soon</span>
                      <span className="lp-plan-name">Pro</span>
                      <span className="lp-plan-price lp-plan-price-dim">— <span className="lp-plan-period">TBD</span></span>
                      <button className="lp-cta-pro-disabled" disabled>
                        Notify me
                      </button>
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {PLAN_ROWS.map((row, i) => (
                  <tr key={row.label} className={i % 2 === 0 ? 'lp-row-even' : ''}>
                    <td className="lp-plan-row-label">{row.label}</td>
                    <td className="lp-plan-row-val"><PlanCell value={row.free} /></td>
                    <td className="lp-plan-row-val lp-plan-row-pro"><PlanCell value={row.pro} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ── Footer CTA ── */}
      <section className="lp-footer-cta">
        <TopoBackground opacity={0.45} style={{ position: 'absolute', inset: 0 }} />
        <div className="lp-orb lp-orb-c" />
        <div className="lp-footer-inner">
          <h2 className="lp-footer-heading">Ready to build your world?</h2>
          <p className="lp-footer-sub">Free to start. No credit card. No time limit.</p>
          <div className="lp-hero-ctas">
            <button className="lp-cta-primary lp-cta-lg" onClick={() => onGetStarted('signup')}>
              <Sparkle size={17} weight="fill" />
              Create your free account
            </button>
            <button className="lp-cta-ghost" onClick={() => onGetStarted('login')}>
              Already have an account?
              <ArrowRight size={15} />
            </button>
          </div>
        </div>
      </section>

    </div>
  );
}
