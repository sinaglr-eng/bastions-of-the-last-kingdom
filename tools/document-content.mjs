import {readFileSync,writeFileSync} from 'node:fs';
import {recipeLabel,rankLabel} from '../game/core/recipes.js';
const data=Object.fromEntries(['balance','towers','recipes'].map(k=>[k,JSON.parse(readFileSync(`data/${k}.json`,'utf8'))]));
const basic=Object.entries(data.towers).filter(([,t])=>!t.advanced);
const label=p=>`${data.towers[p.family].name} ${rankLabel(p.tier)}`;
const stats=['family,unit_code,rank,damage,interval_seconds,range_cells,poison_dps,armor_reduction,slow,cleave,cleave_radius,targets,haste'];
for(const [family,t]of basic)t.levels.forEach((s,i)=>stats.push([family,t.unitCode,i+1,s.damage,s.interval,s.range,s.poisonDps||0,s.shred||0,s.slow||0,s.cleave||0,s.cleaveRadius||0,s.multishot||1,s.aura?.haste||0].join(',')));
writeFileSync('artifacts/defender-ranks.csv',stats.join('\n')+'\n');
// Historical mechanical-reference export; do not overwrite the maintained current design.
writeFileSync('artifacts/game-design-reference.md',`# Bastions of the Last Kingdom — reference notes

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

Snow-capped peaks, forests, rocks, flowers, a winding river and an animated waterfall frame the board. Scenery geometry stays outside the playable grid; a bridge connects the final tile to the keep. The default camera frames the field and surrounding valley.

The maze button (M) opens a worker-based search comparing long routes, central strongholds and lean layouts. Cyan cells are future foundations; gold cells are recommended firing positions within six tiles of the centre. The full 50-wave placement budget is available. Every route is counted with the same BFS order as gameplay, segment by segment; repeated visits count. The central coverage value is the union of six-tile firing circles, not a damage simulation. Prepared candidates exceed 1,000 steps, while the central alternative spends most of its route near the middle. Search more retains earlier results and performs additional improvements. Finalists are revalidated after placements. Nothing is auto-built and hidden recruits stay hidden. See docs/MAZE_COMPARISON.md for reproducible measured results; global optimality is not proven.

The ground uses one continuous world-space meadow shader across the field and surrounding shoulders. Layered grass patches, fine blades and clover provide detail without blocking tiles. The construction grid has internal lines only; there is no rectangular frame or raised board.

## Eight families, six ranks

The user supplied [Gem TD on the Dota 2 Wiki](https://dota2.fandom.com/wiki/Gem_TD) as the mechanical reference. Original heroes, creatures and siege machines replace gems and named source towers. This adaptation uses the Dota 2 variant's armor-reducing Amethyst, not the older Warcraft variant's air-only Amethyst.

| Defender | Reference | Role |
|---|---|---|
${basic.map(([,t])=>`| ${t.name} | ${t.referenceGem} (${t.referenceCode}) | ${t.role} |`).join('\n')}

Ranks I–VI are Militia, Trained, Veteran, Elite, Royal and Mythic. Every family has an explicit six-row profile in data/towers.json. Two identical units of the same rank merge one rank upward; VI is capped. Mythic VI is merge-only, while mastery rolls ranks I–V. The grimoire exposes all 48 profiles; artifacts/defender-ranks.csv provides an editable comparison export.

Reference basic hit-damage ratios and attack intervals are retained, with damage multiplied by three for this campaign. One hundred source range units become one board cell. Soldier adapts Diamond to a ground-only sword fighter with 2.5-cell reach. Sapphire's flat movement reductions become capped percentage slows. The reference's exceptional Topaz VI range becomes 50 cells. These are deliberate adaptations, not a claim of exact Dota combat equivalence.

Mythic upgrades alter defining abilities: faster arrows, stronger sword hits, independent poison DPS, larger pure cleave, stronger blessing, armor reduction, nearby frost slow, or battlefield-wide triple targeting. Models add equipment and floating ornaments while keeping one-cell footprints.

## Twenty branching recipes

Recipes require exact families and ranks. An advanced ingredient is a complete crafted defender; paid enhancements are consumed with it. Recipe requirements themselves gate progression, without additional Kingdom-level locks. Three optional paid enhancements cost 160, 320 and 480 gold and scale offensive values by 1.3 per purchase. They are separate from basic ranks.

| Advanced unit | Reference recipe | Required ingredients |
|---|---|---|
${data.recipes.map(r=>`| ${recipeLabel(r,data)} | ${r.referenceTower||'Original formation'} | ${r.ingredients.map(label).join(' + ')} |`).join('\n')}

The recipe dependency graph follows these selected reference combinations, including crafted ingredients and VI requirements. Missing or extreme reference combat values were authored or moderated for the browser campaign, especially final branch forms and forked lightning. Data files and the grimoire describe the implemented effects.

All twenty advanced models are original characters or mobile siege machines: griffin, wolf, dragon and phoenix riders; duelists, rangers, spellcasters, treants, elementals and a seraph; plus a catapult, cannon and ballista. Basic and advanced units occupy one cell, while advanced wings and weapons may overhang visually. Their recipe IDs and mechanics stay stable; only their names, presentation and flavor change. Runtime models, thumbnails and Blender exports share the same source geometry.

## Combat and economy

Armor uses 30 / (30 + effective armor), after flat reduction and penetration. Magic damage applies generic and typed resistances; pure cleave ignores both. Projectiles deal damage on arrival. Soldier strikes have a short windup and check melee range again at impact. Criticals and chain procs use seeded randomness. Attack cooldown overshoot is retained for fast attackers at accelerated game speed.

Poison has its own per-rank DPS and five-second duration. Reapplying a status refreshes it without duplicating it, retaining the strongest magnitude and kill owner. Cleric blessings of different ranks combine; identical rank auras count once. Range and damage auras use the strongest value. Slows use the strongest effect, including the Frost Colossus aura. The Ember Catapult and Dragonfire Cannon burn continuously without needing projectile damage.

Start with 90 gold and 30 keep health. Kills grant gold and XP; each 90 XP raises Kingdom level. Eight mastery tables improve future draw odds. Removal costs 8 and a five-health repair costs 60. There is no pre-placement reroll: recruits do not exist until placed. Mastery changes next round’s odds. The main campaign has 50 original orc warbands with bosses every tenth wave, plus an optional ten-wave skirmish. The Warbands guide (V) exposes all waves, movement classes and counters. docs/WAVE_REFERENCE.md records the reference mapping. Orc names, numerical balance and combat timings are original adaptations.

Enemy mechanics include veil detection, evasion, periodic disarm, three-hit refraction shields, physical/magical immunities, theft on leaking, non-stacking attack suppression, periodic rush, reactive armor, healing recharge, checkpoint-preserving blink, flat shell protection and war-drum haste. Pure damage bypasses damage-type immunity, armor and shell; refraction still absorbs direct pure hits. Damage over time bypasses direct-hit shields. Clerics reveal veiled enemies within six tiles. Flying variants include wyvern riders, giant bats, scrap balloons and dragon-mounted warlords. Variants are seeded once per wave.

Balance remains provisional. Seeded simulations exercise the real game loop, but do not replace human playtesting. Original low-poly art, browser-local profile saves and synthesized sounds are prototype assets; in-progress save/load is not implemented.
`);
