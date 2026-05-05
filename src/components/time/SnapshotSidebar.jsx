import { useEffect, useRef, useState, useMemo } from 'react';
import { X, Clock, Trash, ArrowCounterClockwise, CalendarBlank, Camera, Check, Lightning } from '@phosphor-icons/react';
import useSnapshotStore from '../../stores/snapshotStore';
import useNodeStore from '../../stores/nodeStore';
import useTerritoryStore from '../../stores/territoryStore';

// ── Tree helpers ──────────────────────────────────────────────────────────────

/**
 * Given a flat list of snapshots, build a tree.
 * Returns { byId, roots } where each node has a .children array.
 */
function buildTree(snapshots) {
  const byId = {};
  snapshots.forEach((s) => { byId[s.id] = { ...s, children: [] }; });

  const roots = [];
  snapshots.forEach((s) => {
    const node = byId[s.id];
    if (s.parentSnapshotId && byId[s.parentSnapshotId]) {
      byId[s.parentSnapshotId].children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort children oldest first
  const sortChildren = (node) => {
    node.children.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    node.children.forEach(sortChildren);
  };
  roots.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
  roots.forEach(sortChildren);

  return { byId, roots };
}

/**
 * Find the path of IDs from root to a given snapshot (the "main spine").
 */
function getSpinePath(byId, targetId) {
  if (!targetId || !byId[targetId]) return new Set();
  const path = new Set();
  let cur = byId[targetId];
  while (cur) {
    path.add(cur.id);
    cur = cur.parentSnapshotId ? byId[cur.parentSnapshotId] : null;
  }
  return path;
}

// ── Formatting ────────────────────────────────────────────────────────────────

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConfirmDelete({ onConfirm, onCancel }) {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginTop: 6 }}>
      <span style={{ fontSize: 11, color: 'var(--danger)' }}>Delete?</span>
      <button
        className="btn btn-sm"
        style={{ background: 'var(--danger-dim)', color: 'var(--danger)', border: '1px solid var(--danger)', padding: '2px 8px' }}
        onClick={onConfirm}
      >Yes</button>
      <button className="btn btn-secondary btn-sm" style={{ padding: '2px 8px' }} onClick={onCancel}>
        No
      </button>
    </div>
  );
}

/**
 * A single snapshot node in the tree.
 *
 * Props:
 *   snap           — snapshot object (with .children[])
 *   isCurrent      — this is the live state
 *   isOnSpine      — on the path root→current
 *   isBranch       — indented alt-timeline node
 *   isLast         — last child (affects connector line drawing)
 *   currentId      — currentSnapshotId (for highlighting)
 *   spineIds       — Set of IDs on the current spine
 *   onRestore      — (id) => void
 *   onDelete       — (id) => void
 *   depth          — nesting depth
 */
function SnapshotNode({
  snap,
  isCurrent,
  isOnSpine,
  isBranch,
  isLast,
  currentId,
  spineIds,
  onRestore,
  onDelete,
  depth,
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [restored, setRestored] = useState(false);
  const restoredTimerRef = useRef(null);
  useEffect(() => () => clearTimeout(restoredTimerRef.current), []);

  const hasChildren = snap.children.length > 0;
  const nodeCount = snap.worldState?.nodes?.length ?? 0;
  const terrCount = snap.worldState?.territories?.length ?? 0;

  // Which children are on-spine vs branching off
  const spineChild   = snap.children.find((c) => spineIds.has(c.id));
  const branchChildren = snap.children.filter((c) => !spineIds.has(c.id));

  const handleRestore = () => {
    onRestore(snap.id);
    setRestored(true);
    clearTimeout(restoredTimerRef.current);
    restoredTimerRef.current = setTimeout(() => setRestored(false), 2500);
  };

  const dotColor = isCurrent
    ? 'var(--accent)'
    : isOnSpine
    ? 'var(--text-secondary)'
    : 'var(--border-strong)';

  const dotBorder = isCurrent
    ? '2px solid var(--accent)'
    : isOnSpine
    ? '2px solid var(--text-muted)'
    : '2px solid var(--border-strong)';

  const dotGlow = isCurrent
    ? '0 0 10px var(--accent-glow), 0 0 3px var(--accent)'
    : 'none';

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* ── Node row ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 0 }}>

        {/* ── Spine / connector column ── */}
        <div style={{
          width: isBranch ? 40 : 24,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
        }}>
          {/* Branch connector: horizontal line from parent spine to this dot */}
          {isBranch && (
            <div style={{
              position: 'absolute',
              top: 8,
              left: 0,
              width: 32,
              height: 1,
              background: 'var(--border)',
            }} />
          )}

          {/* The dot */}
          <div style={{
            width: isCurrent ? 14 : 10,
            height: isCurrent ? 14 : 10,
            borderRadius: '50%',
            background: isCurrent ? 'var(--accent)' : 'var(--bg-elevated)',
            border: dotBorder,
            boxShadow: dotGlow,
            flexShrink: 0,
            marginTop: 2,
            zIndex: 1,
            transition: 'all 0.2s',
          }} />

          {/* Vertical line below dot (connects to next node or branch) */}
          {(hasChildren || branchChildren.length > 0) && (
            <div style={{
              width: 1,
              flex: 1,
              minHeight: 12,
              background: isOnSpine ? 'var(--border-strong)' : 'var(--border)',
              marginTop: 2,
            }} />
          )}
        </div>

        {/* ── Card content ── */}
        <div style={{
          flex: 1,
          marginLeft: 8,
          marginBottom: hasChildren || branchChildren.length > 0 ? 0 : 6,
          paddingBottom: 14,
          minWidth: 0,
        }}>
          {/* Header row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, justifyContent: 'space-between' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{
                  fontSize: isCurrent ? 13 : 12,
                  fontWeight: isCurrent || isOnSpine ? 600 : 400,
                  color: isCurrent ? 'var(--accent)' : isOnSpine ? 'var(--text-primary)' : 'var(--text-secondary)',
                  lineHeight: 1.3,
                }}>
                  {snap.name}
                </span>
                {isCurrent && (
                  <span style={{
                    fontSize: 9,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-pill)',
                    background: 'var(--accent-dim)',
                    color: 'var(--accent)',
                    border: '1px solid rgba(255,146,72,0.3)',
                    flexShrink: 0,
                  }}>
                    Live
                  </span>
                )}
              </div>

              {/* Meta row */}
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, display: 'flex', gap: 6 }}>
                <span>{formatDate(snap.createdAt)}</span>
                <span>·</span>
                <span>{nodeCount} nodes</span>
                {terrCount > 0 && <><span>·</span><span>{terrCount} territories</span></>}
              </div>

              {/* Summary */}
              {snap.summary && (
                <div style={{
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  marginTop: 4,
                  lineHeight: 1.45,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}>
                  {snap.summary}
                </div>
              )}
            </div>

            {/* Delete button */}
            {!isCurrent && (
              <button
                className="btn-icon"
                style={{ color: 'var(--text-muted)', flexShrink: 0, opacity: 0.6 }}
                onClick={() => setConfirmDelete(true)}
                title="Delete snapshot"
              >
                <Trash size={12} />
              </button>
            )}
          </div>

          {/* Actions */}
          {!isCurrent && (
            confirmDelete ? (
              <ConfirmDelete
                onConfirm={() => { onDelete(snap.id); setConfirmDelete(false); }}
                onCancel={() => setConfirmDelete(false)}
              />
            ) : restored ? (
              <span style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 4, marginTop: 6 }}>
                ✓ Restored — future commits branch from here
              </span>
            ) : (
              <button
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 4 }}
                onClick={handleRestore}
                title="Restore this state and branch future timelines from here"
              >
                <ArrowCounterClockwise size={11} />
                Restore
              </button>
            )
          )}
        </div>
      </div>

      {/* ── Branch children (alternate timelines off this node) ── */}
      {branchChildren.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginLeft: 24 }}>
          {branchChildren.map((child, bi) => (
            <div key={child.id} style={{ display: 'flex', alignItems: 'flex-start' }}>
              {/* L-shaped connector from spine to branch */}
              <div style={{
                width: 14,
                flexShrink: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}>
                <div style={{
                  width: 1,
                  height: 14,
                  background: 'var(--border)',
                  alignSelf: 'center',
                }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <SnapshotNode
                  snap={child}
                  isCurrent={child.id === currentId}
                  isOnSpine={spineIds.has(child.id)}
                  isBranch
                  isLast={bi === branchChildren.length - 1}
                  currentId={currentId}
                  spineIds={spineIds}
                  onRestore={onRestore}
                  onDelete={onDelete}
                  depth={depth + 1}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Spine child (continues main path downward) ── */}
      {spineChild && (
        <SnapshotNode
          snap={spineChild}
          isCurrent={spineChild.id === currentId}
          isOnSpine={spineIds.has(spineChild.id)}
          isBranch={false}
          isLast
          currentId={currentId}
          spineIds={spineIds}
          onRestore={onRestore}
          onDelete={onDelete}
          depth={depth}
        />
      )}
    </div>
  );
}

// ── AutoSaveRow ───────────────────────────────────────────────────────────────

function AutoSaveRow({ snap, onRestore }) {
  const [restored, setRestored] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  const handleRestore = async () => {
    setRestoring(true);
    await onRestore();
    setRestoring(false);
    setRestored(true);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setRestored(false), 2500);
  };

  return (
    <div className="snap-auto-row">
      <div className="snap-auto-meta">
        <span className="snap-auto-time">{formatDate(snap.createdAt)}</span>
        <span className="snap-auto-counts">
          {snap.nodeCount} node{snap.nodeCount !== 1 ? 's' : ''}
          {snap.terrCount > 0 && ` · ${snap.terrCount} territories`}
        </span>
      </div>
      {restored ? (
        <span style={{ fontSize: 10, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 3 }}>
          <Check size={10} weight="bold" /> Restored
        </span>
      ) : (
        <button
          className="btn btn-secondary btn-sm"
          style={{ padding: '2px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 3 }}
          onClick={handleRestore}
          disabled={restoring}
        >
          <ArrowCounterClockwise size={10} />
          {restoring ? '…' : 'Restore'}
        </button>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function SnapshotSidebar({ campaignId, onClose }) {
  const loadSnapshots              = useSnapshotStore((s) => s.loadSnapshots);
  const autoSnapshots              = useSnapshotStore((s) => s.autoSnapshots);
  const restoreAutoSnapshot        = useSnapshotStore((s) => s.restoreAutoSnapshot);
  const takeSnapshot               = useSnapshotStore((s) => s.takeSnapshot);
  const deleteSnapshot             = useSnapshotStore((s) => s.deleteSnapshot);
  const writeSnapshotToLiveStorage = useSnapshotStore((s) => s.writeSnapshotToLiveStorage);
  const currentSnapshotId          = useSnapshotStore((s) => s.currentSnapshotId);
  const allSnapshots               = useSnapshotStore((s) => s.snapshots);
  const nodes                      = useNodeStore((s) => s.nodes);
  const loadNodes                  = useNodeStore((s) => s.loadNodes);
  const territories                = useTerritoryStore((s) => s.territories);
  const loadTerritories            = useTerritoryStore((s) => s.loadTerritories);

  // ── Quick-snap form state ─────────────────────────────────────────────────
  const [snapFormOpen, setSnapFormOpen] = useState(false);
  const [snapName,     setSnapName]     = useState('');
  const [snapNote,     setSnapNote]     = useState('');
  const [saving,       setSaving]       = useState(false);
  const [savedFlash,   setSavedFlash]   = useState(false);
  const nameInputRef = useRef(null);

  useEffect(() => {
    if (snapFormOpen && nameInputRef.current) nameInputRef.current.focus();
  }, [snapFormOpen]);

  const openForm = () => {
    const now = new Date();
    const label = now.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      + ' ' + now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    setSnapName(`World Snapshot — ${label}`);
    setSnapNote('');
    setSnapFormOpen(true);
  };

  const handleTakeSnapshot = async () => {
    if (!snapName.trim()) return;
    setSaving(true);
    await takeSnapshot(
      campaignId,
      snapName.trim(),
      { nodes: nodes ?? [], territories: territories ?? [] },
      snapNote.trim(),
    );
    setSaving(false);
    setSnapFormOpen(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2200);
  };

  // ── Snapshot list ─────────────────────────────────────────────────────────

  useEffect(() => {
    loadSnapshots(campaignId);
  }, [campaignId, loadSnapshots]);

  const snapshots = useMemo(
    () => allSnapshots
      .filter((s) => s.campaignId === campaignId)
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [allSnapshots, campaignId],
  );

  const { byId, roots } = useMemo(() => buildTree(snapshots), [snapshots]);
  const spineIds         = useMemo(() => getSpinePath(byId, currentSnapshotId), [byId, currentSnapshotId]);

  const handleRestore = (snapshotId) => {
    const ok = writeSnapshotToLiveStorage(snapshotId);
    if (ok) {
      loadNodes(campaignId);
      loadTerritories(campaignId);
      loadSnapshots(campaignId);
    }
  };

  const handleDelete = (snapshotId) => {
    deleteSnapshot(campaignId, snapshotId);
  };

  return (
    <div className="snapshot-sidebar">
      {/* Header */}
      <div className="snapshot-sidebar__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} style={{ color: 'var(--accent)', flexShrink: 0 }} weight="duotone" />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
              World Snapshots
            </div>
            {snapshots.length > 0 && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {snapshots.length} checkpoint{snapshots.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {savedFlash && (
            <span style={{ fontSize: 11, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Check size={11} weight="bold" /> Saved
            </span>
          )}
          <button
            className="btn btn-secondary btn-sm"
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px' }}
            onClick={openForm}
            title="Take a snapshot of the current world state"
          >
            <Camera size={12} weight="fill" />
            Snapshot
          </button>
          <button className="btn-icon" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Quick-snap form */}
      {snapFormOpen && (
        <div className="snapshot-sidebar__snap-form">
          <input
            ref={nameInputRef}
            className="snap-form-input"
            placeholder="Snapshot name…"
            value={snapName}
            onChange={(e) => setSnapName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleTakeSnapshot();
              if (e.key === 'Escape') setSnapFormOpen(false);
            }}
          />
          <textarea
            className="snap-form-textarea"
            placeholder="Optional note (what's happening in the world right now…)"
            value={snapNote}
            onChange={(e) => setSnapNote(e.target.value)}
            rows={2}
          />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary btn-sm" onClick={() => setSnapFormOpen(false)}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleTakeSnapshot}
              disabled={saving || !snapName.trim()}
            >
              {saving ? 'Saving…' : 'Save Snapshot'}
            </button>
          </div>
        </div>
      )}

      {/* Body */}
      <div className="snapshot-sidebar__body">
        {snapshots.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center' }}>
            <CalendarBlank size={32} style={{ color: 'var(--text-muted)', marginBottom: 12 }} />
            <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              No snapshots yet.
            </p>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.5 }}>
              Click <strong style={{ color: 'var(--text-secondary)' }}>Snapshot</strong> above
              to save the current state of your world — nodes, positions, everything.
            </p>
          </div>
        ) : (
          <div style={{ padding: '16px 16px 16px 12px' }}>
            {roots.map((root) => (
              <SnapshotNode
                key={root.id}
                snap={root}
                isCurrent={root.id === currentSnapshotId}
                isOnSpine={spineIds.has(root.id)}
                isBranch={false}
                isLast={false}
                currentId={currentSnapshotId}
                spineIds={spineIds}
                onRestore={handleRestore}
                onDelete={handleDelete}
                depth={0}
              />
            ))}
          </div>
        )}
      </div>

      {/* Auto-saves section */}
      {autoSnapshots.length > 0 && (
        <div className="snapshot-sidebar__auto-saves">
          <div className="snap-auto-header">
            <Lightning size={11} weight="fill" style={{ color: 'var(--accent)', flexShrink: 0 }} />
            <span>Auto-saves</span>
            <span className="snap-auto-hint">last {autoSnapshots.length} · every 30 min</span>
          </div>
          {[...autoSnapshots].reverse().map((snap, i) => (
            <AutoSaveRow
              key={snap.id}
              snap={snap}
              onRestore={async () => {
                const idx = autoSnapshots.length - 1 - i;
                const ok = await restoreAutoSnapshot(campaignId, idx);
                if (ok) {
                  loadNodes(campaignId);
                  loadTerritories(campaignId);
                }
              }}
            />
          ))}
        </div>
      )}

      {/* Footer hint */}
      <div className="snapshot-sidebar__footer">
        <p style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.5 }}>
          Restore any checkpoint to branch future timelines from that point. Rejected timelines remain accessible unless deleted.
        </p>
      </div>
    </div>
  );
}
