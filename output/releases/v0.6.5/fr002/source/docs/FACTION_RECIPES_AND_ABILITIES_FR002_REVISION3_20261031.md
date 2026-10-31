# FR 002 revision 3 shared ability rows

Requirement: **FR-002, revision 3**. Date: **31 October 2026**. Status: **PROPOSED — PENDING FINAL APPROVAL — NOT IMPLEMENTED IN THE GAME**.

This is the current FR-002 handoff. It incorporates the four follow-up comments about repeated Anti-Regeneration, Bonded Formation, Lightning and Physical Cleave levels. It supersedes the conflicting configurations and gallery presentation rules in [revision 2](FACTION_RECIPES_AND_ABILITIES_FR002_REVISION2_20261031.md). Other revision 2 values, the 43 proposed recipes, ten terminal stat changes and nine ability additions remain in force as proposals. Earlier revisions stay exact historical evidence.

The game remains at its implemented FR-001 combat baseline. Only the proposed data and its local gallery preview change. Human primary attacks and recipes, Lady Claire's effective combat behavior and recipes, original images, models, casting and review decisions remain unchanged.

## Four requested corrections

| Comment | Common level and effect | Result |
| --- | --- | --- |
| 1 | Anti-Regeneration II | One configuration: **100% healing reduction for 5 seconds**. Promote shorter 3/4-second versions to the stronger existing duration. The rules column explains refresh and strongest-effect behavior instead of appearing empty. Level I stays 50% for 3 seconds. |
| 2 | Bonded Formation I | One visible level row: **+20% direct damage beside an eligible cardinally adjacent partner**. Show all ten owners and the shared pair overview once. Preserve every owner's actual partner list. |
| 3 | Lightning III | One configuration: **20% chance, 250 damage per additional target, up to 5 additional targets, 6-tile sequential jumps**. Each owner retains its effective damage channel: Holy for Claire and Magical for the other current owners. |
| 4 | Physical Cleave II | One configuration: **50% Physical damage within 4 tiles**, inheriting the primary attack's critical multiplier. Promote the shorter 2-tile versions to this existing stronger form. Other Physical Cleave levels stay exact. |

Physical Cleave's inherited critical multiplier is not a second independent critical roll. An attack without a critical multiplier retains ordinary secondary damage.

## One visible row per named level

The proposed ability table must display each full level name once. Combine all assigned defender/rank buttons into that row and show all of them immediately. The Focus level control follows the same grouping; technical configurations must not appear as repeated options with indistinguishable names.

Keep meaningful distinctions visible inside the common row when they remain necessary. For example, Lightning VI retains its existing sequential and forked patterns, with their actual chance, target count and reach. Fire Aura III retains its different source radii. These are described clearly together rather than displayed under duplicate level headings. This does not introduce unrequested numeric buffs to those other configurations.

The explicitly named **Anti-Air** Armor Reduction variant remains separately identifiable because its scope and full name differ. Technical variant IDs stay in source data so old links, selected-variant focus and exact owner mappings remain precise. A common visible row must not erase a real rule or redirect an old link to the wrong owner configuration.

Give the central rules column a useful, concise description in every row. Avoid repeating the same short description in several places or reintroducing a raw technical parameter list.

## Preserve Bonded Formation eligibility

Bonded Formation has ten owners, **28 directed partner entries** and **14 mutual pairs**. Preserve this graph exactly. A single common level does not make every owner a valid partner for every other owner.

Display the 14 valid mutual pairs once in an expanded, readable overview. Retain cardinal adjacency, the +20% primary damage bonus, source ownership and the existing non-stacking condition. Do not union all partner IDs into one unrestricted shared list.

The [partner graph](../output/design/fr002-revision3-20261031/bonded-formation-partners.json) and the exact assignment parameters are authoritative. Rendering may group the four technical partner-list configurations under one level.

## Preserve Claire through channel normalization

The common Lightning III source represents damage type as following its owner. This resolves to Holy for all three Claire bindings and Magical for the other current owners. Claire's 250 damage, 20% chance, five additional targets, six-tile sequential jumps, distinct victims and every other combat value stay effectively exact. Her separate Lightning V is unchanged.

The normalized source token and explicit default fields may differ from an earlier catalogue representation without changing the effect. The [equivalence proof](../output/design/fr002-revision3-20261031/claire-equivalence.json) distinguishes these metadata aliases from combat changes. Do not show a false Claire combat delta in the gallery comparison or apply a new damage channel to her in a future implementation.

## Scope and approval

The [revised ability appendix](../output/design/fr002-revision3-20261031/proposal-abilities.md) lists exact values, owners, Human ability exceptions and differences from revision 2. The [complete proposal](../output/design/fr002-revision3-20261031/ability-level-proposal.json) preserves all original, revision 1 and revision 2 link mappings. The [assignment review](../output/design/fr002-revision3-20261031/assignment-review.csv) lists every exact defender and rank. The [manifest](../output/design/fr002-revision3-20261031/proposal-manifest.json) pins the reviewable set.

Fourteen Human ability-assignment exceptions are proposed relative to the implemented baseline; Human primary parameters and recipes remain protected. No new recipe, champion, class, model or voice is introduced. Keep the current FR-002 proposal unapproved until the user gives final approval or approves an identified subset.

## Acceptance checks

1. Anti-Regeneration II, Bonded Formation I, Lightning III and Physical Cleave II each have one visible level row and one Focus level option, with every current owner visible.
2. Verify the exact common configurations above. Preserve all 570 ability occurrences, nine additions, 258 profiles, 114 recipes and all existing recipe-coverage guarantees.
3. Verify all 28 directed Bonded partner entries and 14 mutual pairs against revision 2. Display the pair overview once without creating extra partners.
4. Verify Claire's effective combat equivalence in all factions and no false before/proposed combat difference. Preserve her shared secret recipes and eligibility.
5. Verify every old level ID from V14, FR-001 and FR-002 revisions 1/2 resolves to the appropriate grouped row and exact selected configuration. Preserve all views, searches, filters, comparisons, exports and review/casting persistence.
6. Verify useful nonempty rule descriptions, no repeated identical full level headings, all owners immediately visible and readable desktop/mobile layouts. Keep all gallery copy English and distribution local only.
7. Preserve the frozen earlier proposals, game/data sources, original artwork, approvals, local models and casting. After approval, test actual acquisition and combat with the combined proposed values before a later game release; gallery checks do not establish campaign balance.
