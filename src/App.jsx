import { useEffect, useState } from 'react';
import useCampaignStore from './stores/campaignStore';
import useSettingsStore from './stores/settingsStore';
import { useAuth } from './context/AuthContext';
import AuthScreen from './components/auth/AuthScreen';
import CampaignSelect from './components/campaign/CampaignSelect';
import WorkspaceView from './views/WorkspaceView';
import ErrorBoundary from './components/common/ErrorBoundary';
import PlayerJoinScreen from './components/player/PlayerJoinScreen';
import PlayerView from './components/player/PlayerView';
import { getPlayerSessionToken, playerGetStatus, clearPlayerSession } from './utils/api';

// ── Player flow ────────────────────────────────────────────────────────────────

function PlayerFlow({ joinToken }) {
  const [status, setStatus]   = useState(null); // null = loading
  const [session, setSession] = useState(null);
  const [error, setError]     = useState(null);

  const checkStatus = async () => {
    const token = getPlayerSessionToken();
    if (!token) {
      setStatus('join');
      return;
    }
    try {
      const data = await playerGetStatus();
      setSession(data);
      setStatus(data.status); // 'pending' | 'approved' | 'rejected'
    } catch {
      // Token invalid or expired — go back to join
      clearPlayerSession();
      setStatus(joinToken ? 'join' : 'invalid');
    }
  };

  useEffect(() => {
    checkStatus();
    // Poll every 8s while pending so the player auto-advances when approved
    const interval = setInterval(() => {
      if (status === 'pending') checkStatus();
    }, 8000);
    return () => clearInterval(interval);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (status === null) {
    return (
      <div className="player-view-loading">
        <div className="player-loading-spinner" />
      </div>
    );
  }

  if (status === 'join' && joinToken) {
    return (
      <PlayerJoinScreen
        inviteToken={joinToken}
        onJoined={(result) => {
          setSession(result);
          setStatus('pending');
          // Strip the join token from the URL without a page reload
          window.history.replaceState({}, '', window.location.pathname);
        }}
      />
    );
  }

  if (status === 'pending') {
    return (
      <div className="player-view-loading">
        <div className="player-loading-spinner" />
        <p className="player-pending-text">
          Waiting for GM approval…
          <br />
          <small>This page will update automatically.</small>
        </p>
        <button
          className="player-logout-btn"
          onClick={() => { clearPlayerSession(); setStatus('join'); }}
        >
          Cancel
        </button>
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="player-view-loading">
        <p style={{ color: '#f87171' }}>Your request was declined by the GM.</p>
        <button
          className="player-logout-btn"
          onClick={() => { clearPlayerSession(); window.location.href = '/'; }}
        >
          Back
        </button>
      </div>
    );
  }

  if (status === 'approved' && session) {
    return (
      <PlayerView
        session={session}
        onLogout={() => { setStatus('join'); setSession(null); }}
      />
    );
  }

  // Fallback: no join token and no valid session
  return (
    <div className="player-view-loading">
      <p style={{ color: '#f87171' }}>Invalid or expired invite link.</p>
      <button
        className="player-logout-btn"
        onClick={() => { window.location.href = '/'; }}
      >
        Go Home
      </button>
    </div>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────

export default function App() {
  const { user, loading } = useAuth();
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId);
  const loadCampaigns = useCampaignStore((s) => s.loadCampaigns);
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    if (user) loadCampaigns();
  }, [user, loadCampaigns]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme || 'dark');
  }, [theme]);

  // Check for player join token in URL or existing player session
  const joinToken    = new URLSearchParams(window.location.search).get('join');
  const playerToken  = getPlayerSessionToken();

  if (joinToken || playerToken) {
    return <PlayerFlow joinToken={joinToken} />;
  }

  if (loading) return null;
  if (!user) return <AuthScreen />;
  if (!activeCampaignId) return <CampaignSelect />;

  return (
    <ErrorBoundary>
      <WorkspaceView />
    </ErrorBoundary>
  );
}
