# Secret champions — 0.2.8

Lady Claire (`ladyclaire`) and Lord Bernhard (`lordbernhard`) are fixed rank-I champions in the **Secret** category. Their classification aura is gold, level 4. They do not replace any of the 37 ordinary champions or change their stats, recipes or inventory rules.

## Crafting contract

| Champion | Exactly three ingredients |
| --- | --- |
| Lady Claire | Mage V + Druid V + Frost Warden V |
| Lord Bernhard | Soldier V + Soldier IV + Soldier III |

These are the user's Bastions recipes, rather than direct copies of the gem recipes. All three ingredients must belong to the same current round's five newly placed defenders. The game checks the actual five placed draw IDs, matching round numbers, unique physical units and `select` phase. Previously retained units, stale drafts, incomplete placement and a selected noningredient cannot supply a secret recipe or its result tile.

Select one of the three ingredients to anchor the result. Crafting transforms that defender into the champion, consumes the other two ingredients and closes the selection. The two remaining candidates become walls; the consumed ingredient foundations also remain walls, as in ordinary crafting. All five occupied cells remain occupied. Ingredient kills transfer to the result, gold stays unchanged, and the normal `combine` and `discover` events record it. Crafting cannot happen again after that selection closes.

## Source precedence and units

The requested [Gem TD wiki Towers table](https://dota2.fandom.com/wiki/Gem_TD#Towers) takes precedence over the [older author's tower extract](https://clementbera.github.io/Website/advancedTowers.html). Direct wiki access is blocked by the site's robots/access policy in this environment; its indexed Towers table supplied the current rows. The older page is readable and exposes ability parameters from a different version. Its conflicting values are not silently substituted for current wiki values.

Range conversion is **100 source units = one Bastions tile**. The requested damage values are retained without a multiplier. Some existing champions use an earlier threefold damage scaling; their approved values remain untouched. In particular, Nature Spirit and Lord Bernhard share Diamond Cullinan as a reference but retain distinct recipes and stat records. The displayed wiki damage already includes its listed damage bonus; another 640 is not added.

## Lady Claire / Fantastic Miss Shrimp

| Parameter | Implemented value | Evidence |
| --- | --- | --- |
| Main damage / range | 1225 / 10 tiles | Current wiki: 1225 / 1000 |
| Attack interval | 0.5 seconds | Older extract; current wiki leaves interval blank |
| Chain / fork probability | 20% / 50% | Current wiki; older 30% / 25% chances are overridden |
| Chain damage / count / jump reach | 150 / five other enemies / 10 tiles | Older parameters: Damage 150, Count 5, Radius 1000 |
| Fork damage / targets / reach | 2500 / five / 50 tiles | Older parameters: damage 2500, targets 5, end_distance 5000 |
| Melancholy | 3% at attack start, five seconds | Older attack-start disarm parameters; current wiki only names the effect |

The current wiki's 10000 fork damage belongs to **Antique Bloodstone**, not Fantastic Miss Shrimp. It is not copied into Lady Claire. The 50-tile fork reach is intentional and documented; it is not silently clamped to the champion's 10-tile acquisition range.

Bastions implements a chain as five additional, distinct hops to the nearest eligible enemy within ten tiles of the previous victim. A target is not repeated. Chain and fork roll independently after a successful primary hit, and respect visibility and magical immunity.

The older fork parameters describe a widening cone (start radius 100, end radius 3000). Bastions reuses its existing radial fork mechanic: up to five nearest visible enemies within fifty tiles of the impact target, including that target if it survives. This is an explicit shape adaptation, not a reproduction of the original cone script. Arcane primary damage follows the game's caster damage convention.

Melancholy cancels the attempted attack and prevents new attacks for five **combat seconds**. Already launched projectiles continue. Its deadline does not depend on ally haste; pausing the game pauses that clock, and 3× speed advances it three times faster in wall time. The next attack may begin when the deadline expires. Allied control resistance protects against enemy control, not this champion's own Melancholy. A new wave clears the temporary state. The `melancholy` event carries its source and duration; `melancholyUntil` and `melancholy` expose the live status.

## Lord Bernhard / Diamond Cullinan

| Parameter | Implemented value | Evidence |
| --- | --- | --- |
| Main damage / interval / range | 3164 / 0.5 seconds / 13 tiles | Current wiki: 3164 / 0.50 seconds / 1300 |
| Poison | 16 damage per second for five seconds | Current wiki |
| Allied range bonus | +3 tiles | Current wiki: +300 source units |
| True strike | Nearby allies ignore evasion | Current wiki's Monkey King Bar |
| Support radius | Three tiles for both bonuses | Existing Bastions support convention; older radius parameters are 290 for range and 300 for true strike |

**Poison 5 is the ability grade, not a target count.** Neither source lists Split or multiple attacks for Diamond Cullinan. Lord Bernhard therefore fires at one target per attack and spreads poison to unmarked targets using the game's existing poison targeting behavior. Poison refreshes with the strongest active poison instead of stacking.

The older Diamond Cullinan damage, interval, range and critical-strike ability conflict with the requested current wiki row. Its critical strike is not added. The primary damage uses Bastions' poison damage convention; it is not an additional undocumented physical attack. The three-tile aura includes the provider and the boundary, grants the strongest range bonus, and uses the existing true-strike support path. A consumed provider supplies no support.

## Verification

`tests/secret-towers.test.mjs` exercises actual placement, all three result anchors for both recipes, atomic rejection of invalid rounds and selections, wall/kill/discovery outcomes, UI recruitment eligibility, independent proc thresholds, chain hops and fork target limits, exact Melancholy deadlines and five-second poison damage. It also verifies Bernhard's single-target behavior, aura boundary, extended acquisition and physical allies ignoring evasion. Existing recipe tests continue to craft all 37 ordinary champions from every valid ingredient anchor. `tools/author-roster.mjs` validates 39 champion records, 39 three-ingredient recipes and secret-only current-round restrictions.
