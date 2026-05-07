import { useState } from 'react';
import { playerJoin } from '../../utils/api';

export default function PlayerJoinScreen({ inviteToken, onJoined }) {
  const [name, setName]       = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState(null);

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const result = await playerJoin(inviteToken, name.trim());
      onJoined(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="player-join-screen">
      <div className="player-join-card">
        <div className="player-join-logo">Flux Atlas</div>
        <h2 className="player-join-title">You've been invited to a campaign</h2>
        <p className="player-join-subtitle">Enter your name to request access. The GM will approve you shortly.</p>

        <form onSubmit={handleJoin} className="player-join-form">
          <input
            className="player-join-input"
            type="text"
            placeholder="Your name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={40}
            autoFocus
            disabled={loading}
          />
          {error && <div className="player-join-error">{error}</div>}
          <button
            className="player-join-btn"
            type="submit"
            disabled={!name.trim() || loading}
          >
            {loading ? 'Joining…' : 'Request Access'}
          </button>
        </form>
      </div>
    </div>
  );
}
