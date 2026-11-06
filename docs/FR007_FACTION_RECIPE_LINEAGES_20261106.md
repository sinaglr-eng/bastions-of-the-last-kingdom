# FR007 Dwarf and Elf recipe lineages

**Revision 2 · proposal for review · not implemented.** Prepared 6 November 2026 against game **0.6.9**, ruleset **fr005-r2-dwarf-air-20261102**. This proposal changes 47 of 114 faction recipes. All 258 combat profiles, abilities, stats, approved appearances, Human recipes and shared Lady Claire recipes remain exact. Implementation and publication require a later explicit request.

## Common recipe rules

Each ordinary branch has one main draft family and two support families. Basic champions must directly include the main family at rank I, with all draft ingredients at rank II or below. Intermediate recipes may use draft ranks up to IV. These caps also hold when predecessor recipes are expanded. Existing predecessor champion links and the three-defender crafting format remain intact. Repeated families/ranks are permitted only as distinct physical defender instances.

Ordinary Advanced and TOP routes use only the declared branch families, including recursively expanded ingredients. A terminal Advanced specialist retains its branch predecessor and requires at least one directly added draft family **outside** the normal three-family pool, except the explicit Mortar Dwarf correction in revision 2. The exact exceptional ingredient is recorded below. This exception does not broaden the normal TOP route.

The user explicitly selected six Dwarf pools and all eight Elf main families. Elf support pairs and the remaining two Dwarf pools are proposal defaults. A branch may use only part of its permitted family pool in a particular recipe; the rule does not require all three families in every upgrade. Every Dwarf and Elf TOP recipe must use its preceding Advanced champion plus exactly two rank-VI basic defender instances from the branch pool. Both required basic ranks are VI; rank V is not an alternative. Advanced draft-rank choices otherwise retain the current structure where possible.

## Branch families

| Faction | Branch | Main family | Support families | Selection status |
| --- | --- | --- | --- | --- |
| Dwarves | Dwarf Berserkers | Shieldguard | Boar Rider + Blacksmith | Pool inferred from current branch and selected corrections |
| Dwarves | Muskets and snipers | Musketeer | Griffin Handler + Grenadier | User-selected pool |
| Dwarves | Boar riders | Boar Rider | Shieldguard + Dwarf Miner | User-selected pool |
| Dwarves | Bombs and siege | Grenadier | Blacksmith + Griffin Handler | Pool inferred from current branch and selected corrections |
| Dwarves | Iron golems and crank Gatlings | Dwarf Miner | Musketeer + Grenadier | User-selected pool |
| Dwarves | Runic magic and immunity weakening | Runesmith | Blacksmith + Dwarf Miner | User-selected pool |
| Dwarves | Griffin riders | Griffin Handler | Musketeer + Runesmith | User-selected pool |
| Dwarves | Blacksmiths and flame machines | Blacksmith | Dwarf Miner + Grenadier | User-selected pool |
| Elves | Emerald Guardians | Emerald Elf | Elven Ranger + Stormspear | Main selected; supports proposed |
| Elves | Moonlight Rangers | Elven Ranger | Elven Priestess + Stormspear | Main selected; supports proposed |
| Elves | Thunder Phoenixes | Stormspear | Elven Priestess + Lunar Spirit Shaman | Main selected; supports proposed |
| Elves | Drow Phantoms | Lunar Spirit Shaman | Moonblade Assassin + Nightweaver Spider | Main selected; supports proposed |
| Elves | Nightweaver Brood | Nightweaver Spider | Lunar Spirit Shaman + Moonblade Assassin | Main selected; supports proposed |
| Elves | Shadow Assassins | Moonblade Assassin | Emerald Elf + Nightweaver Spider | Main selected; supports proposed |
| Elves | Elven Battlemages | Elven Priestess | Stormspear + Emerald Elf | Main selected; supports proposed |
| Elves | Fire dragons | Dragon Keeper | Stormspear + Elven Priestess | Main selected; supports proposed |

## Successor choices per exact defender and rank

Every defender profile may lead to at most three distinct immediate champion or shared Secret recipe outputs shown under Next recipes. Every basic family at every rank I–VI must have at least one such recipe. The preferred count is two, with a strict majority of basic profiles reaching that count in each revised faction. A recipe requiring two copies of the same family/rank counts as one output choice, not two. Include the unchanged shared Secret recipe in the counts. Rank-I and rank-II versions of the same family are separate ingredient identities; do not aggregate their choices into one family-wide limit.

| Faction | Basic profiles with one choice | With two choices | With three choices | Dead ranks | Above three |
| --- | ---: | ---: | ---: | ---: | ---: |
| Human | 16 | 31 | 1 | 0 | 0 |
| Dwarves | 15 | 29 | 4 | 0 | 0 |
| Elves | 15 | 29 | 4 | 0 | 0 |

Human recipes already satisfy the count bounds and remain unchanged. Proposed Dwarf and Elf draft ranks and selected support ingredients distribute choices without altering the main-family requirements or allowed branch pools. All champion profiles also meet the three-output maximum; terminal champions may correctly have no successor. Cards and exact-rank dialogs must display these same choices. See [full successor counts](../output/design/fr007-current/successor-counts.json).

## Exact proposed recipes

Every row is an ordinary champion. These tables are the implementation target, including recipes that already comply. Lady Claire and all Human recipes are excluded.

### Dwarves

| Champion | Class | Proposed ingredients | Terminal exception |
| --- | --- | --- | --- |
| Dwarf Axeman | BASIC | Shieldguard I + Boar Rider II + Blacksmith I | — |
| Dwarf Dualist | INTERMEDIATE | Dwarf Axeman + Shieldguard II + Blacksmith III | — |
| Dwarf Berserker | ADVANCED | Dwarf Dualist + Shieldguard V + Blacksmith IV | — |
| Berserker Champion | TOP | Dwarf Berserker + Shieldguard VI + Boar Rider VI | — |
| Dwarf Rifleman | BASIC | Musketeer I + Griffin Handler II + Grenadier II | — |
| Dwarf Sniper | INTERMEDIATE | Dwarf Rifleman + Musketeer III + Grenadier III | — |
| Heavy Sniper | ADVANCED | Dwarf Sniper + Musketeer V + Griffin Handler III | — |
| Mortar Dwarf | ADVANCED | Dwarf Sniper + Musketeer IV + Grenadier IV | Explicit Mortar Dwarf inside-pool exception |
| Master Sniper | TOP | Heavy Sniper + Musketeer VI + Grenadier VI | — |
| Boar Lancer | BASIC | Boar Rider I + Shieldguard I + Dwarf Miner II | — |
| Boar Drummer | INTERMEDIATE | Boar Lancer + Boar Rider III + Dwarf Miner III | — |
| Armored Boar Rider | ADVANCED | Boar Drummer + Boar Rider IV + Shieldguard III | — |
| War Drummer | ADVANCED | Boar Drummer + Boar Rider V + Runesmith II | Runesmith |
| Boar Warlord | TOP | Armored Boar Rider + Boar Rider VI + Shieldguard VI | — |
| Bomb Dwarf | BASIC | Grenadier I + Blacksmith I + Griffin Handler I | — |
| Fire Bomber | INTERMEDIATE | Bomb Dwarf + Grenadier IV + Blacksmith II | — |
| Griffin Bomber | ADVANCED | Fire Bomber + Griffin Handler IV + Grenadier V | — |
| Siege Cannon | ADVANCED | Fire Bomber + Grenadier V + Boar Rider IV | Boar Rider |
| Dwarf Airship | TOP | Griffin Bomber + Grenadier VI + Griffin Handler VI | — |
| Gatling Gunner | BASIC | Dwarf Miner I + Musketeer I + Grenadier I | — |
| Iron Golem | INTERMEDIATE | Gatling Gunner + Dwarf Miner IV + Grenadier III | — |
| Gatling Golem | ADVANCED | Iron Golem + Dwarf Miner V + Musketeer II | — |
| Forge Sentinel | ADVANCED | Iron Golem + Dwarf Miner V + Shieldguard IV | Shieldguard |
| Iron Colossus | TOP | Gatling Golem + Dwarf Miner VI + Musketeer VI | — |
| Rune Dwarf | BASIC | Runesmith I + Blacksmith II + Dwarf Miner I | — |
| Rune Mage | INTERMEDIATE | Rune Dwarf + Runesmith III + Blacksmith III | — |
| Rune Guardian | ADVANCED | Rune Mage + Runesmith V + Dwarf Miner IV | — |
| Rune Master | TOP | Rune Guardian + Runesmith VI + Blacksmith VI | — |
| Griffin Scout | BASIC | Griffin Handler I + Musketeer II + Runesmith I | — |
| Griffin Gunner | INTERMEDIATE | Griffin Scout + Griffin Handler II + Musketeer III | — |
| Armored Griffin Rider | ADVANCED | Griffin Gunner + Griffin Handler V + Runesmith IV | — |
| Griffin Commander | TOP | Armored Griffin Rider + Griffin Handler VI + Runesmith VI | — |
| Steam Dwarf | BASIC | Blacksmith I + Dwarf Miner II + Grenadier II | — |
| Flamethrower | INTERMEDIATE | Steam Dwarf + Blacksmith IV + Grenadier IV | — |
| Heavy Flamethrower | ADVANCED | Flamethrower + Blacksmith V + Dwarf Miner III | — |
| Forge Dwarf | ADVANCED | Flamethrower + Blacksmith V + Runesmith IV | Runesmith |
| Fire Furnace | TOP | Heavy Flamethrower + Blacksmith VI + Dwarf Miner VI | — |

### Elves

| Champion | Class | Proposed ingredients | Terminal exception |
| --- | --- | --- | --- |
| Emerald Sentry | BASIC | Emerald Elf I + Elven Ranger I + Stormspear I | — |
| Emerald Blademaster | INTERMEDIATE | Emerald Sentry + Emerald Elf II + Stormspear III | — |
| Ironbark Ent | ADVANCED | Emerald Blademaster + Emerald Elf III + Emerald Elf V | — |
| World Oak Ent | TOP | Ironbark Ent + Emerald Elf VI + Elven Ranger VI | — |
| Stag Bulwark | ADVANCED | Emerald Blademaster + Emerald Elf V + Dragon Keeper III | Dragon Keeper |
| Moonlight Ranger Scout | BASIC | Elven Ranger I + Elven Priestess II + Stormspear I | — |
| Moonlight Ranger Captain | INTERMEDIATE | Moonlight Ranger Scout + Elven Ranger II + Elven Ranger III | — |
| Moonlight Ranger Warden | ADVANCED | Moonlight Ranger Captain + Stormspear III + Elven Ranger V | — |
| Moonlight Eagle Rider | TOP | Moonlight Ranger Warden + Elven Ranger VI + Elven Priestess VI | — |
| Moonshadow Huntress | ADVANCED | Moonlight Ranger Captain + Dragon Keeper IV + Elven Ranger V | Dragon Keeper |
| Stormspear Initiate | BASIC | Stormspear I + Elven Priestess I + Lunar Spirit Shaman I | — |
| Thunderlance Guard | INTERMEDIATE | Stormspear Initiate + Stormspear IV + Elven Priestess III | — |
| Thunder Phoenix | ADVANCED | Thunderlance Guard + Lunar Spirit Shaman III + Stormspear V | — |
| Tempest Phoenix | TOP | Thunder Phoenix + Stormspear VI + Elven Priestess VI | — |
| Stormwing Phoenix Rider | ADVANCED | Thunderlance Guard + Emerald Elf IV + Stormspear V | Emerald Elf |
| Drow Wraithcaller | BASIC | Lunar Spirit Shaman I + Moonblade Assassin I + Nightweaver Spider I | — |
| Drow Moon Specter | INTERMEDIATE | Drow Wraithcaller + Lunar Spirit Shaman II + Nightweaver Spider IV | — |
| Moon Banshee | ADVANCED | Drow Moon Specter + Moonblade Assassin III + Lunar Spirit Shaman IV | — |
| Eclipse Phantom | TOP | Moon Banshee + Lunar Spirit Shaman VI + Nightweaver Spider VI | — |
| Crescent Revenant | ADVANCED | Drow Moon Specter + Elven Priestess IV + Lunar Spirit Shaman V | Elven Priestess |
| Nightweaver Broodguard | BASIC | Nightweaver Spider I + Lunar Spirit Shaman II + Moonblade Assassin II | — |
| Nightweaver Spider Rider | INTERMEDIATE | Nightweaver Broodguard + Nightweaver Spider II + Lunar Spirit Shaman III | — |
| Nightweaver Spider Queen | ADVANCED | Nightweaver Spider Rider + Moonblade Assassin III + Nightweaver Spider V | — |
| Eclipse Broodmother | TOP | Nightweaver Spider Queen + Nightweaver Spider VI + Lunar Spirit Shaman VI | — |
| Moonweb Hunter | ADVANCED | Nightweaver Spider Rider + Elven Ranger IV + Nightweaver Spider IV | Elven Ranger |
| Shadow Assassin Apprentice | BASIC | Moonblade Assassin I + Emerald Elf II + Nightweaver Spider II | — |
| Shadow Assassin Adept | INTERMEDIATE | Shadow Assassin Apprentice + Moonblade Assassin IV + Nightweaver Spider III | — |
| Shadow Assassin Expert | ADVANCED | Shadow Assassin Adept + Emerald Elf IV + Moonblade Assassin V | — |
| Shadow Assassin Master | TOP | Shadow Assassin Expert + Moonblade Assassin VI + Nightweaver Spider VI | — |
| Elven Battlemage Apprentice | BASIC | Elven Priestess I + Stormspear II + Emerald Elf I | — |
| Elven Battlemage Adept | INTERMEDIATE | Elven Battlemage Apprentice + Elven Priestess III + Emerald Elf III | — |
| Elven Battlemage Expert | ADVANCED | Elven Battlemage Adept + Stormspear IV + Elven Priestess V | — |
| Elven Battlemage Master | TOP | Elven Battlemage Expert + Elven Priestess VI + Emerald Elf VI | — |
| Baby Fire Dragon | BASIC | Dragon Keeper I + Stormspear II + Elven Priestess II | — |
| Fire Dragon | INTERMEDIATE | Baby Fire Dragon + Dragon Keeper III + Dragon Keeper II | — |
| Mother Fire Dragon | ADVANCED | Fire Dragon + Dragon Keeper IV + Dragon Keeper V | — |
| Ancient Dragon Patriarch | TOP | Mother Fire Dragon + Dragon Keeper VI + Stormspear VI | — |

## Selected corrections

Dwarf Axeman replaces Runesmith I with Blacksmith I. Dwarf Berserker replaces Runesmith III with Blacksmith IV. Rune Dwarf requires Runesmith I. Moonlight Ranger Scout requires Elven Ranger I; Shadow Assassin Apprentice requires Moonblade Assassin I; Baby Fire Dragon requires Dragon Keeper I. The same main-rank-I rule applies to every other Basic champion in both factions.

Revision 2 selected corrections: Dwarf Sniper uses Musketeer III; Heavy Sniper uses Musketeer V; Mortar Dwarf uses Dwarf Sniper + Musketeer IV + Grenadier IV. This exact Mortar Dwarf selection is the single named exception to the terminal outside-pool requirement. Master Sniper uses Heavy Sniper + Musketeer VI + Grenadier VI. Moonlight Eagle Rider uses Moonlight Ranger Warden + Elven Ranger VI + Elven Priestess VI. Eclipse Phantom uses Moon Banshee + Lunar Spirit Shaman VI + Nightweaver Spider VI. All other revised Dwarf and Elf TOP recipes also follow Advanced + VI + VI.

## Material impact and validation

The review includes 53 recursively changed material totals. Rank-I material equivalents use 1, 2, 4, 8, 16 and 32 for ranks I–VI and expand predecessor recipes. They are a transparent cost comparison, not draft odds, CP costs, a balance certificate or proof of a winning army. A later implementation must test acquisition and progression under the changed recipes.

Validate all 74 ordinary champion recipes: exactly three physical ingredients, valid faction/rank references, no cycles, no duplicate recipe multisets, reachable progression from the eight draft families, required main I for every Basic, rank caps, ordinary recursive pools and explicit external families for nine terminal Advanced specialists and the single user-selected Mortar Dwarf exception. Check all sixteen TOP recipes as Advanced + VI + VI. Preserve all predecessor champion edges. Reconcile cards, exact ingredient modals, successors, evolution comparisons, exports and inherited-mechanic explanations with the same recipe data. Ingredients do not add or remove combat abilities.

The original game/runtime data, approved media, prompts, review identity, model binaries and player records must remain unchanged during this proposal. The existing [FR-006 draft](FR006_FINAL_BOSS_HUMAN_SCALE_REGEN_AND_SCORE_20261106.md) remains separate and unimplemented. No game version, score cohort, public deployment or balance simulation is part of this gallery update.

Machine-readable implementation target: [handoff](../output/design/fr007-current/implementation-handoff.json). Review [changed recipes](../output/design/fr007-current/recipe-changes.json) and [material impact](../output/design/fr007-current/material-changes.json).
