# Flux Atlas — Brand Facts & Design Philosophy

*A reference document for brand identity and marketing strategy development.*

---

## What It Is

**Flux Atlas** is a web-based campaign world manager for tabletop RPG game masters. It is a purpose-built tool for organizing, visualizing, and evolving the living world behind a campaign — not a note-taking app adapted for the purpose, but software designed from the ground up around the specific mental model of a GM running an ongoing game.

The app's own tagline: **"Your campaign world, alive."**  
Secondary copy: **"Map it. Connect it. Watch it evolve."**  
Category label it uses for itself: **Campaign World Manager**

---

## The Name

**Flux** — constant change, flow, dynamism. A world in motion.  
**Atlas** — a collection of maps; also the titan who holds up the world. The keeper of geographies.

Together: a map of a living, changing world. The name encodes both the spatial and temporal dimensions of the product.

---

## The Core Philosophy

The central design premise is that **a campaign world is a living system, not a static document**. Everything in the app flows from this:

- Entities (characters, factions, locations) are not just records — they have **status** (alive/dead, active/ruined, revealed/hidden) and **behavior** (factions expand territory, characters relocate, locations get repurposed).
- Time is not a passive backdrop — it is something you can **advance**, with the world responding algorithmically.
- The GM's knowledge is fundamentally asymmetric — the "revealed/hidden" status flag exists on every single entity type, built into the schema at the lowest level.
- Nothing should be permanently lost — **snapshots** let you branch timelines and restore history.
- The canvas is the primary interface — because spatial thinking is how GMs actually understand their worlds.

A secondary philosophy: **structure enables creativity**. The schema is opinionated enough to be useful (consistent fields, typed relationships, nesting rules) but flexible enough to model any setting, any genre, any game system. Custom node types extend the system without breaking it.

---

## The Four Pillars (Core Features)

These are the four named features presented on the landing page — the product's own way of describing itself:

### 1. Living Map Canvas
Drag-and-place characters, locations, factions, and events directly on a custom map. Draw territory polygons, connect nodes with typed relationships, and see the whole world at a glance. The canvas is a Konva.js-rendered stage with pan, zoom, and up to four levels of spatial nesting (e.g., a city inside a region inside a continent). Nodes float on a custom map background image.

### 2. Trouble Engine
Structured dice-based downtime workflow, explicitly built around the **Blades in the Dark** TTRPG system. A four-step process covering crew trouble (heat band × dice roll → trouble severity), faction clock advancement, local trouble modifiers (civic hostility, active wars, enemy clock completions, crew reputation), and escalations. The engine generates historically logged trouble records per campaign. This is not a generic tool — it is designed for a specific play style and its design choice signals the target audience precisely.

### 3. Flux System (internally called the "Time Engine")
Advance time across five preset scales — 1 month, 6 months, 1 year, 3 years, 10 years, or a custom duration. The system generates multiple **scenario proposals** simultaneously, each at a different volatility level: **stable**, **balanced**, or **volatile**. Each scenario is a deterministic, seeded simulation where every entity type has its own behavior profile — characters may die or relocate, locations may be destroyed or repurposed, faction and polity territories expand or contract as actual polygons on the map. The GM reviews proposed changes, approves or rejects each one individually, and commits the result as the new world state. The system generates a prose narrative summary for each scenario ("The Upheaval," "Shifting Tides," "The Quiet Years").

### 4. World Snapshots (Board History)
Save the entire campaign state at any moment with a name and annotation. Restore from or branch off any prior snapshot. The free tier shows the last 25 entries; restore capability is a Pro feature.

---

## Entity Types (The World Model)

Seven built-in node types, each with a signature color, field schema, and distinct behavior in the canvas and time engine:

| Type | Color | Hex | Kind |
|---|---|---|---|
| Character (NPC) | Amethyst | `#c48dff` | Spatial |
| Location | Cerulean | `#6db3ff` | Spatial |
| Faction | Ember | `#ff9f43` | Abstract |
| Religion | Gold | `#fbbf24` | Abstract |
| Event | Coral | `#ff7b7b` | Spatial |
| Polity | Rose | `#e879a8` | Abstract |
| Thing (Item) | Jade | `#5aeea0` | Spatial |

**Spatial** types live on the map canvas and can be nested. **Abstract** types (Faction, Religion, Polity) exist primarily in organizational panels and relate to spatial nodes through typed tag relationships rather than geographic placement.

Each type has: a field schema, status flags (e.g., Alive/Dead for Characters; Active/Ruined for Locations; Revealed/Hidden on all types), and a behavior profile governing how it changes when time is advanced.

Custom node types (up to 5 on Free, unlimited on Pro) extend this system with user-defined schemas, icons, and colors.

---

## Canvas Widgets

A secondary layer of tools that live directly on the map canvas — they move with the viewport and are designed to be used at the table during a session:

- **Sticky Notes** — freeform text notes, color-coded, multi-tab
- **Linear Tracker** — progress/resource bars with configurable scale and color
- **Clock Widget** — Blades-style segmented faction clocks
- **Thread Tracker** — narrative arc tracker with named milestones (Inciting Incident → Rising Action → Climax), linked to specific nodes
- **Trouble Engine Widget** — a docked shortcut to the Trouble Engine workflow

---

## Platform & Technical Facts

- **Web app** with dedicated mobile layout (responsive, separate mobile components)
- **Backend:** Cloudflare Workers + D1 (SQLite) + R2 object storage
- **Auth:** Email/password account system
- **Storage:** Map backgrounds and node images stored in cloud object storage
- **Import:** Markdown-based bulk import with a three-pass resolution system for relationships
- **Export:** Export utilities present in codebase

---

## Business Model

**Freemium.** Free tier exists and is intended to be permanent ("Free forever. No credit card required.").

| | Free | Pro (Coming Soon) |
|---|---|---|
| Campaigns | 2 | Unlimited |
| Nodes | 100 | Unlimited |
| Storage | 100 MB | 2 GB |
| Custom Node Types | 5 | Unlimited |
| Trouble Engine | 10 rolls / month | Unlimited |
| Flux System | 10 uses / month | Unlimited |
| World History | Last 25 entries | Full history |
| Restore from History | ✗ | ✓ |
| Priority Support | ✗ | ✓ |

Pro pricing is TBD; currently in pre-launch ("Coming soon").

---

## Design Language (Observable Facts)

- **Dark UI** — map canvas aesthetic, dark background throughout
- **Topographic contour lines** used as a decorative background pattern (the `TopoBackground` component appears on the landing hero and footer)
- **Color system** is driven entirely by node type — the seven type colors are the primary palette and appear everywhere: map nodes, UI chips, widget accents, legend entries
- **Ambient glow orbs** used on the landing hero for atmosphere
- **Phosphor Icons** library used throughout (consistent, slightly rounded, modern icon style)
- **Parallax node-type chips** float in the landing hero — visual metaphor for world elements in space
- **Scenario titles** have a literary, almost epic quality: "The Upheaval," "Fire and Ruin," "The Long Peace," "Collapse and Rebirth," "Crossroads"

---

## Audience Signals (From the Product Itself)

- The Trouble Engine is built around **Blades in the Dark** specifically — a narrative heist TTRPG with a devoted, design-literate community. This is a sharp niche signal.
- The copy "from a single session to a decade-long saga" acknowledges a range, but the depth of the tooling (Flux System, snapshots, custom types) skews toward **long-running, complex campaigns**.
- The "Revealed/Hidden" flag baked into every entity signals a **GM-only** perspective — this is a tool for the person running the game, not a shared player resource.
- Mobile support exists, suggesting the product is meant to be used **at the table**, not just during prep.

---

## What Flux Atlas Is Not

- Not a virtual tabletop (no dice rolling for gameplay, no battlemaps, no token movement)
- Not a general note-taking or wiki tool
- Not a character sheet manager
- Not a rules reference
- Not a collaborative tool (no multi-user, no player-facing views — it is a GM's private workspace)
