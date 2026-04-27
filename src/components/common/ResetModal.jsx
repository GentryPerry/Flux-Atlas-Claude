import { useState, useRef, useEffect } from 'react';
import { Warning, Trash } from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useTagStore from '../../stores/tagStore';
import useHierarchyStore from '../../stores/hierarchyStore';
import useTerritoryStore from '../../stores/territoryStore';
import useCampaignStore from '../../stores/campaignStore';

const CONFIRM_WORD = 'RESET';

/**
 * Hidden nuclear-option modal — triggered by Ctrl+Shift+Backspace.
 * Wipes all nodes, tags, hierarchies, and territories for the active campaign
 * while preserving maps (and their background images).
 */
export default function ResetModal({ onClose }) {
  const [input, setInput]   = useState('');
  const inputRef            = useRef(null);
  const campaignId          = useCampaignStore((s) => s.activeCampaignId);
  const clearNodes          = useNodeStore((s) => s.clearCampaign);
  const clearTags           = useTagStore((s) => s.clearCampaign);
  const clearHierarchies    = useHierarchyStore((s) => s.clearCampaign);
  const clearTerritories    = useTerritoryStore((s) => s.clearCampaign);

  useEffect(() => { inputRef.current?.focus(); }, []);

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const ready = input.trim() === CONFIRM_WORD;

  const handleReset = () => {
    if (!ready) return;
    clearNodes(campaignId);
    clearTags(campaignId);
    clearHierarchies(campaignId);
    clearTerritories(campaignId);
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: 'var(--bg-panel)',
        border: '1px solid var(--border-strong)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px 32px',
        width: 400,
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <Warning size={22} weight="fill" color="#ef4444" />
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
            Reset Campaign Data
          </span>
        </div>

        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.6 }}>
          This will permanently delete <strong style={{ color: 'var(--text-primary)' }}>all nodes, tags, territories, and hierarchies</strong> for this campaign.
        </p>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
          Your maps and their background images are kept. This cannot be undone.
        </p>

        <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
          Type <strong style={{ color: '#ef4444', letterSpacing: '0.06em' }}>{CONFIRM_WORD}</strong> to confirm
        </label>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleReset(); }}
          placeholder={CONFIRM_WORD}
          style={{
            width: '100%',
            marginBottom: 16,
            fontFamily: 'monospace',
            letterSpacing: '0.06em',
            borderColor: ready ? '#ef4444' : undefined,
          }}
        />

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-danger btn-sm"
            disabled={!ready}
            onClick={handleReset}
            style={{ gap: 6, opacity: ready ? 1 : 0.4 }}
          >
            <Trash size={13} /> Wipe All Data
          </button>
        </div>
      </div>
    </div>
  );
}
