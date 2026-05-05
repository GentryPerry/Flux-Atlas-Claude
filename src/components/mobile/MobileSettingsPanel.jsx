import { CaretLeft, Eye, Cube, ListDashes, Images, DownloadSimple, MapTrifold, Question, Key } from '@phosphor-icons/react';
import SettingsPanel from '../settings/SettingsPanel';
import useSettingsStore from '../../stores/settingsStore';

const CATEGORIES = [
  { id: 'view',      label: 'View',       icon: Eye            },
  { id: 'nodeTypes', label: 'Node Types', icon: Cube           },
  { id: 'fields',    label: 'Fields',     icon: ListDashes     },
  { id: 'images',    label: 'Images',     icon: Images         },
  { id: 'import',    label: 'Import',     icon: DownloadSimple },
  { id: 'campaign',  label: 'Campaign',   icon: MapTrifold     },
  { id: 'account',   label: 'Account',    icon: Key            },
];

/**
 * Full-screen settings panel for mobile.
 * Replaces the desktop modal-overlay pattern with a proper native-feeling page.
 */
export default function MobileSettingsPanel({ onBack }) {
  const settingsCategory    = useSettingsStore((s) => s.settingsCategory);
  const setSettingsCategory = useSettingsStore((s) => s.setSettingsCategory);

  return (
    <div className="mobile-settings-overlay">

      {/* Header */}
      <div className="mobile-settings-header">
        <button className="mobile-header-btn" onClick={onBack} title="Back">
          <CaretLeft size={20} weight="bold" />
        </button>
        <span className="mobile-settings-title">Settings</span>
        <div style={{ width: 40 }} />
      </div>

      {/* Horizontal scrolling tab strip */}
      <div className="mobile-settings-tabs">
        {CATEGORIES.map((cat) => {
          const TabIcon = cat.icon;
          const isActive = settingsCategory === cat.id;
          return (
            <button
              key={cat.id}
              className={`mobile-settings-tab${isActive ? ' active' : ''}`}
              onClick={() => setSettingsCategory(cat.id)}
            >
              <TabIcon size={15} weight={isActive ? 'duotone' : 'regular'} />
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Scrollable pane content */}
      <div className="mobile-settings-pane-wrap">
        <SettingsPanel mobileEmbed />
      </div>
    </div>
  );
}
