# FR 002 approved faction recipes and abilities

Requirement: **FR-002, revision 3**. Approved: **31 October 2026**. Status: **APPROVED DESIGN — NOT IMPLEMENTED IN THE GAME**.

The user approved the current consolidated revision 3 after reviewing the local gallery. The exact message, **“schvaluji”**, is retained as historical user evidence in the [approval receipt](../output/design/fr002-approval-20261031/approval.json). Approval covers the final revision 3 ability assignments and rules, the retained 43 recipe changes and ten terminal Advanced stat changes. It does not approve superseded configurations from earlier revisions.

This is the current implementation handoff. Implementation remains deferred to the separately authorized game chat under the standing workflow. Recording approval and updating gallery status do not authorize game edits or publication in this chat. The game remains on its implemented FR-001 combat baseline.

## Approved scope

| Component | Approved set |
| --- | --- |
| Ordinary faction recipes | 43 changes: 23 Dwarf and 20 Elf; exact retained inputs from revision 1 |
| Early acquisition | 28 of 32 Basic/Intermediate recipes lighter; all 16 Intermediate recipes lighter |
| Terminal Advanced specialists | Ten final alternatives with the retained relative material premium and stronger approved values |
| Specialist damage | Nine +15% listed direct-damage changes; Forge Dwarf's combined 2,070-DPS cone, applied once |
| Ability assignments | Final revision 3 data: 42 families, 152 potency levels, 160 technical configurations and 570 occurrences |
| Added abilities | Nine additions, including the earlier eight and Execution I on Moonshadow Huntress |
| Human exceptions | Fourteen explicitly listed ability-assignment changes; primary damage, intervals, base range and recipes remain protected |
| Catalogue presentation | 155 distinct full named level rows, complete visible owner lists, concise useful descriptions and precise old-link focus |
| Shared Claire | Faction-local recipes and eligibility preserved; effective combat unchanged through verified channel/default normalization |

Every proposed value in the approved final ability file is part of the set, including the retained revision 1/2 changes. Do not interpret the latest four correction comments as the entire approval scope. Conversely, older conflicting ability values are historical evidence and must not be applied over the final file.

## Exact implementation inputs

Use the [approval receipt](../output/design/fr002-approval-20261031/approval.json) for exact hashes and scope. The following files define the effective set:

- [Final ability assignments and rules](../output/design/fr002-revision3-20261031/ability-level-proposal.json).
- [Complete retained Dwarf and Elf recipe graph](../output/design/fr002-proposal-20261031/recipes/candidate-recipes.json), with [before/after recipe comparisons](../output/design/fr002-proposal-20261031/recipes/recipe-comparison.json).
- [Ten terminal specialist stat changes](../output/design/fr002-proposal-20261031/recipes/terminal-stat-proposal.json).
- [Revision 3 requirement](FACTION_RECIPES_AND_ABILITIES_FR002_REVISION3_20261031.md), with non-conflicting [revision 2 requirements](FACTION_RECIPES_AND_ABILITIES_FR002_REVISION2_20261031.md) and the retained [recipe progression specification](../output/design/fr002-proposal-20261031/recipes/proposal-recipes.md).
- [Exact defender/rank assignment review](../output/design/fr002-revision3-20261031/assignment-review.csv), [Bonded Formation graph](../output/design/fr002-revision3-20261031/bonded-formation-partners.json) and [Claire equivalence proof](../output/design/fr002-revision3-20261031/claire-equivalence.json).

The original frozen proposal manifests and their documents intentionally retain their historical pending-approval labels. Their bytes remain evidence of what was reviewed. The separate approval receipt and this handoff establish current approval without rewriting that evidence.

Apply reviewed changes against the implementation checkout using stable faction, unit and rank IDs. Do not replace the entire current registry with an older proposal snapshot or replay FR-001 patches over implemented values. Reconcile unrelated changes from other chats and regenerate derived metrics and descriptions from the final approved parameters.

## Rules that must remain precise

- Every basic rank I–VI retains 1–3 ordinary destinations and no more than three including Claire. Nonterminal champions retain their onward recipes. Intentional final Advanced, TOP and Secret endpoints remain explicit.
- Human recipes and primary attack parameters stay exact. Apply only the fourteen listed Human ability exceptions. Preserve all Claire recipes, special eligibility and effective combat values.
- Apply the nine added assignments once. Forge Dwarf's 2,070-DPS cone already includes the terminal premium; keep its ability and continuous-attack mirrors synchronized without adding another multiplier.
- Moonshadow Huntress remains final Advanced and has Execution I. Despite five-target Multishot, Execution affects one main eligible target per activation.
- Burn and Lightning retain six potency levels. Preserve the specifically requested Armor Reduction VIII - Anti-Air and Attack Speed Aura VII meanings and the recorded retired-number handling.
- Anti-Regeneration II uses 100% for five seconds; Physical Cleave II uses 50% within four tiles and inherits the primary critical multiplier. Lightning III uses 20% chance, 250 damage, five additional targets and six-tile sequential jumps while preserving each owner's effective channel.
- Bonded Formation retains ten owners, 28 directed partner entries and 14 mutual pairs. One common visible row does not create universal partner eligibility.
- Ricochet permits critical hits and ordinary on-hit effects without a bounce-distance or substitute owner-range cap. Retain finite distinct victims and the approved proc-lineage protection; bounces do not create extra attack-release or timed activations.
- Each full named level appears once in the proposed/approved catalogue. Keep actual mode, radius and partner distinctions visible inside the common row and retain exact technical IDs for old links.

## Required implementation validation

The recorded checks validate the gallery and proposal structure. They do not certify campaign balance. Before a later game release:

1. Verify every recipe, assignment and numeric change against the receipt, including continuous range/DPS mirrors and derived cycle/critical projections.
2. Test legal seeded acquisition using actual merge/craft rules and full retained ingredient trees. Verify recipe coverage and all Claire positive/negative eligibility cases.
3. Test damage, critical inheritance, on-hit effects, control and aura stacking, immunity, evasion, ground/flying eligibility and shared-secret equivalence.
4. Test one-target Huntress Execution and finite Ricochet lineages, including secondary/continuous damage, lethal hits, no distance cap and frame-independent pulse handling.
5. Compare equal-commitment armies and terminal specialists across single targets, clusters, dispersed enemies, bosses, armor, immunities and support. Run legal full campaigns on fixed seed cohorts before claiming parity or completion.
6. Verify the one English local gallery, exact old links, all owners, exports, baseline comparison, review/casting persistence and desktop/mobile layouts. Preserve original images and keep model binaries local.
7. Version actual game results and report performed checks and remaining balance limitations before release. Approval does not change old scores or establish release authorization.

## Implementation chat handoff

Refer to **FR-002 revision 3 — approved on 31 October 2026** and this document. The approval receipt pins the exact reviewed inputs and distinguishes approved design from actual game implementation. No message has been sent to another chat and no game or gallery has been published as part of this approval recording.
