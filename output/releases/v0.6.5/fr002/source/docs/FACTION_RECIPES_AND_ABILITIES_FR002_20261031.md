# FR 002 Faction recipes and shared ability levels

Requirement ID: **FR-002**. Date: **31 October 2026**. Status: **PROPOSED — NOT APPROVED — NOT IMPLEMENTED**.

Make early Dwarf and Elf champions easier to obtain, give final Advanced specialists a modest acquisition premium and stronger combat values, and replace duplicate faction ability levels with a common, ordered catalogue. This proposal includes all 28 browser comments supplied with the request. Approval and implementation of FR-001 do not approve FR-002.

The implementation baseline is the current **0.6.4** game and its implemented FR-001 combat data. The local gallery's `fr001-current` snapshot identifies itself as 0.6.3; the 0.6.4 release changes presentation and preserves those combat parameters. Use current runtime data, rather than replaying the historical FR-001 patches. Exact inspected source hashes are retained in the [planning baseline](../output/design/fr002-proposal-20261031/protected-baseline.json).

## Scope for approval

Approval would cover the specific recipe, parameter, assignment and trigger changes in this requirement and its linked tables. Implementation belongs in a separately authorized game update. Preparing this proposal changes neither the game nor the maintained gallery.

- Change Dwarf and Elf ordinary recipes while retaining their existing defenders, classes, dependency branches and exact three-ingredient format.
- Standardize ability levels across Human, Dwarves and Elves. Merge equal effects, promote near-equal effects to the stronger value and order the resulting levels by an explicit measure of potency.
- Preserve Human recipes and primary damage, attack intervals and attack range. The separately listed Human ability changes needed for the shared standard are proposed exceptions to the earlier Human baseline restriction; they require FR-002 approval.
- Preserve Lady Claire's combat profile, three faction-local rank-V recipes, current-draft eligibility and rarity. Her shared ability references may receive catalogue labels without changing her values.
- Preserve draft probabilities, rank merging, economy, enemies, waves, scoring, models, artwork approvals and voice casting. Existing campaign results retain their original version and faction.

## Recipe progression

Basic and Intermediate recipes should become easier through lower exact recruit ranks, without introducing extra ingredient slots, alternative recipe sets, additional unlock gates or new champions. A recruit at every exact rank I–VI must still have 1–3 ordinary destinations and no more than three total destinations including Claire. A nonterminal champion must have 1–3 onward recipes. Final Advanced specialists remain intentional endpoints.

Apply the two explicit corrections: **Dwarf Dualist uses Shieldguard II instead of IV**, and **Dwarf Berserker uses Runesmith III instead of IV**. Remaining recipe changes must preserve useful destinations for the displaced higher ranks.

For a continuing Advanced champion and its final Advanced alternative, compare the full recursively expanded ingredients. Use the final specialist's modest additional acquisition burden to fund a combat premium. The proposal uses rank weights I = 1, II = 2, III = 4, IV = 8, V = 16 and VI = 32. Add every consumed ingredient, including repeated underlying ingredients of crafted champions. This weight measures ingredient commitment; it does not predict the probability or wave of obtaining a recipe.

The concrete set changes **43 recipes: 23 Dwarf and 20 Elf**. Of the 32 Basic/Intermediate recipes, 28 become lighter and four already inexpensive Basic recipes remain exact; all 16 Intermediate recipes become lighter. The ten final Advanced specialists require **11.11–13.79%** more flattened material than their paired continuing Advanced. Their full-tree cost can still be lower than today because their earlier ingredients are easier.

Direct TOP ingredients remain exact, but cheaper parent champions also lower their full-tree commitment. Evaluate this indirect acquisition change together with the new combat values rather than treating TOP availability as unchanged.

Nine final specialists receive **+15% listed direct damage**. Forge Dwarf instead receives **2,070 Flame Cone DPS**, which already includes its 15% premium over the proposed 1,800-DPS continuing Advanced cone. Apply this premium once. A support specialist's advantage may include its stronger utility; it need not outdamage a dedicated attacker in every scenario.

The complete before/after recipe tables, exact rank coverage and final specialist parameters are in the [recipe proposal](../output/design/fr002-proposal-20261031/recipes/proposal-recipes.md). The isolated structural check passes all 96 Dwarf/Elf recruit rank profiles; battle and actual draft-acquisition testing remain future acceptance gates.

## Common ability levels

A Roman level must represent effect strength rather than the faction or engine that authored it. Equal numeric effects use the same level. Where effects differ only slightly, use the greater damage or stronger effect; never average them downward. Do not merge different trigger rules, damage types, targeting scopes or stacking behavior merely because a short description displays the same number.

Use one common potency ladder per ability family. Retain necessary differences such as radius, duration, damage type and trigger mode as explicit variants attached to that level. An allied aura is a separate family from a personal effect. Stable old links must redirect to the exact new family, level and variant.

| Effect type | Main ordering measure | Additional displayed parameters |
| --- | --- | --- |
| Continuous damage and damage over time | Damage per second per affected target | Duration, area, damage type and stacking |
| Damage pulses and lightning packets | Damage per pulse or packet per target | Chance, interval, targets, area and maximum total damage |
| Cleave and splash | Percentage of attack damage | Radius, targets and damage type |
| Critical Strike | Expected added direct damage at the stated chance and multiplier | Chance and multiplier |
| Armor Reduction | Armor removed | Duration; aura radius where applicable |
| Slow | Movement reduction percentage | Duration; aura radius where applicable |
| Support auras | Attack speed, damage or range bonus | Radius and stacking group |
| Multishot | Number of distinct targets | Target eligibility |
| Sky Hunt | Damage bonus against flying enemies | Eligible attack types |
| True Strike | Evasion ignored | Personal or allied aura scope |
| Visibility | One common level | Detection radius remains an explicit parameter |

The [ability standardization tables](../output/design/fr002-proposal-20261031/abilities/proposal-abilities.md) define the exact groups, values, assignments and exceptions. A higher level may not show lower damage according to its family's stated measure. Equal damage with different area or duration remains visibly differentiated rather than implying that all combat outcomes are identical.

### Required family changes

Consolidate **Armor Reduction, Armor Reduction Aura, Attack Speed Aura, Burn, Critical Strike, Damage Aura, Lightning, Magical Cleave, Multishot, Sky Hunt, Slow and Slow Aura** across factions. In particular, merge the equal effects currently presented as Armor Reduction I/XIII and Armor Reduction Aura I/IV. Use common Dwarf and Elf Sky Hunt values and common all-faction Slow and Slow Aura values.

Sort **Fire Aura** by damage per second. Increase **Flame Cone** to a comparable combat classification while recognizing that its forward cone and ground targeting are more restrictive than a surrounding aura. Increase every **Heat** damage level. Retain their distinct targeting and damage rules.

Merge **Spark VII/VIII** into the stronger configuration: 4,000 damage every 5 seconds. Merge **Stun I/II** into one 20% chance for 2 seconds. Unify every Visibility label as **Visibility I** with the strongest existing **6-tile radius**. This includes an explicit range increase on shorter detection variants.

Replace **Magical Critical Strike** with **Critical Strike**, using the same chance and multiplier rules for an attack's own damage type. Split **True Strike** into personal **True Strike** and allied **True Strike Aura**. These family changes require updated assignments and legacy links.

### Human ability exceptions

These six ability-only changes are proposed because the new cross-faction rule selects the stronger shared value. They are a limited exception to the previous Human protection, not a general Human rebalance. Shared Lady Claire receives no numeric change.

| Human defender | Ability | Current to proposed |
| --- | --- | --- |
| Frost Warden III | Slow | 24% to 25% |
| Cinder Adept | Fire Aura | 240 to 250 DPS |
| Ballista | Armor Reduction | 30 to 32 armor |
| Master Ranger | Armor Reduction against flying enemies | 30 to 32 armor |
| Fire Ballista | Burn | 120 to 140 DPS |
| Paladin Oathbreaker | Slow Aura | 70% to 75% |

## Simpler abilities and additional faction coverage

Use short English descriptions in player and gallery views. Keep technical trigger, immunity, stacking and recursion rules in expandable details. The [mechanics proposal](../output/design/fr002-proposal-20261031/mechanics/proposal-mechanics.md) specifies exact recipients and values.

- Add **Keep Recovery** to a suitable Elf champion and a suitable Dwarf champion, using the Human recovery rule as the reference.
- Give the Dwarf axe champion branch **Physical Cleave** with progressive values.
- Give an Elf support champion **Range Aura**, including its continuation where appropriate.
- Replace Moon Strike's attack-count condition with a simple chance to deal a Holy bonus hit, retaining comparable average contribution.
- Let Ricochet trigger from any eligible damaging hit by its owner, including secondary damage. Preserve a finite chain and prevent a Ricochet bounce from recursively triggering another Ricochet. The illustrative 20% wording applies to the first level; higher existing chances remain explicit in their level descriptions.
- Describe Splash simply as damage to enemies near the hit target. Put exact damage, radius and eligibility in its parameters.

| Added ability | Proposed owners | Main values |
| --- | --- | --- |
| Keep Recovery I | War Drummer; Crescent Revenant | 1% chance to restore 1 keep health, capped at starting health |
| Physical Cleave I–IV | Dwarf Axeman; Dwarf Dualist; Dwarf Berserker; Berserker Champion | 35%, 50%, 65%, 80% damage; radii 1.5, 2, 2.25, 2.75 tiles |
| Range Aura I–II | Moon Banshee; Eclipse Phantom | +1 and +3 attack range within 5 tiles |

## Future game and gallery update

After approval, implement against the current faction runtime and current Human campaign adapter. Catalogue changes alone cannot implement combat changes. Update derived DPS projections, ability text, recipe explanations and exact-rank successor lists from the final game data.

Update the existing local gallery in `sites/defender-faction-atlas-20261021/`, including Roster details, recipe cards, Abilities, faction coverage, missing-ability filters and CSV/JSON exports. Keep gallery copy English. Preserve all existing routes, exact original images, review decisions, art identities, model bindings and historical source evidence. Do not create or publish another gallery. Shared Claire remains excluded from ordinary faction coverage by default.

Map old ability family/level deep links to the new precise variant. Do not change appearance-review identities when only combat data or ability names change. Retired ability names must not remain assigned to live profiles, while historical descriptions remain clearly marked as historical evidence.

## Acceptance requirements

1. **Recipe integrity:** each faction retains 8 basic families, 37 ordinary champions and Claire, with 38 fixed recipes. Every recipe consumes three distinct actual defenders of valid faction-local identities and exact ranks. Graphs remain finite and acyclic. Human recipes and all Claire recipes remain exact.
2. **Coverage:** every ordinary basic rank I–VI has 1–3 ordinary destinations and at most three including Claire; every nonterminal champion has 1–3 destinations. Intentional TOP, Secret and final Advanced endpoints are excluded from the onward-recipe requirement.
3. **Acquisition:** all changed Basic/Intermediate recipes meet the stated easier-rank goals. Paired final Advanced recipes have the specified modest additional flattened commitment, without relying on TOP ingredients. Use seeded legal drafts and actual merge/craft actions to measure acquisition timing, including reserve and repeated family/rank requirements. Do not present rank-weight reductions as measured acquisition probabilities.
4. **Final Advanced combat:** verify every proposed stat delta and its combined ability changes. Compare each specialist with the continuing Advanced option using equal ingredient commitment and the same target scenarios. A terminal specialist must remain useful without making TOP progression redundant.
5. **Ability catalogue:** no duplicate normalized configuration receives two Roman levels. Levels are contiguous, damage is nondecreasing by the declared measure, exact old-to-new mappings are complete, and necessary radius/type/trigger differences remain inspectable. Every live assignment resolves to a family, level and variant.
6. **Shared effects:** verify stronger-value merges, aura stacking, damage-over-time refresh, boss control reductions, immunity, evasion and flying/ground eligibility. Unchanged Human and Claire fields stay exact except for the individually listed shared ability changes proposed for Human.
7. **Trigger behavior:** verify one recovery roll per eligible attack release, recovery health cap, one ordinary critical roll, Moon Strike chance, finite any-hit Ricochet, and frame-rate-independent continuous damage handling. Test zero-damage, evaded and immune hits, lethal hits, secondary hits and distinct bounce targets.
8. **Balance:** repeat controlled single-target, clustered, dispersed, flying, high-armor, immune and boss cases with and without support. Run legal full campaigns across all factions using the same seed cohorts and fixed policies. Assess easier acquisition together with stronger abilities; old FR-001 results do not validate FR-002. Flag Flame Cone, Heat, critical and broad Ricochet increases for particular review before release.
9. **Gallery:** verify all faction/rank recipes, successor lists, stats, ability links, coverage counts and exports against the implemented source; verify old links, artwork approvals and review persistence. Test desktop and narrow layouts. Keep gallery requests on loopback and model binaries local.
10. **Release records:** version new game results and content rules independently of historical runs. Report actual checks and remaining balance limitations before release. Approval of this proposal is not a claim that a complete campaign is already balanced.

## Browser comment coverage

| Comment | Required change | Proposal section |
| --- | --- | --- |
| 1 | Shieldguard IV to II in Dwarf Dualist | Recipe progression |
| 2 | Runesmith IV to III in Dwarf Berserker | Recipe progression |
| 3 | Armor Reduction duplicates | Common ability levels |
| 4 | Armor Reduction Aura duplicates | Common ability levels |
| 5 | Attack Speed Aura levels | Common ability levels |
| 6 | Burn levels | Common ability levels |
| 7 | Critical Strike levels | Common ability levels |
| 8 | Damage Aura levels | Common ability levels |
| 9 | Fire Aura damage ordering | Required family changes |
| 10 | Stronger comparable Flame Cone | Required family changes |
| 11 | Stronger Heat at every level | Required family changes |
| 12 | Elf and Dwarf Keep Recovery | Additional faction coverage |
| 13 | Lightning levels | Common ability levels |
| 14 | Magical Cleave levels | Common ability levels |
| 15 | Magical Critical Strike to Critical Strike | Required family changes |
| 16 | Simpler Moon Strike trigger | Simpler abilities |
| 17 | Multishot levels | Common ability levels |
| 18 | Dwarf axe Physical Cleave | Additional faction coverage |
| 19 | Elf Range Aura | Additional faction coverage |
| 20 | Simple any-hit Ricochet | Simpler abilities |
| 21 | Common Dwarf and Elf Sky Hunt | Common ability levels |
| 22 | All-faction Slow levels | Common ability levels |
| 23 | All-faction Slow Aura levels | Common ability levels |
| 24 | Merge Spark VII and VIII | Required family changes |
| 25 | Simple Splash description | Simpler abilities |
| 26 | Merge Stun I and II | Required family changes |
| 27 | Separate True Strike Aura | Required family changes |
| 28 | Visibility I for every source | Required family changes |

## Approval and handoff

Review the recipe tables, common level ladders, exact assignments and the explicitly listed Human ability exceptions together. Keep this status **PROPOSED — NOT APPROVED** until the user approves the set or a clearly identified subset. Record any subsequent decision separately; do not overwrite the FR-001 approval or claim that these changes are already active.

The implementation chat can refer to **FR-002** and this file. The [handoff directory](../output/design/fr002-proposal-20261031/README.md) identifies authoritative tables, overlapping descriptions and verification results. The machine-readable proposal files are planning inputs and must not overwrite current source data wholesale. Apply reviewed deltas against the implementation checkout, reconcile other chats' changes, then run the acceptance checks above.
