import { useState } from 'react';
import { Plus, SignOut } from '@phosphor-icons/react';
import useCampaignStore from '../../stores/campaignStore';
import { useAuth } from '../../context/AuthContext';
import TopoBackground from '../common/TopoBackground';

export default function CampaignSelect() {
  const { campaigns, createCampaign, setActiveCampaign } = useCampaignStore();
  const { user, logout } = useAuth();
  const splashLogo = '/logo/splash.svg';
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createCampaign(name.trim(), description.trim());
      setName('');
      setDescription('');
      setShowModal(false);
    } finally {
      setCreating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <div className="campaign-select" style={{ position: 'relative', isolation: 'isolate' }}>
      <TopoBackground style={{ zIndex: 0 }} opacity={0.9} />

      {/* User info + logout — top right corner */}
      <div style={{
        position: 'fixed', top: 16, right: 20, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{user?.email}</span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={logout}
          title="Sign out"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <SignOut size={14} />
          Sign out
        </button>
      </div>

      <img src={splashLogo} alt="Flux Atlas" className="splash-logo" style={{ position: 'relative', zIndex: 1 }} />
      <p className="subtitle" style={{ position: 'relative', zIndex: 1 }}>Campaign World Manager</p>

      <div className="campaign-grid" style={{ position: 'relative', zIndex: 1 }}>
        {campaigns.map((c) => (
          <div key={c.id} className="campaign-card" onClick={() => setActiveCampaign(c.id)}>
            <h3>{c.name}</h3>
            {c.description && <p>{c.description}</p>}
            <div className="meta">
              Created {new Date(c.createdAt).toLocaleDateString()}
            </div>
          </div>
        ))}

        <div className="campaign-card new-campaign-card" onClick={() => setShowModal(true)}>
          <Plus size={28} />
          <span>New Campaign</span>
        </div>
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New Campaign</h2>
            <div className="field-group" style={{ marginBottom: 12 }}>
              <label>Campaign Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="e.g. The Shattered Crown"
                autoFocus
              />
            </div>
            <div className="field-group">
              <label>Description (optional)</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="A brief description of the campaign world..."
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={!name.trim() || creating}
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
