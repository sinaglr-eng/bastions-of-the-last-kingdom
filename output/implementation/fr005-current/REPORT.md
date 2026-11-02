# FR-005 revision 2 — local implementation

Local game **0.6.8**, ruleset **fr005-r2-20261102**. The exact revision 2 implementation was authorized by the user request in Master verze hry. Public game and hosted statistics have not been deployed.

## Verified changes

The actual runtime matches all 258 approved profiles, 559 ability occurrences, 41 families, 159 family-level numbers, 167 parameter variants and 114 recipes. Only Boar Lancer changes an ingredient. All primary values, sustained single-target DPS, timing, targeting, weapon cycles, continuous weapon DPS, FR-004 immunity auras and approved media remain exact. Sky Hunt is a separate continuous geometric Slow aura against flying enemies, with no hit, reveal or lingering status. Existing Physical immunity is also this engine’s Slow immunity and remains a status gate; geometric coverage itself does not depend on damage contact. Attack pause and disarm do not disable Sky Hunt. Ordinary Slow, Slow Aura and Sky Hunt use the strongest reduction and the existing boss multiplier.

Five machines use classified Multishot and Ricochet. Heavy Sniper receives canonical Execution I; Siege Cannon receives Freeze I. Golem retains Freeze I and replaces Stone Gaze with canonical Stun I. All 21 specified Visibility assignments are removed, with usable extended detection remaining in every faction.

All **2042 automated tests** and the **233-module build** passed. The new tests cover actual movement, aura boundaries and entry/exit, hidden and evading enemies, immunity, control recovery, magazines/reloads, distinct targets, proc lineage, execution, UI effect attribution and score cohort separation.

## Fresh matched Diamond Spiral campaigns

Six fresh seeds × two frozen legal policies × three factions × two rulesets = **72 campaigns**. TOP and Secret are excluded; rank VI is allowed. The controller decision functions and construction order are unchanged from the previous verified controller.

| Faction | Baseline mean completed | FR-005 mean completed | FR-005 best | Wins |
| --- | ---: | ---: | ---: | ---: |
| crown | 22.17 | 22.17 | 41 | 0 |
| forge | 23.83 | 26.92 | 37 | 0 |
| grove | 25.50 | 22.75 | 29 | 0 |

## Equal-material late battles

234 controlled cases compare frozen 600-material armies, nine late waves, every final-boss form and selected half-timestep checks. The current Dwarf fixed army cleared all 39 of its cases; the baseline fixed army leaked the final boss. The selected Elf army still leaked wave 46. This is a controlled capacity result, not a legal campaign victory.

## Limits

- Six fresh initial seed clusters, each tested with two fixed policies across three factions and both rulesets; these are paired diagnostics, not 72 independent faction-strength estimates.
- All legal campaign actions use the real game APIs and costs. No army, walls, resources, ranks, health or favorable draws are injected. TOP and Secret are excluded; rank VI is allowed.
- The frozen policies use a known future-wave schedule, not only the live UI preview. Combat and drafts share randomness; paired initial seeds do not force identical downstream draws.
- The 234 controlled late-wave cases inject frozen 600-material armies on a complete Diamond Spiral with MVP0. Principal identities are paired; filler may differ under the cheaper Boar Lancer recipe. These tests establish controlled capacity, not legal acquisition.
- No legal campaign in this sample completed all 50 waves. Elves completed fewer waves under these policies after the intentionally removed detection. No unapproved balance retuning was applied.

See [exact runtime compatibility](runtime-gallery-compatibility.json), [balance results](balance-summary.json), [campaign table](campaign-results.csv), [test/build validation](validation.json) and [the preserved exact revision 2 requirement](authority/REQUIREMENT.md).
