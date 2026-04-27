import { CaretLeft, MagnifyingGlass, MapTrifold } from '@phosphor-icons/react';
import useMapStore from '../../stores/mapStore';
import useCampaignStore from '../../stores/campaignStore';

export default function MobileHeader({ onOpenSearch, onOpenCampaignSheet }) {
  const activeMapId      = useMapStore((s) => s.activeMapId);
  const maps             = useMapStore((s) => s.maps);
  const setActiveCampaign = useCampaignStore((s) => s.setActiveCampaign);

  const activeMap = maps.find((m) => m.id === activeMapId);

  return (
    <div className="mobile-header">
      {/* Back to campaign select */}
      <button
        className="mobile-header-btn"
        onClick={() => setActiveCampaign(null)}
        title="Back to campaigns"
      >
        <CaretLeft size={20} weight="bold" />
      </button>

      {/* Map name — tapping opens the campaign/map sheet */}
      <button className="mobile-header-title" onClick={onOpenCampaignSheet}>
        <MapTrifold size={15} style={{ flexShrink: 0, color: 'var(--accent)' }} />
        <span>{activeMap?.name || 'No Map'}</span>
      </button>

      {/* Search */}
      <button className="mobile-header-btn" onClick={onOpenSearch} title="Search">
        <MagnifyingGlass size={20} />
      </button>
    </div>
  );
}
