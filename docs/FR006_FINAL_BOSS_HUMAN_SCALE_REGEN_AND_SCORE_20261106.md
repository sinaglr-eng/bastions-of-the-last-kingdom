# FR006 Final boss Human defender sizes regeneration and score faction

**Draft for review, 6 November 2026. Implementation and publication are not authorized.** Baseline: current game **0.6.9**, ruleset **fr005-r2-dwarf-air-20261102**. This requirement covers four requested corrections. The current game and the current approved gallery combat catalogue remain in effect while this draft is reviewed.

## 1 Final boss escape must end the campaign in defeat

In wave 50 of the 50-wave campaign, any surviving final boss that reaches the exit consumes **all remaining keep lives** and immediately ends the run in **Defeat**. Players must destroy the boss to win. Apply this to every current final-boss form, every faction and every starting remainder of keep health.

The current final boss has a nominal leak cost of 10. With 30 lives, the current engine permits it to escape, leaves 20 lives and declares Victory without killing the boss. The resulting 15,000-point wave-completion bonus must no longer be awarded in this situation.

Required behavior:

- Make the terminal loss atomic: record the boss escape once, consume the actual remaining lives, and resolve defeat before wave completion, survival rewards, MVP rewards or victory can run.
- Preserve points legitimately earned before the escape. Do not count the escaped boss as killed or wave 50 as completed.
- Record the actual lives consumed in the result and statistics, including when fewer or more than 10 lives remain. Do not keep the existing nominal value of 10 as the loss record.
- Further updates, queued attacks, healing or repeated escape processing cannot reverse defeat or award the boss kill after escape. A boss killed before crossing the exit must not also leak.
- Preserve the existing rules for other bosses and the 10-wave campaign.
- Validate the new release's checkpoints consistently with the terminal rule. A wave-50 final-boss leak cannot be submitted as a completed winning campaign. Preserve historical records and their original edition contracts.

Acceptance matrix: all three final-boss forms × Human, Dwarves and Elves × representative remaining lives of 1, 10, 20 and 30. Verify both escape and a kill before the exit, repeated updates after ending, and a hit/heal near the escape boundary. Escape always yields 0 lives, Defeat, no boss kill, no wave-50 completion and no completion reward.

Primary implementation references: `game/core/combat.js`, `game/core/game.js`, `game/core/run-statistics.js`, `backend/validation.js` and result rendering.

## 2 Normalize Human defender sizes by classification

Ordinary Human draft defenders must be the smallest class. Basic champions must be visibly larger, followed by Intermediate, Advanced and TOP. Normalize actual model sizes as well as the classification multiplier: multiplying differently sized source models by a common class factor does not establish the required ordering.

Current measurements cover all 86 approved V3 Human profiles, including all 48 draft ranks. They use the actual approved GLBs, Idle at time zero and current battlefield transforms. The body measurements exclude obvious weapons, shields, wings and magic by semantic mesh names; they are a body-and-clothing proxy requiring visual confirmation, not a manually annotated anatomical measurement.

| Current classification | Profiles | Smallest body proxy | Median | Largest body proxy |
| --- | ---: | ---: | ---: | ---: |
| Draft basic ranks | 48 | 1.1264 | 1.1940 | 1.3245 |
| Basic champion | 5 | 0.7308 | 0.7913 | 3.2060 |
| Intermediate | 13 | 0.6020 | 1.3099 | 1.7388 |
| Advanced | 11 | 0.8229 | 1.1415 | 1.8829 |
| TOP | 8 | 1.0880 | 1.6132 | 2.0915 |
| Shared Secret Lady Claire | 1 | 1.0513 | 1.0513 | 1.0513 |

Values are battlefield world units. Basic Cinder Adept is approximately 4.39 times as tall as Basic Frostsword Watchmen. Archer VI is taller than TOP Mother Nature and Archbishop. Draft defenders and Basic champions currently share a class multiplier of 1. Legacy family-based dragon adjustments also apply to current Human models whose approved identities have changed; Cinder Adept still receives the old `embercrown` presentation factor of 2.3.

Proposed working targets for humanoid bodies:

| Class | Reference multiplier | Approximate current working target |
| --- | ---: | ---: |
| Draft basic ranks | At most H | At most 1.3245 |
| Basic champion | 1.10 H | 1.4570 |
| Intermediate | 1.21 H | 1.6027 |
| Advanced | 1.331 H | 1.7630 |
| TOP | 1.4641 H | 1.9392 |

H is the tallest visually verified Human draft body after correcting any measurement contamination. The current proxy gives H = 1.3245. This reference preserves useful size progression across draft ranks while placing every Basic champion above the draft group. The numerical targets are proposal defaults; verify them with the common-camera review before implementation.

Implementation and acceptance requirements:

- Audit all eight draft families at ranks I–VI and all 37 ordinary Human champions. Use current V3 identities and source hashes rather than legacy family-name assumptions. List shared Secret Lady Claire separately; retain her common approved presentation across factions outside this ordinary-class normalization.
- Normalize humanoid champions toward their class body targets using uniform XYZ scaling on private presentation actors. Allow at most ±2% around each approved target, with no overlap between adjacent humanoid class body-height bands and with the smallest humanoid Basic champion above the tallest draft body.
- Preserve body proportions, equipment, approved geometry, materials, source files, animation clips and ground contact. Account for every existing class, family and battlefield multiplier exactly once; replace obsolete Human presentation exceptions rather than applying a second correction over them.
- Artillery, machines and low, broad constructs require explicit class-based silhouette and footprint targets rather than the humanoid standing-height formula. Record each proposed exception and compare its perceived size with the approved class reference in the common-camera review. Do not stretch only the Y axis or inflate a low weapon chassis to imitate a humanoid height: current Ballista would grow to roughly 2.60 × 3.19 tiles under that approach. Keep their classification visually legible through coherent body mass and footprint.
- Record full silhouette dimensions separately. A tall staff, flame, wing, head ornament or attack pose must not determine body normalization by itself. Review both body height and perceived volume so a body-height correction does not leave obvious visual outliers.
- Produce before/after comparisons using one fixed camera, ground plane, tile reference, lighting and actor pose across each comparison. Individually fitted portraits are not size evidence. Include Cinder Adept, Frostsword Watchmen, Archer VI, Mother Nature and Archbishop as explicit regression subjects.
- Check Idle and Attack, grounded placement, shadows, weapons, selection markers and preview presentation. Combat range, targeting, damage and collision rules do not change with visual scale.
- Keep Dwarf and Elf presentation unchanged. The Human correction must not leak through a family-only override into another faction or the shared Secret.

Measurement inputs and complete profile rows: [Human size audit](../output/design/next-requirement-current/human-size-audit.json) , [CSV](../output/design/next-requirement-current/human-size-audit.csv) and [interpretation](../output/design/next-requirement-current/HUMAN_SIZE_AUDIT.md). These measurements establish current discrepancies; the target scale map is pending visual review.

## 3 Wave 49 restores 15 percent of missing health every four seconds

Set the wave-49 enemy's existing **Recharge** pulse to **15% of its missing HP every four simulation seconds**, increased from the current effective 10%. Preserve the existing denominator, timing mechanism and healing-control interactions.

For maximum HP of 100 and current HP of 20, with no other damage or healing: the first pulse produces **32 HP**, the second produces **42.2 HP**. The second pulse uses the newly reduced missing-health amount. At full health, healing is zero; health never exceeds the actual maximum after modifiers.

Acceptance:

- Apply the 15% value to wave 49 across its current variants and every player faction. Change the effective campaign override, not only the historical raw JSON value of 12% that the runtime currently replaces.
- Preserve the four-second schedule, pause behavior and simulation-time semantics at supported game speeds. Test pulse boundaries and a step spanning more than one pulse.
- Preserve healing block and anti-regeneration reductions. A blocked pulse is not stored for a later burst.
- Keep other enemies' regeneration and Recharge rules unchanged. Update the wave guide, enemy inspection, tooltip and numeric preview from the same effective rule so they all describe 15% of missing HP every four seconds.

Primary references: `game/core/campaign-roster.js`, `game/core/combat.js`, `game/core/enemy-rules.js` and enemy/wave UI copy.

## 4 Show the played faction directly with the final score

The completed run must clearly identify its faction beside the final score: **Faction · Human**, **Faction · Dwarves** or **Faction · Elves**. Cover victory and defeat. Keep this local result context visible while online results load, while saving a name, after saving and when the service is unavailable.

The current result model already carries the faction, and the result page has a separate faction paragraph. The missing context is in the score/version block and online standings, whose five columns and captions currently emphasize only score, campaign and version. Existing faction data is already stored and validated; this requirement does not call for inventing a new faction field or a database migration.

Acceptance:

- The played faction is prominent in the score area, with readable text rather than relying on an image, color or a distant paragraph.
- Online standings and save confirmation identify their faction, game version and campaign length. The current player's own position outside the Top 10 has the same unambiguous context.
- Switching online versions or Legacy records changes the standings context while leaving the completed run's faction beside its final score unchanged.
- Historical records without a faction show **Faction not recorded** or the existing Legacy context. Do not assign Human as a fallback or relabel an old record using the current faction selection.
- Preserve faction-specific score separation and all existing player records. Apply the same verified faction context to table rows or a clear shared table heading as appropriate; avoid unnecessary repeated columns on mobile.
- Verify all three factions × victory/defeat, initial loading, name-save success/failure, unavailable service, own position outside Top 10, historical-version switching and Legacy. Inspect portrait mobile, ordinary desktop and short landscape layouts.

Primary references: `ui/run-results.js`, `ui/leaderboard.js`, result CSS, `game/core/save.js`, `game/core/run-statistics.js` and `game/core/statistics-client.js`.

## Review and implementation handoff

This draft changes no runtime code, model, current gallery rules, game version or deployment. Implementation requires a later explicit request. That work must include focused rule and statistics regressions, same-camera Human size comparisons, responsive result checks and the normal release checks. The existing 0.6.9 test and publication receipts do not validate these proposed changes.

The current local gallery remains available for recipe review: [Dwarves](http://127.0.0.1:59544/#view=roster&faction=forge) and [Elves](http://127.0.0.1:59544/#view=roster&faction=grove). All gallery language remains English, and approved original artwork, prompts, reviews, local models and player records remain preserved.
