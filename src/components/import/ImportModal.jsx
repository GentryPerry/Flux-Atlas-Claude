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
Motivation: Protect the northern border
Status: alive
---
A battle-scarred veteran who commands the garrison at Stormwatch Keep.
He trusts few and speaks less, but his loyalty is unshakable.

# NPC: Miriel Dawnweaver
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
Members: Gareth Ironhand
---
A knightly order dedicated to defending the realm from darkness.
Their ranks have thinned after the Battle of Ashen Fields.

# Religion: The Lightbringer
Deity: Solarius
Members: Gareth Ironhand, Miriel Dawnweaver
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
 * Org-type labels that can appear on character import lines for backward
 * compatibility (e.g. "Faction: The Silver Order" on an NPC block).
 * These no longer exist as character schema fields — instead they are resolved
 * post-import by adding the character's ID to the org node's members array.
 */
const ORG_MEMBERSHIP_LABELS = new Set(['faction', 'religion', 'polity']);

/**
 * Parse markdown import format into node objects.
 *
 * Format:
 *   # TYPE: Name
 *   Field: Value
 *   Members: Name One, Name Two      ← noderefs field (org nodes)
 *   Faction: Org Name                ← legacy character membership (still supported)
 *   ---
 *   Description text (multiple lines)
 *
 * Internal sentinel fields written on parsed nodes (stripped before saving):
 *   __tagNames_<key>    — comma-separated tag names to resolve to IDs
 *   __noderefNames_<key>— comma-separated node names to resolve to node IDs
 *   __pendingMembership — [{orgLabel, orgName}] for legacy character org lines
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

    const typeLabel = headerMatch[1].trim().toLowerCase();
    const name = headerMatch[2].trim();

    // Map label to internal type key
    const typeKey = Object.entries(NODE_TYPES).find(
      ([key, schema]) => schema.label.toLowerCase() === typeLabel || key === typeLabel
    )?.[0];

    if (!typeKey) continue;

    const fields = buildDefaultFields(typeKey);
    fields.name = name;

    let descLines = [];
    let pastSeparator = false;

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];

      if (line.trim() === '---') { pastSeparator = true; continue; }

      if (!pastSeparator) {
        const fieldMatch = line.match(/^([A-Za-z\s]+):\s*(.+)$/);
        if (!fieldMatch) continue;

        const fieldLabel = fieldMatch[1].trim().toLowerCase();
        const fieldValue = fieldMatch[2].trim();
        const names      = fieldValue.split(',').map((s) => s.trim()).filter(Boolean);

        // ── Legacy: "Faction: X" / "Religion: X" / "Polity: X" on a character ──
        // These fields no longer live on the character schema. Store them so we
        // can add the character to the org's members array after all nodes exist.
        if (ORG_MEMBERSHIP_LABELS.has(fieldLabel)) {
          if (!fields.__pendingMembership) fields.__pendingMembership = [];
          names.forEach((orgName) =>
            fields.__pendingMembership.push({ orgLabel: fieldLabel, orgName })
          );
          continue;
        }

        // ── Schema-driven field matching ──
        const schema   = NODE_TYPES[typeKey];
        const fieldDef = schema?.fields.find(
          (f) => f.label.toLowerCase() === fieldLabel || f.key.toLowerCase() === fieldLabel
        );
        if (!fieldDef) continue;

        if (fieldDef.type === 'tags') {
          // Resolve tag names → tag IDs during import
          fields[`__tagNames_${fieldDef.key}`] = names;
          fields[fieldDef.key] = [];
        } else if (fieldDef.type === 'noderefs') {
          // Resolve node names → node IDs during import
          fields[`__noderefNames_${fieldDef.key}`] = names;
          fields[fieldDef.key] = [];
        } else {
          fields[fieldDef.key] = fieldValue;
        }
      } else {
        descLines.push(line);
      }
    }

    if (descLines.length > 0) fields.description = descLines.join('\n').trim();

    nodes.push({ type: typeKey, fields, statusFlags: buildDefaultStatusFlags(typeKey) });
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

    const cols    = Math.ceil(Math.sqrt(preview.length));
    const spacing = 120;
    const startX  = 200;
    const startY  = 200;

    // ── Pass 1: create all nodes and collect ID map ───────────────────────
    // nodeNameMap: lowercase name → array of created node objects
    // (array because names are not guaranteed unique)
    const nodeNameMap = {};   // name.toLowerCase() → [{ id, type }]
    const created = [];

    for (let i = 0; i < preview.length; i++) {
      const node = preview[i];
      const col  = i % cols;
      const row  = Math.floor(i / cols);
      const x    = startX + col * spacing;
      const y    = startY + row * spacing;

      const newNode = createNode(campaignId, activeMapId, node.type, x, y);
      created.push({ newNode, parsed: node });

      const lowerName = (node.fields.name || '').toLowerCase();
      if (!nodeNameMap[lowerName]) nodeNameMap[lowerName] = [];
      nodeNameMap[lowerName].push({ id: newNode.id, type: node.type });
    }

    // ── Pass 2: resolve fields and memberships now that all IDs exist ─────
    // pendingOrgMembers: orgNodeId → Set of character IDs to add
    const pendingOrgMembers = {};

    for (const { newNode, parsed } of created) {
      const rawFields     = { ...parsed.fields };
      const resolvedFields = {};

      for (const [key, val] of Object.entries(rawFields)) {
        if (key.startsWith('__tagNames_')) {
          // tags: name → tag ID (create if missing)
          const fieldKey = key.replace('__tagNames_', '');
          resolvedFields[fieldKey] = val.map((n) => resolveTag(n));

        } else if (key.startsWith('__noderefNames_')) {
          // noderefs: name → node ID (best-match from imported set)
          const fieldKey = key.replace('__noderefNames_', '');
          resolvedFields[fieldKey] = val
            .flatMap((n) => (nodeNameMap[n.toLowerCase()] || []).map((e) => e.id));

        } else if (key === '__pendingMembership') {
          // Legacy "Faction: X" lines on characters — add this character to
          // the org node's members array after all fields are resolved.
          for (const { orgLabel, orgName } of val) {
            const matches = nodeNameMap[orgName.toLowerCase()] || [];
            const orgEntry = matches.find((e) => e.type === orgLabel) || matches[0];
            if (orgEntry) {
              if (!pendingOrgMembers[orgEntry.id]) pendingOrgMembers[orgEntry.id] = new Set();
              pendingOrgMembers[orgEntry.id].add(newNode.id);
            }
          }

        } else {
          resolvedFields[key] = val;
        }
      }

      updateNodeFields(campaignId, newNode.id, resolvedFields);
    }

    // ── Pass 3: apply pending org memberships ─────────────────────────────
    for (const [orgId, memberSet] of Object.entries(pendingOrgMembers)) {
      // Merge with any members already set on the org node via __noderefNames_members
      const orgCreated = created.find((c) => c.newNode.id === orgId);
      const existingMembers = orgCreated
        ? (orgCreated.parsed.fields.__noderefNames_members
            ? orgCreated.parsed.fields.__noderefNames_members
                .flatMap((n) => (nodeNameMap[n.toLowerCase()] || []).map((e) => e.id))
            : [])
        : [];
      const merged = [...new Set([...existingMembers, ...memberSet])];
      updateNodeFields(campaignId, orgId, { members: merged });
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
                placeholder={`Paste your markdown here...\n\n# NPC: Character Name\nMotivation: Some goal\n---\nDescription text here.\n\n# Faction: Org Name\nMembers: Character Name, Another Name\n---\nOrg description here.`}
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
