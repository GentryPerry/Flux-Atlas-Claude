/**
 * UpgradePage — placeholder shown at /account/upgrade.
 * No payment intake in Phase 1.
 */

import { Sparkle, Lightning, Timer, ClockCounterClockwise, Check } from '@phosphor-icons/react';

const COMING_FEATURES = [
  { icon: Sparkle,               text: 'Unlimited campaigns and nodes'            },
  { icon: Lightning,             text: 'Unlimited Trouble Engine rolls per month' },
  { icon: Timer,                 text: 'Unlimited Flux System uses per month'     },
  { icon: ClockCounterClockwise, text: 'Full board history with restore'          },
  { icon: Check,                 text: '2 GB storage'                             },
  { icon: Check,                 text: 'Unlimited custom node types'              },
];

export default function UpgradePage({ onClose }) {
  return (
    <div className="upgrade-page">
      <div className="upgrade-card">

        <div className="upgrade-badge">Coming Soon</div>

        <h2 className="upgrade-heading">Flux Atlas Pro</h2>
        <p className="upgrade-sub">
          Upgrade options are on the way. Future paid plans will unlock everything
          you need to run campaigns without limits.
        </p>

        <ul className="upgrade-features">
          {COMING_FEATURES.map(({ icon: Icon, text }) => (
            <li key={text} className="upgrade-feature-row">
              <Icon size={15} weight="fill" style={{ color: 'var(--accent)', flexShrink: 0 }} />
              {text}
            </li>
          ))}
        </ul>

        <p className="upgrade-fine">
          No card entry or checkout is available yet. Check back soon.
        </p>

        {onClose && (
          <button className="btn btn-secondary" style={{ marginTop: 8, width: '100%' }} onClick={onClose}>
            Back to settings
          </button>
        )}

      </div>
    </div>
  );
}
