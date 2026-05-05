import { useState, useMemo, useRef, useEffect } from 'react';
import { DiceSix, ArrowsInSimple, ArrowsOutSimple, X, CaretRight, CaretDown } from '@phosphor-icons/react';

// ── Load all table JSON files at build time via Vite glob import ───────────────
const RAW_TABLES = import.meta.glob('../../data/tables/**/*.json', { eager: true });

// Build a structured index: { categorySlug: { label, tables: [tableObj, ...] } }
const CATEGORY_LABELS = {
  'npc':                    'NPCs',
  'gm-tools':               'GM Tools',
  'quest':                  'Quests & Hooks',
  'encounter-social':       'Social Encounters',
  'encounter-terrain':      'Terrain Encounters',
  'encounter-investigation':'Investigation',
  'items-magic':            'Magic Items',
  'items-mundane':          'Mundane Items',
  'items-tech':             'Tech Items',
  'horror':                 'Horror',
  'phenomena':              'Phenomena',
  'faction':                'Factions',
  'tavern':                 'Tavern',
};

const TABLE_INDEX = (() => {
  const index = {};
  for (const [path, mod] of Object.entries(RAW_TABLES)) {
    const table = mod.default ?? mod;
    if (!table?.entries?.length) continue;
    // Extract category from path: ../../data/tables/<category>/<file>.json
    const parts = path.split('/');
    const catSlug = parts[parts.length - 2];
    if (catSlug === 'uncategorizedRandom Roll Tables') continue;
    if (!index[catSlug]) {
      index[catSlug] = {
        slug:   catSlug,
        label:  CATEGORY_LABELS[catSlug] ?? catSlug,
        tables: [],
      };
    }
    index[catSlug].tables.push(table);
  }
  // Sort tables within each category by title
  for (const cat of Object.values(index)) {
    cat.tables.sort((a, b) => a.title.localeCompare(b.title));
  }
  return index;
})();

// Sorted category list
const CATEGORIES = Object.values(TABLE_INDEX).sort((a, b) => a.label.localeCompare(b.label));

// ── Dice roll helper ───────────────────────────────────────────────────────────
function rollTable(table, count) {
  const entries = table.entries;
  const results = [];
  const used = new Set();
  const attempts = entries.length * 4;
  let tries = 0;
  while (results.length < count && results.length < entries.length && tries < attempts) {
    tries++;
    const idx = Math.floor(Math.random() * entries.length);
    if (!used.has(idx)) {
      used.add(idx);
      results.push(entries[idx]);
    }
  }
  return results;
}

// ── Tree picker ────────────────────────────────────────────────────────────────
function TreePicker({ selectedId, onSelect, onClose }) {
  const [openCats, setOpenCats] = useState(() => {
    // Auto-open the category that contains the selected table
    if (!selectedId) return {};
    for (const cat of CATEGORIES) {
      if (cat.tables.some((t) => t.id === selectedId)) return { [cat.slug]: true };
    }
    return {};
  });
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  const toggleCat = (slug) => setOpenCats((prev) => ({ ...prev, [slug]: !prev[slug] }));

  return (
    <div ref={ref} className="tr-picker">
      {CATEGORIES.map((cat) => (
        <div key={cat.slug} className="tr-picker-cat">
          <button
            className="tr-picker-cat-header"
            onClick={() => toggleCat(cat.slug)}
          >
            {openCats[cat.slug]
              ? <CaretDown size={11} weight="bold" />
              : <CaretRight size={11} weight="bold" />}
            <span>{cat.label}</span>
            <span className="tr-picker-count">{cat.tables.length}</span>
          </button>
          {openCats[cat.slug] && (
            <div className="tr-picker-items">
              {cat.tables.map((t) => (
                <button
                  key={t.id}
                  className={`tr-picker-item ${t.id === selectedId ? 'active' : ''}`}
                  onClick={() => { onSelect(t); onClose(); }}
                  title={t.description}
                >
                  {t.title}
                </button>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main Widget ────────────────────────────────────────────────────────────────
export default function TableRollerWidget({ widget, onUpdate, onUpdateData, onRemove, onContextMenu }) {
  const { data }    = widget;
  const isMinimized = widget.isMinimized;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [results,    setResults]    = useState(data.lastResults ?? []);

  const selectedTable = useMemo(() => {
    if (!data.tableId) return null;
    for (const cat of CATEGORIES) {
      const t = cat.tables.find((t) => t.id === data.tableId);
      if (t) return t;
    }
    return null;
  }, [data.tableId]);

  const rollCount = data.rollCount ?? 1;

  const handleRoll = () => {
    if (!selectedTable) return;
    const rolled = rollTable(selectedTable, rollCount);
    setResults(rolled);
    onUpdateData({ lastResults: rolled });
  };

  const selectTable = (table) => {
    setResults([]);
    onUpdateData({ tableId: table.id, lastResults: [] });
  };

  const setCount = (n) => {
    onUpdateData({ rollCount: n });
  };

  const w = isMinimized ? 'fit-content' : (data.width ?? 340);

  return (
    <div
      className={`widget-shell tr-widget ${isMinimized ? 'widget-minimized' : ''}`}
      style={{ width: w }}
      onContextMenu={onContextMenu}
    >
      {/* Title bar */}
      <div className="tr-titlebar" data-drag-handle="true">
        <DiceSix size={12} weight="fill" style={{ color: 'var(--accent)', flexShrink: 0 }} />
        <span className="tr-title">{data.title ?? 'Table Roller'}</span>
        <div className="widget-controls">
          <button
            className="widget-ctrl-btn"
            onClick={() => onUpdate({ isMinimized: !isMinimized })}
            title={isMinimized ? 'Expand' : 'Minimise'}
          >
            {isMinimized ? <ArrowsOutSimple size={11} /> : <ArrowsInSimple size={11} />}
          </button>
          <button className="widget-ctrl-btn close" onClick={onRemove} title="Remove widget">
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Body — hidden when minimized */}
      {!isMinimized && (
        <div className="tr-body">
          {/* Table selector */}
          <div className="tr-selector-row" style={{ position: 'relative' }}>
            <button
              className="tr-table-btn"
              onClick={() => setPickerOpen((v) => !v)}
              title={selectedTable?.description ?? 'Choose a table'}
            >
              <span className="tr-table-name">
                {selectedTable ? selectedTable.title : 'Select a table…'}
              </span>
              <CaretDown size={10} />
            </button>
            {pickerOpen && (
              <TreePicker
                selectedId={data.tableId}
                onSelect={selectTable}
                onClose={() => setPickerOpen(false)}
              />
            )}
          </div>

          {/* Controls row: count + roll */}
          <div className="tr-controls-row">
            <div className="tr-count-label">Results:</div>
            <div className="tr-count-btns">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={`tr-count-btn ${rollCount === n ? 'active' : ''}`}
                  onClick={() => setCount(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              className="tr-roll-btn"
              onClick={handleRoll}
              disabled={!selectedTable}
              title={selectedTable ? `Roll ${rollCount} from ${selectedTable.title}` : 'Select a table first'}
            >
              <DiceSix size={13} />
              Roll
            </button>
          </div>

          {/* Results */}
          {results.length > 0 && (
            <div className="tr-results">
              {results.map((entry, i) => (
                <div key={i} className="tr-result-item">
                  <span className="tr-result-roll">{entry.roll}</span>
                  <span className="tr-result-text">{entry.result}</span>
                </div>
              ))}
            </div>
          )}

          {!selectedTable && (
            <div className="tr-empty">Choose a table above, set how many results you want, then roll.</div>
          )}

          {selectedTable && results.length === 0 && (
            <div className="tr-empty">
              {selectedTable.entries.length} entries · d{selectedTable.die ?? selectedTable.entries.length}
            </div>
          )}

          {/* Resize handle */}
          <div className="tr-resize-handle" data-resize-handle="true" />
        </div>
      )}
    </div>
  );
}
