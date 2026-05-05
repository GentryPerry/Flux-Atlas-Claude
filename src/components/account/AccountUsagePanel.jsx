/**
 * AccountUsagePanel — shows the current user's plan, usage bars, and limits.
 * Designed to slot into SettingsPanel as a new "Account" category.
 */

import { ArrowSquareOut, Sparkle, Crown } from '@phosphor-icons/react';
import useAccountStatus from '../../hooks/useAccountStatus';
import { formatBytes, usageFraction, usageColor, usageLabel } from '../../utils/entitlements';

// ── UsageBar ─────────────────────────────────────────────────────────────────

function UsageBar({ label, used, limit, formatFn }) {
  const frac  = usageFraction(used, limit);
  const color = usageColor(frac);
  const isUnlimited = limit === null || limit === undefined;

  return (
    <div className="aup-row">
      <div className="aup-row-header">
        <span className="aup-row-label">{label}</span>
        <span className="aup-row-value" style={{ color: frac >= 1 ? color : undefined }}>
          {isUnlimited
            ? (formatFn ? formatFn(used) : used)
            : formatFn
              ? `${formatFn(used)} / ${formatFn(limit)}`
              : usageLabel(used, limit)
          }
          {isUnlimited && <span className="aup-unlimited-tag">Unlimited</span>}
        </span>
      </div>
      {!isUnlimited && (
        <div className="aup-bar-track">
          <div
            className="aup-bar-fill"
            style={{ width: `${frac * 100}%`, background: color }}
          />
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AccountUsagePanel() {
  const { status, loading, error, refresh } = useAccountStatus();

  if (loading) {
    return (
      <div className="aup-root">
        <div className="aup-loading">Loading account info…</div>
      </div>
    );
  }

  if (error || !status) {
    return (
      <div className="aup-root">
        <div className="aup-error">
          Could not load account status.{' '}
          <button className="aup-retry" onClick={refresh}>Retry</button>
        </div>
      </div>
    );
  }

  const { plan, usage } = status;
  const isFree  = plan.key === 'free';
  const isPro   = plan.key === 'pro';

  const periodEnd = usage.troubleGenerations.periodEnd
    ? new Date(usage.troubleGenerations.periodEnd).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    : null;

  return (
    <div className="aup-root">

      {/* Plan badge */}
      <div className="aup-plan-card">
        <div className="aup-plan-info">
          <span className="aup-plan-icon">
            {isPro ? <Crown size={16} weight="fill" /> : <Sparkle size={16} weight="fill" />}
          </span>
          <div>
            <div className="aup-plan-name">{plan.name} Plan</div>
            <div className="aup-plan-status">{plan.status}</div>
          </div>
        </div>
        {isFree && (
          <a href="/account/upgrade" className="aup-upgrade-link">
            Upgrade options coming soon
            <ArrowSquareOut size={12} />
          </a>
        )}
      </div>

      {/* Usage rows */}
      <div className="aup-section">
        <div className="aup-section-title">Usage</div>

        <UsageBar
          label="Campaigns"
          used={usage.campaigns.used}
          limit={usage.campaigns.limit}
        />
        <UsageBar
          label="Nodes"
          used={usage.nodes.used}
          limit={usage.nodes.limit}
        />
        <UsageBar
          label="Storage"
          used={usage.storage.usedBytes}
          limit={usage.storage.limitBytes}
          formatFn={formatBytes}
        />
        <UsageBar
          label="Custom Node Types"
          used={usage.customNodeTypes.used}
          limit={usage.customNodeTypes.limit}
        />
      </div>

      {/* Monthly usage */}
      <div className="aup-section">
        <div className="aup-section-title">
          Monthly Usage
          {periodEnd && <span className="aup-period-end">resets {periodEnd}</span>}
        </div>

        <UsageBar
          label="Trouble Engine"
          used={usage.troubleGenerations.used}
          limit={usage.troubleGenerations.limit}
        />
        <UsageBar
          label="Flux System"
          used={usage.fluxGenerations.used}
          limit={usage.fluxGenerations.limit}
        />
      </div>

      {/* Board history */}
      <div className="aup-section">
        <div className="aup-section-title">Board History</div>
        <div className="aup-history-row">
          <span className="aup-row-label">Visible snapshots</span>
          <span className="aup-row-value">
            {usage.boardHistory.visibleEntries === null
              ? 'Unlimited'
              : `Last ${usage.boardHistory.visibleEntries}`}
          </span>
        </div>
        <div className="aup-history-row">
          <span className="aup-row-label">Restore from history</span>
          <span className="aup-row-value" style={{ color: usage.boardHistory.canRestore ? 'var(--success)' : 'var(--text-muted)' }}>
            {usage.boardHistory.canRestore ? 'Enabled' : 'Not available on Free plan'}
          </span>
        </div>
      </div>

    </div>
  );
}
