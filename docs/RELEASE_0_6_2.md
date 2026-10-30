# Forged Alliances TD 0.6.2

The faction chooser now uses newly recomposed panoramic battle illustrations in frames sized to their native dimensions. No character cropping or image stretching is applied. Engraved gold corners and a parchment frame accompany a new native SVG crest: united blades and a glowing forge inside a shield. The current logo is used in the loading screen, top bar, chooser and favicon. Original artwork remains preserved.

Defender ability descriptions follow all rank controls, statistics, measured damage and targeting controls at the bottom of the defender panel.

FR-001 implements the approved 18 faction recipe changes and 492 numeric deltas across 85 Elf and 48 Dwarf profiles. Sixty-five changed ability descriptions and faction-local level identities are regenerated from the approved values. Lady Claire remains a shared champion with three distinct faction-local rank-V ingredients and the existing current-draft crafting contract. Human combat, ordinary Dwarf champion parameters, enemies, economy, draft odds, gallery sources, portrait derivatives, original model binaries and animation clips are unchanged.

Version 0.6.2 identifies this balance package; existing ruleset and native-model source revision identifiers remain provenance for their original imports. Score cohorts already separate exact game versions and factions, so earlier scores are retained and cannot mix with this release.

## Validation

The full implementation test suite and production build are recorded in output/releases/v0.6.2. FR-001 evidence is separately attributed to this implemented registry, rather than replaying a numeric candidate overlay. Reproduction:

- node output/releases/v0.6.2/fr001/acquisition.mjs
- node tools/fr001-validation/claire.mjs
- node tools/fr001-validation/combat.mjs --tag=implemented
- node tools/fr001-validation/campaign.mjs --seeds=16 --holdout --tag=implemented

The combat matrix contains 5,400 actual-engine stationary encounters across all faction profiles, equal-rank armies, air targets, armor, regeneration and all three final-boss variants. These are controlled encounter fixtures, not acquired campaign armies. The 80 legal campaigns use 16 new seeds and the same placement/decision policy for the baseline and implemented data, with no injected resources, ranks or victories. They exercise moving ground/air encounters and legal recipe acquisition as reached by the policy. All 16 mastery rows were also checked using exact fresh-draft acquisition probabilities for the implemented recipes. No fifty-wave victory or equal player win rate is certified. Human averaged 16.375 completed waves; Dwarves improved from 9.0625 to 11.0625 and Elves from 7.75 to 12.125 under this policy. All campaigns ended in defeat, with the longest reaching 26 completed waves.

Browser and physical iPad checks were explicitly waived by the user. The local-only English design gallery was not changed or published.

## Visual sources

The built-in image_gen tool recomposed the three existing scenes. Exact prompts, source hashes, native dimensions and final workspace paths are recorded in public/assets/ui/faction-scenes-v062/manifest.json. The logo is original editable SVG in public/assets/branding/forged-alliances-v3. These implementation visuals have not received a separate human approval.
