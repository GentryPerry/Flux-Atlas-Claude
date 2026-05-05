# Flux Atlas — Mobile Kanban & Related Features Spec

**Date:** 2026-04-28  
**Status:** Draft

---

## 1. Current Node Types

Flux Atlas currently supports the following built-in node types:

- NPC
- Location
- Faction
- Religion
- Polity
- Item
- Event

Users may also create custom node types.

There are no built-in Concept or Timeline node types.

---

## 2. Purpose

The mobile kanban view gives users a fast way to organize campaign/world nodes by dragging one node onto another.

Dragging cards creates or updates relationships between nodes, such as:

- An NPC being located in a Location
- An Item being held by an NPC
- A Location becoming a sub-location of another Location
- An NPC joining a Faction
- An NPC following a Religion
- A Location being governed by a Polity

Some drag actions affect the map canvas. Others only create tags or relationship links.

---

## 3. Mobile Kanban Layout

The mobile kanban view always shows exactly **two boards** side by side:

- One board on the left
- One board on the right

There is no single-board mode and no three-board mode.

---

## 4. Board Types

A board can appear in one of two modes:

### 4.1 Node-Type Board

A node-type board shows all nodes of a selected type.

Examples:
- All NPCs
- All Locations
- All Factions
- All Religions
- All Polities
- All Items
- All Events

### 4.2 Focused Node Board

A focused node board shows one specific node as the destination context.

Examples:
- Specific Location: "Black Hollow Keep"
- Specific Faction: "The Ember Court"
- Specific NPC: "Ser Kael"

Focused node boards are used when the user wants to drag multiple nodes into one specific destination.

Example:
To create sub-locations inside "Black Hollow Keep":
- Left board: Focused Location, "Black Hollow Keep"
- Right board: All Locations
- User drags Location cards from the right board into the focused Location board on the left
- The dragged Locations become sub-locations of "Black Hollow Keep"

---

## 5. Duplicate Board Rule

The two boards should not show the same generic node-type board at the same time.

Examples:

Allowed:
- All NPCs + All Locations
- All Items + All NPCs
- Focused Location + All Locations
- Focused Faction + All NPCs

Not allowed:
- All Locations + All Locations
- All NPCs + All NPCs
- All Factions + All Factions

Focused node boards are not considered duplicates of node-type boards because they serve a different function.

Example:

Allowed:
- Focused Location: "Black Hollow Keep"
- All Locations

This is allowed because it enables sub-location nesting.

---

## 6. Empty State

When a board has no selected type or focused node:

- The board renders an empty column
- A centered **+** button is displayed
- Tapping **+** opens the node or board selection popup
- The selected option determines which nodes populate that board

The selection popup should allow the user to choose:
- A node-type board
- A focused node board

---

## 7. Board Switching

Each board has a **swap icon** in its header.

Tapping the swap icon re-opens the board selection popup for that side.

Changing one board does not affect the other board unless the new selection would violate the duplicate board rule.

---

## 8. Node Interaction

### Tap
Tapping a node opens an overlay detail view in a bottom sheet style.

### Expand
Swiping up on the overlay expands the node into the full detail pane.

### Collapse
Swiping down on the full detail pane returns the user to the kanban board the node came from.

---

## 9. Drag Target Model

In kanban view, users drag a source node card onto a destination node card or into a focused node board.

The relationship is created between the source node and the specific destination node.

The board determines which cards are visible, but the relationship is not with the board itself.

Example:
Dragging an NPC card onto a Location card creates a relationship between that NPC and that specific Location.

Example:
Dragging an Item card into a focused NPC board gives that Item to that specific NPC.

---

## 10. Two Types of Kanban Drag

| Type | Description | Map Effect |
|---|---|---|
| Nesting Drag | The source node physically or structurally belongs inside the destination node | Updates map parent-child relationship |
| Tagging Drag | The source node is associated with the destination node | No map change |

### Nesting Drag

Nesting means the source node becomes structurally contained by the destination node.

Examples:
- NPC nested in Location
- Item nested in NPC
- Item nested in Location
- Location nested in Location as a sub-location

Nesting affects the map canvas.

### Tagging Drag

Tagging means the source node gains a relationship connected to the destination node.

Examples:
- NPC joins Faction
- NPC follows Religion
- NPC is affiliated with Polity
- Location is controlled by Faction
- Location is governed by Polity
- Item is associated with Religion, Faction, or Polity

Tagging does not move nodes on the map canvas.

---

## 11. Move vs Also Link

Some drag actions happen immediately. Others prompt the user to choose how the new relationship should behave.

### Move

Move removes the previous relationship of the same relationship type, then creates the new relationship.

Example:
If an NPC follows Religion A and is moved to Religion B:
- The Religion A relationship is removed
- The Religion B relationship is added

Move does not delete the node.

### Also Link

Also Link adds the new relationship while keeping existing relationships of the same type.

Example:
If an NPC is already connected to Faction A and is also linked to Faction B:
- The Faction A relationship remains
- The Faction B relationship is added

Also Link does not duplicate the node. It only adds another relationship.

### UI Language

Avoid using the word "copy" in the user interface because it may imply duplicating the node.

Preferred prompt language:
- **Move here**
- **Also link here**

---

## 12. Relationship Uniqueness

For simplicity, there should only be one relationship between any two specific nodes.

Example:

An NPC and a Faction should not have multiple separate relationships at the same time.

Allowed:
- NPC: Ser Kael → Faction: Ember Court
- Relationship: member of

Not allowed:
- NPC: Ser Kael → Faction: Ember Court
- Relationship 1: member of
- Relationship 2: enemy of
- Relationship 3: spy for

If the relationship between two nodes changes, the existing relationship should be edited instead of creating an additional relationship.

---

## 13. Relationship Labels

Relationships should have default labels so that tags are readable in detail views, exports, and markdown.

Example:
Dragging an NPC into a Faction should create a relationship labeled:
- `member of`

### Default Relationship Labels

| Source | Destination | Default Relationship Label |
|---|---|---|
| NPC | Location | located in |
| NPC | Faction | member of |
| NPC | Religion | follows |
| NPC | Polity | affiliated with |
| Item | NPC | held by |
| Item | Location | located in |
| Item | Faction | owned by |
| Item | Religion | sacred to |
| Item | Polity | owned by |
| Location | Location | sub-location of |
| Location | Faction | controlled by |
| Location | Religion | sacred to |
| Location | Polity | governed by |

### Editing Relationship Labels

Relationship labels should be editable in two places:

1. **Settings Menu**
   - Used to edit global default relationship labels.
   - These defaults affect future relationships.
   - Example: Change the default NPC → Religion label from `follows` to `devotee of`.

2. **Node Detail Pane**
   - Used to edit an individual relationship between two specific nodes.
   - Example: Change Ser Kael's relationship to the Ember Court from `member of` to `exiled from`.

If a global default is changed, existing individual relationships should not automatically change unless a separate bulk update feature is added later.

---

## 14. Built-In Relationship Rules

### 14.1 NPC Dragged To

| Destination | Behavior | Relationship Type | Map Effect |
|---|---|---|---|
| Location | Move, no prompt | Nesting | Nests on map |
| Faction | Prompt: Move here / Also link here | Tagging | No map change |
| Religion | Move, no prompt | Tagging | No map change |
| Polity | Prompt: Move here / Also link here | Tagging | No map change |
| NPC | Not allowed | - | - |
| Item | Not allowed | - | - |

Notes:
- NPC → Location means the NPC is located there.
- NPC → Faction means the NPC is a member of that faction by default.
- NPC → Religion means the NPC follows that religion. Exclusive — one religion per NPC.
- NPC → Polity means the NPC is affiliated with that polity.

---

### 14.2 Location Dragged To

| Destination | Behavior | Relationship Type | Map Effect |
|---|---|---|---|
| Location | Move, no prompt | Nesting | Nests on map as sub-location |
| Faction | Move, no prompt | Tagging | No map change |
| Religion | Move, no prompt | Tagging | No map change |
| Polity | Prompt: Move here / Also link here | Tagging | No map change |
| NPC | Not allowed | - | - |
| Item | Not allowed | - | - |

Notes:
- Location → Location creates a sub-location relationship.
- This is commonly done by opening a focused Location board on one side and All Locations on the other side.
- Example: Drag "Dungeon Level 2" into the focused board for "Black Hollow Keep."
- Location → Religion is exclusive. A location has one primary religious association at a time.

---

### 14.3 Item Dragged To

| Destination | Behavior | Relationship Type | Map Effect |
|---|---|---|---|
| NPC | Move, no prompt | Nesting | Nests in NPC |
| Location | Move, no prompt | Nesting | Nests in Location |
| Faction | Move, no prompt | Tagging | No map change |
| Religion | Move, no prompt | Tagging | No map change |
| Polity | Move, no prompt | Tagging | No map change |
| Item | Not allowed | - | - |

Notes:
- Items always move.
- Items do not use the Move / Also Link prompt.
- Items flow toward their current holder, location, owner, or primary association.
- Item → NPC means the NPC holds the item.
- Item → Location means the item is located there.
- Item → Faction, Religion, or Polity creates a primary association tag.

---

## 15. Directionality Rules

Some relationships are one-directional.

Example:
An Item can be dragged onto an NPC because the Item can be held by that NPC.
However, an NPC cannot be dragged onto an Item because the NPC does not belong inside the Item.

Allowed:
- Item → NPC

Not allowed:
- NPC → Item

This same logic applies to other relationship pairs where the destination is a container, holder, parent, or organizing structure.

---

## 16. Events in Kanban

Event nodes are not part of the main structured kanban rules.

However, Event nodes should not be completely inaccessible from kanban.

Users may choose to display Event nodes in a kanban board if they want to use them in their own way.

The app does not need predefined relationship rules for Events.

Recommended behavior:
- Event boards may be selectable.
- Event drag behavior does not need special built-in logic.
- If Event dragging is supported, it should create a simple editable relationship.
- Users can rename or clarify that relationship in the node detail pane.

Events should not appear in the built-in relationship rule tables unless formal Event behavior is added later.

---

## 17. Custom Node Types

Users may create custom node types.

Custom node types should use source-destination relationship rules rather than only global behavior settings.

Each custom rule should define:

| Field | Description |
|---|---|
| Source node type | The dragged node type |
| Destination node type | The target node type |
| Allowed | Whether this drag is allowed |
| Relationship kind | Nesting or Tagging |
| Cardinality | Exclusive or Open |
| Prompt behavior | No prompt or Move / Also Link prompt |
| Default relationship label | Human-readable name of the relationship |
| Map effect | Whether the map canvas updates |

### Relationship Kind

| Option | Effect |
|---|---|
| Nesting | Drag affects parent-child structure and may update the map |
| Tagging | Drag creates an association only and does not update the map |

### Cardinality

| Option | Effect |
|---|---|
| Exclusive | The source node can only have one relationship of this type at a time |
| Open | The source node can have multiple relationships of this type |

### Prompt Behavior

| Cardinality | Default Prompt Behavior |
|---|---|
| Exclusive | Move, no prompt |
| Open | Prompt: Move here / Also link here |

This can be overridden per rule if needed.

### Relationship Limit

Even when a relationship type is Open, there should still only be one relationship between the same two specific nodes.

Example:

Allowed:
- NPC → Faction A
- NPC → Faction B

Not allowed:
- NPC → Faction A with three separate relationship labels

---

## 18. Staging

### What Staging Is

Staging is a node state meaning:

**Intentionally off the map canvas.**

Staging is not deletion.

A staged node:
- Retains its data
- Remains searchable
- Appears in the all-nodes pane
- Appears in kanban boards
- Appears in node detail views
- Is hidden only from the map canvas

---

## 19. How Nodes Enter Staging

A node can enter staging in two ways:

1. **Right-click on map**
   - User right-clicks a node on the map.
   - User selects "Move to Staging" or "Remove from Map."
   - The node is removed from the map canvas and marked as staged.

2. **Drag into Staging**
   - User drags a node into a staging area or staging list.
   - The node is removed from the map canvas and marked as staged.

When a node is staged, it loses its map placement and parent/nesting information.

---

## 20. How Nodes Leave Staging

A staged node can be dragged from staging back onto the map.

When this happens:
- The node is placed back onto the map canvas.
- The node is no longer marked as staged.
- The node receives a new map position.
- The node does not automatically restore its previous parent, nesting relationship, or position.

Staging is a clean removal from the canvas, not a temporary hide with preserved map structure.

---

## 21. Current Staging Bug

The existing right-click action:

> Remove node from map

currently removes the node from:
- Search results
- Kanban
- Other node lists

This is incorrect.

Removing a node from the map should stage the node, not remove it from the app.

---

## 22. Correct Staging Behavior

When a node is moved to staging:
- The node remains in the database.
- The node is marked as staged.
- The node is hidden from the map canvas only.
- The node remains visible everywhere else.
- The node loses map parent/nesting information.
- The node can be dragged from staging back onto the map later.

Recommended data model:

```js
mapPlacement: {
  status: "placed" | "staged",
  parentId: string | null,
  position: { x: number, y: number } | null
}
```

When staged:

```js
mapPlacement: {
  status: "staged",
  parentId: null,
  position: null
}
```

When placed back on the map:

```js
mapPlacement: {
  status: "placed",
  parentId: null,
  position: { x: number, y: number }
}
```

---

## 23. Staged Node Visual Indicator

Staged nodes should have a visible indicator in kanban and all-nodes views.

Recommended indicator:
- A small "Staged" pill
- Or a map-off icon
- Or both

The indicator should be subtle but clear.

Example card treatment:
```
Ser Kael
NPC
[Staged]
```

This helps users understand why the node exists in kanban but does not appear on the map.

---

## 24. All-Nodes Pane Updates

The all-nodes pane exists on both mobile and desktop.

It is the master list of nodes and should include placed and staged nodes.

### Mobile Access

On mobile, a bottom navigation button provides access to the all-nodes pane from the kanban view.

This is the same node list shown in desktop split-screen mode.

---

## 25. All-Nodes Pane Filters

The all-nodes pane must support filtering.

Required filters:
- Node type
- Tags
- Staged / Not Staged / All
- Any existing filters currently supported by the pane

### Staging Filter

The staging filter should be clearly labeled.

Recommended options:
- Not Staged
- Staged
- All

Default view: **Not Staged**

This keeps the normal node list clean while still making staged nodes easy to find.

---

## 26. Search Behavior

Search must include staged nodes.

A staged node should appear in search results unless the user has explicitly filtered staged nodes out.

Search result cards should show the staged indicator when applicable.

---

## 27. Development Notes

### Overview

The relationship system should be implemented as a rule table rather than hardcoded drag logic.

Each rule is defined by:

| Field | Description |
|---|---|
| `allowed` | Whether this drag interaction is allowed |
| `relationshipKind` | `nesting`, `tagging`, or `manual` |
| `cardinality` | `exclusive` or `open` |
| `promptBehavior` | `none`, `move-or-link`, or `manual` |
| `defaultRelationshipLabel` | Default label applied to the relationship |
| `mapEffect` | `update-parent`, `none`, or `manual` |
| `notes` | Developer-facing clarification |

### Rule Meaning

```js
relationshipKind: "nesting"
// The source node becomes structurally contained by the destination node. This affects the map.

relationshipKind: "tagging"
// The source node is associated with the destination node. This does not affect the map.

relationshipKind: "manual"
// The app does not enforce a built-in meaning. The user may define or edit the relationship manually.

cardinality: "exclusive"
// The source node can only have one relationship of this type at a time.
// Moving to a new destination removes the previous relationship of the same type.

cardinality: "open"
// The source node may have multiple relationships of this type,
// but only one relationship may exist between the same two specific nodes.

promptBehavior: "none"
// The drag action happens immediately.

promptBehavior: "move-or-link"
// The user is prompted with:
//   Move here
//   Also link here

mapEffect: "update-parent"
// The map canvas parent-child structure updates.

mapEffect: "none"
// No map canvas change occurs.
```

---

### 27.1 Built-In Relationship Rule Object

```js
const relationshipRules = {
  npc: {
    location: {
      allowed: true,
      relationshipKind: "nesting",
      cardinality: "exclusive",
      promptBehavior: "none",
      defaultRelationshipLabel: "located in",
      mapEffect: "update-parent",
      notes: "NPC is moved into the destination Location on the map."
    },
    faction: {
      allowed: true,
      relationshipKind: "tagging",
      cardinality: "open",
      promptBehavior: "move-or-link",
      defaultRelationshipLabel: "member of",
      mapEffect: "none",
      notes: "NPC becomes a member of the destination Faction. User may move from an existing faction or also link to another faction."
    },
    religion: {
      allowed: true,
      relationshipKind: "tagging",
      cardinality: "exclusive",
      promptBehavior: "none",
      defaultRelationshipLabel: "follows",
      mapEffect: "none",
      notes: "NPC follows the destination Religion. Moving to a new Religion removes the previous Religion relationship."
    },
    polity: {
      allowed: true,
      relationshipKind: "tagging",
      cardinality: "open",
      promptBehavior: "move-or-link",
      defaultRelationshipLabel: "affiliated with",
      mapEffect: "none",
      notes: "NPC is affiliated with the destination Polity. User may move from an existing polity or also link to another polity."
    },
    item: {
      allowed: false,
      notes: "NPCs are not dragged into Items. Use Item to NPC instead."
    },
    npc: {
      allowed: false,
      notes: "NPC to NPC relationships are not part of the default kanban drag rules."
    },
    event: {
      allowed: true,
      relationshipKind: "manual",
      cardinality: "open",
      promptBehavior: "manual",
      defaultRelationshipLabel: "related to",
      mapEffect: "none",
      notes: "Events are not part of structured kanban rules. If allowed, create a simple editable relationship."
    }
  },
  location: {
    location: {
      allowed: true,
      relationshipKind: "nesting",
      cardinality: "exclusive",
      promptBehavior: "none",
      defaultRelationshipLabel: "sub-location of",
      mapEffect: "update-parent",
      notes: "Location becomes a sub-location of the destination Location."
    },
    faction: {
      allowed: true,
      relationshipKind: "tagging",
      cardinality: "exclusive",
      promptBehavior: "none",
      defaultRelationshipLabel: "controlled by",
      mapEffect: "none",
      notes: "Location is controlled by or associated with the destination Faction."
    },
    religion: {
      allowed: true,
      relationshipKind: "tagging",
      cardinality: "exclusive",
      promptBehavior: "none",
      defaultRelationshipLabel: "sacred to",
      mapEffect: "none",
      notes: "Location has one primary religious association. Moving to a new Religion removes the previous one."
    },
    polity: {
      allowed: true,
      relationshipKind: "tagging",
      cardinality: "open",
      promptBehavior: "move-or-link",
      defaultRelationshipLabel: "governed by",
      mapEffect: "none",
      notes: "Location is governed by, within, or claimed by the destination Polity."
    },
    npc: {
      allowed: false,
      notes: "Locations are not dragged into NPCs."
    },
    item: {
      allowed: false,
      notes: "Locations are not dragged into Items."
    },
    event: {
      allowed: true,
      relationshipKind: "manual",
      cardinality: "open",
      promptBehavior: "manual",
      defaultRelationshipLabel: "related to",
      mapEffect: "none",
      notes: "Events are not part of structured kanban rules. If allowed, create a simple editable relationship."
    }
  },
  item: {
    npc: {
      allowed: true,
      relationshipKind: "nesting",
      cardinality: "exclusive",
      promptBehavior: "none",
      defaultRelationshipLabel: "held by",
      mapEffect: "update-parent",
      notes: "Item is held by the destination NPC."
    },
    location: {
      allowed: true,
      relationshipKind: "nesting",
      cardinality: "exclusive",
      promptBehavior: "none",
      defaultRelationshipLabel: "located in",
      mapEffect: "update-parent",
      notes: "Item is placed inside the destination Location."
    },
    faction: {
      allowed: true,
      relationshipKind: "tagging",
      cardinality: "exclusive",
      promptBehavior: "none",
      defaultRelationshipLabel: "owned by",
      mapEffect: "none",
      notes: "Item is owned by or primarily associated with the destination Faction."
    },
    religion: {
      allowed: true,
      relationshipKind: "tagging",
      cardinality: "exclusive",
      promptBehavior: "none",
      defaultRelationshipLabel: "sacred to",
      mapEffect: "none",
      notes: "Item is sacred to or primarily associated with the destination Religion."
    },
    polity: {
      allowed: true,
      relationshipKind: "tagging",
      cardinality: "exclusive",
      promptBehavior: "none",
      defaultRelationshipLabel: "owned by",
      mapEffect: "none",
      notes: "Item is owned, regulated, or claimed by the destination Polity."
    },
    item: {
      allowed: false,
      notes: "Item-to-Item nesting is not supported by default."
    },
    event: {
      allowed: true,
      relationshipKind: "manual",
      cardinality: "open",
      promptBehavior: "manual",
      defaultRelationshipLabel: "related to",
      mapEffect: "none",
      notes: "Events are not part of structured kanban rules. If allowed, create a simple editable relationship."
    }
  },
  faction: {
    npc: {
      allowed: false,
      notes: "Faction to NPC is not supported. Use NPC to Faction."
    },
    location: {
      allowed: false,
      notes: "Faction to Location is not supported by default. Use Location to Faction."
    },
    item: {
      allowed: false,
      notes: "Faction to Item is not supported by default. Use Item to Faction."
    },
    religion: {
      allowed: false,
      notes: "Faction to Religion is not part of the default kanban rules."
    },
    polity: {
      allowed: false,
      notes: "Faction to Polity is not part of the default kanban rules."
    },
    faction: {
      allowed: false,
      notes: "Faction nesting is not part of the default kanban rules."
    },
    event: {
      allowed: true,
      relationshipKind: "manual",
      cardinality: "open",
      promptBehavior: "manual",
      defaultRelationshipLabel: "related to",
      mapEffect: "none",
      notes: "Events are not part of structured kanban rules. If allowed, create a simple editable relationship."
    }
  },
  religion: {
    npc: {
      allowed: false,
      notes: "Religion to NPC is not supported. Use NPC to Religion."
    },
    location: {
      allowed: false,
      notes: "Religion to Location is not supported by default. Use Location to Religion."
    },
    item: {
      allowed: false,
      notes: "Religion to Item is not supported by default. Use Item to Religion."
    },
    faction: {
      allowed: false,
      notes: "Religion to Faction is not part of the default kanban rules."
    },
    polity: {
      allowed: false,
      notes: "Religion to Polity is not part of the default kanban rules."
    },
    religion: {
      allowed: false,
      notes: "Religion nesting is not part of the default kanban rules."
    },
    event: {
      allowed: true,
      relationshipKind: "manual",
      cardinality: "open",
      promptBehavior: "manual",
      defaultRelationshipLabel: "related to",
      mapEffect: "none",
      notes: "Events are not part of structured kanban rules. If allowed, create a simple editable relationship."
    }
  },
  polity: {
    npc: {
      allowed: false,
      notes: "Polity to NPC is not supported. Use NPC to Polity."
    },
    location: {
      allowed: false,
      notes: "Polity to Location is not supported by default. Use Location to Polity."
    },
    item: {
      allowed: false,
      notes: "Polity to Item is not supported by default. Use Item to Polity."
    },
    faction: {
      allowed: false,
      notes: "Polity to Faction is not part of the default kanban rules."
    },
    religion: {
      allowed: false,
      notes: "Polity to Religion is not part of the default kanban rules."
    },
    polity: {
      allowed: false,
      notes: "Polity nesting is not part of the default kanban rules."
    },
    event: {
      allowed: true,
      relationshipKind: "manual",
      cardinality: "open",
      promptBehavior: "manual",
      defaultRelationshipLabel: "related to",
      mapEffect: "none",
      notes: "Events are not part of structured kanban rules. If allowed, create a simple editable relationship."
    }
  },
  event: {
    npc: {
      allowed: true,
      relationshipKind: "manual",
      cardinality: "open",
      promptBehavior: "manual",
      defaultRelationshipLabel: "related to",
      mapEffect: "none",
      notes: "Event relationships are manually interpreted by the user."
    },
    location: {
      allowed: true,
      relationshipKind: "manual",
      cardinality: "open",
      promptBehavior: "manual",
      defaultRelationshipLabel: "related to",
      mapEffect: "none",
      notes: "Event relationships are manually interpreted by the user."
    },
    faction: {
      allowed: true,
      relationshipKind: "manual",
      cardinality: "open",
      promptBehavior: "manual",
      defaultRelationshipLabel: "related to",
      mapEffect: "none",
      notes: "Event relationships are manually interpreted by the user."
    },
    religion: {
      allowed: true,
      relationshipKind: "manual",
      cardinality: "open",
      promptBehavior: "manual",
      defaultRelationshipLabel: "related to",
      mapEffect: "none",
      notes: "Event relationships are manually interpreted by the user."
    },
    polity: {
      allowed: true,
      relationshipKind: "manual",
      cardinality: "open",
      promptBehavior: "manual",
      defaultRelationshipLabel: "related to",
      mapEffect: "none",
      notes: "Event relationships are manually interpreted by the user."
    },
    item: {
      allowed: true,
      relationshipKind: "manual",
      cardinality: "open",
      promptBehavior: "manual",
      defaultRelationshipLabel: "related to",
      mapEffect: "none",
      notes: "Event relationships are manually interpreted by the user."
    },
    event: {
      allowed: true,
      relationshipKind: "manual",
      cardinality: "open",
      promptBehavior: "manual",
      defaultRelationshipLabel: "related to",
      mapEffect: "none",
      notes: "Event-to-Event relationships are manually interpreted by the user."
    }
  }
};
```

---

### 27.2 Important Implementation Rules

**Unlisted Rules**

If a relationship pair is not listed in `relationshipRules`, it should default to:

```js
{ allowed: false }
```

**One Relationship Per Pair**

There should only be one relationship between the same two specific nodes.

Example:

Allowed:
- Ser Kael → Ember Court — `member of`

Not allowed:
- Ser Kael → Ember Court — `member of`
- Ser Kael → Ember Court — `spy for`
- Ser Kael → Ember Court — `enemy of`

If the meaning changes, the existing relationship should be edited in the detail pane.

**Move Behavior**

When `cardinality` is `exclusive`, creating a new relationship removes the previous relationship of that same destination type.

Example:
If an NPC follows Religion A and is dragged onto Religion B:
- Remove: NPC → Religion A
- Add: NPC → Religion B

**Also Link Behavior**

When `cardinality` is `open`, the user may keep existing relationships and add a new one.

Example:
If an NPC is a member of Faction A and is dragged onto Faction B:
- Keep: NPC → Faction A
- Add: NPC → Faction B

The app should still prevent duplicate relationships between the same two nodes.

---

### 27.3 Relationship Creation Flow

```js
function handleKanbanDrop(sourceNode, destinationNode) {
  const sourceType = sourceNode.type;
  const destinationType = destinationNode.type;

  const rule = relationshipRules?.[sourceType]?.[destinationType] ?? {
    allowed: false
  };

  if (!rule.allowed) {
    return {
      success: false,
      reason: "This relationship is not allowed."
    };
  }

  if (rule.promptBehavior === "move-or-link") {
    return openMoveOrLinkPrompt({
      sourceNode,
      destinationNode,
      rule
    });
  }

  if (rule.promptBehavior === "manual") {
    return createManualRelationship({
      sourceNode,
      destinationNode,
      rule
    });
  }

  return createRelationship({
    sourceNode,
    destinationNode,
    rule,
    mode: "move"
  });
}
```

---

### 27.4 Relationship Creation Logic

```js
function createRelationship({ sourceNode, destinationNode, rule, mode }) {
  const relationship = {
    sourceNodeId: sourceNode.id,
    destinationNodeId: destinationNode.id,
    sourceType: sourceNode.type,
    destinationType: destinationNode.type,
    relationshipKind: rule.relationshipKind,
    relationshipLabel: rule.defaultRelationshipLabel,
    mapEffect: rule.mapEffect
  };

  // Prevent duplicate relationship between the same two nodes
  if (relationshipAlreadyExists(sourceNode.id, destinationNode.id)) {
    return {
      success: false,
      reason: "A relationship between these two nodes already exists."
    };
  }

  // Exclusive relationships remove previous relationship of same destination type
  if (rule.cardinality === "exclusive" || mode === "move") {
    removeExistingRelationshipsOfType({
      sourceNodeId: sourceNode.id,
      destinationType: destinationNode.type
    });
  }

  saveRelationship(relationship);

  if (rule.mapEffect === "update-parent") {
    updateMapParent({
      sourceNodeId: sourceNode.id,
      parentNodeId: destinationNode.id
    });
  }

  return {
    success: true,
    relationship
  };
}
```

---

### 27.5 Event Handling

Events are intentionally flexible.

Events may appear in kanban, but they do not have strict built-in relationship logic.

When an Event is dragged to or from another node:
- Create a simple relationship.
- Use the default label `related to`.
- Do not update the map.
- Allow the user to rename the relationship in the detail pane.

Events should not trigger nesting behavior by default.

---

### 27.6 Manual Relationship Creation

`createManualRelationship` is used when a rule has:

```js
promptBehavior: "manual"
```

Manual relationships are intentionally lightweight and user-defined.

When called, `createManualRelationship` should:

- Create a relationship between the source node and destination node
- Use the rule's `defaultRelationshipLabel`
- If no default label exists, use `related to`
- Set `relationshipKind` to `manual`
- Set `mapEffect` to `none`
- Skip nesting behavior
- Skip map parent updates
- Skip strict cardinality enforcement
- Prevent exact duplicate relationships between the same two nodes
- Open the relationship label field for immediate editing in the detail pane

Manual relationships should not attempt to infer deeper meaning from the node types.

```js
function createManualRelationship({ sourceNode, destinationNode, rule }) {
  const relationship = {
    sourceNodeId: sourceNode.id,
    destinationNodeId: destinationNode.id,
    sourceType: sourceNode.type,
    destinationType: destinationNode.type,
    relationshipKind: "manual",
    relationshipLabel: rule.defaultRelationshipLabel ?? "related to",
    mapEffect: "none"
  };

  if (relationshipAlreadyExists(sourceNode.id, destinationNode.id)) {
    return {
      success: false,
      reason: "A relationship between these two nodes already exists."
    };
  }

  saveRelationship(relationship);

  openRelationshipLabelEditor(relationship.id);

  return {
    success: true,
    relationship
  };
}
```

Manual relationships are mainly intended for Events and other flexible node interactions where the app should allow user interpretation without enforcing a built-in semantic rule.
