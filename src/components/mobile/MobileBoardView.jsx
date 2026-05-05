import { useState, useMemo, useCallback, useRef } from 'react';
import {
  Plus, ArrowsLeftRight, X, MagnifyingGlass,
  Tray, ArrowRight, Check,
} from '@phosphor-icons/react';
import useNodeStore from '../../stores/nodeStore';
import useCampaignStore from '../../stores/campaignStore';
import useSettingsStore from '../../stores/settingsStore';
import NodeIcon from '../common/NodeIcon';
import { getTypeColor, getTypeLabel, getTypeIcon } from '../../utils/typeColors';
import { NODE_TYPES, isAbstractType } from '../../utils/nodeSchemas';
import { resolveIcon } from '../../utils/iconRegistry';
import { getRule, handleKanbanDrop, applyRelationship } from '../../utils/relationshipRules';

// ── Board Picker ──────────────────────────────────────────────────────────────
// Adapted from the desktop ColumnPicker — same two tabs (Specific Node / Type Pool)
// but adapted for mobile sizing.

function BoardPicker({ campaignNodes, otherBoard, onSelect, onClose, nodeTypeOverrides, customNodeTypes }) {
  const [tab, setTab]       = useState('pool');
  const [filter, setFilter] = useState('');

  const allTypes = [...Object.keys(NODE_TYPES), ...customNodeTypes.map((c) => c.id)];

  // Prevent duplicate type-pool boards
  const blockedType = otherBoard?.kind === 'pool' ? otherBoard.nodeType : null;

  const poolTypes = useMemo(() => {
    const q = filter.toLowerCase();
    return allTypes.filter((t) => {
      if (t === blockedType) return false;
      const label = getTypeLabel(t, NODE_TYPES, nodeTypeOverrides, customNodeTypes).toLowerCase();
      return !q || label.includes(q);
    });
  }, [allTypes, blockedType, filter, nodeTypeOverrides, customNodeTypes]);

  const entityNodes = useMemo(() => {
    const q = filter.toLowerCase();
    return campaignNodes
      .filter((n) => !q || (n.fields?.name || '').toLowerCase().includes(q))
      .sort((a, b) => (a.fields?.name || '').localeCompare(b.fields?.name || ''));
  }, [campaignNodes, filter]);

  const groupedEntities = useMemo(() => {
    const map = {};
    for (const n of entityNodes) {
      if (!map[n.type]) map[n.type] = [];
      map[n.type].push(n);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [entityNodes]);

  return (
    <div className="mboard-picker-backdrop" onClick={onClose}>
      <div className="mboard-picker-sheet" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="mboard-picker-header">
          <div className="mboard-picker-handle" />
          <div className="mboard-picker-title-row">
            <span className="mboard-picker-title">Choose Board</span>
            <button className="btn-icon" onClick={onClose}><X size={18} /></button>
          </div>

          {/* Tabs */}
          <div className="mboard-picker-tabs">
            {[['pool', 'Type Pool'], ['entity', 'Specific Node']].map(([t, label]) => (
              <button
                key={t}
                className={`mboard-picker-tab${tab === t ? ' active' : ''}`}
                onClick={() => { setTab(t); setFilter(''); }}
              >{label}</button>
            ))}
          </div>

          {/* Search */}
          <div className="mboard-picker-search">
            <MagnifyingGlass size={14} />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search..."
              autoFocus
            />
          </div>
        </div>

        {/* Body */}
        <div className="mboard-picker-body">

          {tab === 'pool' && poolTypes.map((type) => {
            const iconName = getTypeIcon(type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
            const Icon     = resolveIcon(iconName);
            const color    = getTypeColor(type, nodeTypeOverrides, customNodeTypes);
            const label    = getTypeLabel(type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
            const count    = campaignNodes.filter((n) => n.type === type).length;
            return (
              <button
                key={type}
                className="mboard-picker-row"
                onClick={() => onSelect({ kind: 'pool', nodeType: type })}
              >
                <div className="mboard-picker-row-icon" style={{ background: `${color}18`, color }}>
                  <Icon size={16} weight="duotone" />
                </div>
                <span className="mboard-picker-row-label">All {label}s</span>
                <span className="mboard-picker-row-count">{count}</span>
              </button>
            );
          })}

          {tab === 'pool' && poolTypes.length === 0 && (
            <div className="mboard-picker-empty">
              {filter ? 'No matches' : 'No available type pools'}
            </div>
          )}

          {tab === 'entity' && groupedEntities.map(([type, nodes]) => {
            const iconName   = getTypeIcon(type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
            const Icon       = resolveIcon(iconName);
            const color      = getTypeColor(type, nodeTypeOverrides, customNodeTypes);
            const label      = getTypeLabel(type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
            const isAbstract = isAbstractType(type, customNodeTypes);
            return (
              <div key={type}>
                <div className="mboard-picker-group-header">
                  {label}
                  {isAbstract && <span className="mboard-picker-group-badge">members</span>}
                </div>
                {nodes.map((n) => (
                  <button
                    key={n.id}
                    className="mboard-picker-row"
                    onClick={() => onSelect({ kind: 'entity', nodeId: n.id, nodeType: type })}
                  >
                    <div className="mboard-picker-row-icon" style={{ background: `${color}18`, color }}>
                      <Icon size={16} weight="duotone" />
                    </div>
                    <span className="mboard-picker-row-label">
                      {n.fields?.name || 'Unnamed'}
                    </span>
                    <span className="mboard-picker-row-type" style={{ color }}>{label}</span>
                  </button>
                ))}
              </div>
            );
          })}

          {tab === 'entity' && groupedEntities.length === 0 && (
            <div className="mboard-picker-empty">
              {filter ? 'No matches' : 'No nodes in this campaign'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Move-or-Link Prompt ───────────────────────────────────────────────────────

function MoveOrLinkPrompt({ sourceNode, destinationNode, rule, onMove, onLink, onClose }) {
  const sourceName = sourceNode?.fields?.name || 'Node';
  const destName   = destinationNode?.fields?.name || 'Node';

  return (
    <div className="mboard-prompt-backdrop" onClick={onClose}>
      <div className="mboard-prompt-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="mboard-prompt-handle" />
        <div className="mboard-prompt-body">
          <p className="mboard-prompt-text">
            <strong>{sourceName}</strong> → <strong>{destName}</strong>
          </p>
          <p className="mboard-prompt-sub">
            How should this relationship be created?
          </p>
          <button className="mboard-prompt-btn primary" onClick={onMove}>
            <ArrowRight size={16} />
            Move here
            <span className="mboard-prompt-hint">Remove previous {rule?.defaultLabel} link</span>
          </button>
          <button className="mboard-prompt-btn" onClick={onLink}>
            <Check size={16} />
            Also link here
            <span className="mboard-prompt-hint">Keep existing links</span>
          </button>
          <button className="mboard-prompt-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── Node Card ─────────────────────────────────────────────────────────────────

function BoardCard({
  node,
  isPicked,
  isDropTarget,
  canReceiveDrop,
  onTap,
  onPickToggle,
  onDrop,
  nodeTypeOverrides,
  customNodeTypes,
}) {
  const color    = getTypeColor(node.type, nodeTypeOverrides, customNodeTypes);
  const iconName = getTypeIcon(node.type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
  const Icon     = resolveIcon(iconName);
  const name     = node.fields?.name || 'Unnamed';
  const isStaged = node.mapId === '__staging__';

  const handleCardTap = () => {
    if (isDropTarget && canReceiveDrop) {
      onDrop(node);
    } else if (!isDropTarget) {
      onTap(node.id);
    }
  };

  return (
    <div
      className={[
        'mboard-card',
        isPicked       ? 'picked'      : '',
        isDropTarget   ? 'drop-target' : '',
        canReceiveDrop ? 'droppable'   : '',
      ].filter(Boolean).join(' ')}
      onClick={handleCardTap}
    >
      <div className="mboard-card-icon" style={{ background: `${color}18`, color }}>
        <Icon size={14} weight="duotone" />
      </div>
      <div className="mboard-card-info">
        <span className="mboard-card-name">{name}</span>
        {isStaged && (
          <span className="mboard-card-staged">
            <Tray size={9} /> Staged
          </span>
        )}
      </div>
      {!isDropTarget && (
        <button
          className={`mboard-card-pick-btn${isPicked ? ' active' : ''}`}
          onClick={(e) => { e.stopPropagation(); onPickToggle(node.id); }}
          title={isPicked ? 'Cancel' : 'Move this node'}
        >
          <ArrowRight size={13} />
        </button>
      )}
      {isDropTarget && canReceiveDrop && (
        <span className="mboard-card-drop-hint">Drop</span>
      )}
    </div>
  );
}

// ── Board Column ──────────────────────────────────────────────────────────────

function BoardColumn({
  side,
  board,
  allNodes,
  campaignNodes,
  pickedNodeId,
  pickedNodeType,
  onOpenPicker,
  onNodeTap,
  onPickToggle,
  onDropOntoCard,
  onDropOntoBoard,
  nodeTypeOverrides,
  customNodeTypes,
}) {
  // Resolve which nodes populate this board
  const boardNodes = useMemo(() => {
    if (!board) return [];
    if (board.kind === 'pool') {
      return campaignNodes.filter((n) => n.type === board.nodeType);
    }
    if (board.kind === 'entity') {
      const focusNode = allNodes.find((n) => n.id === board.nodeId);
      if (!focusNode) return [];
      const isAbstract = isAbstractType(focusNode.type, customNodeTypes);
      if (isAbstract) {
        const memberIds = focusNode.fields?.members || [];
        return memberIds.map((id) => allNodes.find((n) => n.id === id)).filter(Boolean);
      }
      return campaignNodes.filter((n) => n.parentNodeId === focusNode.id);
    }
    return [];
  }, [board, campaignNodes, allNodes, customNodeTypes]);

  const isDropMode = !!pickedNodeId;

  // For focused-node boards, the focused node itself is the drop target
  const focusNode = board?.kind === 'entity' ? allNodes.find((n) => n.id === board.nodeId) : null;

  // Determine if the picked node can be dropped onto a given destination node
  const canDropOnto = useCallback((destNode) => {
    if (!pickedNodeId || !pickedNodeType || !destNode) return false;
    const rule = getRule(pickedNodeType, destNode.type);
    return rule.allowed;
  }, [pickedNodeId, pickedNodeType]);

  // Header label
  let headerLabel = 'Board';
  let headerSub   = null;
  let headerColor = 'var(--text-muted)';
  if (board?.kind === 'pool') {
    headerLabel = `All ${getTypeLabel(board.nodeType, NODE_TYPES, nodeTypeOverrides, customNodeTypes)}s`;
    headerColor = getTypeColor(board.nodeType, nodeTypeOverrides, customNodeTypes);
  } else if (board?.kind === 'entity' && focusNode) {
    headerLabel = focusNode.fields?.name || 'Unnamed';
    headerSub   = getTypeLabel(focusNode.type, NODE_TYPES, nodeTypeOverrides, customNodeTypes);
    headerColor = getTypeColor(focusNode.type, nodeTypeOverrides, customNodeTypes);
  }

  // Empty state
  if (!board) {
    return (
      <div className="mboard-col mboard-col-empty">
        <div className="mboard-col-empty-inner">
          <button className="mboard-add-btn" onClick={onOpenPicker}>
            <Plus size={22} />
          </button>
          <span className="mboard-col-empty-hint">Tap + to add a board</span>
        </div>
      </div>
    );
  }

  return (
    <div className={`mboard-col${isDropMode ? ' is-drop-mode' : ''}`}>
      {/* Column header */}
      <div className="mboard-col-header" style={{ '--col-color': headerColor }}>
        <div className="mboard-col-header-accent" />
        <div className="mboard-col-header-info">
          <span className="mboard-col-header-title">{headerLabel}</span>
          {headerSub && <span className="mboard-col-header-sub" style={{ color: headerColor }}>{headerSub}</span>}
        </div>
        <span className="mboard-col-count">{boardNodes.length}</span>
        <button
          className="mboard-swap-btn"
          onClick={onOpenPicker}
          title="Change board"
        >
          <ArrowsLeftRight size={14} />
        </button>
      </div>

      {/* Focused-node drop zone — when in drop mode and this is entity board */}
      {isDropMode && focusNode && canDropOnto(focusNode) && (
        <button
          className="mboard-focused-drop-zone"
          style={{ borderColor: headerColor, color: headerColor }}
          onClick={() => onDropOntoBoard(focusNode)}
        >
          Drop onto {focusNode.fields?.name || 'this node'}
        </button>
      )}

      {/* Cards */}
      <div className="mboard-col-body">
        {boardNodes.length === 0 && (
          <div className="mboard-col-placeholder">
            {isDropMode ? 'No cards to drop onto' : 'Empty'}
          </div>
        )}
        {boardNodes.map((node) => (
          <BoardCard
            key={node.id}
            node={node}
            isPicked={pickedNodeId === node.id}
            isDropTarget={isDropMode && pickedNodeId !== node.id}
            canReceiveDrop={isDropMode && pickedNodeId !== node.id && canDropOnto(node)}
            onTap={onNodeTap}
            onPickToggle={onPickToggle}
            onDrop={onDropOntoCard}
            nodeTypeOverrides={nodeTypeOverrides}
            customNodeTypes={customNodeTypes}
          />
        ))}
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MobileBoardView() {
  const campaignId        = useCampaignStore((s) => s.activeCampaignId);
  const allNodes          = useNodeStore((s) => s.nodes);
  const selectNode        = useNodeStore((s) => s.selectNode);
  const updateNode        = useNodeStore((s) => s.updateNode);
  const updateNodeFields  = useNodeStore((s) => s.updateNodeFields);
  const nestNode          = useNodeStore((s) => s.nestNode);
  const nodeTypeOverrides = useSettingsStore((s) => s.nodeTypeOverrides) || {};
  const customNodeTypes   = useSettingsStore((s) => s.customNodeTypes)   || [];

  // All campaign nodes (includes staged)
  const campaignNodes = useMemo(
    () => allNodes.filter((n) => n.campaignId === campaignId),
    [allNodes, campaignId]
  );

  // Board state: null = empty, { kind: 'pool', nodeType } or { kind: 'entity', nodeId, nodeType }
  const [leftBoard,  setLeftBoard]  = useState(null);
  const [rightBoard, setRightBoard] = useState(null);

  // Which side is currently showing the picker
  const [pickerSide, setPickerSide] = useState(null); // 'left' | 'right' | null

  // Pick-and-drop state
  const [pickedNodeId,   setPickedNodeId]   = useState(null);
  const [pickedNodeType, setPickedNodeType] = useState(null);

  // Move-or-link prompt
  const [prompt, setPrompt] = useState(null); // { sourceNode, destinationNode, rule }

  const openPicker  = useCallback((side) => setPickerSide(side), []);
  const closePicker = useCallback(() => setPickerSide(null), []);

  const handleSelectBoard = useCallback((boardDef) => {
    if (pickerSide === 'left')  setLeftBoard(boardDef);
    if (pickerSide === 'right') setRightBoard(boardDef);
    setPickerSide(null);
  }, [pickerSide]);

  const handlePickToggle = useCallback((nodeId) => {
    if (pickedNodeId === nodeId) {
      setPickedNodeId(null);
      setPickedNodeType(null);
    } else {
      const node = allNodes.find((n) => n.id === nodeId);
      setPickedNodeId(nodeId);
      setPickedNodeType(node?.type || null);
    }
  }, [pickedNodeId, allNodes]);

  const handleNodeTap = useCallback((nodeId) => {
    selectNode(nodeId);
  }, [selectNode]);

  const attemptDrop = useCallback((sourceNode, destinationNode) => {
    if (!sourceNode || !destinationNode) return;

    const result = handleKanbanDrop({
      sourceNode,
      destinationNode,
      allNodes,
      campaignId,
      updateNode,
      updateNodeFields,
      nestNode,
    });

    if (result.action === 'prompt') {
      setPrompt({ sourceNode, destinationNode, rule: result.rule });
    } else if (result.action === 'denied') {
      // Could show a toast here in the future
      console.warn('[MobileBoardView] Drop denied:', result.reason);
    }

    setPickedNodeId(null);
    setPickedNodeType(null);
  }, [allNodes, campaignId, updateNode, updateNodeFields, nestNode]);

  const handleDropOntoCard = useCallback((destNode) => {
    const sourceNode = allNodes.find((n) => n.id === pickedNodeId);
    attemptDrop(sourceNode, destNode);
  }, [pickedNodeId, allNodes, attemptDrop]);

  const handleDropOntoBoard = useCallback((focusNode) => {
    const sourceNode = allNodes.find((n) => n.id === pickedNodeId);
    attemptDrop(sourceNode, focusNode);
  }, [pickedNodeId, allNodes, attemptDrop]);

  const handlePromptMove = useCallback(() => {
    if (!prompt) return;
    applyRelationship({
      sourceNode: prompt.sourceNode,
      destinationNode: prompt.destinationNode,
      mode: 'move',
      allNodes,
      campaignId,
      updateNode,
      updateNodeFields,
      nestNode,
    });
    setPrompt(null);
  }, [prompt, allNodes, campaignId, updateNode, updateNodeFields, nestNode]);

  const handlePromptLink = useCallback(() => {
    if (!prompt) return;
    applyRelationship({
      sourceNode: prompt.sourceNode,
      destinationNode: prompt.destinationNode,
      mode: 'link',
      allNodes,
      campaignId,
      updateNode,
      updateNodeFields,
      nestNode,
    });
    setPrompt(null);
  }, [prompt, allNodes, campaignId, updateNode, updateNodeFields, nestNode]);

  // Cancel pick on tap outside (handled via overlay)
  const handleCancelPick = useCallback(() => {
    setPickedNodeId(null);
    setPickedNodeType(null);
  }, []);

  // "Other board" for duplicate rule enforcement
  const otherBoardFor = (side) => side === 'left' ? rightBoard : leftBoard;

  return (
    <div className="mboard-root">

      {/* Pick mode overlay — tap outside boards to cancel */}
      {pickedNodeId && (
        <div className="mboard-pick-overlay" onClick={handleCancelPick} />
      )}

      {/* Pick mode banner */}
      {pickedNodeId && (() => {
        const picked = allNodes.find((n) => n.id === pickedNodeId);
        return (
          <div className="mboard-pick-banner">
            <span>Tap a card to link <strong>{picked?.fields?.name || 'node'}</strong></span>
            <button className="mboard-pick-cancel" onClick={handleCancelPick}>
              <X size={14} />
            </button>
          </div>
        );
      })()}

      {/* Two boards */}
      <div className="mboard-boards">
        <BoardColumn
          side="left"
          board={leftBoard}
          allNodes={allNodes}
          campaignNodes={campaignNodes}
          pickedNodeId={pickedNodeId}
          pickedNodeType={pickedNodeType}
          onOpenPicker={() => openPicker('left')}
          onNodeTap={handleNodeTap}
          onPickToggle={handlePickToggle}
          onDropOntoCard={handleDropOntoCard}
          onDropOntoBoard={handleDropOntoBoard}
          nodeTypeOverrides={nodeTypeOverrides}
          customNodeTypes={customNodeTypes}
        />

        <div className="mboard-divider" />

        <BoardColumn
          side="right"
          board={rightBoard}
          allNodes={allNodes}
          campaignNodes={campaignNodes}
          pickedNodeId={pickedNodeId}
          pickedNodeType={pickedNodeType}
          onOpenPicker={() => openPicker('right')}
          onNodeTap={handleNodeTap}
          onPickToggle={handlePickToggle}
          onDropOntoCard={handleDropOntoCard}
          onDropOntoBoard={handleDropOntoBoard}
          nodeTypeOverrides={nodeTypeOverrides}
          customNodeTypes={customNodeTypes}
        />
      </div>

      {/* Board picker modal */}
      {pickerSide && (
        <BoardPicker
          campaignNodes={campaignNodes}
          otherBoard={otherBoardFor(pickerSide)}
          onSelect={handleSelectBoard}
          onClose={closePicker}
          nodeTypeOverrides={nodeTypeOverrides}
          customNodeTypes={customNodeTypes}
        />
      )}

      {/* Move-or-link prompt */}
      {prompt && (
        <MoveOrLinkPrompt
          sourceNode={prompt.sourceNode}
          destinationNode={prompt.destinationNode}
          rule={prompt.rule}
          onMove={handlePromptMove}
          onLink={handlePromptLink}
          onClose={() => setPrompt(null)}
        />
      )}
    </div>
  );
}
