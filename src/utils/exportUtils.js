import { NODE_TYPES } from './nodeSchemas';
import { loadCampaign } from './api';

/**
 * Serialize all nodes for a campaign to Flux Atlas import markdown format.
 * Output is valid input for ImportModal — it round-trips cleanly.
 *
 * Format produced:
 *   # TypeLabel: Node Name
 *   Field Label: value
 *   Tag Field: Name One, Name Two
 *   Members: Name One, Name Two
 *   ---
 *   Description text (multi-line ok)
 *
 * Only built-in NODE_TYPES are included (custom types aren't importable anyway).
 * Nodes whose type isn't in NODE_TYPES are silently skipped.
 */
export function exportToMarkdown(nodes, tags) {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const tagMap  = new Map(tags.map((t) => [t.id, t]));

  const blocks = [];

  for (const node of nodes) {
    const schema = NODE_TYPES[node.type];
    if (!schema) continue; // skip custom types not in import schema

    const name = node.fields?.name || 'Unnamed';
    const fieldLines = [];
    let descriptionText = '';

    for (const fieldDef of (schema.fields || [])) {
      if (fieldDef.key === 'name') continue; // name is in the header

      const value = node.fields?.[fieldDef.key];

      // Description always goes after ---
      if (fieldDef.key === 'description') {
        if (value && String(value).trim()) {
          descriptionText = String(value).trim();
        }
        continue;
      }

      if (fieldDef.type === 'tags') {
        if (!Array.isArray(value) || value.length === 0) continue;
        const names = value
          .map((tagId) => tagMap.get(tagId)?.name ?? null)
          .filter(Boolean);
        if (names.length > 0) {
          fieldLines.push(`${fieldDef.label}: ${names.join(', ')}`);
        }

      } else if (fieldDef.type === 'noderefs') {
        if (!Array.isArray(value) || value.length === 0) continue;
        const names = value
          .map((nodeId) => nodeMap.get(nodeId)?.fields?.name ?? null)
          .filter(Boolean);
        if (names.length > 0) {
          fieldLines.push(`${fieldDef.label}: ${names.join(', ')}`);
        }

      } else if (fieldDef.type === 'textarea') {
        // Non-description textareas: flatten newlines — import format is single-line
        if (!value || !String(value).trim()) continue;
        const flat = String(value).trim().replace(/\n+/g, ' ');
        fieldLines.push(`${fieldDef.label}: ${flat}`);

      } else {
        // text, select, number, boolean, date, color, etc.
        if (value === undefined || value === null || value === '') continue;
        fieldLines.push(`${fieldDef.label}: ${value}`);
      }
    }

    const block = [`# ${schema.label}: ${name}`, ...fieldLines];
    if (descriptionText) {
      block.push('---');
      block.push(descriptionText);
    }
    blocks.push(block.join('\n'));
  }

  return blocks.join('\n\n') + '\n';
}

/**
 * Fetch all campaign stores from D1 and bundle into a single JSON backup.
 *
 * Includes every store blob saved for the campaign: nodes, tags, widgets,
 * settings, territories, snapshots, hierarchies, overlays, maps, and any
 * others added in future. Version 2+ uses the live API instead of localStorage.
 *
 * Returns a JSON string ready for downloadFile().
 */
export async function exportToJSON(campaignId, campaignName) {
  const stores = await loadCampaign(campaignId);

  const data = {
    _meta: {
      exportedAt: new Date().toISOString(),
      campaignId,
      campaignName,
      version: 2,
    },
    ...stores,
  };

  return JSON.stringify(data, null, 2);
}

/**
 * Trigger a file download in the browser.
 */
export function downloadFile(content, filename, mimeType = 'text/plain') {
  const blob = new Blob([content], { type: mimeType });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Sanitize a campaign name into a safe filename segment */
export function safeFilename(name) {
  return (name || 'campaign')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
}
