import { useState, useEffect, useCallback } from 'react';
import { X, Copy, Check, UserCircle, UserCircleCheck, Trash } from '@phosphor-icons/react';
import {
  playerCreateInvite, playerGetPending, playerGetApproved,
  playerApprove, playerReject,
} from '../../utils/api';

export default function InvitePanel({ campaignId, onClose }) {
  const [inviteToken, setInviteToken]   = useState(null);
  const [copied, setCopied]             = useState(false);
  const [pending, setPending]           = useState([]);
  const [approved, setApproved]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);

  const inviteUrl = inviteToken
    ? `${window.location.origin}/?join=${inviteToken}`
    : null;

  const load = useCallback(async () => {
    try {
      const [inviteRes, pendingRes, approvedRes] = await Promise.all([
        playerCreateInvite(campaignId),
        playerGetPending(campaignId),
        playerGetApproved(campaignId),
      ]);
      setInviteToken(inviteRes.token);
      setPending(pendingRes.players || []);
      setApproved(approvedRes.players || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => { load(); }, [load]);

  const handleCopy = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleApprove = async (id) => {
    await playerApprove(id);
    await load();
  };

  const handleReject = async (id) => {
    await playerReject(id);
    await load();
  };

  return (
    <div className="invite-panel">
      <div className="invite-panel-header">
        <span>Player Access</span>
        <button className="btn-icon" onClick={onClose}><X size={14} /></button>
      </div>

      {loading && <div className="invite-panel-loading">Loading…</div>}
      {error   && <div className="invite-panel-error">{error}</div>}

      {!loading && !error && (
        <>
          <div className="invite-panel-section">
            <div className="invite-panel-label">Invite Link</div>
            <div className="invite-panel-link-row">
              <input
                readOnly
                value={inviteUrl || ''}
                className="invite-panel-link-input"
                onFocus={(e) => e.target.select()}
              />
              <button className="btn-icon invite-copy-btn" onClick={handleCopy} title="Copy link">
                {copied ? <Check size={13} weight="bold" /> : <Copy size={13} />}
              </button>
            </div>
            <div className="invite-panel-hint">
              Share this link with players. They'll pick a name and wait for your approval.
            </div>
          </div>

          {pending.length > 0 && (
            <div className="invite-panel-section">
              <div className="invite-panel-label">Waiting for Approval ({pending.length})</div>
              {pending.map((p) => (
                <div key={p.id} className="invite-player-row">
                  <span className="invite-player-dot" style={{ background: p.color }} />
                  <span className="invite-player-name">{p.display_name}</span>
                  <button
                    className="btn-icon invite-approve-btn"
                    title="Approve"
                    onClick={() => handleApprove(p.id)}
                  >
                    <UserCircleCheck size={14} />
                  </button>
                  <button
                    className="btn-icon invite-reject-btn"
                    title="Reject"
                    onClick={() => handleReject(p.id)}
                  >
                    <Trash size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {approved.length > 0 && (
            <div className="invite-panel-section">
              <div className="invite-panel-label">Approved Players</div>
              {approved.map((p) => (
                <div key={p.id} className="invite-player-row">
                  <span className="invite-player-dot" style={{ background: p.color }} />
                  <UserCircle size={13} style={{ opacity: 0.5 }} />
                  <span className="invite-player-name">{p.display_name}</span>
                </div>
              ))}
            </div>
          )}

          {pending.length === 0 && approved.length === 0 && (
            <div className="invite-panel-empty">No players yet. Share the invite link to get started.</div>
          )}
        </>
      )}
    </div>
  );
}
