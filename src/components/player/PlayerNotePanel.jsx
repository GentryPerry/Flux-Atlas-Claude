import { useState, useEffect, useRef } from 'react';
import { X, ArrowRight } from '@phosphor-icons/react';
import { playerSaveNote } from '../../utils/api';

export default function PlayerNotePanel({ node, session, allNotes, myNotes, onClose, onNoteSaved }) {
  const nodeNotes  = allNotes.filter((n) => n.node_id === node.id);
  const myNote     = myNotes.find((n) => n.node_id === node.id);
  const [draft, setDraft]       = useState(myNote?.text || '');
  const [saving, setSaving]     = useState(false);
  const [saved, setSaved]       = useState(false);
  const saveTimerRef            = useRef(null);

  useEffect(() => {
    setDraft(myNote?.text || '');
  }, [node.id, myNote?.text]);

  const handleChange = (val) => {
    setDraft(val);
    setSaved(false);
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => save(val), 1200);
  };

  const save = async (text) => {
    setSaving(true);
    try {
      await playerSaveNote(node.id, text);
      setSaved(true);
      onNoteSaved?.(node.id, text);
    } catch { /* non-fatal */ }
    setSaving(false);
  };

  const heroImage = node.images?.[0]?.url;
  const description = node.fields?.description || node.fields?.notes || '';

  return (
    <div className="player-note-panel">
      <div className="player-note-header">
        <div className="player-note-title-row">
          <span
            className="player-note-type-dot"
            style={{ background: node.color || 'var(--accent)' }}
          />
          <span className="player-note-title">{node.name}</span>
          <span className="player-note-type">{node.type}</span>
        </div>
        <button className="btn-icon" onClick={onClose}><X size={16} /></button>
      </div>

      <div className="player-note-body">
        {heroImage && (
          <img src={heroImage} alt="" className="player-note-hero" />
        )}

        {description && (
          <div className="player-note-description">{description}</div>
        )}

        {/* Other players' notes */}
        {nodeNotes.filter((n) => n.player_session_id !== session.id).map((n) => (
          <div key={n.player_session_id} className="player-note-other">
            <span className="player-note-author" style={{ color: n.color }}>{n.display_name}</span>
            <span className="player-note-other-text">{n.text}</span>
          </div>
        ))}

        {/* My note */}
        <div className="player-note-mine-section">
          <div className="player-note-mine-label">
            <span style={{ color: session.color }}>{session.displayName}</span>
            {saving && <span className="player-note-status">saving…</span>}
            {saved && !saving && <span className="player-note-status">saved</span>}
          </div>
          <textarea
            className="player-note-textarea"
            placeholder="Add your notes…"
            value={draft}
            onChange={(e) => handleChange(e.target.value)}
            rows={4}
          />
        </div>
      </div>
    </div>
  );
}
