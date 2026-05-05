import { MapTrifold, TreeStructure, Kanban, GearSix, Cards } from '@phosphor-icons/react';

const TABS = [
  { id: 'map',       label: 'Map',       Icon: MapTrifold    },
  { id: 'board',     label: 'Board',     Icon: Kanban        },
  { id: 'nodes',     label: 'Nodes',     Icon: Cards         },
  { id: 'hierarchy', label: 'Hierarchy', Icon: TreeStructure },
  { id: 'settings',  label: 'Settings',  Icon: GearSix       },
];

export default function MobileBottomNav({ activeView, setActiveView }) {
  return (
    <nav className="mobile-bottom-nav">
      {TABS.map((tab) => {
        const isActive = activeView === tab.id;
        const TabIcon = tab.Icon;
        return (
          <button
            key={tab.id}
            className={`mobile-nav-tab${isActive ? ' active' : ''}`}
            onClick={() => setActiveView(tab.id)}
          >
            <TabIcon size={22} weight={isActive ? 'fill' : 'regular'} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
