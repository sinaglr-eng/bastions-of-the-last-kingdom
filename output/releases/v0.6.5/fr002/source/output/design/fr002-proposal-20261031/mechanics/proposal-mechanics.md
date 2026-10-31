# FR-002 — Proposed ability mechanics and missing faction coverage

Date: 31 October 2026. **Draft for approval. Not implemented.** This note supplements the proposed shared level ladders and recipe changes. It reads the current 0.6.4 checkout, whose relevant combat baseline remains implemented FR-001. Exact source hashes, assignments and numeric values are recorded in [mechanics-proposal.json](mechanics-proposal.json).

This mechanics note proposes no Human numeric changes. The separate [shared ability appendix](../abilities/proposal-abilities.md#human-shared-ability-changes-requiring-explicit-approval) proposes six Human ability-only buffs as explicit exceptions requiring approval. Human primary attacks, recipes and unrelated mechanics remain outside this proposal; shared Lady Claire always remains unchanged. Human ability labels may also be reorganized without a gameplay effect. All player-facing text below is English, as required for the maintained local gallery.

## Proposed new assignments

| Champion | Stable ID | New ability | Exact proposed values |
| --- | --- | --- | --- |
| War Drummer | `forge/dw_warcaller` | Keep Recovery I | 1% chance to restore 1 keep health; cap is starting keep health |
| Crescent Revenant | `grove/el_stag_oracle` | Keep Recovery I | 1% chance to restore 1 keep health; cap is starting keep health |
| Dwarf Axeman | `forge/dw_ironwarden` | Physical Cleave | 35% damage; radius 1.5 tiles |
| Dwarf Dualist | `forge/dw_ashshield` | Physical Cleave | 50% damage; radius 2 tiles |
| Dwarf Berserker | `forge/dw_bulwarkcaptain` | Physical Cleave | 65% damage; radius 2.25 tiles |
| Berserker Champion | `forge/dw_forgeking` | Physical Cleave | 80% damage; radius 2.75 tiles |
| Moon Banshee | `grove/el_moonwell_seer` | Range Aura | +1 attack range; radius 5 tiles |
| Eclipse Phantom | `grove/el_eclipse_unbinder` | Range Aura | +3 attack range; radius 5 tiles |

These eight assignments currently do not exist on the listed profiles. They are repeated in the shared ability JSON for complete assignment coverage: each is one proposed addition, not two changes to apply. Physical Cleave and Range Aura use the corresponding canonical value configurations from the shared level proposal; final Roman labels follow that proposal rather than the old faction-local numbering.

Keep Recovery goes to one terminal Advanced support specialist in each faction. This gives those endpoints a distinct lasting utility without multiplying healing rolls across Moonshadow Huntress's five direct targets. The nominal, unbuffed maximum mean is approximately 0.545 keep health/minute for War Drummer and 0.6 for Crescent Revenant, before misses, target uptime, haste and the health cap. Human Master Ranger has the same 1%/1-health ability and a nominal 1.2/minute at its current 0.5-second interval. These are arithmetic expectations, not battle simulation results.

Recovery rolls once per direct attack release that causes positive HP loss on at least one primary target, including a lethal hit. Additional targets, DOT, auras and secondary packets do not add rolls. Keep health cannot exceed its original maximum. Cleave keeps the existing structured-faction area and ground-only rules. Range Aura uses strongest-only stacking, includes its source, increases direct and continuous-cone reach, and does not enlarge offensive auras or cone angles.

## One ordinary Critical Strike family

Replace Magical Critical Strike on the four Shadow Assassins with ordinary Critical Strike. Their direct damage remains Magical. The first three use the existing stronger ordinary 10% chance for ×5 damage; the TOP uses the existing 20% chance for ×5 damage.

| Champion | Current magical critical | Proposed ordinary critical | Expected primary DPS before → after |
| --- | --- | --- | --- |
| Shadow Assassin Apprentice (`el_drow_blade_initiate`) | 10% ×2 | 10% ×5 | 183.333 → 233.333 |
| Shadow Assassin Adept (`el_drow_duelist`) | 10% ×3 | 10% ×5 | 592.941 → 691.765 |
| Shadow Assassin Expert (`el_drow_ashblade`) | 10% ×4 | 10% ×5 | 1,906.667 → 2,053.333 |
| Shadow Assassin Master (`el_drow_eclipse_duelist`) | 20% ×5 | 20% ×5 | 9,415.385 → 9,415.385 |

This changes the first three primary averages by approximately +27.3%, +16.7% and +7.7%. The calculation excludes defenses, Moon Strike, execution, positioning and support. It does not certify their final battle balance.

Only one ordinary critical roll is allowed per direct target hit. DOT, auras and Moon Strike do not critically strike. Existing Human critical values and Human Cleave's inherited critical multiplier stay intact; that separate Cleave property must remain visible in technical details. Old Magical Critical Strike links become migration aliases to the appropriate Critical Strike entry.

Player copy: **“Attacks have a {chancePercent}% chance to deal ×{multiplier} damage.”**

## Moon Strike without an attack counter

Replace “every fifth attack” with a **20% chance on a direct attack**. Keep the existing bonus amounts of 25%, 50%, 75% and 100% of listed pre-critical attack damage. Their long-run nominal contributions remain 5%, 10%, 15% and 20% of that damage basis. Random timing replaces the deterministic fifth-release burst.

Player copy: **“A direct attack has a 20% chance to add {damagePercent}% Holy damage to its main target.”**

One roll applies to the main target of an attack release. The bonus is a separate Holy packet, cannot critically strike, and does not apply ordinary on-hit procs. If an owner also has Ricochet, its positive damage remains eligible under the explicit any-hit rule. It does not require the original primary packet to deal damage. Its own armor, evasion and deflection checks remain active. The current engine has no separate Holy-immunity flag: remove misleading catalogue claims that it bypasses every defense; do not add an unrequested bypass.

## Ricochet from any damaging hit

Keep the existing four probabilities **20%, 30%, 40%, 50%**. The user's “20%” is interpreted as the illustrative first-level description, not a request to reduce all later levels to 20%. The proposed descriptions make this interpretation explicit for approval.

Player copy: **“Any damaging hit has a {chancePercent}% chance to bounce to nearby enemies. Bounces cannot trigger Ricochet again.”**

| Proposed level | Chance | Maximum bounces | Damage lost per bounce | Jump distance |
| --- | --- | --- | --- | --- |
| I | 20% | 1 | 50% | 3 tiles |
| II | 30% | 2 | 40% | 3 tiles |
| III | 40% | 3 | 30% | 3 tiles |
| IV | 50% | 4 | 20% | 3 tiles |

Every positive owned damage hit is eligible, including another direct target, cleave, splash, other secondary damage and logical DOT, aura or continuous-damage pulses. A lethal initiating hit remains eligible from its impact position. Blocks and zero HP loss do not roll. This removes the current first-primary restriction.

Damage-sliced effects need a stable logical hit definition so frame rate cannot multiply proc chances. For Ricochet eligibility only, combine each owner/effect/target's DOT, aura or cone slices into one **1-second logical pulse**, then roll once when that window ends. Flush a partial final pulse when the effect ends or the target dies. Actual damage delivery remains immediate. The pulse's bounce damage uses its accumulated eligible pre-defense damage basis; a tiny burn slice must not launch a full rifle-damage chain.

A bounce uses the triggering hit's damage type and pre-defense damage basis, without critical or execution multipliers, attenuated by the table above. Each victim applies its own defenses. Each chain visits distinct visible legal enemies, excludes its origin and stops after its finite bounce allowance. Ricochet descendants cannot initiate another Ricochet or carry other offensive procs, Cleave, Splash or recovery. Discrete hits roll immediately; no arbitrary frame cap may discard eligible natural hits.

This is a proposed combat redesign. Broader eligibility is a buff even with unchanged chances. It requires dense-enemy, secondary-effect and continuous-damage benchmarks before its balance can be certified. The existing single-origin nominal secondary averages are 10%, 28.8%, 61.32% and 118.08% of the triggering damage when every bounce finds a target. These percentages are useful arithmetic references, not total army DPS.

## Splash in plain language

Family copy: **“Hits also damage nearby enemies.”**

Level copy: **“Deals {damagePercent}% damage to other enemies within {radius} tiles.”**

This is a text simplification only. Preserve current damage type, legal targeting, first-primary area origin, exclusion of directly hit targets and duplicate protection. Expanded technical details can retain those rules.

## True Strike and True Strike Aura

Split the mixed catalogue into two clearly named families:

| Family | Proposed levels | Player copy |
| --- | --- | --- |
| True Strike | I: 20%; II: 40%; III: 60%; IV: 100% evasion ignored | “Attacks ignore {evasionIgnorePercent}% of enemy evasion.” |
| True Strike Aura | I: 100% evasion ignored, radius 5 tiles | “Nearby allies ignore enemy evasion.” |

Human Royal Battery (`royalarsenal`) keeps its existing 100% self effect. Human Nature Spirit (`rangermentor`) and Mother Nature (`mothernature`) keep their existing 100% aura within 5 tiles; their entries move to True Strike Aura I. Dwarf and Elf self assignments retain their exact percentages and become ordered levels. No new aura owner is proposed here.

This is a catalogue split and relabel only. It does not bypass armor, immunity, concealment or shields. Aura includes its owner and does not stack with itself. The JSON lists all six current catalogue-variant mappings and exact current owners.

## Future acceptance gates

The JSON lists targeted checks for each mechanic. Required verification includes one recovery roll per release, lethal hits and caps, direct-target area exclusion, strongest-only support, one critical roll, Moon Strike's expected contribution, finite Ricochet chains from every eligible source, equal logical pulses at 30/60/120 simulation steps per second, and migration of old ability links. Compare Human combat against baseline allowing only the six separately listed shared-ability exceptions if approved; shared Claire must compare equal without exceptions. Benchmark legal acquired armies and high-haste/dense-target cases before declaring balance. No such gameplay implementation or battle tests were performed for this planning note.
