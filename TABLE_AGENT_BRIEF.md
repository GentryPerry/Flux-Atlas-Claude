# Random Table Content Brief

You are generating entries for TTRPG random tables used by GMs during play.

---

## Output Format

Output the completed JSON as a code block in your response. If the table is very large (over ~800 entries), split across responses and label each part:
```
// FILE: npc-physical-traits.json  PART 1 of 3  (entries 1–300)
```

Every output is a single complete JSON object, never truncated:

```json
{
  "id": "kebab-case-slug matching the filename without .json",
  "title": "Display name",
  "category": "slug from the Category List below",
  "subcategory": "optional freeform string",
  "genre": ["one or more slugs from the Genre List below"],
  "die": 100,
  "description": "One sentence: when would a GM use this table?",
  "tags": ["freeform", "keywords"],
  "entries": [
    { "roll": 1, "result": "Entry text." },
    { "roll": 2, "result": "Entry text." }
  ]
}
```

**`die`** — set to 20 for small focused tables, 100 for broad ones. Does not need to match entry count.

**`roll`** — sequential starting at 1, no gaps. Count can be anything.

**`result`** — plain text only. No markdown, no HTML, no line breaks.

---

## Entry Count Targets

| Table type | Minimum | Target |
|---|---|---|
| Niche / highly specific | 100 | 200 |
| Standard utility | 200 | 500 |
| Frequently-rolled (NPC traits, encounters, complications) | 500 | 1,000 |
| Core tables | 1,000 | 2,000 |

Stop where quality ends. A table of 350 sharp entries beats 500 with 150 duds.

---

## Entry Rules

- One to three sentences per entry.
- Every entry must be distinct — not just surface variation.
- No stat blocks, no mechanical references (saving throws, DCs, HP). Description and flavor only.
- No trademarked terms. See Genericization below.
- No entries that start with "Roll again," "The GM may," or similar.
- Every entry must fit the tagged genre(s). Hold tone across the whole table.

---

## Genre List

| Slug | Setting |
|---|---|
| `any` | Works in any setting |
| `fantasy` | Medieval, high fantasy, sword & sorcery |
| `dark-fantasy` | Grimdark, gothic, horror-adjacent fantasy |
| `modern` | Contemporary real-world, 1980s–present |
| `horror` | Supernatural, psychological, survival horror |
| `sci-fi` | Space opera, hard sci-fi, alien worlds, starships |
| `cyberpunk` | Near-future, megacorps, implants, neon cities |
| `retrofuturistic` | Atompunk, dieselpunk, 1950s space age, pulp sci-fi |
| `post-apocalyptic` | Wasteland, collapse, survival, ruins of civilization |
| `western` | Frontier, gunslingers, outlaws, frontier towns |
| `espionage` | Spies, cold war, black ops, tradecraft |
| `nautical` | Sea voyages, pirates, ocean exploration |
| `occult-noir` | Industrial-gothic heist thriller. Mid-century aesthetics. Ghosts are a labor dispute. Demons are a smuggling problem. Crews run scores for factions that may not be entirely human. The city has opinions. Debt is spiritual. |

---

## Category List

| Slug | Contents |
|---|---|
| `npc` | Traits, backstories, speech, personality, professions, quirks |
| `ancestry` | Unusual traits for specific peoples, bloodlines, or species |
| `encounter-terrain` | Random encounters keyed to environment |
| `encounter-social` | Non-combat interactions, street run-ins, travel meetings |
| `encounter-dungeon` | Events inside structures — rooms, corridors, facilities, ruins |
| `quest` | Mission seeds, job postings, rumors, contracts, hooks |
| `items-magic` | Enchanted or supernatural items |
| `items-mundane` | Non-magical goods, junk, pockets, loot |
| `items-tech` | Gadgets, gear, vehicles, cybernetics, equipment |
| `items-weapon` | Weapon histories, enchantments, quirks, modifications |
| `location` | Shops, rooms, venues, districts, regions |
| `magic` | Spells, curses, supernatural effects |
| `phenomena` | Unexplained events, anomalies, strange occurrences |
| `combat` | Boss mechanics, monsters, enemies, traps, hazards |
| `world` | Natural features, weather, atmosphere, overland details |
| `gm-tools` | Investigation results, complications, puzzles, oracles, clocks |
| `tavern` | Overheard conversations, rumors, venue details |
| `horror` | Dread events, body horror, psychological effects, hauntings |
| `faction` | Organizations, their structure, reputation, rivalries, demands |

---

## Genericization

Replace these terms throughout.

**Ancestry / race names:**

| Replace | With |
|---|---|
| Aasimar | Angelic-Blooded, Celestial-Touched |
| Tiefling | Infernal-Blooded, Fiend-Touched, Hellborn |
| Tabaxi | Cat-Folk, Feline-Folk |
| Kenku | Raven-Folk, Corvid-Folk |
| Dragonborn | Dragon-Blooded, Draconid |
| Warforged | Living Construct, Golem-Kin |
| Githyanki / Githzerai | Astral Warrior / Mindwalker |
| Illithid / Mind Flayer | Psionic Aberration, Mind-Eater |
| Beholder | Eye Tyrant |
| Aarakocra | Avian-Folk, Bird-Folk |

**Class names:**

| Replace | With |
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

**Other:**

| Replace | With |
|---|---|
| Named planes (Mechanus, Avernus, Limbo…) | Descriptive ("the clockwork plane", "the first hell", "the chaos realm") |
| Named deities | Role ("a war god", "the death goddess", "the trickster") |
| Named IP organizations | Function ("a thieves' guild", "a secret society", "a mercenary company") |
| `gp` / `gold pieces` | `gold` or `coins` |
| Spell names (Fireball, Hold Person…) | Effect description ("a burst of conjured flame", "a paralysis effect") |
| Saving throws / DCs / HP | Rewrite as description, remove the mechanical element |
