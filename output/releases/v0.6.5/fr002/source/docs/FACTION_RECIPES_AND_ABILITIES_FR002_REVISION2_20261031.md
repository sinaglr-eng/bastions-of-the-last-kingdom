# FR 002 revision 2 recipes and ability review

Requirement: **FR-002, revision 2**. Date: **31 October 2026**. Status: **PROPOSED — PENDING FINAL APPROVAL — NOT IMPLEMENTED IN THE GAME**.

This is the current FR-002 proposal for approval. It incorporates the 32 follow-up gallery comments and the user's clarification that **Moonshadow Huntress** receives Execution. It supersedes conflicting ability values, assignments, trigger restrictions and catalogue presentation rules from revision 1. The [original proposal](FACTION_RECIPES_AND_ABILITIES_FR002_20261031.md) remains historical evidence.

The 43 proposed Dwarf and Elf recipe changes and ten terminal Advanced stat changes remain exact. Current game 0.6.4 and implemented FR-001 remain the comparison baseline. Updating the gallery authorizes a preview; it does not approve or implement the proposed game rules.

## Retained recipe and combat changes

Use the [frozen revision 1 recipe set](../output/design/fr002-proposal-20261031/recipes/candidate-recipes.json), [recipe comparisons](../output/design/fr002-proposal-20261031/recipes/proposal-recipes.md) and [terminal specialist parameters](../output/design/fr002-proposal-20261031/recipes/terminal-stat-proposal.json). No recipe, champion class or dependency edge changes in revision 2.

All 16 Intermediate recipes stay lighter; 28 of 32 Basic/Intermediate recipes are lighter and four inexpensive Basic recipes stay exact. Final Advanced alternatives retain an 11.11–13.79% full-tree material premium relative to their paired continuing Advanced. Nine final specialists retain +15% listed direct damage. Forge Dwarf retains the combined 2,070-DPS cone value, including its terminal premium once.

Human primary damage, attack intervals and base attack range remain exact. Human recipes, all Lady Claire recipes and eligibility, Claire's combat values, draft probabilities, economy, enemies, waves, artwork, models and casting remain unchanged. Proposed Human ability changes are individually enumerated in the [revised ability appendix](../output/design/fr002-revision2-20261031/proposal-abilities.md); there are **13 ability-assignment exceptions**, including retained revision 1 changes. They are not a general Human primary-stat rebalance.

## Revised levels and assignments

| Ability | Revised rule |
| --- | --- |
| Armor Reduction | The former 35-armor flying-only effect becomes 40 armor for 4 seconds and is named **Armor Reduction VIII - Anti-Air**. Every other flying-only variant also uses the Anti-Air suffix at its own potency level. |
| Attack Speed Aura | Merge the 10% and 20% forms into +20%, radius 5. War Drummer and Forge Sentinel receive **Attack Speed Aura VII**, +70% within 5 tiles. |
| Berserker | Attack-speed bonuses I–IV become **35%, 50%, 70%, 100%**. The selected +60%-damage form has +100% speed. Keep damage, duration, cooldown, range penalty and control protection exact. |
| Burn | Exactly six levels: **4, 8, 32, 64, 240, 600 Magical damage/s**, each lasting 3 seconds. Map all owners upward using the table below. |
| Cancel Magic Immunity | Every former level I owner receives the complete former level II configuration: 2 targets, 5-second cooldown, 4-second window, 50% damage multiplier. The surviving strengths become levels I and II. |
| Cancel Physical Immunity | Use the same promotion and renumbering as Cancel Magic Immunity, preserving Physical scope. |
| Execution | Add **Execution I to Moonshadow Huntress**, retaining her final Advanced class and recipe. Every 15 seconds, execute one normal enemy or deal ×10 direct damage to one boss. |
| Fire Aura IV | Every 1,200-DPS owner adopts Stormfire Sorcerer's **5.5-tile radius**. Keep Magical damage and strongest-only overlap. |
| Flame Cone II | All 1,500-DPS owners adopt Fire Dragon's **60° cone and 4.5-tile reach**. |
| Flame Cone III | All 1,800-DPS owners adopt Mother Fire Dragon's **75° cone and 5.25-tile reach**. |
| Flame Cone V | All 9,000-DPS owners adopt Ancient Dragon Patriarch's **90° cone and 6-tile reach**. |
| Lightning | Exactly six damage levels: **24, 96, 250, 1,200, 2,500, 7,500 per target**. Promote packets to the next anchor. Preserve explicit trigger mode, chance, target count, damage type and link geometry. Claire's 250/2,500 packets stay exact. |
| Magical Cleave | Merge every same-potency pair into its stronger existing configuration. Use the wider Human radius and inherited critical behavior where that configuration exists. Each potency has one assigned configuration. |
| Slow | Merge same-potency variants into the stronger configuration. At 50%, use the existing 3-tile area and all-eligible scope. At 75%, use the existing 3-second duration and all-eligible scope. |
| Slow Aura | At 75%, use the existing 5-tile radius affecting ground and flying enemies. Every potency has one configuration. |
| Critical Strike | Keep Shadow Assassin Apprentice, Adept, Expert and Master assigned to ordinary Critical Strike. Show all four in its owner lists. Do not add duplicate abilities. |

Flame Cone consolidation includes its profile's base `range` and continuous attack's range as well as the assigned ability. Keep each defender's actual Physical or Magical channel. Forge Dwarf's separate 2,070-DPS level IV keeps its 4-tile base cone reach; its Range Aura remains separate. Fire Aura radius is independent of primary attack range.

Moonshadow Huntress's five-target Multishot must not multiply Execution: one eligible main target receives the execution effect per 15-second activation. Other arrows retain their ordinary damage. The exact `targets: 1` rule must be enforced in the later game implementation.

### Six Burn levels

| Previous FR-002 DPS | Revised level | Revised DPS |
| --- | --- | --- |
| 2 or 4 | I | 4 |
| 6 or 8 | II | 8 |
| 18 or 32 | III | 32 |
| 50 or 64 | IV | 64 |
| 140 or 240 | V | 240 |
| 300 or 600 | VI | 600 |

For Lightning, 10/24 become 24; 60/96 become 96; 165/200/250 become 250; 400/1,200 become 1,200; 2,500 stays 2,500; 3,000/3,600/7,500 become 7,500. These upward groupings are proposed numerical buffs, not only label changes. Full owner/rank mappings are in the [assignment review](../output/design/fr002-revision2-20261031/assignment-review.csv).

### Preserve the requested level names

The user explicitly requested 40 armor at level VIII and +70% Attack Speed Aura at level VII. Preserve those identities rather than silently shifting their meaning after a merge. Armor Reduction's empty former VII is retired; Attack Speed Aura's merged former II is retired. Do not display empty rows or invent abilities to fill a gap. Show the number of active levels separately from the highest retained Roman label. All other revised families, including Burn and Lightning I–VI, remain contiguous.

This is a limited revision 2 exception to revision 1's contiguous-level rule. Old levels redirect to the exact current configuration or show the relevant alternatives when owners diverge.

## Ricochet in plain language

Each level keeps its existing chance, maximum bounce count and damage retained per bounce:

| Level | Chance | Additional enemies | Damage retained per bounce |
| --- | --- | --- | --- |
| I | 20% | 1 | 50% |
| II | 30% | 2 | 60% |
| III | 40% | 3 | 70% |
| IV | 50% | 4 | 80% |

Suggested level I copy: **“Hits have a 20% chance to bounce to one additional enemy for 50% damage. Bounces can critically strike and apply on-hit effects.”** Use corresponding values for the other levels. Do not repeat the chance, bounce count, trigger or damage basis in extra parameter bullets.

Bounces may use ordinary critical hits and ordinary on-hit statuses and procs. There is **no bounce-distance limit and no substitute owner attack-range limit**. Keep legal visibility, flying/ground restrictions and finite distinct victims. The target is the nearest eligible visible enemy anywhere on the battlefield, with stable identity breaking ties.

Implementation details belong in the technical data and acceptance tests. Each bounce has one fresh ordinary critical roll using the owner's critical ability and pre-critical bounce damage. An effect generated by a proc cannot retrigger an ancestor ability in the same originating-hit lineage; this prevents Ricochet/Lightning cycles. Attack-release and timed abilities retain their own triggers, so a bounce does not create extra Execution, Moon Strike, Cleave or Splash releases. Keep the existing frame-independent logical pulse contract for continuous damage without exposing its internal fields in normal gallery copy.

These changes supersede revision 1's restrictions that bounces cannot critically strike, cannot apply on-hit effects and must remain within 3 tiles. Restrictions that were only marked “unnecessary to mention” are removed from normal copy, not silently changed into permission for infinite chains.

## Clear catalogue presentation

Show each short effect description once. Keep the main rule text concise and display only useful numbers, units and conditions. Do not append the full technical parameter object as repetitive bullet points. Preserve technical parameters in downloaded source data and this handoff for implementation.

Every assigned defender must be immediately visible in each ability row. Remove “Show N more defenders” and its collapsed owner list. Preserve portrait, name, faction, exact rank and detail links for every owner, including all four former Magical Critical Strike Shadow Assassins. The coverage matrix, filters, baseline comparison and review persistence remain available.

The one English local gallery remains at `http://127.0.0.1:59544/`. Preview data, exports and the persistent dataset bar must identify **FR-002 revision 2, pending approval**. The implemented FR-001 comparison stays exact. Preserve original artwork, approval identities, notes, voices, models, old URLs and historical revision 1 evidence.

## Acceptance checks

1. Verify all 43 recipe changes and ten terminal stat values against the frozen revision 1 set, with all 144 basic rank profiles across three factions retaining the required 1–3 ordinary destinations.
2. Verify exact six-level Burn and Lightning ladders, all owner assignments, the requested VIII/VII labels, retired-number metadata and absence of empty rows. Check that no selected stronger configuration loses a parameter in a same-level merge.
3. Verify the former immunity-cancellation level I owners all receive the complete stronger configuration. Verify every 1,200-DPS Fire Aura and repeated cone potency uses the chosen configuration, including all continuous/profile range mirrors.
4. Verify Moonshadow Huntress has exactly one Execution I and remains final Advanced. Verify four Shadow Assassins each have one ordinary Critical Strike and every assigned defender is shown without a collapsed list.
5. Verify Ricochet source data permits criticals and ordinary on-hit effects, has no distance or owner-range cap, retains finite bounce limits, and prevents cyclic proc lineages. Test positive, zero, lethal, secondary and continuous hits and all allowed damage channels in a future game implementation.
6. Verify simple unique copy, all new and legacy ability links, every exact-rank recipe, all faction coverage counts, exports, dataset switching, desktop/mobile layout and preserved reviews/voices. Keep all requests local and model binaries on the PC.
7. Preserve Human primary parameters and recipes, Claire combat and recipes, game files and frozen revision 1 evidence. List all 13 proposed Human ability-assignment exceptions for approval.
8. Test actual legal acquisition and battle balance together before any later game release. Burn/Lightning compression, wider Cleave/Slow/cones, stronger auras, Ricochet critical/on-hit effects and Huntress Execution are gameplay buffs. Structural/gallery checks do not establish campaign parity.

## Follow-up comment coverage

| Comment | Revision 2 action |
| --- | --- |
| 1 | 35 to 40 armor; exact VIII Anti-Air label and suffix on other flying-only variants |
| 2 | +10% Attack Speed Aura to +20%, merged |
| 3 | War Drummer to Attack Speed Aura VII, +70% |
| 4 | Forge Sentinel to Attack Speed Aura VII, +70% |
| 5 | Berserker top speed +100%; lower levels 35/50/70% |
| 6 | Burn exactly six levels and reassigned owners |
| 7 | Remove weak Cancel Magic Immunity configuration and promote owners |
| 8 | Remove weak Cancel Physical Immunity configuration and promote owners |
| 9 | Add Execution I to the clarified Moonshadow Huntress |
| 10 | 1,200-DPS Fire Aura to Stormfire Sorcerer configuration |
| 11 | Flame Cone II to Fire Dragon configuration |
| 12 | Flame Cone III to Mother Fire Dragon configuration |
| 13 | Flame Cone V to Ancient Dragon Patriarch configuration |
| 14 | Lightning at most six levels and reassigned owners |
| 15 | Merge same-potency Magical Cleave into stronger configuration |
| 16 | Short Ricochet rules |
| 17 | Remove repeated Ricochet chance bullet |
| 18 | Permit Ricochet critical hits |
| 19 | Permit ordinary Ricochet on-hit effects |
| 20 | Remove repeated logical-pulse detail from normal copy |
| 21 | Remove repeated damage-basis detail from normal copy |
| 22 | Remove repeated rule and technical parameter dump |
| 23 | Remove Ricochet bounce-distance limit |
| 24 | State bounce count once |
| 25 | Omit redundant distinct-victim parameter bullet |
| 26 | Omit redundant recursive-chain parameter bullet |
| 27 | Omit repeated trigger parameter bullet |
| 28 | Omit repeated hit-source parameter bullet |
| 29 | Merge same-potency Slow into stronger configuration |
| 30 | Merge same-potency Slow Aura into stronger configuration |
| 31 | Show all assigned defenders immediately |
| 32 | Show all four former Magical Critical Strike owners under Critical Strike |

## Exact handoff and approval

The [revision 2 ability appendix](../output/design/fr002-revision2-20261031/proposal-abilities.md), [complete ability proposal](../output/design/fr002-revision2-20261031/ability-level-proposal.json), [changes since revision 1](../output/design/fr002-revision2-20261031/revision2-changes.json), [verification](../output/design/fr002-revision2-20261031/verification.json) and [manifest](../output/design/fr002-revision2-20261031/proposal-manifest.json) define the reviewable set. Apply nine added assignments once; the earlier eight are retained and Huntress Execution is the ninth.

The implementation chat should use **FR-002 revision 2** with the retained recipe/stat files. Status stays proposed until the user approves this revision or an identified subset. Review comments refine a proposal; they do not approve a game release. Preserve prior evidence and reconcile the exact reviewed changes with the current implementation checkout.
