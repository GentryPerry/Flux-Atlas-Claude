# Flux Atlas — Random Table Widget: Spec & Content Guide

**Purpose of this document:** Define the data format, category taxonomy, genre system, and contributor guidelines for the Random Table Roller widget in Flux Atlas. This doc is designed to be handed to an AI (or a human) to generate conforming table files.

**Genre scope:** Fantasy, Modern, Sci-Fi, Retrofuturistic, Cyberpunk, Horror, Post-Apocalyptic, and Any (genre-agnostic). Tables are tagged so GMs can filter by genre. Many tables intentionally cross genres.

---

## 1. Widget Overview (for context)

The Random Table Roller is a GM-facing popup widget. The GM:
1. Filters by genre and/or category (or searches by keyword)
2. Selects a table
3. Rolls — the widget shows the result entry

Tables are stored as static JSON files in `src/data/tables/`. The widget reads those files at runtime. No AI or network calls during play — everything is local.

---

## 2. Data Format

Every table is a single `.json` file. The schema is:

```json
{
  "id": "string — unique slug, kebab-case, e.g. npc-physical-traits",
  "title": "string — display name shown in the widget",
  "category": "string — must match a category slug from Section 3",
  "subcategory": "string — optional freeform grouping within a category",
  "genre": ["array — one or more genre slugs from Section 4, or ['any']"],
  "die": "number — display die shown in the widget UI: 4 | 6 | 8 | 10 | 12 | 20 | 100",
  "description": "string — one sentence: when and why would a GM roll on this?",
  "tags": ["array", "of", "freeform", "keyword", "strings"],
  "entries": [
    {
      "roll": 1,
      "result": "string — the table entry, plain text only"
    }
  ]
}
```

### Die vs. Pool size — the key distinction

**`die` is purely cosmetic.** It controls what die icon the widget shows and the general "feel" of rolling. The widget always picks randomly from `1` to `entries.length` regardless of the `die` value. A table can be labeled `"die": 100` but contain 500 entries — the widget rolls across all 500.

This means:
- A GM who rolls the same table ten times in a session is unlikely to see the same result twice
- Contributors should write as many entries as they can, not stop at the die size
- `die` should reflect the *smallest standard die that feels right for this table's granularity*, not the entry count

### Pool size targets

| Table type | Minimum entries | Target |
|---|---|---|
| Niche / highly specific tables | 100 | 200 |
| Standard GM utility tables | 200 | 500 |
| Frequently-rolled tables (NPC traits, complications, encounters) | 500 | 1,000 |
| Core tables (things a GM might roll multiple times per session) | 1,000 | 2,000+ |

When converting source PDFs that only have 100 entries, **expand to at least 200** by writing additional entries in the same tone and style. When generating original tables from scratch, aim for the Target column.

### Rules for entries

- **`roll` must be sequential starting at 1.** No gaps, no ranges. The count can be any number — it does not need to match `die`.
- **`result` is plain text only.** No markdown, no HTML, no line breaks.
- **Entries must be immediately usable at the table** — a GM should be able to read the result aloud or drop it into play without further prep.
- **Keep entries punchy but complete.** One to three sentences is the sweet spot.
- **All entries must be system-agnostic.** No stat blocks, no mechanical references (saving throws, DCs, HP, etc.). Flavor and description only.
- **No padding.** More entries is good; vague or repeated entries to hit a count is not. Every entry should be genuinely distinct.
- **Genre consistency.** Every entry must feel at home in the tagged genre(s). No tonal whiplash within a single table.

### Example file

```json
{
  "id": "npc-drunken-boasts",
  "title": "Drunken Boasts",
  "category": "npc",
  "subcategory": "personality",
  "genre": ["fantasy", "any"],
  "die": 100,
  "description": "Outrageous claims made by a tavern regular or bar patron. Roll to determine what the local drunk insists is true about their past.",
  "tags": ["tavern", "bar", "npc", "humor", "social"],
  "entries": [
    { "roll": 1, "result": "I once hit a stone giant so hard in the face its eyes crossed for a week." },
    { "roll": 2, "result": "I once shouted the fire off a burning orphanage." }
  ]
}
```

> Note: the example above is truncated for illustration. The actual file should have at least 500 entries.

---

## 3. Category Taxonomy

Categories describe the *type* of table, independent of genre. Every table gets one category. The widget can filter by both genre and category simultaneously.

| Slug | Display Name | Description |
|---|---|---|
| `npc` | NPCs | Traits, backstories, speech patterns, personality, quirks |
| `ancestry` | Ancestry & Lineage | Unusual traits for specific peoples, bloodlines, species |
| `encounter-terrain` | Terrain Encounters | Random encounters keyed to environment type |
| `encounter-social` | Social Encounters | Non-combat interactions, road meetings, street run-ins |
| `encounter-dungeon` | Dungeon & Structure Encounters | Rooms, corridors, hazards inside buildings, ruins, facilities |
| `quest` | Quests & Hooks | Mission seeds, job postings, rumors, contracts |
| `items-magic` | Magic Items | Enchanted or supernatural items |
| `items-mundane` | Mundane Items | Non-magical goods, junk, pocket contents, loot |
| `items-tech` | Technology & Gear | Weapons, gadgets, vehicles, cybernetics, equipment |
| `items-weapon` | Weapons | Weapon histories, enchantments, quirks, modifications |
| `location` | Locations & Places | Shops, rooms, venues, regions, points of interest |
| `magic` | Magic & Phenomena | Spells, curses, supernatural effects, anomalies |
| `combat` | Combat & Antagonists | Boss mechanics, monsters, enemies, traps, hazards |
| `world` | World Details | Natural wonders, weather, atmosphere, overland features |
| `gm-tools` | GM Tools | Investigation results, puzzles, titles, party bonds, oracles |
| `tavern` | Social Venues | Overheard conversations, rumors, bar details (genre-agnostic concept) |
| `horror` | Horror Elements | Dread, body horror, psychological effects, hauntings |
| `faction` | Factions & Crews | Organizations, their structure, reputation, rivals, and internal drama |
| `phenomena` | Strange Phenomena | Unexplained events, anomalies, and supernatural occurrences — genre-flexible |

---

## 4. Genre System

Every table has a `genre` array. Use one or more slugs. Use `"any"` for tables that work regardless of setting.

| Slug | Display Name | Description |
|---|---|---|
| `any` | Any Genre | Works in any setting — universal human/social content |
| `fantasy` | Fantasy | Medieval, high fantasy, sword & sorcery, fairy tale |
| `dark-fantasy` | Dark Fantasy | Grimdark, gothic, horror-adjacent fantasy |
| `modern` | Modern | Contemporary real-world setting, 1980s–present |
| `horror` | Horror | Supernatural horror, psychological horror, survival horror |
| `sci-fi` | Sci-Fi | Space opera, hard sci-fi, alien worlds, starships |
| `cyberpunk` | Cyberpunk | Near-future, megacorps, implants, neon cities |
| `retrofuturistic` | Retrofuturistic | Atompunk, dieselpunk, 1950s space age, pulp sci-fi |
| `post-apocalyptic` | Post-Apocalyptic | Wasteland, collapse, survival, ruins of civilization |
| `western` | Western | Frontier, gunslinger, frontier towns, outlaws |
| `espionage` | Espionage | Spies, cold war, black ops, tradecraft |
| `nautical` | Nautical | Sea voyages, pirates, ocean exploration |
| `occult-noir` | Occult Noir | Industrial-gothic spy thriller where the supernatural is operational reality — mid-century aesthetics, crew-based scores, ghosts and demons as facts of life, shadowy agencies, cold-city atmosphere. Think: haunted canal cities, deniable ops gone wrong, occult black markets, crews with debts to powers they don't fully understand. |

### Genre tagging guidelines

- A table about "what's in someone's pockets" can be `["any"]` — people have pockets everywhere.
- A table about "forest encounters" is `["fantasy", "dark-fantasy"]` — forests exist in modern too, but the content would be different; make separate modern and sci-fi versions.
- A table about "bar rumors" would be `["any"]` if written generically, or split into `["fantasy"]` (tavern) and `["modern"]` (dive bar) versions.
- When in doubt, write separate tables per genre rather than cramming mixed-genre entries into one file.

---

## 5. Complete Table Catalog

### Section 5A — Fantasy Tables (from source zip)

These tables are sourced from the PDFs and Google Docs in the provided zip. All require genericization per Section 6 before shipping.

#### `npc` — NPCs

| Target File | Title | Genre | Die | Source | Notes |
|---|---|---|---|---|---|
| `npc-physical-traits.json` | NPC Physical Traits | `["any"]` | d100 | `100 Physical NPC Traits GM Binder.pdf` | Mostly clean; bodies are universal |
| `npc-backstories.json` | NPC Backstories | `["fantasy"]` | d100 | `100 NPC Backstories.pdf` | Genericize proper nouns (Bordertown → "the frontier town") |
| `npc-character-traits.json` | Character Traits | `["any"]` | d100 | `100 - Character Traits.pdf` | |
| `npc-voice-styles.json` | Voice & Speech Styles | `["any"]` | d100 | `100 - Voice Acting References.pdf` | Reframe as "how this NPC speaks" not "voice acting reference" |
| `npc-professions-fantasy.json` | Professions (Fantasy) | `["fantasy"]` | d100 | `100 Professions.pdf` | Convert class names — see Section 6 |
| `npc-drunken-boasts.json` | Drunken Boasts | `["fantasy", "any"]` | d100 | `100 Drunken Boasts.pdf` | Check for proper nouns |
| `npc-minion-traits.json` | Memorable Minion Traits | `["fantasy"]` | d20 | `Making Minions Memorable.gdoc` | |
| `npc-things-overheard-tavern.json` | Things Overheard in a Tavern | `["fantasy"]` | d100 | `100 Things Overheard in a Tavern` | |
| `npc-pregens-a.json` … `npc-pregens-j.json` | Pregenerated NPCs (Vol. A–J) | `["fantasy"]` | d100 | `1,000 Pregenerated NPCs` | Split into 10 d100 files |

#### `ancestry` — Ancestry & Lineage (NEEDS GENERIC REVIEW)

| Target File | Title | Genre | Die | Source | Rename |
|---|---|---|---|---|---|
| `ancestry-angelic-blooded.json` | Angelic-Blooded Traits | `["fantasy", "dark-fantasy"]` | d100 | `100 Unusual Aasimar` | "Aasimar" → "Angelic-Blooded" |
| `ancestry-infernal-blooded.json` | Infernal-Blooded Traits | `["fantasy", "dark-fantasy"]` | d100 | `100 Tiefling Traits.pdf` | "Tiefling" → "Infernal-Blooded" |
| `ancestry-goblinoid-traits.json` | Goblinoid Traits | `["fantasy"]` | d100 | `100 Interesting Goblins.gdoc` | Remove any mechanical text |

#### `encounter-terrain` — Terrain Encounters

| Target File | Title | Genre | Die | Source |
|---|---|---|---|---|
| `encounter-forest.json` | Forest Encounters | `["fantasy"]` | d100 | `100 Forest Encounters.pdf` |
| `encounter-forest-dark.json` | Dark Forest Encounters | `["fantasy", "dark-fantasy", "horror"]` | d100 | `100 Scary Forest Encounters.pdf` |
| `encounter-beach.json` | Beach & Coastal Encounters | `["fantasy", "any"]` | d100 | `100 Beach Encounters.pdf` |
| `encounter-jungle.json` | Jungle Encounters | `["fantasy", "any"]` | d100 | `100 Jungle Encounters.pdf` |
| `encounter-aerial.json` | Aerial Encounters (Fantasy) | `["fantasy"]` | d100 | `100 Aerial Encounters.gdoc` |
| `encounter-roadside-a.json` … `encounter-roadside-n.json` | Roadside Encounters (Vol. A–N) | `["fantasy"]` | d100 | `1372 Fantasy Roadside Encounters.pdf` | 14 files |
| `encounter-graveyard.json` | Graveyard Oddities | `["fantasy", "horror"]` | d100 | `100 Oddities for a Graveyard.pdf` |

#### `encounter-social` — Social Encounters

| Target File | Title | Genre | Die | Source |
|---|---|---|---|---|
| `encounter-road-social.json` | Social Road Encounters | `["fantasy"]` | d100 | `100 Social Road Encounters.pdf` |
| `encounter-city-fantasy.json` | City Encounters (Fantasy) | `["fantasy"]` | d100 | `100 Random City Encounters.gdoc` |
| `encounter-useless.json` | Mundane & Useless Encounters | `["any"]` | d100 | `100 Useless Encounters.pdf` |

#### `encounter-dungeon` — Dungeon & Structure Encounters

| Target File | Title | Genre | Die | Source |
|---|---|---|---|---|
| `encounter-dungeon-spooky.json` | Spooky Dungeon Encounters | `["fantasy", "horror"]` | d100 | `100 Spooky, Yet Mundane Dungeon Encounters.pdf` |
| `encounter-dungeon-rooms.json` | Creepy Rooms | `["fantasy", "horror"]` | d100 | `100 Creepy Rooms.pdf` |
| `encounter-haunted-house.json` | Haunted House Encounters | `["horror", "fantasy"]` | d100 | `100 Creepy Things in a Spooky House.pdf` |
| `encounter-haunted-house-oddities.json` | Haunted House Oddities | `["horror", "fantasy"]` | d100 | `100 Oddities for a Creepy Old House.pdf` |

#### `quest` — Quests & Hooks

| Target File | Title | Genre | Die | Source |
|---|---|---|---|---|
| `quest-side-hooks-fantasy.json` | Side Quest Hooks (Fantasy) | `["fantasy"]` | d100 | `100 Side Quest Hooks GM Binder.pdf` |
| `quest-odd-jobs.json` | Job Board Postings | `["fantasy"]` | d100 | `100 Odd Jobs Posted.pdf` | Keep parenthetical GM asides |
| `quest-monster-hunts.json` | Monster Hunt Contracts | `["fantasy"]` | d100 | `100 Monster Hunts` |
| `quest-party-origin.json` | How the Party Met | `["any"]` | d100 | `100 Reasons the PCs are Together.pdf` | Write generically |

#### `items-magic` — Magic Items

| Target File | Title | Genre | Die | Source |
|---|---|---|---|---|
| `items-magic-minor.json` | Minor Magical Items | `["fantasy"]` | d100 | `100 Minor Magical Items.pdf` |
| `items-magic-minor-v2.json` | Minor Magical Items Vol. 2 | `["fantasy"]` | d100 | `100 Minor Magical Items V2` |
| `items-magic-low-level.json` | Low Level Magic Items | `["fantasy"]` | d100 | `100 Clockwork's Big List of Low Level Magic Items` |
| `items-magic-black-market.json` | Black Market Magic Items | `["fantasy"]` | d100 | `100 Items For Sale in a Fantasy Black Market.pdf` |
| `items-magic-coat.json` | Coat of Many Things | `["fantasy"]` | d100 | `100 Coat of Many Things.gdoc` |
| `items-magic-gems.json` | Gemstones | `["fantasy", "any"]` | d100 | `100 Gemstones` |
| `items-magic-pets.json` | Pets & Familiars | `["fantasy"]` | d100 | `100 Pets and Familiars.pdf` |
| `items-magic-noble-chamber.json` | Items in a Noble's Bedchamber | `["fantasy"]` | d100 | `100 Items in a Noble's Bedchamber` |

#### `items-mundane` — Mundane Items

| Target File | Title | Genre | Die | Source |
|---|---|---|---|---|
| `items-mundane-200-a.json`, `items-mundane-200-b.json` | Mundane Items (Vol. A–B) | `["fantasy"]` | d100 | `200 Mundane Items.pdf` |
| `items-mundane-random-01.json` … `items-mundane-random-20.json` | Random Items (Vol. 1–20) | `["fantasy"]` | d100 | `2000 Random Items.pdf` |
| `items-mundane-pockets-fantasy.json` | Things Found in Pockets (Fantasy) | `["fantasy"]` | d100 | `100 Things PCs Find in Pockets.pdf` |
| `items-mundane-pickpocket.json` | Pickpocket Finds | `["fantasy"]` | d100 | `100 Random Pickpocket Items.pdf` |
| `items-mundane-thrift.json` | Thrift & Secondhand Goods | `["fantasy", "any"]` | d100 | `100 Random Thrift Shop Items.pdf` |
| `items-mundane-trinkets.json` | Trinkets & Curiosities | `["fantasy"]` | d100 | `A LOT of Trinkets.gdoc` |

#### `items-weapon` — Weapons

| Target File | Title | Genre | Die | Source | Notes |
|---|---|---|---|---|---|
| `items-weapon-histories.json` | Weapon Histories | `["fantasy"]` | d100 | `100 Weapon Histories.pdf` |
| `items-weapon-backstories.json` | Weapon Backstories | `["fantasy"]` | d100 | `100 Weapon Backstories.gdoc` | Deduplicate with Weapon Histories |
| `items-weapon-enchantments.json` | Minor Weapon Enchantments | `["fantasy"]` | d100 | `100 - Minor Weapon Enchantments.pdf` | Has name + alt-title columns; use name as result, alt-title in parentheses |

#### `location` — Locations & Places

| Target File | Title | Genre | Die | Source |
|---|---|---|---|---|
| `location-shops-fantasy.json` | Interesting Shops & Stores (Fantasy) | `["fantasy"]` | d100 | `100 Interesting Shops and Stores.gdoc` |
| `location-market-stalls.json` | Market Stalls | `["fantasy"]` | d100 | `100 - Market Stalls.pdf` |
| `location-market-stalls-more.json` | More Market Stalls | `["fantasy"]` | d100 | `100 - More Market Stalls.pdf` |
| `location-islands.json` | Uncharted Islands | `["fantasy", "nautical"]` | d100 | `100 Uncharted Islands.pdf` |

#### `magic` — Magic & Phenomena

| Target File | Title | Genre | Die | Source |
|---|---|---|---|---|
| `magic-minor-spells.json` | Minor Spells | `["fantasy"]` | d100 | `D100 Minor Spells.pdf` |
| `magic-curses.json` | Interesting Curses | `["fantasy", "dark-fantasy", "horror"]` | d100 | `100 Interesting Curses.pdf` |
| `magic-pun-wands.json` | Pun Wands | `["fantasy"]` | d100 | `100 Pun Wands.gdoc` |

#### `combat` — Combat & Antagonists

| Target File | Title | Genre | Die | Source |
|---|---|---|---|---|
| `combat-boss-mechanics.json` | Boss Mechanics | `["fantasy"]` | d100 | `100 Boss Mechanics.pdf` |
| `combat-boss-mechanics-interesting.json` | Interesting Boss Mechanics | `["fantasy"]` | d100 | `100 Interesting Boss Mechanics.pdf` |
| `combat-monsters.json` | Fantasy Monsters | `["fantasy"]` | d100 | `100 Fantasy Monsters.pdf` |
| `combat-dungeon-constructs.json` | Dungeon Traps & Constructs | `["fantasy"]` | d100 | `100 Magic Monster Machines for your Murder Maze.pdf` |

#### `world` — World Details

| Target File | Title | Genre | Die | Source |
|---|---|---|---|---|
| `world-wonders-natural.json` | Wonders of the Natural World | `["fantasy", "any"]` | d100 | `100 Wonders of the Natural World.gdoc` |

#### `gm-tools` — GM Tools

| Target File | Title | Genre | Die | Source | Notes |
|---|---|---|---|---|---|
| `gm-failed-investigation.json` | Failed Investigation Results | `["any"]` | d100 | `100 Failed Investigation Checks.pdf` |
| `gm-puzzles-riddles.json` | Puzzles, Tricks & Riddles | `["fantasy", "any"]` | d100 | `D100 of Tricks, Puzzles and Riddles.gsheet` |
| `gm-titles-fantasy.json` | NPC Titles & Honorifics | `["fantasy"]` | d100 | `80 Titles.pdf` | Pad to 100 entries |
| `gm-dark-lords.json` | Dark Lords & Infernal Powers | `["fantasy", "dark-fantasy"]` | d100 | `100 Demon Lords.pdf` | Generic names only — no IP-specific names |

#### Spreadsheet sources (require manual export first)

- `D100.gsheet` — review and categorize contents
- `Weather, Random Encounters, etc.gsheet` — split by tab into multiple tables
- `Random Tables by Frank Tedeschi.gsheet` — review and categorize
- `Waldo's Guide to DND Chapter 4 - Travel.gsheet` — heavy generic review needed; DND branding in title

---

### Section 5B — Original Tables to Generate (No Source Files)

These tables do not exist in the zip. An AI should generate them from scratch following the contributor instructions in Section 7. Organized by genre.

---

#### MODERN (`genre: ["modern"]`)

**`npc`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `npc-professions-modern.json` | Modern Professions | d100 | Realistic contemporary occupations from blue-collar to white-collar |
| `npc-modern-backstories.json` | Modern NPC Backstories | d100 | Contemporary origin stories — career changes, family drama, past traumas |
| `npc-overheard-bar.json` | Things Overheard at a Bar | d100 | Modern equivalent of tavern rumors — conversations snippets at a dive bar or restaurant |
| `npc-social-media-rumors.json` | Local Rumors & Gossip | d100 | What people in the neighborhood are saying — modern urban gossip |

**`encounter-social`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `encounter-city-modern.json` | Urban Street Encounters | d100 | People, situations, and oddities encountered on city streets |
| `encounter-suburb.json` | Suburban Encounters | d100 | Neighborhood oddities, strange neighbors, mundane weirdness |
| `encounter-highway.json` | Highway & Road Encounters | d100 | What happens on a long drive — other drivers, roadside stops, breakdowns |

**`quest`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `quest-side-hooks-modern.json` | Modern Side Quest Hooks | d100 | Contemporary mission seeds — missing persons, petty crimes, neighborhood disputes |
| `quest-craigslist-jobs.json` | Strange Job Postings | d100 | Weird, vague, or suspicious want ads and gig listings |
| `quest-urban-legends.json` | Local Urban Legends | d100 | Neighborhood myths and rumors that might be true |

**`items-mundane`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `items-mundane-pockets-modern.json` | Things Found in Pockets (Modern) | d100 | What's in a contemporary person's pockets, bag, or glove compartment |
| `items-mundane-car.json` | Things Found in a Car | d100 | Glove box contents, back seat junk, trunk discoveries |
| `items-mundane-apartment.json` | Things Found in an Apartment | d100 | Contents of drawers, closets, storage units |
| `items-mundane-office.json` | Things Found in an Office | d100 | Desk drawers, break room, supply closet discoveries |

**`location`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `location-shops-modern.json` | Interesting Modern Businesses | d100 | Strange, suspicious, or memorable contemporary shops and services |
| `location-abandoned-modern.json` | Abandoned Modern Locations | d100 | Forgotten malls, closed factories, empty offices — what's inside |

---

#### SCI-FI (`genre: ["sci-fi"]`)

**`npc`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `npc-alien-species-traits.json` | Alien Species Traits | d100 | Physical and behavioral quirks for non-human species encountered in space |
| `npc-professions-scifi.json` | Professions (Sci-Fi) | d100 | Spacefaring careers — crew roles, colony jobs, station workers |
| `npc-overheard-spaceport.json` | Things Overheard at a Spaceport | d100 | Rumor, gossip, and strange conversations in a busy transit hub |

**`encounter-terrain`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `encounter-space-station.json` | Space Station Encounters | d100 | Events and people encountered aboard a large station or orbital |
| `encounter-alien-world.json` | Alien World Encounters | d100 | Strange things on the surface of an unfamiliar planet |
| `encounter-starship.json` | Starship Interior Encounters | d100 | Crew interactions, anomalies, and events aboard a vessel |
| `encounter-asteroid-belt.json` | Asteroid & Deep Space Encounters | d100 | Mining operations, derelicts, cosmic oddities in open space |

**`quest`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `quest-side-hooks-scifi.json` | Sci-Fi Side Quest Hooks | d100 | Mission seeds for a space-faring campaign — salvage, diplomacy, smuggling |
| `quest-cargo-manifests.json` | Suspicious Cargo Manifests | d100 | What's actually in the crate they were hired to transport |
| `quest-distress-signals.json` | Distress Signal Contents | d100 | What the crew finds when they answer a distress call |

**`items-tech`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `items-tech-scifi-gear.json` | Standard Sci-Fi Equipment | d100 | Everyday gear in a spacefaring setting — tools, comms, survival items |
| `items-tech-alien-artifacts.json` | Alien Artifacts | d100 | Strange objects of unknown origin — what it is and what it does (flavor only) |
| `items-tech-ship-components.json` | Ship Components & Salvage | d100 | Parts found when stripping a derelict or buying from a salvage yard |
| `items-tech-cargo.json` | Random Cargo Contents | d100 | What's in an unclaimed shipping container |

**`items-weapon`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `items-weapon-scifi-histories.json` | Weapon Histories (Sci-Fi) | d100 | The story behind a firearm, energy weapon, or blade in a sci-fi setting |
| `items-weapon-modifications-scifi.json` | Weapon Modifications (Sci-Fi) | d100 | Aftermarket changes, illegal upgrades, or field repairs |

**`location`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `location-stations.json` | Space Stations & Orbitals | d100 | Brief descriptions of unique stations, their purpose, and reputation |
| `location-colony-worlds.json` | Colony Worlds | d100 | Frontier planet settlements — what makes each one distinctive |
| `location-derelicts.json` | Derelict Vessels & Stations | d100 | Abandoned ships and stations — what happened and what's left behind |

**`magic` → use `phenomena`-style for sci-fi**
| Target File | Title | Die | Description |
|---|---|---|---|
| `phenomena-scifi-anomalies.json` | Deep Space Anomalies | d100 | Unexplained phenomena, sensor ghosts, and cosmic weirdness |
| `phenomena-scifi-malfunctions.json` | Ship & System Malfunctions | d100 | Failure modes — what went wrong and what it looks like |

**`world`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `world-alien-environments.json` | Alien Environments | d100 | Descriptions of strange, striking, or hostile planetary environments |

---

#### CYBERPUNK (`genre: ["cyberpunk"]`)

**`npc`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `npc-cyberpunk-fixers.json` | Street Contacts & Fixers | d100 | Who the crew knows on the street — their specialty and their price |
| `npc-megacorp-employees.json` | Corporate NPC Traits | d100 | Salary workers, middle managers, and corporate security — what makes each memorable |
| `npc-professions-cyberpunk.json` | Professions (Cyberpunk) | d100 | Street-level and corporate jobs in a near-future city |

**`encounter-social`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `encounter-city-cyberpunk.json` | Neon City Street Encounters | d100 | What happens walking through the sprawl |
| `encounter-corp-zone.json` | Corporate Zone Encounters | d100 | Events in the clean, surveilled, upper-tier areas of the city |
| `encounter-underground.json` | Underground & Black Market Encounters | d100 | What happens in the parts of the city that aren't on any map |

**`quest`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `quest-side-hooks-cyberpunk.json` | Cyberpunk Side Gigs | d100 | One-session job seeds — extractions, data grabs, protection runs |
| `quest-corporate-rumors.json` | Corporate Rumors & Intel | d100 | What's circulating about the megacorps — layoffs, scandals, black projects |

**`items-tech`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `items-tech-cyberware.json` | Cyberware & Implants | d100 | Body modifications — what they are and their visible tells or side effects |
| `items-tech-black-market.json` | Black Market Tech | d100 | What's for sale in the back room — illegal mods, stolen gear, contraband software |
| `items-tech-everyday-cyberpunk.json` | Everyday Cyberpunk Items | d100 | What's in a fixer's bag or on a street vendor's cart |

**`location`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `location-cyberpunk-venues.json` | Cyberpunk Locations | d100 | Bars, clinics, safehouses, arcades, and back-alley shops |
| `location-corp-facilities.json` | Corporate Facilities | d100 | Labs, offices, and secure buildings — their purpose and their security culture |

---

#### RETROFUTURISTIC (`genre: ["retrofuturistic"]`)

**`npc`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `npc-retro-archetypes.json` | Retrofuturistic Archetypes | d100 | The rocket pilot, the lady scientist, the sinister government man — pulp character types |

**`encounter-terrain`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `encounter-retro-planet.json` | Pulp Planet Encounters | d100 | What explorers encounter on a classic sci-fi alien world — ray guns, bug monsters, ancient temples |
| `encounter-atomic-era.json` | Atomic Age Urban Encounters | d100 | 1950s-style city events — suburban secrets, communist paranoia, drive-in drama |

**`quest`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `quest-retrofuturistic-hooks.json` | Retrofuturistic Adventure Hooks | d100 | Pulp-serial mission seeds — daring rescues, villain plots, secret societies |

**`items-tech`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `items-tech-retro-gadgets.json` | Retrofuturistic Gadgets | d100 | Rayguns, jetpacks, robot servants, atomic-powered doodads |
| `items-tech-retro-cargo.json` | Retro Cargo & Contraband | d100 | What's in the space freighter's hold — Moon cheese, Venusian crystal, Martian antiquities |

**`location`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `location-retro-bases.json` | Secret & Remote Bases | d100 | Volcano lairs, moon stations, arctic research outposts |

---

#### HORROR (`genre: ["horror"]`)

**`horror` category**
| Target File | Title | Die | Description |
|---|---|---|---|
| `horror-dread-events.json` | Dread Events | d100 | Things that go wrong — small, creeping escalations of wrongness |
| `horror-body-horror.json` | Body Horror Details | d100 | Disturbing physical transformations and afflictions — not gory, but deeply unsettling |
| `horror-psychological.json` | Psychological Horror Moments | d100 | Paranoia, unreliable senses, something-is-wrong feelings |
| `horror-haunting-events.json` | Haunting Events | d100 | Paranormal occurrences in a location — noises, objects, sightings |
| `horror-cult-activity.json` | Signs of Cult Activity | d100 | Evidence that something organized and sinister has been here |
| `horror-monster-tells.json` | Monster Tells & Signs | d100 | Evidence a creature has been in an area — for any genre |
| `horror-survivor-rumors.json` | Survivor Rumors | d100 | What people who got out say they saw — unreliable but evocative |

**`encounter-dungeon`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `encounter-investigation-site.json` | Investigation Site Details | d100 | What investigators find at a crime scene, ritual site, or abandoned building |
| `encounter-horror-structure.json` | Abandoned Structure Encounters | d100 | Events and discoveries inside condemned buildings, hospitals, asylums |

**`quest`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `quest-horror-hooks.json` | Horror Investigation Hooks | d100 | Session seeds — disappearances, strange phenomena, something wrong in a small town |

**`npc`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `npc-horror-witnesses.json` | Witness Testimonies | d100 | What traumatized witnesses say they saw — consistent enough to be clues, weird enough to be horror |
| `npc-horror-antagonists.json` | Horror Antagonist Traits | d100 | What makes this particular monster, killer, or cult leader distinctive |

---

#### POST-APOCALYPTIC (`genre: ["post-apocalyptic"]`)

**`encounter-terrain`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `encounter-wasteland.json` | Wasteland Encounters | d100 | Events in open ruins and dead landscapes |
| `encounter-ruined-city.json` | Ruined City Encounters | d100 | What happens moving through the remains of a major urban center |

**`quest`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `quest-wasteland-hooks.json` | Wasteland Job Hooks | d100 | Survival missions — salvage runs, community defense, finding resources |

**`items-tech`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `items-tech-salvage.json` | Salvage Finds | d100 | Pre-collapse items found in ruins — their condition and potential use |
| `items-tech-wasteland-gear.json` | Wasteland Equipment | d100 | Jury-rigged, patched-together, and improvised survival gear |

**`npc`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `npc-wasteland-factions.json` | Wasteland Faction Types | d100 | The gangs, cults, settlements, and wandering groups that define the post-collapse world |
| `npc-wasteland-survivors.json` | Wasteland Survivor Backgrounds | d100 | Where this person was when the world ended and what they've been doing since |

---

#### ESPIONAGE / THRILLER (`genre: ["espionage"]`)

**`quest`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `quest-spy-missions.json` | Intelligence Operation Seeds | d100 | Mission types — dead drops, exfiltrations, honey traps, asset meetings |
| `quest-cover-stories.json` | Cover Story Details | d100 | Plausible backstories for agents going undercover |

**`npc`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `npc-spy-contacts.json` | Intelligence Contacts | d100 | The assets, handlers, doubles, and informants an operative might meet |

**`items-tech`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `items-tech-spy-gadgets.json` | Spy Gadgets & Tradecraft Tools | d100 | Hidden cameras, dead drops, signal devices, disguises |

---

#### WESTERN (`genre: ["western"]`)

**`encounter-terrain`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `encounter-frontier-trail.json` | Frontier Trail Encounters | d100 | What happens on the road west — other travelers, hazards, opportunities |
| `encounter-frontier-town.json` | Frontier Town Encounters | d100 | Events in a small western settlement |

**`quest`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `quest-western-hooks.json` | Frontier Adventure Hooks | d100 | Bounties, land disputes, railroad trouble, outlaws, and pioneer problems |

**`npc`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `npc-western-archetypes.json` | Western Archetypes | d100 | The gunfighter, the sheriff, the snake-oil salesman, the sodbuster |

---

#### OCCULT NOIR (`genre: ["occult-noir"]`)

> **Vibe brief:** Industrial-gothic cities built on canals and old bones. Mid-century to early-modern aesthetics — trench coats, valve-lit offices, pneumatic tubes, gas lamps next to electric ones. The supernatural is not a secret: ghosts are a labor dispute, demons are a smuggling problem, spirits are a sanitation issue. Crews run scores for factions that may or may not be entirely human. Debt is spiritual as much as financial. The city itself has opinions.

> **Tone references:** haunted heist thriller, cold city noir, occult tradecraft, industrial gothic, shadow economy, deniable operations where "deniable" means the agency will disavow you *and* perform the exorcism without telling you what it costs.

---

**`npc`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `npc-occult-crew-archetypes.json` | Crew Archetypes | d20 | The specialists you'd find on a score — the whisper, the slide, the leech, the hound, each with a twist |
| `npc-occult-handlers.json` | Agency Handlers & Patrons | d20 | Who is giving the crew its jobs and what they want — their manner, their leverage, their agenda |
| `npc-occult-contacts.json` | Street Contacts | d100 | The fences, fixers, spirit brokers, black market alchemists, and corrupt inspectors a crew might know |
| `npc-occult-witnesses.json` | Witnesses to the Unnatural | d20 | What people who saw something impossible say about it — and what they want in return for talking |
| `npc-occult-rivals.json` | Rival Crew Traits | d20 | What makes the other crew distinctive — their method, their reputation, their tell |
| `npc-occult-marks.json` | Score Targets | d100 | Who or what the crew has been contracted against — noble houses, spirit-bound vaults, haunted ships, ministry officials |
| `npc-occult-spirits.json` | Spirit Personalities | d100 | The character of a ghost, demon, or bound entity the crew encounters — their fixation, their leverage, their weakness |

**`faction`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `faction-occult-types.json` | Faction Types | d100 | The organizations that run this city — criminal syndicates, occult bureaus, merchant consortiums, ancient cults, labor gangs, spirit courts — what they want and how they operate |
| `faction-occult-turf.json` | Faction Turf Details | d20 | What a faction's territory looks, smells, and feels like — the signs that mark it as theirs |
| `faction-occult-complications.json` | Faction Complications | d20 | Ways the crew's relationship with a faction gets messier — debts called in, rival factions interfering, internal schism |
| `faction-occult-demands.json` | Patron Demands | d100 | Specific jobs, favors, or obligations a patron places on the crew — mundane, bizarre, and troubling in equal measure |

**`quest`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `quest-occult-scores.json` | Score Seeds | d100 | The job — what the crew is being hired to steal, destroy, retrieve, assassinate, escort, or negotiate — with a supernatural angle baked in |
| `quest-occult-entanglements.json` | Post-Score Entanglements | d100 | What comes back to bite the crew after a job — consequences, complications, and unexpected parties with opinions |
| `quest-occult-side-jobs.json` | Side Job Hooks | d100 | Smaller gigs that arise between major scores — quick coin with a twist |
| `quest-occult-long-game.json` | Long-Game Schemes | d20 | Overarching crew ambitions — what they're really building toward, and the obstacle standing between them and it |

**`encounter-social`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `encounter-occult-street.json` | City Street Encounters | d100 | What happens moving through the gothic industrial city — the crowds, the horrors, the opportunities |
| `encounter-occult-underworld.json` | Criminal Underworld Encounters | d100 | Events in dens, back rooms, and fences' shops — deals, threats, and surprises |
| `encounter-occult-overheard.json` | Things Overheard in the City | d100 | Fragments of conversation in taverns, tram cars, workhouses, and ministry halls |
| `encounter-occult-docks.json` | Dockside & Waterfront Encounters | d100 | The port district — smugglers, spirit-infested cargo, ghost ships, and night-shift inspectors |

**`encounter-dungeon`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `encounter-occult-vault.json` | Vault & Secured Location Events | d100 | What happens inside a noble's private vault, a ministry archive, or a spirit-warded strongroom during a score |
| `encounter-occult-ruins.json` | City Ruins & Undercity Events | d100 | The old city beneath the city — collapsed canals, buried wards, things that were sealed away |
| `encounter-occult-estate.json` | Estate & Manor Events | d100 | What happens in a wealthy patron's or mark's private residence — staff, traps, secrets, and things that shouldn't be in the study |

**`items-mundane`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `items-occult-pockets.json` | Things Found in Pockets (Occult Noir) | d100 | What's on the body of someone in this world — transit tokens, spirit-wards, incriminating receipts, contraband leviathan oil |
| `items-occult-black-market.json` | Black Market Inventory | d100 | What the fence has in the back room this week — stolen goods, occult contraband, ministry-flagged materials |
| `items-occult-evidence.json` | Evidence & Clues at a Scene | d100 | What the crew finds when they search a location — the things that tell a story if you know how to read them |

**`items-magic`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `items-occult-artifacts.json` | Occult Artifacts | d100 | Spirit-bound objects, cursed heirlooms, alchemical contraband, and remnants of the old world — what they do and what they cost to use |
| `items-occult-minor.json` | Minor Occult Items | d100 | Small, everyday supernatural objects — ghost lamps, spirit bottles, blood-marked contracts, minor wards |
| `items-occult-payouts.json` | Score Payouts | d100 | What the crew actually walks away with — coin, information, favors, objects, and the occasional complication |

**`items-tech`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `items-tech-occult-gear.json` | Crew Equipment | d100 | The tools of the trade in this world — alchemical grenades, pneumatic grapples, electroplasmic lanterns, concealed weapons, forged documents |
| `items-tech-occult-weapons.json` | Weapons of the Trade | d20 | What this city's criminals and agents carry — and the stories those weapons tell |

**`location`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `location-occult-districts.json` | City Districts | d100 | The neighborhoods — their character, their smell, their danger, their opportunity |
| `location-occult-venues.json` | Venues & Establishments | d100 | Bars, gambling dens, spirit parlors, Ministry offices, canal markets, leviathan processing plants |
| `location-occult-safehouses.json` | Safehouse Details | d20 | What a crew's bolt-hole looks like — its advantages, its problems, and what it costs to keep |
| `location-occult-score-sites.json` | Score Site Details | d100 | The physical feel of a location the crew is casing — its layout hints, its atmosphere, and the first wrong thing they notice |

**`phenomena`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `phenomena-occult-ghost-activity.json` | Ghost Activity | d100 | What a ghost is doing and why — its fixation, how it manifests, what it's protecting or replaying |
| `phenomena-occult-demon-presence.json` | Demon Presence Signs | d100 | Evidence a demon or bound entity has been active in a location — the damage it leaves behind |
| `phenomena-occult-bleed.json` | The Ghost Field Bleeds Through | d100 | Moments when the barrier between living and dead thins — strange events that serve as atmosphere or clues |
| `phenomena-occult-ritual-aftermath.json` | Ritual Aftermath | d100 | What's left after someone performed a ritual here — the residue, the damage, the thing that was summoned or bound |
| `phenomena-occult-strange-omens.json` | Strange Omens | d20 | Unsettling signs that something is about to happen — useful for session openings or scene dressing |

**`horror`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `horror-occult-dread.json` | Dread Moments | d100 | Small, creeping wrongness specific to this genre — the candle that burns wrong, the reflection that's a half-second late, the canal water that whispers |
| `horror-occult-costs.json` | Costs of Power | d100 | What using occult abilities, artifacts, or bargains takes from a person — physical, psychological, social, spiritual |

**`gm-tools`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `gm-occult-complications.json` | Score Complications | d100 | What goes wrong mid-job — the variable that wasn't in the plan |
| `gm-occult-clocks.json` | Ticking Clock Events | d20 | Things happening in the background that will matter if the crew dawdles |
| `gm-occult-downtime.json` | Downtime Events | d100 | What happens between scores — opportunities, problems, and developments in the crew's world |
| `gm-occult-city-events.json` | City-Level Events | d20 | Large-scale things happening in the city that flavor the world and create pressure |

---

#### GENRE-AGNOSTIC (`genre: ["any"]`)

These tables are intentionally written to work in any setting.

**`npc`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `npc-speech-quirks.json` | Speech Quirks & Verbal Tics | d20 | How this person talks — universal regardless of setting |
| `npc-motivations.json` | NPC Motivations | d20 | What drives this person — fear, love, greed, loyalty, revenge |
| `npc-secrets.json` | NPC Secrets | d100 | What this person is hiding — genre-agnostic |
| `npc-relationships.json` | NPC Relationship to the Party | d20 | How this person relates to the protagonists — wary ally, old debt, rival |

**`gm-tools`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `gm-oracle-yes-no.json` | Oracle: Yes/No/Maybe | d20 | Degrees of yes and no for improv answers — with complications |
| `gm-complications.json` | Unexpected Complications | d100 | What goes wrong when things were supposed to go smoothly |
| `gm-discoveries.json` | Unexpected Discoveries | d100 | Something the party wasn't looking for but found anyway |
| `gm-weather.json` | Weather & Atmosphere | d20 | Conditions for any environment — description-focused |
| `gm-time-pressure.json` | Time Pressure Events | d20 | Things that create urgency — can be reflavored for any genre |

**`quest`**
| Target File | Title | Die | Description |
|---|---|---|---|
| `quest-party-origin-any.json` | How the Group Came Together | d100 | Universal backstory connections — shared history, coincidence, mutual need |
| `quest-twists.json` | Mid-Session Twists | d20 | Complications that reframe what the party thought was happening |

---

## 6. Genericization Rules (Fantasy Source Material)

When converting tables from the source PDFs, apply these replacements. The goal: no trademarked terms, no edition-specific mechanics.

### Race / Ancestry Names

| Source Term | Replace With |
|---|---|
| Aasimar | Angelic-Blooded, Celestial-Touched |
| Tiefling | Infernal-Blooded, Fiend-Touched, Hellborn |
| Tabaxi | Cat-Folk, Feline-Folk |
| Kenku | Raven-Folk, Corvid-Folk |
| Dragonborn | Dragon-Blooded, Draconid |
| Warforged | Living Construct, Golem-Kin, Constructed Being |
| Githyanki / Githzerai | Astral Warrior / Mindwalker |
| Illithid / Mind Flayer | Psionic Aberration, Mind-Eater |
| Beholder | Eye Tyrant |
| Aarakocra | Avian-Folk, Bird-Folk |

### Class Names (in NPC context)

| Source Term | Replace With |
|---|---|
| Paladin | Holy Warrior, Oath-Knight, Divine Champion |
| Wizard | Mage, Arcanist, Scholar of Magic |
| Sorcerer | Innate Mage, Wild-Mage |
| Warlock | Pact-Binder, Hexblade |
| Cleric | Priest, Devotee, Divine Servant |
| Druid | Nature Keeper, Grove-Warden, Shaper |
| Ranger | Scout, Warden, Hunter |
| Barbarian | Berserker, Savage Warrior |
| Bard | Storyteller, Minstrel, Lorekeeper |
| Monk | Ascetic, Mystic, Fist-Fighter |
| Rogue | Scoundrel, Cutpurse, Shadow |
| Fighter | Warrior, Soldier, Blade |

### Setting-Specific Proper Nouns

- Named planes → descriptive equivalents ("the clockwork plane", "the grey wastes", "the first hell")
- Named deities → role descriptions ("a war god", "the death goddess", "the trickster")
- Named organizations → function descriptions ("a secret society", "the thieves' guild", "a mercenary company")
- Named D&D locations → terrain type ("the Underdark" → "the deep underground")

### Currency & Mechanics

- `gp / gold pieces` → `gold` or `coins`
- `sp / cp / pp` → `silver / copper / platinum`
- Mechanical references (DCs, saving throws, HP) → remove or rewrite as description
- Specific spell names → describe the effect ("Fireball" → "a burst of conjured flame")

---

## 7. AI Contributor Instructions

When given this doc and asked to generate or transcribe tables, follow these rules exactly.

**One file at a time.** Generate one complete JSON file per response. Never truncate entries.

**Pool size is the priority.** Do not stop at 100 entries because the source PDF had 100. Check the pool size targets in Section 2 and write toward the Target column. For a standard NPC utility table, that means 500 entries. For a core frequently-rolled table, aim for 1,000. If the source material provides a starting point, use it — then keep writing in the same style until you hit the target.

**`die` is cosmetic, entry count is not.** Set `die` to whatever feels right for the table's granularity (d20 for small focused tables, d100 for broad ones). The actual entry count can be anything. Do not make them match.

**No padding.** Every entry must be genuinely distinct and useful. Do not write vague or near-duplicate entries to hit a count. If you run out of strong ideas before the target, stop — a table of 350 sharp entries is better than 500 with 150 duds.

**When expanding source material:** read all the source entries first to internalize the tone, specificity level, and types of ideas before writing new ones. New entries should be indistinguishable in quality from the source.

**Genre matters.** Every entry must feel at home in the tagged genre(s). A sci-fi table should not have a result that reads like fantasy. A horror table must hold its tone across every entry — no tonal whiplash, no comic relief in a dread table.

**Check the catalog.** Confirm the target filename, die display value, category, genre array, and any special column or formatting notes before writing.

**Genericize.** Apply Section 6 to all entries converted from fantasy source material. Do not output any trademarked or edition-specific terms.

**No markdown in results.** The `result` field is plain text only. No bold, italics, lists, or HTML.

**Verify the schema before finishing:**
- `roll` values are sequential starting at 1, with no gaps
- `roll` count matches `entries` array length (not necessarily `die`)
- `id` is kebab-case matching the target filename (without `.json`)
- `category` is a slug from Section 3
- `genre` contains only slugs from Section 4
- `die` is one of: 4, 6, 8, 10, 12, 20, 100

---

## 8. File Location in Project

```
src/data/tables/<category-slug>/<filename>.json
```

Examples:
```
src/data/tables/npc/npc-physical-traits.json
src/data/tables/quest/quest-odd-jobs.json
src/data/tables/items-tech/items-tech-cyberware.json
src/data/tables/horror/horror-dread-events.json
src/data/tables/encounter-terrain/encounter-wasteland.json
```

The widget discovers tables by scanning this directory recursively and filtering by the `genre` and `category` fields.

---

## 9. Build Order Recommendation

**Batch 1 — Core utility (genre-agnostic foundation):**
`npc-physical-traits`, `npc-motivations`, `npc-secrets`, `npc-speech-quirks`, `gm-oracle-yes-no`, `gm-complications`, `quest-twists`

**Batch 2 — Fantasy core (from zip):**
`npc-backstories`, `npc-drunken-boasts`, `quest-side-hooks-fantasy`, `quest-odd-jobs`, `encounter-road-social`, `items-magic-minor`, `items-mundane-pockets-fantasy`

**Batch 3 — Occult Noir (priority genre):**
`quest-occult-scores`, `quest-occult-entanglements`, `npc-occult-crew-archetypes`, `npc-occult-contacts`, `npc-occult-spirits`, `faction-occult-types`, `encounter-occult-street`, `phenomena-occult-ghost-activity`, `horror-occult-dread`, `items-occult-artifacts`, `gm-occult-complications`, `gm-occult-downtime`

**Batch 4 — Horror essentials:**
`horror-dread-events`, `horror-haunting-events`, `horror-psychological`, `quest-horror-hooks`, `encounter-investigation-site`

**Batch 5 — Sci-Fi core:**
`npc-professions-scifi`, `encounter-space-station`, `quest-side-hooks-scifi`, `items-tech-scifi-gear`, `phenomena-scifi-anomalies`, `quest-distress-signals`

**Batch 6 — Cyberpunk & Modern:**
`encounter-city-modern`, `encounter-city-cyberpunk`, `items-tech-cyberware`, `quest-side-hooks-cyberpunk`, `quest-craigslist-jobs`, `items-mundane-pockets-modern`

**Batch 7 — Retrofuturistic & Western:**
`encounter-retro-planet`, `quest-retrofuturistic-hooks`, `items-tech-retro-gadgets`, `encounter-frontier-trail`, `quest-western-hooks`, `npc-western-archetypes`

**Batch 8 — Post-Apocalyptic & Espionage:**
`encounter-wasteland`, `encounter-ruined-city`, `quest-wasteland-hooks`, `items-tech-salvage`, `quest-spy-missions`, `items-tech-spy-gadgets`

**Batch 9 — Remaining fantasy (large splits):**
All 14 roadside encounter files, all 20 random item files, weapon backstories, market stalls, ancestry tables, spreadsheet sources.
