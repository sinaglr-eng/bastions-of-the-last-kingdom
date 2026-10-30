# FR 001 Approved faction recipes and battle balance

Requirement ID: **FR-001**. Date: 30 October 2026. Status: **18 ordinary recipe changes and 492 numeric field deltas approved for future implementation; Lady Claire contract verified; implementation deferred to another chat; full-campaign balance remains unverified.**

Implement the approved Dwarf and Elf recipe inputs, preserve a faction-local Lady Claire unlock with the same rank and recruitment rarity as Human, and complete the battle-balance work described below. This handoff freezes the approved inputs and reports tests performed using candidate data in memory. No game, gallery, backend, combat-stat, model or production asset change was made for FR-001.

## Approved numeric parameter addendum

The user approved the [tested Elf and Dwarf parameter set](FACTION_BALANCE_PARAMETERS_FR001_20261030.md) on 30 October 2026 and requested its inclusion in FR-001 for future implementation. This approval covers **492 numeric field deltas across 133 profiles: 85 Elf profiles and 48 Dwarf profiles**, including nine expected-DPS projection corrections. The [numeric approval receipt](../output/design/faction-balance-fr001-20261030/approval.json) pins the exact four files below. The earlier 18 ordinary recipe changes remain approved.

| Approved component | Deltas | Frozen file | SHA 256 |
| --- | --- | --- | --- |
| Elf recruit and early champion parameters | 217 | [elf-early.json](../output/design/faction-balance-fr001-20261030/iterations/recommended/elf-early.json) | 595409866a6df28206d8c7545d7b15c2a903f0728bd15666de7b7eecf624a96e |
| Elf Advanced and TOP parameters | 79 | [elf-late.json](../output/design/faction-balance-fr001-20261030/iterations/recommended/elf-late.json) | 81d13f3156fa0459eb05e5582da9a59186b6e313f6d4b1d164d8c6a5e6c3f9be |
| Dwarf recruit parameters and cycle projections | 187 | [dwarf.json](../output/design/faction-balance-fr001-20261030/iterations/recommended/dwarf.json) | ce6f353037d838918eb42b24043af4f3e510942779c5e9c5d71a6ff5093f8eef |
| Elf expected-DPS projections | 9 | [elf-derived.json](../output/design/faction-balance-fr001-20261030/iterations/recommended/elf-derived.json) | 185bf8605fdacb6baebe75cbbe8da6a5f0dda0ced329b3f1ce38ffc49ba493d7 |

Human combat and recipes, shared Lady Claire, all ordinary Dwarf champion parameters, enemies, waves, economy, draft odds, models and voices remain outside these numeric changes. Regenerate English ability descriptions and faction-local level identities consistently with the approved values. Full 50-wave and player-win-rate parity remain unverified. Approval does not implement or publish the game; implementation stays deferred to another chat.

## Authority and implementation boundary

The user approved the [30 October recipe proposal](FACTION_RECIPE_REVIEW_20261030.md), requested testing of both factions, requested equal-value faction equivalents for Lady Claire, and explicitly asked to prepare a new requirement for implementation in another chat. The exact user wording is retained as historical evidence in the [approval receipt](../output/design/faction-recipes-approved-20261030/approval.json).

Approval covers the 10 Dwarf and 8 Elf ordinary recipe changes below and the exact 492-field numeric set in the approved addendum. The current Claire triples already satisfy the faction and rank equivalence request, so preserve and regression-test them. The numeric approval is a decision to implement these frozen values later; it is not certification of equal difficulty or permission to change Human.

The measured package version is 0.6.0, registry ruleset `three-factions-v060-20261030`. Source hashes define the tested workspace more precisely than its version alone. Existing newer faction-card scene metadata is unrelated to FR-001 and must not be overwritten. Keep other chat changes intact and reconcile the approved recipe deltas by stable IDs against the current checkout.

## Approved recipe requirements

Every basic defender family at each exact rank I–VI must have 1–3 distinct ordinary output recipes, and no more than three total destinations when Claire is included. Claire may never be a recruit's only useful destination. Every nonterminal champion must also have 1–3 onward recipes. Same-family merges do not count toward recipe coverage.

Each faction keeps eight basic families, 37 ordinary champions, Lady Claire and 38 fixed three-defender recipes. Preserve champion dependency edges, stage classifications and recipe level 1. Keep one recipe per output, valid local ingredients and finite acyclic recipe trees. Human recipes remain unchanged.

Eight TOP champions, Lady Claire and the existing terminal Advanced specialists remain endpoints. Dwarf terminal specialists are Mortar Dwarf, War Drummer, Siege Cannon, Forge Sentinel and Forge Dwarf. Elf terminal specialists are Stag Bulwark, Moonshadow Huntress, Stormwing Phoenix Rider, Crescent Revenant and Moonweb Hunter. These are intentional final combat options, not missing combinations.

### Dwarves

| Champion | Approved ingredients |
| --- | --- |
| Dwarf Axeman | Shieldguard I + Boar Rider I + Runesmith I |
| Heavy Sniper | Dwarf Sniper + Musketeer V + Griffin Handler III |
| Mortar Dwarf | Dwarf Sniper + Grenadier V + Griffin Handler II |
| Boar Lancer | Boar Rider III + Shieldguard II + Shieldguard III |
| Boar Drummer | Boar Lancer + Boar Rider IV + Boar Rider II |
| Bomb Dwarf | Grenadier I + Blacksmith I + Runesmith II |
| Forge Sentinel | Iron Golem + Shieldguard V + Runesmith III |
| Griffin Scout | Griffin Handler I + Musketeer I + Dwarf Miner I |
| Steam Dwarf | Blacksmith II + Dwarf Miner II + Runesmith II |
| Forge Dwarf | Flamethrower + Blacksmith V + Blacksmith II |

The other 28 recipes retain their exact inputs.

### Elves

| Champion | Approved ingredients |
| --- | --- |
| Emerald Sentry | Emerald Elf I + Elven Ranger I + Nightweaver Spider I |
| Ironbark Ent | Emerald Blademaster + Emerald Elf IV + Emerald Elf V |
| Moonlight Ranger Captain | Moonlight Ranger Scout + Elven Ranger III + Elven Ranger IV |
| Stormspear Initiate | Stormspear I + Elven Priestess I + Dragon Keeper I |
| Drow Wraithcaller | Lunar Spirit Shaman I + Moonblade Assassin I + Nightweaver Spider II |
| Drow Moon Specter | Drow Wraithcaller + Lunar Spirit Shaman III + Elven Priestess IV |
| Elven Battlemage Master | Elven Battlemage Expert + Elven Priestess VI + Emerald Elf VI |
| Fire Dragon | Baby Fire Dragon + Dragon Keeper III + Dragon Keeper IV |

The other 30 recipes retain their exact inputs.

### Frozen candidate inputs

The JSON files contain complete reference graphs for inspection and testing. During implementation apply the 18 approved input deltas, rather than overwriting unrelated current registry fields with this historical snapshot.

| Faction | Frozen file | SHA 256 |
| --- | --- | --- |
| forge | [forge-recipes.json](../output/design/faction-recipes-approved-20261030/approved/forge-recipes.json) | 7dde169abfe2e85cd64c8453d8129b59dd35f16db4481b1364dc1130503ae875 |
| grove | [grove-recipes.json](../output/design/faction-recipes-approved-20261030/approved/grove-recipes.json) | 4b2335593cbba9343f7e80b16b7f8eadd79732860ef08c31ebf9541dcd03ea6a |

The [structural validation](../output/design/faction-recipes-approved-20261030/requirement-validation.json) passes for all 144 basic rank profiles across three factions. The approved Dwarf and Elf graphs cover all 96 profiles with 1–3 ordinary recipes, preserve all champion dependencies, and retain 14 intentional endpoints each. Human retains its 13 endpoints and original recipe data. The [previous destination directory](../output/design/faction-recipe-review-20261030/coverage.md) lists every current and approved destination.

## Lady Claire in every faction

Use the existing canonical result ID `ladyclaire` and current name **Lady Claire**. Her resulting combat profile and model stay shared. Only the chosen faction's own recipe appears in a run.

| Human ingredient | Dwarf equivalent | Elf equivalent |
| --- | --- | --- |
| Mage V | Runesmith V | Stormspear V |
| Druid V | Blacksmith V | Nightweaver Spider V |
| Frost Warden V | Dwarf Miner V | Lunar Spirit Shaman V |

The complete triples are:

- **Human:** Mage V + Druid V + Frost Warden V.
- **Dwarves:** Runesmith V + Blacksmith V + Dwarf Miner V.
- **Elves:** Stormspear V + Lunar Spirit Shaman V + Nightweaver Spider V.

Equal value means three distinct basic rank-V ingredients, each with family weight 1 of 8 and the same shared rank odds. The abstract rank weight is 16 per ingredient, 48 total; recipe level is 1. It does not mean identical attack damage or interchangeable combat roles across the races. No Human ingredient ID may leak into a Dwarf or Elf recipe.

Preserve the Human secret rules: the draft is complete, all five actual draw identities are placed, the run is in select phase, and three distinct eligible current-round ingredient defenders are consumed. Previously retained ingredients, foreign families, wrong ranks, stale rounds, forged or duplicate identities, unplaced candidates and a reserved required ingredient must fail atomically. An unrelated reserved filler remains legal under the existing engine's reservation rule. Do not replace this contract with the separate fresh-rank-V-only rule for merging rank VI.

The [Claire verification](../output/design/faction-recipes-approved-20261030/claire/claire-verification.json) passes **66/66 actual Game cases**. Controlled round-25 fixtures use unforced seeded draws, five real placement actions and actual crafting from each possible ingredient anchor. Nine additional cases use actual reserve, keep and next-round APIs to return a prior reserve into the current draft, then craft from each ingredient anchor. A controlled reward boundary advances those fixtures; no combat survival or campaign progression is claimed. The returned reserve is eligible, while an ingredient newly reserved for the next draft is not.

The first mastery row allowing rank V is reached in construction round 19. With maximum mastery, the exact chance of the three required V families appearing in five fresh draws is **0.086865% per draft**, identical in all factions. Claire is a rare possible Secret, not a guaranteed outcome in each run. The report verifies all 16 mastery rows independently; ordinary faction viability must not depend on obtaining her.

## Balance tests completed

### Legal campaign comparisons

The same deterministic policy ran 32 starting seeds through five datasets, giving **160 actual campaigns**. Runs used the real Game, enemy waves, legal shared recruit foundations, ordinary keeps, fresh merges and engine-authorized recipes. No ranks, money, health, enemy deaths or victories were injected. The policy estimates whole ammunition cycles, support and route exposure when choosing actions.

| Dataset | Runs | Mean waves completed | Median | Range | Recipes crafted | Wins |
| --- | --- | --- | --- | --- | --- | --- |
| Human reference | 32 | 13.500 | 13 | 9–20 | 50 | 0 |
| Dwarves current | 32 | 9.000 | 9 | 7–11 | 37 | 0 |
| Dwarves approved recipes | 32 | 9.719 | 9 | 8–11 | 60 | 0 |
| Elves current | 32 | 7.938 | 8 | 7–9 | 23 | 0 |
| Elves approved recipes | 32 | 8.313 | 8 | 7–9 | 44 | 0 |

Dwarf recipe changes improved completed-wave counts on 14 seeds, left 16 unchanged and reduced two. Elf recipe changes improved nine seeds and left 23 unchanged. They increase actual recipe accessibility, but the tested Human policy still progresses substantially farther. All datasets lost before campaign completion. These are automated policy outcomes, not player win rates or proof that later waves are impossible. Combat and draws share RNG, so the same starting seed does not guarantee identical later inventories after actions diverge.

Reproduction and all per-wave results are in the [campaign evidence](../output/design/faction-recipes-approved-20261030/campaign/README.md).

### Controlled combat comparisons

The harness ran **4,046 controlled combat simulations**: 3,096 single-profile scenarios covering all 258 faction appearance profiles against 12 actual wave kits, 648 opening combat runs grouped into 162 comparisons, 108 equal-rank army scenarios and 194 focused counter and boss simulations. All reported finite combat state. The 20 magazine profiles each exercised at least five full magazines in the heavy-armor fixture.

Controlled fixtures use stationary targets with actual HP, armor, evasion, immunity, regeneration, shields and boss properties. Targets in the main harness respawn after death. Multi-defender formations use distinct source tiles. Armies are injected into memory to isolate mechanics and exposure; these fixtures are not acquired campaign armies or estimates of travel-time survival. Low-HP respawn and overkill caps make wave-1 damage unsuitable as a direct power ranking.

For one defender from each of the eight basic families, all at rank V, measured effective damage per second was:

| Faction | Actual target kit | Effective damage per second |
| --- | --- | --- |
| Human | Wave 5 flying | 777.45 |
| Human | Wave 22 armored | 1018.15 |
| Dwarves | Wave 5 flying | 488.40 |
| Dwarves | Wave 22 armored | 793.76 |
| Elves | Wave 5 flying | 302.77 |
| Elves | Wave 22 armored | 339.96 |

These equal recruit-rank budgets use a shared formation that is not optimized for each faction's ranges or auras. The basic profiles in this fixture have no Lone Vigil or Bonded Formation; champion positioning is examined separately. The results corroborate the campaign gap, especially for Elves, but do not define a universal tuning target or justify applying the inverse ratio as a global damage buff.

In 30-second wave-9 opening fixtures, approved Dwarf crafted champions dealt about 8.91–11.42 times their best individual ingredient's damage; Emerald Sentry and Stormspear Initiate were about 5.11 and 5.08 times, while Drow Wraithcaller was about 1.96 times. Human reference values ranged from 5.22 to 19.85. These comparisons use actual wave-9 evasion and three clustered stationary targets. They assess a recipe's keep-one alternative, not the value of replacing three retained defenders or a complete campaign. Ground-only Axeman and Sentry correctly lose air coverage; their zero damage to flying targets is a role tradeoff, not an engine defect.

See the [combat findings](../output/design/faction-recipes-approved-20261030/combat/FINDINGS.md), [controlled combat results](../output/design/faction-recipes-approved-20261030/combat/summary.json) and the full profile, opening and army files in the same directory.

### Immunity and late boss counters

Focused probes verify that Elf immunity cancellation activates on flying enemies and bosses. Boss duration is reduced as authored. A low-damage magic hit may still fail to pass the boss's armor, shell and breach damage multiplier, preventing landed-hit follow-up effects. This is a counter-potency threshold, not failed flying-target eligibility.

Against a stationary actual magic-immune final-boss variant for 60 seconds, representative ordinary champion results with MVP level 0 were:

| Champion | Damage alone | Nonadjacent support | Damage with support |
| --- | --- | --- | --- |
| King | 446,155.71 | Cleric V | 723,505.71 |
| Master Sniper | 404,959.59 | Runesmith V | 720,233.9 |
| Moonlight Eagle Rider | 5,965.32 | Lunar Spirit Shaman V | 5,965.32 |
| Elven Battlemage Master | 0 | Lunar Spirit Shaman V | 493.33 |

Support and recipes differ, so this is not a matched-cost ranking. It is a strong signal to investigate ordinary Elf late-game counters. These MVP-0 fixtures contain one champion and at most one listed support, with no additional allies or external buffs. MVP growth or different compositions may change damage thresholds. Crescent Revenant must also be evaluated as a support unit: positive multi-target secondary damage does not establish useful damage against a lone boss. A basic rank-V unit is not required to defeat the final boss by itself.

The [immunity and boss probes](../output/design/faction-recipes-approved-20261030/combat/immunity-probe.json) include all three actual boss variants. Demonstrate a reachable ordinary counter composition without Claire; do not use her rarity to conceal a missing faction counter.

### Acquisition probabilities

Exact multinomial calculations confirm the same initial opportunity as Human: two all-I roots plus a mixed I and II root, with **15.564%** of five-fresh-rank-I drafts containing an immediate ordinary recipe. At later mastery rows, single-draft opportunities differ:

| Mastery index | Human | Dwarves approved | Elves approved |
| --- | --- | --- | --- |
| 0 | 15.5640% | 15.5640% | 15.5640% |
| 7 | 1.6762% | 2.9211% | 2.8767% |
| 11 | 0.9153% | 1.5886% | 1.5899% |
| 15 | 1.6648% | 0.4920% | 0.4775% |

This calculation deliberately excludes previous inventory, champion ingredients, reroll, reserve and merge. At maximum mastery, fresh-only ordinary opportunities decrease from 0.7548% to 0.4920% for Dwarves and from 0.7485% to 0.4775% for Elves. This is a later fresh-draft opportunity warning, not a claim about total attainable recipes during a campaign. The [acquisition report](../output/design/faction-recipes-approved-20261030/acquisition-balance.json) contains all 16 rows and the exact method. Recipe coverage, acquisition opportunity and battle strength are separate requirements.

## Verification of the approved balance parameters

**The numeric set is approved; full-campaign balance certification remains open.** Implement the frozen values above together with the approved recipe inputs. The original uncalibrated baseline findings are retained below and in the linked evidence; the numeric addendum contains the tested improvements.

1. Preserve the exact approved field values, faction identities, attack types, target caps, finite immunity windows and ground-only restrictions. Keep Human, Claire and ordinary Dwarf champions unchanged.
2. Synchronize English ability copy, faction-local ability-level identities, weapon-cycle statistics, continuous attack projections and expected primary DPS with the approved numeric values.
3. Re-run the implemented data through early moving ground and air encounters, full Dwarf reload cycles, Elf armor preparation and Shaman support with legal positioning. Verify ordinary counters without requiring Claire.
4. Use newly attributed regression and campaign evidence. The existing 5,400 combined combat scenarios and 80 held-out campaigns are historical candidate measurements, not implementation tests.
5. Validate later acquisition, real flight exposure and each final-boss variant. No legal 50-wave win or equal player win rate was established by the candidate. Keep additional tuning distinguishable from this exact approval.

This request records approval and prepares the handoff only. A later implementation instruction in the other chat will activate the work; no runtime or publication action is performed here.

## Implementation and verification checklist

1. Read this requirement, both approval receipts, the approved numeric addendum and the frozen recipe and parameter hashes. Compare the current checkout with the recorded source hashes and preserve unrelated work.
2. Apply the 10 Dwarf and 8 Elf recipe-input changes and the approved 492-field numeric set to the active faction registry or its current successor. Synchronize the required English descriptions and derived fields. Keep current models, visual approvals, voices, Human combat and Claire intact.
3. Lock all three Claire triples by stable ID and rank. Verify five real current-draft identities, atomic rejection cases, faction isolation, resulting shared Claire and identical rarity across the 16 mastery rows.
4. Run graph checks for every rank I–VI with and without Secret recipes, champion endpoints, local ingredients, three physical identities, uniqueness, stage/level preservation and finite expansion. Verify recipe navigation, pinning, catalogue and craft eligibility use the same updated data.
5. Complete verification of the approved values and retain measured results and limits. Report unresolved full-campaign balance findings explicitly rather than labelling the release balanced.
6. Update ruleset/release attribution for the new recipe or combat revision. Preserve historical run statistics and avoid mixing changed progression with 0.6.0 standings.
7. Keep the maintained gallery local only. If its combat references are updated, create an explicit combat revision without replacing approved art, original V14 source evidence or local model binaries.
8. Run relevant engine and UI regression tests and the production build for the actual implementation. This analysis did not modify runtime code and does not substitute for those implementation checks.

## Handoff files and reproduction

The receipt, frozen inputs, validation, probability results, controlled combat reports, campaign outcomes and source-preservation report live under [FR-001 evidence](../output/design/faction-recipes-approved-20261030/). All data written there is requirement or test evidence; no model binary or alternative gallery was created.

Run from the project root:

```powershell
node output/design/faction-recipes-approved-20261030/verify-requirement.mjs
node output/design/faction-recipes-approved-20261030/acquisition-balance.mjs
node output/design/faction-recipes-approved-20261030/claire/verify-claire.mjs
node output/design/faction-recipes-approved-20261030/combat/controlled-combat.mjs
node output/design/faction-recipes-approved-20261030/combat/immunity-probe.mjs
node output/design/faction-recipes-approved-20261030/campaign/run-campaigns.mjs
```

The campaign README records its seed and CLI settings. These commands reproduce the untouched baseline and write to the historical evidence paths shown above. The requirement preflight also checks that all 18 approved changes are still unapplied. Before a post-implementation run, copy or adapt the harnesses to a new output directory, update that preflight expectation and test the actual implemented data rather than blindly overlaying the frozen candidate again. Preserve the original approval and measured baseline records.

### Prompt for the implementing chat

Implement FR-001 from `docs/APPROVED_FACTION_RECIPES_FR001_20261030.md`, including the approved numeric set in `docs/FACTION_BALANCE_PARAMETERS_FR001_20261030.md`. Apply the frozen approved 18 recipe-input changes, 492 numeric field deltas and Claire contract; preserve unrelated current work and complete the listed implementation regressions and remaining campaign checks. Human, shared Claire, ordinary Dwarf champion parameters, models and the local-only gallery policy stay intact. The prior preparation changed no runtime files.
