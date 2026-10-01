# Bastions of the Last Kingdom

## Battlefield and core loop

The browser version uses a completely open 37 × 37 board. No scenery blocks any playable cell. Camp and keep models stand outside the board. Zero-based coordinates:

| Marker | X | Z |
|---|---:|---:|
| Entrance | 0 | 4 |
| Checkpoint 1, left midpoint | 4 | 18 |
| Checkpoint 2, right midpoint | 32 | 18 |
| Checkpoint 3, upper-right corner | 32 | 4 |
| Checkpoint 4, top midpoint | 18 | 4 |
| Checkpoint 5, bottom midpoint | 18 | 32 |
| Keep gate | 36 | 32 |

Checkpoints sit on the fifth tile from each nearest edge: zero-based index 4 or 32, with four full cells before the marker. The route loops through 2–3–4 and crosses itself in the middle. Ground troops visit all five in order using cardinal shortest paths; flying troops traverse the same ordered checkpoints directly. Reaching a crossing or checkpoint never costs lives. Only completing the final segment to the keep does.

Each round grants five sealed build slots. A successful placement commits its tile, then independently rolls a defender family and rank; no identity, portrait, rank or recipe hint exists beforehand. Invalid placement consumes no randomness. Mastery odds are frozen at round start. Place all five, then keep one, merge a matching pair, or complete a recipe. Unchosen defenders and consumed ingredients become barricades. Each placement must leave every route segment reachable. Between waves, existing active ingredients can also combine. The selected ingredient's position holds the result. There is no unrestricted tower shop.

## Valley scenery and recommended maze

Terraced snow-capped peaks, branched conifers and birches, rocks, flowers, a winding river and an animated waterfall frame the board. River highlights and foam travel along the curved current; sheets, spray and expanding splash rings animate the waterfall. Ground scenery stays outside the playable grid; a bridge connects the final tile to the keep. Soft drifting clouds fade in only when the camera pulls back. The default camera frames the field and surrounding valley.

The maze button (M) opens the three user-provided reference layouts and three curated central-fire variants, plus saved custom plans. The new variants use 134, 143 and 148 occupied cells, with 772, 820 and 864 route steps and 69%, 72% and 71% central-fire coverage. They bring every checkpoint leg through central firing circles and make 8, 8 and 14 continuous firing passes. The chooser shows in-range seconds at a stated two-cell-per-second reference speed and six-cell range; these are geometric comparisons, not a damage prediction. Earlier automatic suggestions have been removed. Selecting closes the panel and fixes every planned cell. Building only updates progress, remaining-budget and conflict warnings; no background search changes the chosen structure. M opens the chooser again. Cyan cells are future foundations; gold marks firing positions. Counts sum exact six-leg gameplay BFS steps, including repeated visits. The custom editor supports mouse drag strokes, touch taps, erase, undo/redo, names and browser-local persistence; it pauses gameplay and never spends draws or gold. A one-finger touch drag pans instead of drawing. Save rejects sealed checkpoints, reserved cells and more than 250 positions. Prepared variants are best-found routes, not proven global optima.

The ground uses one continuous world-space meadow shader across the field and surrounding shoulders. Layered grass patches, fine blades and clover provide detail without blocking tiles. The construction grid has internal lines only; there is no rectangular frame or raised board.

## Eight families, six ranks

The user supplied [Gem TD on the Dota 2 Wiki](https://dota2.fandom.com/wiki/Gem_TD) as the mechanical reference. Original heroes, creatures and siege machines replace gems and named source towers. This adaptation uses the Dota 2 variant's armor-reducing Amethyst, not the older Warcraft variant's air-only Amethyst.

| Defender | Unit code | Role |
|---|---|---|
| Soldier | S | Heavy single-target sword strikes |
| Archer | A | Rapid single-target arrows |
| Druid | D | Poison lasting five seconds |
| Mage | M | Arcane hit with pure splash damage |
| Cleric | C | Attack-speed blessing |
| Engineer | R | Shatters enemy armor |
| Frost Warden | F | Slows enemy movement |
| Stormcaller | T | Strikes three enemies at once |

Ranks I–VI are Militia, Trained, Veteran, Elite, Royal and Mythic. Display labels combine the family letter with the Roman rank, such as `S I` or `S VI`. Every family has an explicit six-row profile in data/towers.json. Two identical units of the same rank among the current round’s five draft candidates merge one rank upward; VI is capped. Mythic VI is merge-only, while mastery rolls ranks I–V. The grimoire exposes all 48 profiles; artifacts/defender-ranks.csv provides an editable comparison export.

Gem TD supplies the basic identities and recipe topology. Soldier has 2.5-cell ground-only reach and 50% stronger rank I–V strikes. Soldier, Archer and Stormcaller VI deal roughly 3.5 times rank V direct DPS. Stormcaller VI reaches 12 cells. Mythic frost slows by 55%. These are campaign adaptations, not exact Dota combat equivalence.

Mythic upgrades alter defining abilities: faster arrows, stronger sword hits, independent poison DPS, larger pure cleave, stronger blessing, armor reduction, nearby frost slow, or twelve-tile triple targeting. Models add equipment and floating ornaments while keeping one-cell footprints.

## Champion recipes

All combinations require exactly three distinct defenders with the stated families and ranks. The approved roster contains 37 ordinary champions and two Secret champions, using stable family IDs for renamed units and including all restored reference combinations. An advanced ingredient is a complete crafted defender. Recipe requirements themselves gate progression, without additional Kingdom-level locks. Every champion has one fixed form; paid enhancements and obsolete upgrade multipliers are unavailable.

| Champion | Reference recipe | Required ingredients |
|---|---|---|
| Frostbolt Watchmen | Silver | Frost Warden F I + Soldier S I + Stormcaller T I |
| Knight | Silver Knight | Frostbolt Watchmen I + Archer A II + Mage M III |
| Lionheart Champion | Pink Diamond | Soldier S V + Soldier S III + Stormcaller T III |
| Kingslayer | Huge Pink Diamond | Lionheart Champion I + Knight I + Frostbolt Watchmen I |
| King | Koh-i-noor Diamond | Kingslayer I + Engineer R VI + Soldier S VI |
| Elven Ranger | Malachite | Cleric C I + Druid D I + Archer A I |
| Elven Elite Warrior | Vivid Malachite | Elven Ranger I + Soldier S II + Stormcaller T III |
| Elemental Mage | Uranium-238 | Stormcaller T V + Frost Warden F III + Cleric C II |
| Elemental Archmage | Uranium-235 | Elemental Mage I + Elven Ranger I + Elven Elite Warrior I |
| Fire Baby Dragon | Asteriated Ruby | Mage M II + Mage M I + Engineer R I |
| Fire Mother Dragon | Volcano | Fire Baby Dragon I + Mage M IV + Engineer R III |
| Thunderbird | Bloodstone | Mage M V + Archer A IV + Engineer R III |
| Dragonrider | Antique Bloodstone | Thunderbird I + Fire Mother Dragon I + Mage M II |
| Mage Dragon rider | The Crown Prince | Dragonrider I + Mage M VI + Druid D VI |
| Master Druid | Jade | Druid D III + Cleric C III + Frost Warden F II |
| Archdruid | Grey Jade | Master Druid I + Frost Warden F IV + Archer A III |
| Ballista | Gold | Engineer R V + Engineer R IV + Soldier S II |
| Priest | Chrysoberyl Cat's Eye | Cleric C V + Soldier S IV + Archer A III |
| Frost Colossus | Yellow Saphire | Frost Warden F V + Mage M IV + Stormcaller T IV |
| Angel | Star Sapphire | Frost Colossus I + Frost Warden F VI + Cleric C VI |
| Dwarf Firebomber | Paraiba Tourmaline | Archer A V + Cleric C IV + Druid D II |
| Catapult | Dark Emerald | Druid D V + Frost Warden F IV + Stormcaller T II |
| Ranger | Quartz | Druid D IV + Mage M III + Engineer R II |
| Royal Storm Arsenal | Deplemented-Kyparium | Elemental Archmage I + Archer A VI + Stormcaller T VI |
| Bearking | Monkey King Jade | Archdruid I + Druid D IV + Engineer R II |
| Paladin | Deepsea Pearl | Archer A IV + Soldier S IV + Cleric C II |
| Nature Spirit | Diamond Cullinan | Bearking I + Soldier S VI + Frost Warden F VI |
| Royal Ranger | Lucky Chinese Jade | Ranger I + Master Druid I + Druid D III |
| King's Ranger Guard | Charming Lazurite | Ranger I + Engineer R IV + Stormcaller T II |
| Elven King | Golden Jubilee | King's Ranger Guard I + Stormcaller T VI + Mage M VI |
| Fire Ballista | Egypt Gold | Ballista I + Engineer R V + Archer A II |
| Golem | Emerald Golem | Catapult I + Ballista I + Soldier S III |
| Dwarf Griffin bomber | Elaborately Carved Tourmaline | Catapult I + Dwarf Firebomber I + Druid D II |
| Mechanical Golem | Sapphire Star of Adam | Dwarf Griffin bomber I + Druid D VI + Engineer R VI |
| Monk | Red Coral | Paladin I + Priest I + Cleric C IV |
| Archbishop | Carmen-Lucia | Monk I + Cleric C VI + Archer A VI |
| Archangel | Northern Saber's Eye | Frost Colossus I + Thunderbird I + Frost Warden F V |
| Lady Claire · Secret | Fantastic Miss Shrimp | Mage M V + Druid D V + Frost Warden F V · current round only |
| Lord Bernhard · Secret | Diamond Cullinan | Soldier S V + Soldier S IV + Soldier S III · current round only |

The recipe dependency graph follows these selected reference combinations, including crafted ingredients and VI requirements. The approved data retains the agreed combat values, reference notes and explicitly identified adaptations. Data files and the grimoire describe the implemented effects; source-verification notes stay separate from player-facing ability labels.

There are exactly 39 champion families and 39 fixed recipes (37 ordinary and two Secret); champion Ascension is disabled. Basic rank merging remains restricted to two current-round candidates, capped at VI. Champions have fixed statistics and no paid enhancements. Champion cards show readable effects plus direct attack damage and DPS (damage divided by attack interval); conditional criticals, multi-target hits, support bonuses and continuous damage are described separately. Pinning a recipe recursively expands its crafted ingredients into basic family/rank requirements and aggregates duplicates. Existing component champions contribute their underlying basic ingredients to progress without consuming stock twice.

The 37 ordinary champion classifications follow the wiki Towers table: 5 Basic, 13 Intermediate, 11 Advanced and 8 TOP. Lady Claire and Lord Bernhard use the Secret classification with gold auras. All classes have equally large cosmetic auras: Basic blue, Intermediate green, Advanced purple, TOP gold and Secret gold. Basic recruit ranks use their existing six colors independently of champion classification.

Every basic family and rank I–VI now appears in at least one fixed champion recipe. Royal Storm Arsenal retains the reference recipe, but its rapid three-target physical true strike is an authored adaptation because the source does not specify its ability.

The 37 ordinary champion models are original characters, creatures or siege machines: distinct armored heroes, rangers and druids; dragons and riders, a thunderbird, bear king and golems; priest, monk, bishop and angelic silhouettes; and catapult, cannon and ballista variants. Basic and advanced units occupy one cell, while advanced wings and weapons may overhang visually. Original family IDs and recipe branches remain stable. `data/towers.json`, `data/recipes.json` and `data/balance.json` are the authoritative approved settings. `tools/author-roster.mjs` validates the full roster and can refresh presentation fields from the catalog without regenerating combat values or recipes. Runtime models, thumbnails and Blender exports share the same source geometry.

## Secret champion selection

Lady Claire and Lord Bernhard can be crafted only in the selection phase after all five current-round candidates have been placed. Their exact three ingredients must be distinct actual draw IDs from that same round. Retained defenders, stale candidates, incomplete placement or a selected noningredient cannot offer the combination. Selecting any one of the three valid ingredients anchors the result there; the other four current foundations become walls. No gold is charged. Ordinary recipes retain their existing use of retained ingredients.

Claire attacks for 1225 arcane damage every 0.5 seconds at range 10. A successful hit rolls chain (20%) and fork (50%) independently: chain deals 150 through up to five additional distinct hops, and fork deals 2500 to up to five eligible targets with a 50-tile impact-centered reach. Her attack-start Melancholy roll is 3%, cancels that attack and blocks new attacks for five combat seconds. A moon symbol and countdown report the live state; already launched shots continue.

Bernhard attacks one target for 3164 poison-type damage every 0.5 seconds at range 13, applying 16 poison damage per second for five seconds. His three-tile support aura grants allies +3 range and true strike, including himself and the exact boundary. “Poison 5” is an ability grade, not five targets. Existing strongest-effect stacking and immunity rules apply. Exact source precedence and adaptations are in [SECRET_CHAMPION_RULES.md](docs/SECRET_CHAMPION_RULES.md). Nature Spirit remains a separate approved ordinary champion even though it shares the Diamond Cullinan reference.

## Combat and economy

Armor uses 30 / (30 + effective armor), after flat reduction and penetration. Magic damage applies generic and typed resistances; pure cleave ignores both. Projectiles deal damage on arrival. Soldier strikes have a short windup and check melee range again at impact. Criticals and chain procs use seeded randomness. Attack cooldown overshoot is retained for fast attackers at accelerated game speed.

Poison has its own per-rank DPS and five-second duration. Druid and Engineer first select enemies without the corresponding live status or an incoming effect shot, preserving selected priority within that group. When all eligible targets are marked they follow ordinary priority; failed shots and expired effects release the target. Master Druid applies 24 poison DPS; Archdruid applies 48 poison DPS and grants three extra tiles of ally range. Reapplying a status refreshes it without duplicating it, retaining the strongest magnitude and kill owner. Cleric blessings of different ranks combine; duplicates use the strongest value. Range, damage, control protection, armor reduction and slows use their strongest value. Frost Colossus and Angel have a 75% slowing aura; Archangel starts at 70%. Bosses suffer half the normal slowing strength.

Dwarf Firebomber applies a −15 armor aura within four tiles. Catapult has a 10% chance to stun for two seconds, with half duration on bosses. Ranger applies −10 armor and 30% slow only to flying targets; magic immunity blocks its slow. Royal Storm Arsenal fires three physical true-strike shots every 0.25 seconds. Bearking grants true strike and +3 range within six tiles; true strike bypasses evasion but not shields, armor or physical immunity. Paladin completely protects nearby allies from disarm and dread. Ballista removes 30 armor; Fire Ballista removes 40 armor; champion attacks do not generate gold.

Royal Ranger has a 1% chance on a successful attack to restore one keep health, capped at starting health. Monk combines two distinct blessing groups without doubling identical Cleric or Priest groups. Mechanical Golem suppresses healing for three seconds and applies an armor aura to magic-immune enemies. Golem's Stone Gaze requires an enemy to face it for two seconds, then petrifies for three seconds and doubles physical damage received. Dragonrider's forked lightning selects five targets, with magical immunity respected. Archangel has a 25% chance to release ten frost bounces when an allied caster within six tiles lands a magical hit; its own attacks, blocked hits and secondary bounces do not trigger that effect.

Start with 90 gold and 30 keep health. Kills grant XP and score. Each 90 XP raises Kingdom level; construction mastery advances automatically to Kingdom level minus one, capped at 15. Current-round draw odds stay frozen, and new odds apply next round. Perfect kill XP reaches maximum mastery after wave 22, without spending gold. Completed normal waves award 50 gold and boss waves award 200 gold once; kills and champion attacks do not add gold. Gold is reserved for downgrading candidates. Wall demolition is free; keep health cannot be purchased; Royal Ranger's approved recovery proc is the champion health-recovery mechanic. A current basic candidate above Tier I may be downgraded by one rank and immediately kept for 200 gold. There is no pre-placement reroll: recruits do not exist until placed. Mastery changes next round’s odds. The main campaign has 50 original orc warbands with bosses every tenth wave, plus an optional ten-wave skirmish. The Warbands guide (V) exposes all waves, movement classes and counters. docs/WAVE_REFERENCE.md records the reference mapping. Orc names, numerical balance and combat timings are original adaptations.

Only the first wave allows extra time to establish a basic defense near a checkpoint or central crossing: 9 HP, zero armor, movement speed 1.3 and a 2.4-second spawn interval. Waves 2 and 3 return to their original normal pressure: 61/80 HP, 1/8 armor, movement speeds 2.21/2.37 and 0.6-second spawn intervals. Enemy counts remain 8, 8 and 9. Combat tuning for waves 4–50 is unchanged; placing defenders away from the route can still allow leaks.

Enemy mechanics include veil detection, evasion, periodic disarm, three-hit refraction shields, physical/magical immunities, theft on leaking, non-stacking attack suppression, periodic rush, reactive armor, healing recharge, checkpoint-preserving blink, flat shell protection and war-drum haste. Pure damage bypasses damage-type immunity, armor and shell; refraction still absorbs direct pure hits. Damage over time bypasses direct-hit shields. Clerics reveal veiled enemies within six tiles. Flying variants include wyvern riders, giant bats, goblin scrapwings and dragon-mounted warlords; the old balloon silhouette is retired. All active names and appearance descriptions are in English. Native bats flap, heavy flying mounts use slower wing cycles, and ground actors move their legs and breathe. The simulation clock freezes living enemy motion while paused; reduced motion restores their authored poses. Variants are seeded once per wave, and the combat sidebar reports that actual variant's traits and resistances. Boss health updates while the battle runs.

Score starts at zero. Each killed regular enemy grants 10 × the current wave; a boss grants 500 × the wave. Surviving grants 100 × the wave, with an additional 200 × the wave on boss rounds. Rewards are awarded once, and leaking enemies grant no kill score. The browser-local profile stores the best score. Selected-defender counts include retained units of the exact family and rank; grimoire cards count retained results across champion ranks.

Balance remains provisional. Seeded simulations exercise the real game loop, but do not replace human playtesting. Original low-poly art, browser-local profile saves and synthesized sounds are prototype assets; in-progress save/load is not implemented.


## Current-round clarity and demolition

Each successfully placed current-round draft has a stable numbered marker matching its card and keyboard slot 1–5. It has no rotating arrow. An available advanced recipe replaces its large numeral with a result portrait; the small hotkey number remains and the whole icon stays readable. Retained ingredients also display recipe portraits without a current-round number. A star identifies the exact result anchor, minus identifies consumed ingredients, and a wall identifies other candidates that the decision discards. Selecting an ingredient or a recipe preview changes the indicated result anchor. Crowded portraits are separated and linked to their units. Keep/merge/craft resolves current-round markers immediately.

Delete or Backspace demolishes only a selected castle wall for free, without refunding the construction draw. Retained defenders cannot be demolished; advanced recipes can consume them and leave removable walls. Unresolved candidates, combat/end states and no selection reject removal without changing the grid. Cleared draws remain spent. Masonry connects both cardinal and diagonal neighbors; decorative bridges do not block extra navigation cells.

Commander's spiral contains 136 planned cells and 590 cardinal steps: 88 + 98 + 124 + 96 + 66 + 118. Its central nine positions form a contiguous 3 × 3 block at x/z 17–19. The route passes around the battery, never through its interior. Six-tile firing circles around those nine cells cover 265 counted steps (45%).

A survived non-final wave awards its reward exactly once and immediately increments the round and creates five hidden construction slots. The final wave still ends in victory. Mouse-edge panning uses the battlefield bounds, stops outside the canvas or with a modal, and excludes touch input. The compass rotates with camera azimuth. Blender enemy silhouettes stand about 1.82–1.98 world units tall, comparable to defender characters; bosses reach about 3.1–3.4 with distinct auras. Kept defenders stand on a 0.74-unit stone platform connected to neighboring walls and other retained foundations. Only the character rotates or recoils. Drafts remain on the ground until kept. Killed enemies collapse into retained corpse models; flying enemies fall and fold their wings. Corpses clear at the next construction round. Catapult arms pivot during attacks, including continuous aura attacks. Enemy statistics are separately tuned in tools/author-campaign.mjs; docs/ECONOMY_BALANCE.md records the pressure curve and role defenses.

## September 30 — host and economy revision

The planner explicitly reports the 250-placement campaign ceiling, the union of planned cells and existing off-plan buildings, and remaining unspent draws. Walls and defenders each occupy one cell. Demolition never restores the used draw. Potential combinations require an exact family and tier match. Redundant Preview buttons are removed; automatic recipe ingredient markers remain.
