# FR-005 Combat refinements for review

**Revision 2 — pending approval and implementation.** This proposal applies fifteen cumulative gallery comments to the implemented **game 0.6.7 / FR-004** baseline. It changes one Dwarf recipe ingredient, selected ability assignments, an air-only Sky Hunt Slow aura and shared Splash reach. Heavy Sniper gains Execution I and the five Dwarf machine champions gain Ricochet I or II. Existing primary damage, attack timing, range, target modes, magazine cycles, continuous weapon DPS and immunity auras remain exact. No new game version or combat simulation is included.

## Recipe

Boar Lancer changes from **Boar Rider III + Shieldguard II + Shieldguard I** to **Boar Rider III + Boar Rider I + Shieldguard I**. Only the selected Shieldguard II ingredient is replaced. The recipe still needs three distinct defender instances. All other 113 recipes remain exact.

## Sky Hunt

| Shared level | Existing Physical damage bonus against flying | Proposed air-only Slow aura | Proposed radius |
| --- | --- | --- | --- |
| 1 | 50% | 25% | 3 tiles |
| 2 | 60% | 50% | 4 tiles |
| 3 | 75% | 75% | 5 tiles |

Sky Hunt III slowing at 75% is explicitly requested. The 25% and 50% lower levels and growing 3/4/5-tile aura radii are proposed defaults for review. Existing Physical damage bonuses and all sixteen Sky Hunt owner profiles are preserved. The Slow aura remains part of Sky Hunt; it does not create an extra Slow-family assignment.

This is a continuous aura targeting flying enemies inside the radius of an active defender. No attack or hit is needed, so Physical immunity and evasion do not prevent coverage. The slow is present only while the enemy remains inside an applicable active aura; it leaves no three-second duration after departure. Ground enemies are unaffected. Existing Slow immunity and control/boss rules still apply. Overlapping Sky Hunt, ordinary Slow and Slow Aura use the strongest applicable movement reduction without addition. The Physical anti-air damage bonus retains its existing attack rules and is separate from aura coverage.

## Dwarf ability assignments

| Defender | Classification | Proposed Multishot | Distinct targets | Proposed Ricochet |
| --- | --- | --- | --- | --- |
| Gatling Gunner | BASIC | Multishot I | 2 | Ricochet I |
| Iron Golem | INTERMEDIATE | Multishot II | 3 | Ricochet I |
| Gatling Golem | ADVANCED | Multishot III | 5 | Ricochet II |
| Forge Sentinel | ADVANCED terminal | Multishot III | 5 | Ricochet II |
| Iron Colossus | TOP | Multishot IV | 10 | Ricochet II |

Iron Colossus already has Multishot IV and retains exactly one copy. The other four machine champions gain their classified levels. Single-target primary DPS and the existing firing/reload cycle remain unchanged; several valid targets can increase total outgoing damage.

The two earlier machine classes gain existing **Ricochet I**: 20% chance to bounce to one additional enemy, retaining 50% damage. The three later machine champions gain existing **Ricochet II**: 30% chance to bounce to two additional enemies, retaining 60% damage with each bounce. All existing canonical hit eligibility, critical, on-hit, proc-lineage and no-distance-limit rules remain exact. Other defenders retain their Ricochet assignments; Mortar Dwarf still loses Ricochet.

**Heavy Sniper** gains exactly the existing **Execution I** already assigned to Master Sniper: every 15 seconds, execute one normal enemy or deal ×10 damage to a boss. Its current damage, range, target eligibility, magazine, reload, Critical Strike and other abilities remain exact. This is one new assignment, not a new Execution level or a new damage multiplier applied to every shot.

**Siege Cannon** gains the existing **Freeze I**: 10% chance on ordinary contact, two-second duration, with the existing boss-duration multiplier 0.5 and +25% Physical-damage parameter preserved. **Mortar Dwarf** loses **Ricochet IV** and retains Armor Penetration, Slow, Splash and True Strike.

## Shared Splash reach

| Level | Existing damage percentage | Proposed radius |
| --- | --- | --- |
| I | 25% | 2 tiles |
| II | 40% | 2.25 tiles |
| III | 60% | 2.5 tiles |
| IV | 80% | 2.75 tiles |
| V | 100% | 3 tiles |

This is a global shared-level change across every current owner, including any Human or Elf assignment. Only radius changes; damage percentage, damage channel, target eligibility and existing proc rules remain exact. This explicit request is a scoped exception to the earlier Human-baseline preservation policy.

## Golem control

The Human **Golem** (emeraldgolem), the sole current Stone Gaze owner, loses **Stone Gaze I** and gains existing **Stun I**: 20% chance and two-second duration under current boss/control rules. Its existing **Freeze I** and Armor Reduction remain. Stone Gaze has no remaining current assignment, so it is removed from the current catalogue. Historical family and level links resolve to Stun I. Original source evidence is preserved. This specifically requested Human ability change does not alter its primary attack or recipe.

## Visibility removals

Remove Visibility from **Griffin Handler I–VI** and the entire four-champion Dwarf Griffin branch: **Griffin Scout, Griffin Gunner, Armored Griffin Rider and Griffin Commander**. The user's general Griffin wording is applied consistently to these ten profiles.

Remove Visibility from **Elven Ranger I–VI**, **Moonlight Ranger Scout, Moonlight Ranger Captain, Moonlight Ranger Warden, Moonshadow Huntress and Moonlight Eagle Rider**. The five champion removals correspond to the two explicitly selected regions. All other detection assignments, including Runesmith and Shaman detection, remain exact.

The total is **21 removed Visibility assignments**. Lost detection is an intentional tradeoff; the implementation must still verify that each faction retains usable detection against hidden enemies.

## Exact scope and implementation contract

The proposed catalogue has **559 ability occurrences**, **41 families**, **159 distinct family-level numbers** and **167 parameter variants**, across the same **258 profiles** and **114 recipes**. Eight changed shared levels receive new parameter identities while retaining their visible numbers. Existing level links, including the former Sky Hunt on-hit proposal links, redirect to the current aura levels. Every current used-by list, source index, profile assignment and coverage export is rebuilt from the same atlas. Unrelated existing owner-specific variants remain intact.

Apply the exact before/after replacements once to the FR-004 registry before faction conversion. Use existing Freeze, Stun, Execution, Ricochet, Splash and Multishot contracts and their boss, immunity, visibility and proc rules. Sky Hunt aura coverage must be evaluated independently of attack contact and must participate in the existing strongest-only movement slowing. Do not install a new global damage multiplier or multiply primary DPS by a Multishot target count. The implemented FR-004 Dwarf primary modifiers are already included in the baseline values.

The implementation must preserve every unlisted profile field and ability parameter, all other recipes, classifications, progression links, approved original art, recorded prompts, appearance reviews, casting records, local model identity and player scores. Original art preservation does not mean freezing the gallery image mapping described below. No model file or gallery may be uploaded. Maintain one current English local gallery without comparison controls or historical gallery copies.

## Current Sniper images

The gallery uses the exact approved camouflage PNG renders for **Heavy Sniper** and **Master Sniper** from **approved-faction-models-v3-20261030**, the same approved local source used by the runtime. **Intermediate Dwarf Sniper** retains its approved orange appearance. This is a gallery mapping refresh of two existing approved images; no original image, recorded approval, game asset or model is edited or regenerated.

The current local manifest is **sniper-visual-current.json**. It records the exact source PNG hashes and the approval provenance independently of the pending combat proposal. The available approved renders show a three-quarter front view; this refresh does not invent front/back turnarounds or claim that a new model file has become available. Gallery reference inspection, appearance approval and user-selected local model availability remain separate facts. Model binaries remain local and are not copied or uploaded by this refresh.

## Required validation

- Check every exact recipe and ability delta, all current owners and all legacy redirects. Sky Hunt and Splash must each retain one current row per existing parameter identity, with no phantom owners.
- Test Sky Hunt aura coverage against flying/ground, Physical-immune, Slow-immune, hidden, evading and boss targets. Verify range boundaries, active/inactive sources, entry/exit, no attack requirement, no duration after leaving, and strongest-only overlap with ordinary Slow and Slow Aura. The aura does not grant detection.
- Test classified Multishot with distinct targets, magazines, reloads and existing Splash/proc lineages. Verify Freeze and Stun retain ordinary control gates, boss duration and recovery.
- Verify Heavy Sniper receives the exact canonical Execution I contract. Test all five machine Ricochet assignments under the existing critical, on-hit, lineaging and target rules; preserve all other Ricochet owners and keep Mortar Dwarf unassigned.
- Verify all 21 detection removals and remaining faction detection. Verify all protected primary values/DPS, remaining abilities, all other recipes, art/review/model records and score data remain exact.
- After actual game implementation, run matched Diamond Spiral campaigns for all three factions without TOP plus equal-material controlled late battles. The current FR-004 simulation report is baseline evidence, not a test of these proposed changes.

## Review files

- [Proposed profiles](../output/design/fr005-current/atlas-preview.json)
- [Proposed ability catalogue](../output/design/fr005-current/ability-catalogue-preview.json)
- [Exact before and after changes](../output/design/fr005-current/changes.json)
- [Structured implementation handoff](../output/design/fr005-current/implementation-handoff.json)
- [Source hashes and generation checks](../output/design/fr005-current/preview-manifest.json)

The combat proposal is for review. Combat approval and actual game implementation remain separate from the approved visual source mapping and local model availability.
