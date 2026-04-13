import { useState } from 'react';
import { Plus } from '@phosphor-icons/react';
import useCampaignStore from '../../stores/campaignStore';

export default function CampaignSelect() {
  const { campaigns, createCampaign, setActiveCampaign } = useCampaignStore();
  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return;
    const campaign = createCampaign(name.trim(), description.trim());
    setName('');
    setDescription('');
    setShowModal(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleCreate();
    }
  };

  return (
    <div className="campaign-select">
      <img src="/logo/white-logo.png" alt="Flux Atlas" className="splash-logo" />
      <p className="subtitle">Campaign World Manager</p>

      <div className="campaign-grid">
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
              <button className="btn btn-primary" onClick={handleCreate} disabled={!name.trim()}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
