import { useState, useMemo, useRef, useEffect } from 'react';
import { X, MagnifyingGlass } from '@phosphor-icons/react';
import { ALL_ICON_NAMES, ICON_REGISTRY } from '../../utils/iconRegistry';

const PAGE_SIZE = 120;

// Convert CamelCase icon name to readable words for display/search
function iconNameToWords(name) {
  return name
    .replace(/([A-Z])/g, ' $1')
    .trim()
    .toLowerCase();
}

// Pre-compute a searchable string for every icon name once
const ICON_SEARCH_STRINGS = Object.fromEntries(
  ALL_ICON_NAMES.map((name) => [name, iconNameToWords(name)])
);

// Curated list of noun/object icons — shown by default.
// Skips UI arrows, alignment tools, logos, code/dev icons, etc.
const CURATED_ICONS = [
  // People & Characters
  'Person','PersonSimpleWalk','PersonSimpleRun','Users','UserCircle',
  'Baby','ChefHat','Student','Detective','Alien','Ghost','Skull','Robot',
  // Places & Structures
  'House','Buildings','CastleTurret','Church','Lighthouse','Tent','Warehouse',
  'Door','DoorOpen','Barn','Bridge','Fence','Tower','Wall',
  // Nature & Landscape
  'Mountains','Tree','Leaf','Acorn','Clover','Flower','Feather',
  'Drop','Snowflake','Cloud','CloudRain','CloudLightning','CloudFog',
  'Sun','Moon','Star','SunHorizon','Tornado','Island','Plant','PottedPlant',
  // Combat & Weapons
  'Sword','Axe','Knife','Hammer','Shield','Crosshair','Bomb','Siren','Barricade',
  // Magic & Mystical
  'Eye','Sparkle','MagicWand','Cross','Infinity','YinYang','Atom',
  'StarFour','Hexagon','Pentagon','Spiral','CircleWavy','CircleDashed',
  // Animals & Creatures
  'Bird','Dog','Cat','Horse','Butterfly','Rabbit','Fish',
  'PawPrint','Shrimp','Seal','Bug','Cow',
  // Objects & Items
  'Key','LockKey','LockOpen','Bell','Coin','Coins','Diamond','Scroll',
  'Book','BookOpen','BookBookmark','Books','Flask','Hourglass','Compass',
  'Anchor','Boat','Backpack','Bag','TreasureChest','Fire','Torch',
  'MapPin','MapTrifold','Globe','Binoculars','Microscope',
  'Crown','Flag','Scales','Syringe','Pill','Stethoscope','Bandaids',
  'Wrench','Gear','Toolbox','Vault','SlidersHorizontal',
  // Food & Drink
  'Coffee','BeerBottle','BeerStein','Wine','Bread','Cookie','IceCream',
  'ForkKnife','CookingPot','Pepper',
  // Transport
  'Airplane','Boat','Bicycle','Car','Train','Rocket',
  // Symbols & Power
  'Heart','HeartBreak','Lightning','Crown','Trophy','Medal',
  'Certificate','BookmarkSimple','Clock','Hourglass','Calendar',
  'Bell','Megaphone','Warning','Prohibit','Question','Info',
  // Celestial
  'Planet','Moon','Sun','Star','Meteor',
].filter((name) => ICON_REGISTRY[name]); // silently drops any that don't exist

export default function IconPickerModal({ current, onSelect, onClose }) {
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
  const [page, setPage] = useState(0);
  const searchRef = useRef(null);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  // Reset page on search/mode change
  const handleSearch = (val) => {
    setSearch(val);
    setPage(0);
  };
  const handleToggleAll = (val) => {
    setShowAll(val);
    setPage(0);
  };

  const sourceList = showAll ? ALL_ICON_NAMES : CURATED_ICONS;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sourceList;
    // When searching, always search across ALL icons regardless of mode
    return ALL_ICON_NAMES.filter((name) => ICON_SEARCH_STRINGS[name].includes(q));
  }, [search, sourceList]);

  const visibleStart = page * PAGE_SIZE;
  const visible = filtered.slice(visibleStart, visibleStart + PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ zIndex: 400 }}
    >
      <div
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-strong)',
          borderRadius: 'var(--radius-xl)',
          width: 560,
          maxWidth: '92vw',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'modalIn 200ms var(--ease)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <MagnifyingGlass size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search icons… (e.g. sword, crown, flame)"
            style={{
              flex: 1,
              background: 'none',
              border: 'none',
              outline: 'none',
              fontSize: 14,
              color: 'var(--text-primary)',
            }}
          />
          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button
              onClick={() => handleToggleAll(false)}
              style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius)',
                border: '1px solid var(--border-strong)',
                background: !showAll ? 'var(--accent-dim)' : 'transparent',
                color: !showAll ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              Curated
            </button>
            <button
              onClick={() => handleToggleAll(true)}
              style={{
                fontSize: 11, padding: '3px 8px', borderRadius: 'var(--radius)',
                border: '1px solid var(--border-strong)',
                background: showAll ? 'var(--accent-dim)' : 'transparent',
                color: showAll ? 'var(--accent)' : 'var(--text-muted)',
                cursor: 'pointer',
              }}
            >
              All {ALL_ICON_NAMES.length}
            </button>
          </div>
          <button className="btn-icon" onClick={onClose} style={{ flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* Icon grid */}
        <div style={{
          overflowY: 'auto',
          flex: 1,
          padding: 12,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(52px, 1fr))',
          gap: 4,
          alignContent: 'start',
        }}>
          {visible.map((name) => {
            const Icon = ICON_REGISTRY[name];
            const isActive = name === current;
            return (
              <button
                key={name}
                title={name}
                onClick={() => onSelect(name)}
                style={{
                  width: '100%',
                  aspectRatio: '1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  borderRadius: 'var(--radius)',
                  border: `1.5px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                  background: isActive ? 'var(--accent-dim)' : 'transparent',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '6px 2px',
                  transition: 'all 0.1s',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <Icon size={20} weight="duotone" />
                <span style={{
                  fontSize: 9,
                  lineHeight: 1.1,
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  width: '100%',
                  padding: '0 2px',
                }}>
                  {name}
                </span>
              </button>
            );
          })}

          {visible.length === 0 && search.trim() && (
            <div style={{
              gridColumn: '1 / -1',
              padding: '40px 0',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: 13,
            }}>
              No icons match "{search}"
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            padding: '10px 16px',
            borderTop: '1px solid var(--border)',
            flexShrink: 0,
          }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              ← Prev
            </button>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {page + 1} / {totalPages}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
