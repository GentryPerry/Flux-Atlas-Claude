import { useState, useRef, useMemo } from 'react';
import {
  X, Upload, FileText, Check, Warning, DownloadSimple,
  UserCircle, MapPin, Shield, Cross, Lightning, Sword,
} from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useMapStore from '../../stores/mapStore';
import useCampaignStore from '../../stores/campaignStore';
import useTagStore from '../../stores/tagStore';
import { NODE_TYPES, buildDefaultFields, buildDefaultStatusFlags } from '../../utils/nodeSchemas';

const TYPE_COLORS = {
  character: 'var(--node-character)',
  location: 'var(--node-location)',
  faction: 'var(--node-faction)',
  religion: 'var(--node-religion)',
  event: 'var(--node-event)',
  polity: 'var(--node-polity)',
  thing: 'var(--node-thing)',
};

const TEMPLATE = `# NPC: Gareth Ironhand
Faction: The Silver Order
Religion: The Lightbringer
Motivation: Protect the northern border
Status: alive
---
A battle-scarred veteran who commands the garrison at Stormwatch Keep.
He trusts few and speaks less, but his loyalty is unshakable.

# NPC: Miriel Dawnweaver
Faction: Circle of Whispers
Religion: The Old Ways
Motivation: Uncover the truth about the Sundering
Status: alive
---
An elven scholar who has spent centuries studying ancient texts.

# Location: Stormwatch Keep
Region: Northern Marches
Location Type: fortress
---
A massive stone fortress perched on the edge of the Windbreak Cliffs.

# Faction: The Silver Order
Alignment: Lawful Good
---
A knightly order dedicated to defending the realm from darkness.
Their ranks have thinned after the Battle of Ashen Fields.

# Religion: The Lightbringer
Deity: Solarius
---
An ancient faith centered on the worship of the sun god Solarius.

# Event: Battle of Ashen Fields
Date: Third Age, Year 847
Status: resolved
---
A devastating conflict that nearly destroyed the Silver Order.

# Item: Oathkeeper Blade
---
An enchanted longsword passed down through Silver Order commanders.
`;

/**
 * Parse markdown import format into node objects.
 * Format:
 *   # TYPE: Name
 *   Field: Value
 *   ---
 *   Description text (multiple lines)
 */
function parseImportMarkdown(text) {
  const nodes = [];
  const blocks = text.split(/^# /m).filter(Boolean);

  for (const block of blocks) {
    const lines = block.trim().split('\n');
    const headerLine = lines[0];

    // Parse header: "TYPE: Name"
    const headerMatch = headerLine.match(/^(\w+):\s*(.+)$/);
    if (!headerMatch) continue;

    let typeLabel = headerMatch[1].trim().toLowerCase();
    const name = headerMatch[2].trim();

    // Map label to internal type key
    const typeKey = Object.entries(NODE_TYPES).find(
      ([key, schema]) => schema.label.toLowerCase() === typeLabel || key === typeLabel
    )?.[0];

    if (!typeKey) continue;

    const fields = buildDefaultFields(typeKey);
    fields.name = name;

    // Parse field lines and description
    let descLines = [];
    let pastSeparator = false;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim() === '---') {
        pastSeparator = true;
        continue;
      }

      if (!pastSeparator) {
        // Parse "Key: Value" lines
        const fieldMatch = line.match(/^([A-Za-z\s]+):\s*(.+)$/);
        if (fieldMatch) {
          const fieldLabel = fieldMatch[1].trim().toLowerCase();
          const fieldValue = fieldMatch[2].trim();

          // Find matching field in schema
          const schema = NODE_TYPES[typeKey];
          const fieldDef = schema?.fields.find(
            (f) => f.label.toLowerCase() === fieldLabel || f.key.toLowerCase() === fieldLabel
          );
          if (fieldDef) {
            if (fieldDef.type === 'tags') {
              // Store raw tag names for resolution during import
              fields[`__tagNames_${fieldDef.key}`] = fieldValue.split(',').map((s) => s.trim()).filter(Boolean);
              // Keep field as empty array for now (resolved during import)
              fields[fieldDef.key] = [];
            } else {
              fields[fieldDef.key] = fieldValue;
            }
          }
        }
      } else {
        descLines.push(line);
      }
    }

    if (descLines.length > 0) {
      fields.description = descLines.join('\n').trim();
    }

    nodes.push({
      type: typeKey,
      fields,
      statusFlags: buildDefaultStatusFlags(typeKey),
    });
  }

  return nodes;
}

export default function ImportModal({ onClose }) {
  const campaignId = useCampaignStore((s) => s.activeCampaignId);
  const activeMapId = useMapStore((s) => s.activeMapId);
  const createNode = useNodeStore((s) => s.createNode);
  const updateNodeFields = useNodeStore((s) => s.updateNodeFields);
  const tags = useTagStore((s) => s.tags);
  const createTag = useTagStore((s) => s.createTag);

  const [text, setText] = useState('');
  const [parsed, setParsed] = useState(null);
  const [imported, setImported] = useState(false);
  const fileRef = useRef(null);

  const preview = useMemo(() => {
    if (!text.trim()) return [];
    return parseImportMarkdown(text);
  }, [text]);

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setText(ev.target.result);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  /** Resolve a tag name to a tag ID, creating if needed */
  const resolveTag = (name) => {
    let tag = tags.find((t) => t.name.toLowerCase() === name.toLowerCase());
    if (!tag) tag = createTag(campaignId, name);
    return tag.id;
  };

  const handleImport = () => {
    if (preview.length === 0) return;

    // Place nodes in a grid pattern on the map
    const cols = Math.ceil(Math.sqrt(preview.length));
    const spacing = 120;
    const startX = 200;
    const startY = 200;

    for (let i = 0; i < preview.length; i++) {
      const node = preview[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * spacing;
      const y = startY + row * spacing;

      // Resolve __tagNames_ fields into actual tag IDs
      const resolvedFields = { ...node.fields };
      for (const key of Object.keys(resolvedFields)) {
        if (key.startsWith('__tagNames_')) {
          const fieldKey = key.replace('__tagNames_', '');
          const names = resolvedFields[key];
          resolvedFields[fieldKey] = names.map((n) => resolveTag(n));
          delete resolvedFields[key];
        }
      }

      const created = createNode(campaignId, activeMapId, node.type, x, y);
      updateNodeFields(campaignId, created.id, resolvedFields);
    }

    setImported(true);
  };

  const handleInsertTemplate = () => {
    setText(TEMPLATE);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="import-modal" onClick={(e) => e.stopPropagation()}>
        <div className="import-modal-header">
          <div>
            <h2 style={{ fontSize: 20, marginBottom: 4 }}>Import Nodes</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>
              Paste markdown or upload a .md/.txt file
            </p>
          </div>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="import-modal-body">
          {!imported ? (
            <>
              {/* Action buttons */}
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".md,.txt,.markdown"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                />
                <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>
                  <Upload size={14} /> Upload file
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleInsertTemplate}>
                  <FileText size={14} /> Insert template
                </button>
              </div>

              {/* Text area */}
              <textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Paste your markdown here...\n\n# NPC: Character Name\nFaction: Some Faction\n---\nDescription text here.`}
                style={{ minHeight: 180, fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6 }}
              />

              {/* Preview */}
              {preview.length > 0 && (
                <div>
                  <label style={{ marginBottom: 8, display: 'block' }}>
                    Preview ({preview.length} nodes detected)
                  </label>
                  <div className="import-results">
                    {preview.map((node, i) => (
                      <div key={i} className="import-result-item">
                        <div
                          className="dot"
                          style={{ background: TYPE_COLORS[node.type] || 'var(--text-muted)' }}
                        />
                        <span style={{ fontWeight: 600 }}>
                          {node.fields?.name || 'Unnamed'}
                        </span>
                        <span style={{ color: 'var(--text-muted)', fontSize: 12, marginLeft: 'auto' }}>
                          {NODE_TYPES[node.type]?.label || node.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Import button */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
                <button
                  className="btn btn-primary"
                  disabled={preview.length === 0}
                  onClick={handleImport}
                  style={preview.length === 0 ? { opacity: 0.5, cursor: 'default' } : {}}
                >
                  Import {preview.length} node{preview.length !== 1 ? 's' : ''}
                </button>
              </div>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <Check size={48} weight="bold" color="var(--success)" />
              <div style={{ marginTop: 12, fontSize: 16, fontWeight: 600 }}>
                Imported {preview.length} nodes!
              </div>
              <p style={{ color: 'var(--text-secondary)', marginTop: 6, fontSize: 13 }}>
                Nodes have been placed on the current map.
              </p>
              <button className="btn btn-primary" onClick={onClose} style={{ marginTop: 20 }}>
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
