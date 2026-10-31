# FR 002 revision 3 ability proposal

**PROPOSED — PENDING FINAL APPROVAL — NOT IMPLEMENTED IN THE GAME.** Date: 31 October 2026. This revision addresses four remaining duplicate-level comments. Earlier proposal files remain immutable. Recipes, primary attacks, models, artwork and casting are unchanged.

## Four requested consolidations

| Ability | Previous repeated configurations | Revision 3 |
| --- | --- | --- |
| Anti-Regeneration II | 100% suppression for 3, 4 or 5 seconds; one extra scope-only variant | One 100% suppression effect for 5 seconds with the explicit all-healing scope |
| Bonded Formation I | Four partner-list variants with the same +20% effect | One visible level row, one common rule and one exact matching-pairs table; owner-specific partners are unchanged |
| Lightning III | Three 250-damage shapes with 3/4/5 targets and 3/4/6-tile reach | One 20% chance, 250-damage sequential chain, five additional targets, six-tile links; damage follows the owner channel |
| Physical Cleave II | 50% at 2 tiles without inherited criticals versus 50% at 4 tiles with inherited criticals | One 50% configuration at 4 tiles, retaining the primary critical multiplier |

## Preserve meaningful mechanics

Bonded Formation retains 10 owners, 28 directed partner entries and 14 unique mutual pairs. No owner gains every other owner’s partners. The exact map is [bonded-formation-partners.json](bonded-formation-partners.json). The catalogue must show the common rule and all pairs once, without four repeated level headings.

Lightning III follows the existing Claire chain geometry. `damageType: profile` is a shared representation: Claire keeps Holy damage; the other current owners keep Magical damage. Claire’s chance, packet damage, target count, link range, chain mode and effective damage type do not change. Explicit distinct-target metadata retains the existing chain rule. [claire-equivalence.json](claire-equivalence.json) proves every shared Claire assignment against revision 2.

Lightning VI’s distinct sequential and forked modes retain their exact revision 2 parameters. They belong inside one level row with a short description of the differences. Do not create an unrequested global forked-lightning buff. Other genuinely different configurations should also share one full-label heading while remaining inspectable. Anti-Air labels remain distinct because their full names and target restrictions differ.

## Human ability exceptions

The following proposed changes are measured from the implemented FR-001 baseline; primary damage, interval, range and recipes stay exact.

| Defender | Assignment | Ability | Proposed changes |
| --- | --- | --- | --- |
| Frost Warden | crown/frostwarden/3 | slow | slowPercent: 24 → 25 |
| Cinder Adept | crown/embercrown/1 | fire-aura | dps: 240 → 250 |
| Inferno Magister | crown/worldfire/1 | fire-aura | radius: 5 → 5.5 |
| Storm Eagle | crown/starfall/1 | lightning | damage: 165 → 250; linkRange: 4 → 6; mode: "near-target-chain" → "sequential-chain"; targets: 4 → 5 |
| Stormfire Sorcerer | crown/thunderheart/1 | lightning | damage: 3000 → 7500 |
| Ballista | crown/kingsreach/1 | armor-reduction | armorReduction: 30 → 32 |
| Frozen Paladin | crown/winterhold/1 | slow-aura | groundOnly: true → false; radius: 4.5 → 5 |
| Master Ranger | crown/royalranger/1 | armor-reduction | armorReduction: 30 → 32 |
| Dark Ranger | crown/kingsrangerguard/1 | armor-reduction | armorReduction: 35 → 40 |
| Dark Ranger | crown/kingsrangerguard/1 | slow | radius: 0 → 3; targeting: "flying-only" → "eligible" |
| Ranger Oathbreaker | crown/elvenking/1 | slow | duration: 2 → 3; targeting: "flying-only" → "eligible" |
| Fire Ballista | crown/fireballista/1 | burn | dps: 120 → 240 |
| Royal Battery | crown/mechanicalgolem/1 | anti-regeneration | duration: 3 → 5 |
| Paladin Oathbreaker | crown/archangel/1 | slow-aura | slowPercent: 70 → 75; radius: 4 → 5 |

## Exact review inputs

[ability-level-proposal.json](ability-level-proposal.json) contains all 570 occurrences and nine retained additions, 251 original variant mappings, 197 revision 1 aliases and 166 revision 2 aliases. [assignment-review.csv](assignment-review.csv) lists every exact owner/rank. [revision3-changes.json](revision3-changes.json) separates combat changes from metadata normalization. [verification.json](verification.json) records proposal consistency checks. These are not battle simulations or approval of a game release.
