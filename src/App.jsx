import { useEffect } from 'react';
import useCampaignStore from './stores/campaignStore';
import useSettingsStore from './stores/settingsStore';
import { useAuth } from './context/AuthContext';
import AuthScreen from './components/auth/AuthScreen';
import CampaignSelect from './components/campaign/CampaignSelect';
import WorkspaceView from './views/WorkspaceView';
import ErrorBoundary from './components/common/ErrorBoundary';

export default function App() {
  const { user, loading } = useAuth();
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId);
  const loadCampaigns = useCampaignStore((s) => s.loadCampaigns);
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    if (user) loadCampaigns();
  }, [user, loadCampaigns]);

  // Keep data-theme in sync with the store (persisted in settingsStore)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme || 'dark');
  }, [theme]);

  // Checking stored session token — show nothing while resolving
  if (loading) return null;

  // Not logged in — show auth screen
  if (!user) return <AuthScreen />;

  // Logged in but no campaign selected yet
  if (!activeCampaignId) return <CampaignSelect />;

  return (
    <ErrorBoundary>
      <WorkspaceView />
    </ErrorBoundary>
  );
}
