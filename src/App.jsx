import { useEffect } from 'react';
import useCampaignStore from './stores/campaignStore';
import useSettingsStore from './stores/settingsStore';
import CampaignSelect from './components/campaign/CampaignSelect';
import WorkspaceView from './views/WorkspaceView';
import ErrorBoundary from './components/common/ErrorBoundary';

export default function App() {
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId);
  const loadCampaigns = useCampaignStore((s) => s.loadCampaigns);
  const theme = useSettingsStore((s) => s.theme);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  // Keep data-theme in sync with the store (persisted in settingsStore)
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme || 'dark');
  }, [theme]);

  if (!activeCampaignId) {
    return <CampaignSelect />;
  }

  return (
    <ErrorBoundary>
      <WorkspaceView />
    </ErrorBoundary>
  );
}
