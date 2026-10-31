# Forged Alliances TD 0.6.5 — FR-002 revision 3

This release implements the consolidated FR-002 revision 3 approved on 31 October 2026, including retained recipe/stat changes and the non-conflicting earlier requirements. The implementation was requested in this game chat. The immutable approval receipt, exact reviewed ability assignments, recipes and terminal parameters are retained under `output/releases/v0.6.5/fr002/source/`. Historical pending-approval documents retain their original bytes; the separate approval receipt establishes the later decision.

The 0.6.4 FR-001 registry remains unchanged. A versioned reviewed overlay applies 43 recipe deltas, 570 exact ability assignments in 42 families/152 potency levels/160 technical configurations, nine ability additions and ten terminal specialist stat changes. It does not replay the earlier FR-001 patches or replace current model bindings with a proposal snapshot. Human attacks continue using their established campaign adapter; its actual base damage, intervals, range and recipes are protected. Only fourteen explicitly approved Human ability assignments change. Lady Claire's effective combat, RNG consumption, faction-local recipes and current-draft eligibility are preserved.

## Implemented behavior

- Dwarf and Elf progression uses 23 and 20 changed recipes respectively. Twenty-eight of the 32 Basic/Intermediate recipes are lighter; all sixteen Intermediate recipes are lighter. Every basic rank I–VI retains one to three ordinary destinations and at most three including Claire. Recipes still require three distinct actual defenders at their exact identities and ranks.
- Ten final Advanced specialists retain an 11.11–13.79% recursively expanded material premium over their continuing alternatives. Nine receive the approved +15% listed damage. Forge Dwarf receives the combined 2,070-DPS cone once. Cycle, critical and continuous/range projections are regenerated.
- Burn and Lightning each have six shared potency levels. Stronger selected configurations, the specific Anti-Air VIII and Attack Speed Aura VII labels, retired-number handling, partner-specific Bonded Formation graph and all precise legacy ability IDs are retained.
- Ricochet uses the actual positive triggering packet, including secondary and continuous sources. It has no bounce-distance or owner-range cap, visits finite distinct visible legal targets, uses fresh ordinary critical rolls and permits ordinary on-hit effects. A descendant cannot re-enter an ancestor ability. Timed and attack-release abilities are not duplicated by bounces.
- Continuous/DOT/aura damage is delivered immediately. One-second logical effect windows govern chance effects without multiplying chances by frame rate; independent poison stacks contribute to the same owner/effect/target window. Final partial windows flush, including lethal damage, without turning tiny slices into full weapon-damage bounces.
- Moon Strike uses one main-target chance roll and a separate Holy packet. Keep Recovery rolls at most once per damaging release and respects the starting-health cap. Huntress Multishot carries exactly one Execution activation per fifteen-second release.
- Ability copy uses the shared labels and concise English rules. Source-attributed support glyphs use actual individual aura radii. Healing reduction and structured control effects are visible on affected enemies.
- New run identities use `fr002-r3-20261031`. The statistics service requires this identity for version 0.6.5 onward; older versions retain their original identity and separate score cohorts. No SQL reset or migration is performed.

## Validation and its limits

All **1,984 automated tests** passed. Additional checks loaded all **258 exact native defender models** and sampled their real animations/emitting surfaces with current FR-002 profiles. Approved models, player binaries, textures, artwork and the 0.6.4 presentation changes remain unchanged.

Controlled tests covered **9,288 before/after profile battle cases**: every profile, nine target scenarios and support on/off. There were also **180 paired equal-budget comparisons, 360 actual army cases**, using integer copy counts at exactly equal expanded ingredient commitment, non-overlapping common formations and real support. The original synthetic billion-HP profile arenas can magnify instant Execution; their raw damage is not a universal ranking. The separate equal-budget armies use finite 50,000-HP targets and 500,000-HP bosses, and report kills, control and capped keep recovery alongside effective damage. Both designs have explicit placement, target-replacement and acquisition limitations.

There were **96 actual legal campaign attempts** across eight seeds, two fixed policies, three factions and baseline/current rules. They performed 231 crafts and 163 paid reservations without injected resources, ingredients, levels or forced draws. Mean completed waves in this limited bot cohort were:

| Faction | FR-001 baseline | FR-002 revision 3 |
| --- | ---: | ---: |
| Human | 13.875 | 14.5 |
| Dwarves | 10.875 | 13.0625 |
| Elves | 11.5625 | 14.25 |

The bot reached at most wave 27 completed and did not win a 50-wave campaign. These runs measure real acquisition and combat under fixed imperfect policies, not player win rates, equal faction difficulty, TOP availability or late-campaign parity. Shared seeds do not force identical subsequent drafts because combat RNG consumption can diverge. The campaign report's legacy `baselineVersion` metadata field records the runner package version; the method and immutable registry hashes identify the actual 0.6.4 FR-001 comparison data.

Lady Claire passed **66 actual eligibility/acquisition cases**, including natural unforced draft seeds, all ingredient anchors, invalid/foreign/stale identities and returned reserves. Separate real-combat comparisons preserve her damage events and RNG consumption in all factions against normal, immune, flying and shielded enemies. Her rank-V mathematical opportunity remains unchanged; a conditional 50-draft opportunity is not an observed acquisition or win rate.

No further numeric retuning is included. The approved buffs are implemented as reviewed; complete 50-wave player balance remains unverified. Browser and physical iPad checks remain explicitly waived by the user.

## Local gallery and evidence

Every current profile parameter, continuous/weapon mirror, recipe and complete ability configuration matches the separately approved local gallery. The one English gallery remains local only, with its prior FR-001 comparison, all legacy links, artwork identities, reviews, casting and local model files preserved. No gallery Site, full gallery source snapshot or model binary is uploaded as part of this change. Only game rule inputs required for implementation are retained in the game source distribution.

The default game, backend deployment, CI, model identities, exact served files and backup tags are recorded under `output/releases/v0.6.5/`. Version 0.6.4 is retained by its existing immutable tag for recovery.
