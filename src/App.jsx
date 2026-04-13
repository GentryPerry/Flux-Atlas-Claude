import { useEffect } from 'react';
import useCampaignStore from './stores/campaignStore';
import CampaignSelect from './components/campaign/CampaignSelect';
import WorkspaceView from './views/WorkspaceView';
import ErrorBoundary from './components/common/ErrorBoundary';

export default function App() {
  const activeCampaignId = useCampaignStore((s) => s.activeCampaignId);
  const loadCampaigns = useCampaignStore((s) => s.loadCampaigns);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  if (!activeCampaignId) {
    return <CampaignSelect />;
  }

  return (
    <ErrorBoundary>
      <WorkspaceView />
    </ErrorBoundary>
  );
}
