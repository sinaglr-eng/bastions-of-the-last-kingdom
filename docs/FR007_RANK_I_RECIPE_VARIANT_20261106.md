# FR007 revision 3 rank I recipe choices

**Proposal for review, not implemented.** Prepared 6 November 2026 against local game **0.6.10**, ruleset **fr006-fr007-r2-20261106**. This variant changes 16 recipes. FR-006 and FR-007 revision 2 remain implemented in the current runtime. All 258 combat profiles, 559 ability assignments, approved images, models, Human recipes and shared Lady Claire recipes remain unchanged.

## Rank and successor rules

Each Dwarf and Elf basic defender at rank I should have one immediate champion recipe output wherever feasible and must never have more than two. Seven of eight rank-I defenders in each faction have one output. Blacksmith I keeps two outputs to preserve the selected Dwarf Axeman ingredient. Stormspear I keeps two because four Basic champions require this family as a support; placing all four at rank II would exceed that rank's three-output limit.

Basic champions directly require their main family at rank I and use no ingredients above II. Support ingredients use II wherever the successor limits allow. Intermediate champions directly add ranks II–IV, ordinary Advanced and terminal Advanced champions directly add II–V, and TOP always requires the preceding Advanced champion plus two rank-VI basic defenders. Expanded ancestry still obeys the Basic and Intermediate ceilings. Rank-I ingredients in an inherited Basic champion remain valid; higher classes do not directly require additional rank-I basics.

Every exact basic family/rank I–VI must retain at least one immediate output; every defender profile has a maximum of three, reduced to two for Dwarf and Elf basic rank I. Ranks II–VI should usually have two outputs. Count distinct output recipes, including shared Secret recipes; two copies of one ingredient in the same recipe count as one choice. Preserve the existing champion predecessor links, native faction families, three distinct physical ingredients and all previously selected exact corrections.

## Rank I choices

| Faction | Rank I defender | Immediate recipe outputs | Choices |
| --- | --- | --- | ---: |
| Dwarves | Shieldguard I | Dwarf Axeman | 1 |
| Dwarves | Musketeer I | Dwarf Rifleman | 1 |
| Dwarves | Runesmith I | Rune Dwarf | 1 |
| Dwarves | Boar Rider I | Boar Lancer | 1 |
| Dwarves | Grenadier I | Bomb Dwarf | 1 |
| Dwarves | Dwarf Miner I | Gatling Gunner | 1 |
| Dwarves | Griffin Handler I | Griffin Scout | 1 |
| Dwarves | Blacksmith I | Dwarf Axeman + Steam Dwarf | 2 |
| Elves | Emerald Elf I | Emerald Sentry | 1 |
| Elves | Elven Ranger I | Moonlight Ranger Scout | 1 |
| Elves | Stormspear I | Emerald Sentry + Stormspear Initiate | 2 |
| Elves | Lunar Spirit Shaman I | Drow Wraithcaller | 1 |
| Elves | Nightweaver Spider I | Nightweaver Broodguard | 1 |
| Elves | Moonblade Assassin I | Shadow Assassin Apprentice | 1 |
| Elves | Elven Priestess I | Elven Battlemage Apprentice | 1 |
| Elves | Dragon Keeper I | Baby Fire Dragon | 1 |

## Higher rank distribution

| Faction | II–VI with one choice | With two | With three | Dead ranks | Above three |
| --- | ---: | ---: | ---: | ---: | ---: |
| Dwarves | 10 | 24 | 6 | 0 | 0 |
| Elves | 10 | 25 | 5 | 0 | 0 |

For the fixed branch family allocation, rank selection first minimizes rank-I output counts, then maximizes the number of ranks II–VI with two outputs, then minimizes changes from the implemented recipes. This does not claim an optimum across other family pools.

## Branch pools

| Faction | Branch | Main family | Support families | Selection status |
| --- | --- | --- | --- | --- |
| Dwarves | Dwarf Berserkers | Shieldguard | Boar Rider + Blacksmith | Pool carried forward from authorized revision 2 |
| Dwarves | Muskets and snipers | Musketeer | Griffin Handler + Grenadier | User-selected pool |
| Dwarves | Boar riders | Boar Rider | Shieldguard + Dwarf Miner | User-selected pool |
| Dwarves | Bombs and siege | Grenadier | Blacksmith + Griffin Handler | Pool carried forward from authorized revision 2 |
| Dwarves | Iron golems and crank Gatlings | Dwarf Miner | Musketeer + Grenadier | User-selected pool |
| Dwarves | Runic magic and immunity weakening | Runesmith | Blacksmith + Dwarf Miner | User-selected pool |
| Dwarves | Griffin riders | Griffin Handler | Musketeer + Runesmith | User-selected pool |
| Dwarves | Blacksmiths and flame machines | Blacksmith | Dwarf Miner + Grenadier | User-selected pool |
| Elves | Emerald Guardians | Emerald Elf | Elven Ranger + Stormspear | Main selected; supports carried forward |
| Elves | Moonlight Rangers | Elven Ranger | Elven Priestess + Stormspear | Main selected; supports carried forward |
| Elves | Thunder Phoenixes | Stormspear | Elven Priestess + Lunar Spirit Shaman | Main selected; supports carried forward |
| Elves | Drow Phantoms | Lunar Spirit Shaman | Moonblade Assassin + Nightweaver Spider | Main selected; supports carried forward |
| Elves | Nightweaver Brood | Nightweaver Spider | Lunar Spirit Shaman + Moonblade Assassin | Main selected; supports carried forward |
| Elves | Shadow Assassins | Moonblade Assassin | Emerald Elf + Nightweaver Spider | Main selected; supports carried forward |
| Elves | Elven Battlemages | Elven Priestess | Stormspear + Emerald Elf | Main selected; supports carried forward |
| Elves | Fire dragons | Dragon Keeper | Stormspear + Elven Priestess | Main selected; supports carried forward |

Ordinary routes stay within the three-family pool recursively. Nine terminal Advanced specialists directly add a family outside it. Mortar Dwarf remains the sole selected inside-pool exception: Dwarf Sniper + Musketeer IV + Grenadier IV.

## Exact proposed recipes

### Dwarves

| Champion | Class | Proposed ingredients |
| --- | --- | --- |
| Dwarf Axeman | BASIC | Shieldguard I + Boar Rider II + Blacksmith I |
| Dwarf Dualist | INTERMEDIATE | Dwarf Axeman + Shieldguard II + Blacksmith III |
| Dwarf Berserker | ADVANCED | Dwarf Dualist + Shieldguard V + Blacksmith IV |
| Berserker Champion | TOP | Dwarf Berserker + Shieldguard VI + Boar Rider VI |
| Dwarf Rifleman | BASIC | Musketeer I + Griffin Handler II + Grenadier II |
| Dwarf Sniper | INTERMEDIATE | Dwarf Rifleman + Musketeer III + Grenadier III |
| Heavy Sniper | ADVANCED | Dwarf Sniper + Musketeer V + Griffin Handler III |
| Mortar Dwarf | ADVANCED | Dwarf Sniper + Musketeer IV + Grenadier IV |
| Master Sniper | TOP | Heavy Sniper + Musketeer VI + Grenadier VI |
| Boar Lancer | BASIC | Boar Rider I + Shieldguard II + Dwarf Miner II |
| Boar Drummer | INTERMEDIATE | Boar Lancer + Boar Rider III + Dwarf Miner III |
| Armored Boar Rider | ADVANCED | Boar Drummer + Boar Rider IV + Shieldguard III |
| War Drummer | ADVANCED | Boar Drummer + Boar Rider V + Runesmith II |
| Boar Warlord | TOP | Armored Boar Rider + Boar Rider VI + Shieldguard VI |
| Bomb Dwarf | BASIC | Grenadier I + Blacksmith II + Griffin Handler II |
| Fire Bomber | INTERMEDIATE | Bomb Dwarf + Grenadier IV + Blacksmith II |
| Griffin Bomber | ADVANCED | Fire Bomber + Griffin Handler IV + Grenadier V |
| Siege Cannon | ADVANCED | Fire Bomber + Grenadier V + Boar Rider IV |
| Dwarf Airship | TOP | Griffin Bomber + Grenadier VI + Griffin Handler VI |
| Gatling Gunner | BASIC | Dwarf Miner I + Musketeer II + Grenadier II |
| Iron Golem | INTERMEDIATE | Gatling Gunner + Dwarf Miner IV + Grenadier III |
| Gatling Golem | ADVANCED | Iron Golem + Dwarf Miner V + Musketeer IV |
| Forge Sentinel | ADVANCED | Iron Golem + Dwarf Miner V + Shieldguard IV |
| Iron Colossus | TOP | Gatling Golem + Dwarf Miner VI + Musketeer VI |
| Rune Dwarf | BASIC | Runesmith I + Blacksmith II + Dwarf Miner II |
| Rune Mage | INTERMEDIATE | Rune Dwarf + Runesmith III + Blacksmith III |
| Rune Guardian | ADVANCED | Rune Mage + Runesmith V + Dwarf Miner IV |
| Rune Master | TOP | Rune Guardian + Runesmith VI + Blacksmith VI |
| Griffin Scout | BASIC | Griffin Handler I + Musketeer II + Runesmith II |
| Griffin Gunner | INTERMEDIATE | Griffin Scout + Griffin Handler III + Musketeer III |
| Armored Griffin Rider | ADVANCED | Griffin Gunner + Griffin Handler V + Runesmith IV |
| Griffin Commander | TOP | Armored Griffin Rider + Griffin Handler VI + Runesmith VI |
| Steam Dwarf | BASIC | Blacksmith I + Dwarf Miner II + Grenadier II |
| Flamethrower | INTERMEDIATE | Steam Dwarf + Blacksmith IV + Grenadier IV |
| Heavy Flamethrower | ADVANCED | Flamethrower + Blacksmith V + Dwarf Miner III |
| Forge Dwarf | ADVANCED | Flamethrower + Blacksmith V + Runesmith IV |
| Fire Furnace | TOP | Heavy Flamethrower + Blacksmith VI + Dwarf Miner VI |

### Elves

| Champion | Class | Proposed ingredients |
| --- | --- | --- |
| Emerald Sentry | BASIC | Emerald Elf I + Elven Ranger II + Stormspear I |
| Emerald Blademaster | INTERMEDIATE | Emerald Sentry + Emerald Elf III + Stormspear III |
| Ironbark Ent | ADVANCED | Emerald Blademaster + Emerald Elf V + Emerald Elf V |
| World Oak Ent | TOP | Ironbark Ent + Emerald Elf VI + Elven Ranger VI |
| Stag Bulwark | ADVANCED | Emerald Blademaster + Emerald Elf V + Dragon Keeper III |
| Moonlight Ranger Scout | BASIC | Elven Ranger I + Elven Priestess II + Stormspear II |
| Moonlight Ranger Captain | INTERMEDIATE | Moonlight Ranger Scout + Elven Ranger II + Elven Ranger III |
| Moonlight Ranger Warden | ADVANCED | Moonlight Ranger Captain + Stormspear III + Elven Ranger V |
| Moonlight Eagle Rider | TOP | Moonlight Ranger Warden + Elven Ranger VI + Elven Priestess VI |
| Moonshadow Huntress | ADVANCED | Moonlight Ranger Captain + Dragon Keeper IV + Elven Ranger V |
| Stormspear Initiate | BASIC | Stormspear I + Elven Priestess II + Lunar Spirit Shaman II |
| Thunderlance Guard | INTERMEDIATE | Stormspear Initiate + Stormspear IV + Elven Priestess III |
| Thunder Phoenix | ADVANCED | Thunderlance Guard + Lunar Spirit Shaman III + Stormspear V |
| Tempest Phoenix | TOP | Thunder Phoenix + Stormspear VI + Elven Priestess VI |
| Stormwing Phoenix Rider | ADVANCED | Thunderlance Guard + Emerald Elf IV + Stormspear V |
| Drow Wraithcaller | BASIC | Lunar Spirit Shaman I + Moonblade Assassin II + Nightweaver Spider II |
| Drow Moon Specter | INTERMEDIATE | Drow Wraithcaller + Lunar Spirit Shaman IV + Nightweaver Spider IV |
| Moon Banshee | ADVANCED | Drow Moon Specter + Moonblade Assassin III + Lunar Spirit Shaman IV |
| Eclipse Phantom | TOP | Moon Banshee + Lunar Spirit Shaman VI + Nightweaver Spider VI |
| Crescent Revenant | ADVANCED | Drow Moon Specter + Elven Priestess IV + Lunar Spirit Shaman V |
| Nightweaver Broodguard | BASIC | Nightweaver Spider I + Lunar Spirit Shaman II + Moonblade Assassin II |
| Nightweaver Spider Rider | INTERMEDIATE | Nightweaver Broodguard + Nightweaver Spider III + Lunar Spirit Shaman III |
| Nightweaver Spider Queen | ADVANCED | Nightweaver Spider Rider + Moonblade Assassin III + Nightweaver Spider V |
| Eclipse Broodmother | TOP | Nightweaver Spider Queen + Nightweaver Spider VI + Lunar Spirit Shaman VI |
| Moonweb Hunter | ADVANCED | Nightweaver Spider Rider + Elven Ranger IV + Nightweaver Spider IV |
| Shadow Assassin Apprentice | BASIC | Moonblade Assassin I + Emerald Elf II + Nightweaver Spider II |
| Shadow Assassin Adept | INTERMEDIATE | Shadow Assassin Apprentice + Moonblade Assassin IV + Nightweaver Spider III |
| Shadow Assassin Expert | ADVANCED | Shadow Assassin Adept + Emerald Elf IV + Moonblade Assassin V |
| Shadow Assassin Master | TOP | Shadow Assassin Expert + Moonblade Assassin VI + Nightweaver Spider VI |
| Elven Battlemage Apprentice | BASIC | Elven Priestess I + Stormspear II + Emerald Elf II |
| Elven Battlemage Adept | INTERMEDIATE | Elven Battlemage Apprentice + Elven Priestess III + Emerald Elf III |
| Elven Battlemage Expert | ADVANCED | Elven Battlemage Adept + Stormspear IV + Elven Priestess V |
| Elven Battlemage Master | TOP | Elven Battlemage Expert + Elven Priestess VI + Emerald Elf VI |
| Baby Fire Dragon | BASIC | Dragon Keeper I + Stormspear II + Elven Priestess II |
| Fire Dragon | INTERMEDIATE | Baby Fire Dragon + Dragon Keeper III + Dragon Keeper II |
| Mother Fire Dragon | ADVANCED | Fire Dragon + Dragon Keeper IV + Dragon Keeper V |
| Ancient Dragon Patriarch | TOP | Mother Fire Dragon + Dragon Keeper VI + Stormspear VI |

## Material impact and implementation checks

51 recursively expanded material totals change relative to game 0.6.10. One draft at ranks I–VI represents 1, 2, 4, 8, 16 or 32 rank-I equivalents. See [material impact](../output/design/fr007-rank1-current/material-changes.json). Increased ingredients require later acquisition and campaign testing before a gameplay balance claim.

Validate all 74 ordinary Dwarf and Elf recipes for reachability, cycles, unique multisets, native families, main I, rank ceilings, higher-class inputs of II or above, sixteen Advanced + VI + VI TOP recipes, nine external terminal families and the Mortar exception. Check all 96 basic family/rank successor lists, both rank-I exceptions and every other defender's three-output bound. Cards, exact ingredient dialogs, predecessor trees, successor links and exports must use the same proposal data. Recipe ingredients do not grant extra combat abilities.

The local runtime, release version, original artwork, recorded prompts, reviews, models and player records must remain unchanged for this proposal. The authorized revision 2 handoff is retained only as required implementation and regression evidence. The gallery serves this current proposal without previous-version controls. Implementation and publication are not part of this request.

[Exact implementation handoff](../output/design/fr007-rank1-current/implementation-handoff.json) · [changed recipes](../output/design/fr007-rank1-current/recipe-changes.json) · [all successor counts](../output/design/fr007-rank1-current/successor-counts.json)
