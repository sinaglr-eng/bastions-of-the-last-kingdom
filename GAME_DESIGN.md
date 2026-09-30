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

The maze button (M) opens eight precomputed and validated layouts plus saved custom plans. Selecting closes the panel and fixes every planned cell. Building only updates progress, remaining-budget and conflict warnings; no background search changes the chosen structure. M opens the chooser again. Cyan cells are future foundations; gold marks firing positions. Counts sum exact six-leg gameplay BFS steps, including repeated visits. The custom editor supports mouse drag strokes, touch taps, erase, undo/redo, names and browser-local persistence; it pauses gameplay and never spends draws or gold. A one-finger touch drag pans instead of drawing. Save rejects sealed checkpoints, reserved cells and more than 250 positions. Prepared variants are best-found routes, not proven global optima.

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
| Runebreaker | R | Shatters enemy armor |
| Frost Warden | F | Slows enemy movement |
| Stormcaller | T | Strikes three enemies at once |

Ranks I–VI are Militia, Trained, Veteran, Elite, Royal and Mythic. Display labels combine the family letter with the Roman rank, such as `S I` or `S VI`. Every family has an explicit six-row profile in data/towers.json. Two identical units of the same rank among the current round’s five draft candidates merge one rank upward; VI is capped. Mythic VI is merge-only, while mastery rolls ranks I–V. The grimoire exposes all 48 profiles; artifacts/defender-ranks.csv provides an editable comparison export.

Reference basic hit-damage ratios and attack intervals are retained, with damage multiplied by three for this campaign. One hundred source range units become one board cell. Soldier adapts Diamond to a ground-only sword fighter with 2.5-cell reach. Sapphire's flat movement reductions become capped percentage slows. The reference's exceptional Topaz VI range becomes 50 cells. These are deliberate adaptations, not a claim of exact Dota combat equivalence.

Mythic upgrades alter defining abilities: faster arrows, stronger sword hits, independent poison DPS, larger pure cleave, stronger blessing, armor reduction, nearby frost slow, or battlefield-wide triple targeting. Models add equipment and floating ornaments while keeping one-cell footprints.

## Champion recipes and continuing ascension

All combinations require exactly three distinct defenders with the stated families and ranks. The roster contains the 20 original branches below; the eight later formation champions and their 16 recipes have been removed. An advanced ingredient is a complete crafted defender; paid enhancements are consumed with it. Recipe requirements themselves gate progression, without additional Kingdom-level locks. Three optional paid enhancements cost 160, 320 and 480 gold and scale offensive values by 1.3 per purchase. They are separate from basic ranks and champion ascension.

| Advanced unit | Reference recipe | Required ingredients |
|---|---|---|
| Rime Griffin Rider | Silver | Frost Warden 1 + Soldier 1 + Stormcaller 1 |
| Frostwolf Knight | Silver Knight | Rime Griffin Rider + Archer 2 + Mage 3 |
| Rose Duelist | Pink Diamond | Soldier 5 + Soldier 3 + Stormcaller 3 |
| Lionheart Champion | Huge Pink Diamond | Rose Duelist + Frostwolf Knight + Rime Griffin Rider |
| Astral Dragon Rider | Koh-i-noor Diamond | Lionheart Champion + Runebreaker 6 + Soldier 6 |
| Thorn Huntress | Malachite | Cleric 1 + Druid 1 + Archer 1 |
| Elven Windranger | Vivid Malachite | Thorn Huntress + Soldier 2 + Stormcaller 3 |
| Storm Conjurer | Uranium-238 | Stormcaller 5 + Frost Warden 3 + Cleric 2 |
| Thunder Titan | Uranium-235 | Storm Conjurer + Thorn Huntress + Elven Windranger |
| Ember Catapult | Asteriated Ruby | Mage 2 + Mage 1 + Runebreaker 1 |
| Dragonfire Cannon | Volcano | Ember Catapult + Mage 4 + Runebreaker 3 |
| Starweaver | Bloodstone | Mage 5 + Archer 4 + Runebreaker 3 |
| Tempest Archmage | Antique Bloodstone | Starweaver + Dragonfire Cannon + Mage 2 |
| Phoenix Rider | The Crown Prince | Tempest Archmage + Mage 6 + Druid 6 |
| Grovekeeper | Jade | Druid 3 + Cleric 3 + Frost Warden 2 |
| Ancient Treant | Grey Jade | Grovekeeper + Frost Warden 4 + Archer 3 |
| Runeforged Ballista | Gold | Runebreaker 5 + Runebreaker 4 + Soldier 2 |
| Sun Priestess | Chrysoberyl Cat’s Eye | Cleric 5 + Soldier 4 + Archer 3 |
| Frost Colossus | Yellow Sapphire | Frost Warden 5 + Mage 4 + Stormcaller 4 |
| Dawn Seraph | Star Sapphire | Frost Colossus + Frost Warden 6 + Cleric 6 |

The recipe dependency graph follows these selected reference combinations, including crafted ingredients and VI requirements. Missing or extreme reference combat values were authored or moderated for the browser campaign, especially final branch forms and forked lightning. Data files and the grimoire describe the implemented effects.

There are 20 champion families and 20 fixed recipes. Three champions of the same family and rank combine into one of the next rank, at the selected ingredient's position. This repeats at every champion rank without a terminal tier; offensive damage, poison, continuous burn and chain damage multiply by 1.85 per ascension. Support percentages and range do not scale with ascension. Paid enhancements are consumed rather than transferred to the new rank. Basic two-candidate rank merging remains capped at VI.

The following basic ranks are not ingredients in any of the 20 champion recipes. This does not prevent the usual matching-pair merge among current draft candidates at ranks I–V.

| Basic defender | Ranks unused by champion recipes |
|---|---|
| Archer | V, VI |
| Druid | II, IV, V |
| Cleric | IV |
| Runebreaker | II |
| Stormcaller | II, VI |

Soldier, Mage and Frost Warden use every rank I–VI in at least one champion recipe.

The advanced models are original characters or mobile siege machines: griffin, wolf, dragon and phoenix riders; duelists, rangers, spellcasters, treants, elementals and a seraph; plus a catapult, cannon and ballista. Basic and advanced units occupy one cell, while advanced wings and weapons may overhang visually. Original family IDs and recipe branches remain stable. Runtime models, thumbnails and Blender exports share the same source geometry.

## Combat and economy

Armor uses 30 / (30 + effective armor), after flat reduction and penetration. Magic damage applies generic and typed resistances; pure cleave ignores both. Projectiles deal damage on arrival. Soldier strikes have a short windup and check melee range again at impact. Criticals and chain procs use seeded randomness. Attack cooldown overshoot is retained for fast attackers at accelerated game speed.

Poison has its own per-rank DPS and five-second duration. Reapplying a status refreshes it without duplicating it, retaining the strongest magnitude and kill owner. Cleric blessings of different ranks combine; identical rank auras count once. Range and damage auras use the strongest value. Slows use the strongest effect, including the Frost Colossus aura. The Ember Catapult and Dragonfire Cannon burn continuously without needing projectile damage.

Start with 90 gold and 30 keep health. Kills grant gold and XP; each 90 XP raises Kingdom level. Fifteen mastery upgrades cost 6,500 gold in total, reaching the maximum after wave 30 with perfect income devoted to mastery. Removal costs 8 gold; keep health can never be repaired. A current basic candidate above Tier I may be downgraded by one rank and immediately kept for 200 gold. There is no pre-placement reroll: recruits do not exist until placed. Mastery changes next round’s odds. The main campaign has 50 original orc warbands with bosses every tenth wave, plus an optional ten-wave skirmish. The Warbands guide (V) exposes all waves, movement classes and counters. docs/WAVE_REFERENCE.md records the reference mapping. Orc names, numerical balance and combat timings are original adaptations.

The opening three waves allow time to establish a basic defense near a checkpoint or central crossing. Their HP is 9, 15 and 21, armor is zero, movement speeds are 1.3, 1.45 and 1.6, and spawn intervals are 2.4, 2.2 and 2 seconds. Enemy counts remain 8, 8 and 9, and wave rewards remain 29, 36 and 43 gold. Later waves and mastery income are unchanged; placing defenders away from the route can still allow leaks.

Enemy mechanics include veil detection, evasion, periodic disarm, three-hit refraction shields, physical/magical immunities, theft on leaking, non-stacking attack suppression, periodic rush, reactive armor, healing recharge, checkpoint-preserving blink, flat shell protection and war-drum haste. Pure damage bypasses damage-type immunity, armor and shell; refraction still absorbs direct pure hits. Damage over time bypasses direct-hit shields. Clerics reveal veiled enemies within six tiles. Flying variants include wyvern riders, giant bats, scrap balloons and dragon-mounted warlords. Variants are seeded once per wave, and the combat sidebar reports that actual variant's traits and resistances. Boss health updates while the battle runs.

Score starts at zero. Each killed regular enemy grants 10 × the current wave; a boss grants 500 × the wave. Surviving grants 100 × the wave, with an additional 200 × the wave on boss rounds. Rewards are awarded once, and leaking enemies grant no kill score. The browser-local profile stores the best score. Selected-defender counts include retained units of the exact family and rank; grimoire cards count retained results across champion ranks.

Balance remains provisional. Seeded simulations exercise the real game loop, but do not replace human playtesting. Original low-poly art, browser-local profile saves and synthesized sounds are prototype assets; in-progress save/load is not implemented.


## Current-round clarity and demolition

Each successfully placed current-round draft has a golden rotating arrow and a 1–5 badge matching its card. An available advanced recipe replaces its large numeral with a result portrait; the small hotkey number remains. Retained ingredients also display portraits, without arrows. A star identifies the exact result anchor, minus identifies consumed ingredients, and a wall identifies other candidates that the decision discards. Selecting an ingredient or a recipe preview changes the indicated result anchor. Crowded portraits are separated and linked to their units. Keep/merge/craft resolves current-round arrows immediately.

Delete or Backspace demolishes only a selected castle wall for 8 gold, without a refund. Retained defenders cannot be demolished; advanced recipes can consume them and leave removable walls. Unresolved candidates, combat/end states, insufficient gold and no selection reject removal without changing the grid. Cleared draws remain spent. Masonry connects both cardinal and diagonal neighbors; decorative bridges do not block extra navigation cells.

Commander's spiral contains 136 planned cells and 590 cardinal steps: 88 + 98 + 124 + 96 + 66 + 118. Its central nine positions form a contiguous 3 × 3 block at x/z 17–19. The route passes around the battery, never through its interior. Six-tile firing circles around those nine cells cover 265 counted steps (45%).

A survived non-final wave awards its reward exactly once and immediately increments the round and creates five hidden construction slots. The final wave still ends in victory. Mouse-edge panning uses the battlefield bounds, stops outside the canvas or with a modal, and excludes touch input. The compass rotates with camera azimuth. Blender enemy silhouettes stand about 1.82–1.98 world units tall, comparable to defender characters; bosses reach about 3.1–3.4 with distinct auras. Kept defenders stand on a 0.74-unit stone platform connected to neighboring walls and other retained foundations. Only the character rotates or recoils. Drafts remain on the ground until kept. Killed enemies collapse into retained corpse models; flying enemies fall and fold their wings. Corpses clear at the next construction round. Catapult arms pivot during attacks, including continuous aura attacks. Enemy statistics are separately tuned in tools/author-campaign.mjs; docs/ECONOMY_BALANCE.md records the pressure curve and role defenses.

## September 30 — host and economy revision

The planner explicitly reports the 250-placement campaign ceiling, the union of planned cells and existing off-plan buildings, and remaining unspent draws. Walls and defenders each occupy one cell. Demolition never restores the used draw. Potential combinations require an exact family and tier match. Redundant Preview buttons are removed; automatic recipe ingredient markers remain.
