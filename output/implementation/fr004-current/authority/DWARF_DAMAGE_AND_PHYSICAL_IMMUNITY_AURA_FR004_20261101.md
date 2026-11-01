# FR-004 Dwarf damage and Physical immunity aura implementation requirement

Prepared on 1 November 2026 from the single current gallery. **Implementation specification prepared; gameplay implementation and final numeric approval have not been recorded in this chat.** The current playable release is **0.6.6**, with ruleset **fr003-r2-20261101**. The receiving chat may implement this requirement when the user asks that chat to do so; this document adds no separate confirmation step.

FR-004 raises Dwarf-native primary damage and extends the existing Physical immunity aura. It covers all **45 native defenders / 85 profiles**: **80 profiles use 1.5 times their game-0.6.6 primary value**, and the **five Iron golem and Gatling champions use 2 times their game-0.6.6 value**. All 10 existing Physical immunity aura owners gain 1.5 tiles of radius. The gallery remains a local preview until gameplay implementation is verified.

## Authoritative current inputs

The exact profile and owner identities are part of this requirement. Match by faction, unit ID and rank, not by display name, an image, or champion classification alone.

- [Configuration](../output/design/dwarf-damage-preview-current/preview-config.json): default multiplier, machine override and six aura radii.
- [All 85 profile changes](../output/design/dwarf-damage-preview-current/profile-changes.csv): exact baseline and target fields, with base DPS, damage channel, unchanged interval and attack range.
- [All 10 aura owners](../output/design/dwarf-damage-preview-current/aura-owner-changes.csv): exact owner/rank, current level ID, radius and transmission.
- [Implementation handoff](../output/design/dwarf-damage-preview-current/implementation-handoff.json): structured profile/aura changes, file hashes and authorization boundaries.
- [Complete target atlas](../output/design/dwarf-damage-preview-current/atlas-preview.json), [target ability catalogue](../output/design/dwarf-damage-preview-current/ability-catalogue-preview.json) and [numeric/presentation deltas](../output/design/dwarf-damage-preview-current/changes.json).
- [Current source manifest](../output/design/dwarf-damage-preview-current/preview-manifest.json).

The structured changes and complete target profiles must agree. The gallery atlas contains presentation and recorded-review evidence; apply the selected gameplay fields to the actual registry rather than replacing runtime data wholesale. No earlier proposal folder or gallery comparison copy is needed.

## Primary damage scope

The scope is **48 basic rank profiles plus 37 champion profiles**, including TOP and terminal Advanced champions. There are **81 discrete primary attacks and four continuous weapons**. Shared Lady Claire is excluded in every faction. Human and Elf combat, all recipes, faction eligibility and progression remain exact.

For an ordinary Dwarf profile, set target primary damage to its implemented game-0.6.6 value multiplied by **1.5**. For the following five machine champions, use **2** instead. This is **+100% total versus game 0.6.6**, not another doubling of the already increased preview and not 1.5 multiplied by 2.

| Machine champion | Stable unit ID | Game damage per hit | Target damage per hit | Target base weapon DPS |
| --- | --- | ---: | ---: | ---: |
| Gatling Gunner | dw_repeatercrew | 65 | 130 | 200 |
| Iron Golem | dw_ironclad | 155 | 310 | 539.13043478 |
| Gatling Golem | dw_breachorgan | 520 | 1,040 | 1,300 |
| Forge Sentinel | dw_deepdelve | 708.4 | 1,416.8 | 1,156.57142857 |
| Iron Colossus | dw_salvomarshal | 1,250 | 2,500 | 3,146.85314685 |

Apply only the explicit 85 primary fields. Keep attack interval, fixed weapon interval, magazine size, reload, spin-up, normal attack range, targeting, damage channel, rank/classification and recipe ingredients exact. Preserve fractional damage without integer rounding; Forge Sentinel is **1,416.8**, not 1,417.

The target numbers already include the new primary damage. The gallery fields primaryDamageBonusPercent, primaryDamageBonusApplied and primaryDamageApplication describe this fact; they are not instructions to multiply the result again. Runtime listedDamage must derive from the new primary field so percentage-based attacks use the correct base.

## Continuous weapons and shared ability levels

| Defender | Stable unit ID | Game continuous DPS | Target continuous DPS |
| --- | --- | ---: | ---: |
| Flamethrower | dw_steamharpooner | 1,500 | 2,250 |
| Heavy Flamethrower | dw_flamewarden | 1,800 | 2,700 |
| Forge Dwarf | dw_emberanvil | 2,070 | 3,105 |
| Fire Furnace | dw_bombardking | 9,000 | 13,500 |

Use the proposed **continuousAttack.dps** for actual continuous damage exactly once. These profiles keep damage = 0 and interval = 0; multiplying zero must not leave their actual weapon unchanged. Preserve cone angle, cone/attack range, targeting, damage channel, update cadence and per-target semantics.

The shared **Flame Cone** ability retains its canonical base parameters, level IDs, labels, assignments and source variants across factions. For example, Flame Cone II remains 1,500 base DPS while Dwarf Flamethrower deals 2,250 effective primary DPS. The Elf Fire Dragon remains at 1,500. The game and gallery must clearly distinguish shared base ability strength from the Dwarf weapon's resulting DPS.

Fixed secondary values such as Burn, Heat, Fire Aura, Lightning and Spark stay exact. Percentage-based Cleave, Splash, Charged Attack, Critical Strike and other existing primary-derived rules naturally use the new primary base; preserve their current percentages, triggers, eligibility and recursion rules. Ricochet keeps the actual triggering packet's basis: bounces from a stronger primary hit inherit that stronger basis, while bounces triggered by an unchanged fixed secondary effect retain their corresponding unchanged basis under the same modifiers. Give neither those bounces nor every owned damage packet an additional permanent multiplier.

Apply the new base profile values before the existing support and personal MVP calculation. Existing support/MVP effects still apply once with their existing semantics; they do not become part of the permanent +50%/+100% change.

## Physical immunity aura reach

Family: **cancel-physical-immunity-aura**, displayed as **Cancel Physical Immunity Aura**. This extends immunity coverage; it is not an armor-reduction change. The six levels retain their identities and transmission fractions.

| Level | Game radius | Target radius | Normal Physical damage passing immunity |
| --- | ---: | ---: | ---: |
| I | 2.5 | 4 | 25% |
| II | 3 | 4.5 | 35% |
| III | 3.5 | 5 | 50% |
| IV | 4 | 5.5 | 65% |
| V | 4.5 | 6 | 80% |
| VI | 5 | 6.5 | 100% |

Every current owner keeps its assigned level:

| Defender | Stable unit ID | Rank | Aura level | Target radius | Transmission |
| --- | --- | ---: | --- | ---: | ---: |
| Runesmith I | dw_runesmith | 1 | I | 4 | 25% |
| Runesmith II | dw_runesmith | 2 | I | 4 | 25% |
| Runesmith III | dw_runesmith | 3 | II | 4.5 | 35% |
| Runesmith IV | dw_runesmith | 4 | II | 4.5 | 35% |
| Runesmith V | dw_runesmith | 5 | III | 5 | 50% |
| Runesmith VI | dw_runesmith | 6 | III | 5 | 50% |
| Rune Dwarf | dw_runemortar | 1 | III | 5 | 50% |
| Rune Mage | dw_tunnelsapper | 1 | IV | 5.5 | 65% |
| Rune Guardian | dw_nullifier | 1 | V | 6 | 80% |
| Rune Master | dw_worldanvil | 1 | VI | 6.5 | 100% |

Update the 10 owner ability records and the six canonical Physical aura definitions consistently. Preserve **Cancel Magic Immunity Aura**, all other ability parameters and every owner assignment. Retain the current continuous passive behavior: enemy-position coverage evaluated at a real damage event, radius boundary included, strongest matching channel only, immediate loss of coverage after exit, and armor/shell processing after immunity transmission. Different channels coexist. Active retained sources emit even while their attacks are paused or disarmed; draft, reserve and ruined sources do not emit.

The aura radius remains independent of normal attack range and Range Aura. Preserve ground, airborne, boss and hidden-enemy coverage, existing visibility rules, immunity/status flags, Holy damage behavior and offensive-proc behavior. Extend the existing aura; retain no new cooldown, target cap, finite window or old timed-cancellation source.

## Runtime integration

1. Reconcile the actual implementation checkout against the baseline values in the handoff. All 85 fields and 10 owner radii must match their expected game-0.6.6 baseline before applying FR-004. A later ruleset requires reconciliation rather than silently overwriting newer work.
2. Apply a dedicated FR-004 layer **after FR-003** and before faction data conversion and Game construction. Preserve existing FR-002 and FR-003 engine gates when adding FR-004 ruleset identity. The current paths include game/core/fr003-registry.js, game/core/factions.js, game/core/math.js, game/core/fr002-combat.js and game/core/immunity-auras.js.
3. Change the approved registry's selected primary fields and Physical aura radii, with stable ID/rank matching. Keep canonical fixed secondary values outside this base-primary adjustment. Generate runtime attack descriptions and derived metrics from the resulting profiles.
4. Make the actual game loader and simulation/validation loaders select the same new ruleset. Preserve baseline builders needed for existing regression contracts. The current tools/fr003-validation/datasets.mjs must not silently leave future simulations on old values after the game moves forward.
5. Construct fresh profile/ability arrays before the aura-definition cache is used. Profiles remain immutable during a run; cached definitions must not retain the old radius after the new registry is selected.
6. Recompute base weapon-cycle DPS, expected critical DPS and exported metrics. For magazines, use damage × magazine / (spin-up + magazine × fixedInterval + reload), including the last listed shot interval. Continuous base DPS is continuousAttack.dps. Base DPS excludes crit, extra targets, abilities, support, MVP and defenses.
7. Propagate the new ruleset and the next authorized game-release version to future run statistics, release metadata and in-game information. Preserve existing player score records and their original version/ruleset attribution. No save-schema migration or recipe change is part of this request.
8. Once implementation and compatibility checks pass, update this same local gallery to the verified implemented state, with its existing art/review/model identities. Prepare no separate maintained gallery, archive, source/production backup package, release tag or backup branch. Ordinary Git history remains intact. Keep only the current authorized release and required regression inputs under the retention policy.

## Acceptance and verification

| Check | Required result |
| --- | --- |
| Exact data scope | All 258 profile identities remain; exactly 85 native Dwarf primary fields change, with 5 factors of 2 and 80 factors of 1.5; all non-Dwarf and shared Claire combat fields remain exact. |
| Recipes and other parameters | All 114 recipe entries, eligibility, progression, classifications, timing, magazines, reload, spin-up, attack range, targeting and damage channels remain exact. |
| Damage in the real engine | Deterministic unbuffed zero-defense fixtures verify the selected direct bases and all four continuous outputs; fixed secondary values stay exact. Percentage effects and existing crit/support/MVP use the new base once. Ricochet tests distinguish primary-triggered and fixed-secondary-triggered packet bases. |
| Continuous identity | Flamethrower/Heavy Flamethrower/Forge Dwarf/Fire Furnace actually deal 2,250/2,700/3,105/13,500 continuous DPS; canonical shared Flame Cone parameters remain exact. |
| Aura geometry | All 10 owners use the target radii. Test the exact boundary and just outside it for each of the six levels, exit/movement, strongest overlapping Physical aura, coexistence with Magical aura, emitter states and a Range Aura neighbor. |
| Aura damage ordering | Actual immune targets admit the existing 25/35/50/65/80/100 percent before armor and shell; nonimmune and Holy damage retain their prior behavior. Visibility/status/proc rules remain exact. |
| Derived metrics | All 85 primary DPS values scale by their assigned factor; machine base DPS is 200 / 539.13043478 / 1,300 / 1,156.57142857 / 3,146.85314685 within floating-point tolerance. Weapon cycles retain their timing. |
| Regression | Existing required contracts pass through their relevant baseline fixtures; add focused FR-004 data, runtime damage, aura and metadata tests rather than relaxing unrelated checks. |
| Game and gallery UI | Cards, detail, ability catalogue, descriptions and exports agree with actual runtime values. All owners remain visible. Desktop and 390-pixel layouts stay readable, and appearance/voice review persistence remains separate from combat approval. |
| Protected content | Approved original art, exact recorded prompts/reviews, model binaries and availability, voices, scenery, enemy data and player scores retain their identities. No model upload or hosted publication occurs. |

Use numerical tolerances appropriate to floating-point damage and finite weapon cycles. Measure continuous and magazine weapons over defined logical time windows, with fixed secondary events recorded separately. Verify that a second application of the permanent multiplier is rejected or prevented.

## Balance validation after implementation

Run fresh actual-engine Diamond Spiral campaigns for Human, Dwarves and Elves without TOP champions. Ordinary rank VI remains allowed. Freeze the controller, construction order and seed lists before collecting comparison results. Use at least **12 fresh paired initial seeds × two fixed strategies × three factions = 72 legal campaigns**. Construct the Diamond through normal draft placements, use real CP/resource/recipe actions and earn personal MVP normally. Preserve the same conditions for the unchanged Human reference.

Record natural Lady Claire eligibility separately; a run allowing Secret is not evidence that Claire was acquired. Where paired action/combat histories duplicate, do not count them as independent faction-strength samples. Record completed waves, final lost wave, health/leaks, actual boss kills, craft timing and whether all 128 Diamond foundations were completed. The completed ground route is 718 steps; flying enemies retain their real checkpoint route.

Repeat the fixed equal-material late-wave comparison against waves 27, 35, 40, 43, 45, 46, 48, 49 and 50, all three final-boss forms, and selected half-timestep checks. The existing reproducible harnesses are under output/analysis/diamond-spiral-current/. Keep injected controlled armies distinct from legal campaigns, and count boss kills/full clears rather than treating a boss escape with lives remaining as a kill.

The earlier 0.6.6 runs did not validate these proposed changes. Claim no-TOP completion only with a genuine 50-wave victory and a reproducible legal action record for the relevant faction. If no strategy wins, report the actual result and remaining bottlenecks. Exact implementation acceptance and a successful balance/completion claim are separate outcomes; further parameter changes require a separate user direction.

## Handoff to the implementation chat

Implement FR-004 from this requirement and implementation-handoff.json when the user requests implementation. Apply only its explicit profile/aura changes to the current registry after reconciling the baseline. Preserve Human, Elves, shared Lady Claire, recipes, approved assets and score records. Run the focused engine/data/UI tests and the stated Diamond Spiral comparisons, then synchronize the single local gallery and report numeric correctness and balance outcomes separately. Use the project's release convention for the next authorized version. Keep the current-only release/gallery policy, and publish nothing without an explicit hosted-distribution request.

This preparation creates no game implementation, new release, simulation result, new art approval or model-availability claim. Current preview QA is recorded in the existing local quality reports; the receiving chat must verify its actual implementation.
