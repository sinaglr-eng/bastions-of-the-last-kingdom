# Current campaign combat rules — 0.3.26

The playable roster is produced by the explicit adapters in game/core/campaign-roster.js. Archived balance JSON, approved native/GLB models, portraits, recorded prompts and existing voices remain preserved. Stable family IDs and recipe ingredients remain unchanged. Current runtime overrides and this document supersede historical ability descriptions, including the former Pure damage and Ranger defense-bypass rules.

## Damage and defenses

Only **Physical**, **Magical** and **Holy** are live damage classes. Fire, frost, poison and lightning remain cosmetic/ability identities through projectileEffect and event.effect; they are not extra damage classes. Old piercing maps to Physical; elemental attacks map to Magical. Former Pure secondary attacks now use the approved primary class: Mage cleave is Magical; Frost Knight, Kingslayer and King cleave is Physical.

Armor reduces all three classes using damage × 30 / (30 + effective armor), with the balance armorConstant replacing 30 if configured. Effective armor is max(0, base armor + reactive armor − strongest fixed reduction), then multiplied by (1 − strongest nearby MVP armor reduction), then by (1 − penetration). Fixed armor reduction does not sum, can affect a damage-immune target on contact, lasts 4s and never creates negative armor. Evasion and shields prevent that contact. A strongest-only armor-reduction aura has its stated radius and affects either damage immunity.

Magical immunity blocks Magical damage, poison and burning. Physical immunity blocks Physical damage, movement slows and freeze. **Holy attacks and their companion effects ignore both damage immunities**, including Holy poison/fire/frost effects if supplied by an ability. Holy still respects armor, evasion, refreshing hit shields and direct-hit Shell. No magical resistance, typed resistance, magic ward or magic-resistance-reduction mechanic remains in the playable campaign.

The Holy roster is Cleric (all six ranks), Priest, High Priest, Archbishop, Paladin, Frozen Celestial, Angel, Archangel and Lady Claire. Frost Warden, Frostsword Watchmen and Master Ranger are Physical. Elven King is Magical. Master Ranger poison is Magical.

Direct-hit order is evasion, hit shield, damage bonuses and armor/immunity, then Shell. Physical, Magical and Holy direct hits all roll the authored evasion chance unless True Strike applies. A shield consumes one charge even if the matching damage type would subsequently be immune. Applied DOT, damage auras and non-direct secondary attacks do not consume hit shields, roll evasion or subtract Shell, but still respect armor and their damage immunity. Existing visibility, range and ground/air targeting restrictions remain.

## Defender changes

| Approved identity | Stable ID | Current ability change |
|---|---|---|
| Frostsword Watchmen | rimewatch | Physical; 20% slow for 3s |
| Frost Knight | frostblade | 25% slow for 3s; Physical secondary cleave |
| Kingslayer | highking | 15% chance of ×5 critical damage; 25% slow for 3s; Physical cleave |
| King | crownofages | 20% chance of ×5 critical damage; 30% slow for 3s; −64 armor for 4s; Physical cleave |
| Elven Ranger | thornwarden | Three simultaneous targets |
| Elven Elite Warrior | verdantguard | Five simultaneous targets |
| Thunderbird | starfall | 300 primary damage/hit; 165 per chained target; existing interval/chance/range |
| Elemental Male Dragon | thunderheart | Forked lightning deals 3,000 Magical damage, rather than 30,000 |
| Angel | archangel | Bouncing frost deals 250 Holy damage; nearby allied Magical or Holy landed hits trigger the existing reaction |
| Archangel | dawnspire | +80% standard allied attack speed |
| Ranger | wyvernhunter | Flying targets: −20 armor for 4s, 40% slow for 3s |
| Master Ranger | royalranger | Physical primary; Magical poison; flying targets: −30 armor for 4s, 40% slow for 3s |
| Dark Ranger | kingsrangerguard | Flying targets: −35 armor for 4s, 50% slow for 3s |
| Fire Ballista | fireballista | Adds 120 Magical burn damage/s for 3s; strongest burn, no burn stacking |
| Golem | emeraldgolem | Contact can proc Stone Gaze through damage immunity; facing-dependent petrification ignores both damage immunities. +100% Physical vulnerability remains; Physical-immune targets still block its Physical damage |
| Dwarf Griffin bomber | griffinbomber | Strongest-only −30 armor aura; existing 7-tile range; no magic-resistance aura |
| High Priest | monk | One +100% standard haste blessing; existing damage/control support |
| Archbishop | archbishop | Separate +500% haste, +100% damage and 100% control resistance within 5 tiles |
| Lady Claire | ladyclaire | Holy; 250 Holy damage per sequential chain; Melancholy removed |

Ranger and all three recipe descendants use ordinary armor, evasion, shields, Shell and damage immunity against flying targets. Their air-only debuffs do not reveal cloaked targets or affect grounded targets. Slow respects Physical immunity. On-contact armor reduction can still apply through immunity, while Master Ranger poison needs a primary hit that actually removes HP and a target that permits Magical effects. Ranger Oathbreaker retains its existing 75% air slow and 15% chance of ×20 Magical fire splash; it receives no defense bypass.

Standard haste blessings use the strongest value, regardless of rank. Archbishop's separate blessing adds once to that standard maximum; duplicate Archbishops do not sum. Thus High Priest +100% and Archbishop +500% produce ×7 attack speed. Ordinary damage auras use their strongest bonus (Archbishop +100% gives ×2), and range/control/True Strike retain their strongest/boolean rules. Support affects its own source when inside its own radius.

## Independent poison stacks and actual contribution

Every successful damaging hit adds **one independent 5-game-second poison stack**, including repeats by the same defender. A new stack never refreshes another stack. Each application stores its own DPS, source, remaining time and damage class; displayed poison DPS is the sum of active stacks. Ten Druid I hits create ten 6-DPS stacks, dealing 60 nominal Magical poison damage/s while all ten remain active. Armor still reduces the HP actually lost.

| Identity | ID | Base damage/hit | Interval | Base direct DPS | Poison DPS per stack |
|---|---|---:|---:|---:|---:|
| Nature Spirit | rangermentor | 150 | 0.5s | 300 | 96 |
| Mother Nature | mothernature | 9,492 | 0.5s | 18,984 | 1,898.4 |
| Druid VI | druid, rank6 | Preserved | Preserved | Preserved | 384 |

Nature Spirit's per-stack poison is 32% of direct base DPS. Mother Nature's per-stack poison is 20% of damage/hit, or 10% of direct base DPS. These prior numeric improvements remain; the newly approved stack rule changes accumulated poison throughput. Burn and bleed remain strongest-only statuses rather than independent poison stacks.

Ticks split at individual poison expiry boundaries. Every stack credits only its actual owner, including weaker stacks and Holy effects. The hit event reports effectiveDamage capped at remaining HP; immunity, absorbed damage and overkill do not inflate DPS or MVP contribution. Existing DOT persists after its source is paused; whole-game pause freezes application clocks and combat time.

## Enemy changes

| Mechanic | Current contract |
|---|---|
| Evasion | 25% chance against Physical, Magical and Holy direct hits; True Strike prevents it |
| Refraction | Existing authored charge count; refresh every 5s |
| Reactive armor | +8 armor per contact, 15 stacks maximum =120; decay remains 0.7 stacks/s |
| Shell | First shell wave39 blocks100/direct hit; +10 for each later wave index. Wave50 base210, stronger variant273 |
| Regeneration | 10% actual maximum HP/s; wave38 Blood-Leech Troll variant30% |
| Recharge | 50% missing HP every5s |
| Cloak | Former cyclic-cloak campaign variants now remain continuously cloaked until detection/proximity reveals them |
| Dread | −75% attack speed within4 tiles; existing control resistance reduces it |
| Blink | Advances6 route tiles every6s, retaining ordered route/checkpoints |
| Haste aura | +50% movement for3s every6s within3.5 tiles |

Healing block still prevents regeneration and recharge during its active window. Actual variant HP and wave/group modifiers determine regeneration HP/s. Every invader's seeded variant remains independent; previews list possibilities and do not promise variant counts. Ordinary movement, spawn scheduling, thief/leak effects and other unchanged mechanics are preserved.

## MVP levels and attack pause

A completed wave awards one level to the eligible active defender with the greatest **actual HP removed during that wave**, including primary attacks, poison/burn/bleed, offensive auras and owned secondary procs. Ties prefer more existing MVP levels, then the earlier built identity. Level10 is the cap; capped defenders are excluded from award eligibility. Zero total damage awards nobody. Award occurs once before wave-complete, and the ledger resets at the next combat start.

Each level gives +10% own damage, up to +100%. It also supplies a strongest-only armor reduction of1% per level within2 tiles; fixed reduction applies first. A level10 source gives **other** active allies within2 tiles +75% damage, strongest-only and excluding itself. Own and foreign MVP percentages add, then the strongest ordinary damage aura multiplies the result:

    damage multiplier = (1 + 0.1 × own MVP level + foreign max-level bonus) × (1 + strongest normal damage aura)

This scales all absolute channels, including primary damage, poison/burn DPS, damage auras, chains, forked lightning and bouncing frost. Percentage cleave/bleed/fire procs scale from the resulting primary damage. Merge and recipe evolution inherit the maximum ingredient MVP level, never the sum. The selected tower ID/location remains the result foundation.

Per-defender attack pause stops new projectiles and offensive burn/slow/armor-reduction auras. Already launched projectiles, already applied DOT and already triggered timed effects continue. Ordinary support, detection and MVP auras remain. Whole-game pause still freezes combat itself. Pause and MVP bookkeeping consume no CP or random decisions. Developer overrides use the real same APIs, not a second combat engine.

## Inspection, readiness and events

Army Readiness is a deterministic composition comparison, not a predicted outcome. It includes own MVP damage and guaranteed self support, actual canonical damage classes, defenses, independent poison stacks and pause status. It explicitly excludes placement-dependent allied aura overlap, MVP armor-aura coverage, range coverage and maze length. Poison contribution integrates a nominal hit stream over the displayed five-second comparison window rather than assuming all future stacks already exist. Worst applicable possible variants bound the response; caches invalidate for level/pause changes while Move does not invent guaranteed coverage.

Recipe filters expose the same three classes. They do not label Magical or Holy as armor/evasion bypasses. On-hit DOT requires its initial damaging hit; independent cleave requires other victims; reaction/air/support/proc conditions are stated. Guides and live/queued enemy descriptions omit magical resistance and preserve hidden-location privacy.

Combat emits critical-hit only for a successful existing crit roll whose multiplied primary or cleave hit actually removes HP. It follows hit and precedes death. Chains, ordinary secondary procs and DOT do not inherit a critical announcement. The payload is {enemy,source,type,effect,amount,effectiveDamage,multiplier,directHit,visible}. Presentation requires visible and effectiveDamage>0.

Damage-trace reports an attempted damage resolution, including blockReason, requestedDamage, beforeDefense, effectiveArmor, armorMultiplier, afterArmor, shellBlock, afterShell, appliedDamage and effectiveDamage. These read-only events add no RNG. The explicitly broadened evasion mechanic uses one normal evasion roll for each applicable direct hit. Chain events identify their actual source, lightning/frost effect and visibility; burn-proc fires only when the actual fire proc deals positive damage. DOT/passive damage remain silent in the attack sound routing.

Developer rule overrides are numeric whitelist fields inside that Game's cloned balance.enemyRules. Global ENEMY_RULES remains frozen; periods must remain positive while zero counts, duration, decay and radii can disable a Sandbox feature. Core, preview and inspection share the same per-Game rule snapshot where applicable. Root-owned Developer mode permanently excludes the run from statistics.

Game.discoveries contains available discovery history; Game.earnedDiscoveries starts empty for each run and records only successful advanced recipe results, before the discover event. Already-known recipes and recipes using inherited champions still earn the result for their own run. Loaded history, arriving champions, previews, rejected crafts and MVP levels do not populate this ledger. Repeated crafts of one family remain one per-run discovery; separate legitimate runs each have their own award for persistence reconciliation.

## Evidence

Current meaningful regressions include tests/combat-overhaul.test.mjs, tests/mvp.test.mjs, tests/poison-source-expiry.test.mjs, tests/ranger-air-defenses.test.mjs, tests/army-readiness.test.mjs and tests/recipe-filters.test.mjs. They exercise actual Game impacts/DOT, overkill, blocked hits, all86 current defender profiles, all40 valid basic merges, all38 champion crafts, poison expiry boundaries, coarse/fine ticks, pause, actual ownership and run-local rule isolation. Updated intelligence/card/critical/DPS regressions retain their actual state, privacy and resource checks with the new combat contract.
