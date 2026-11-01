# Forged Alliances TD 0.6.6 — FR-003 revision 2

This release implements the complete current FR-003 revision 2 approved on 1 November 2026 in Audit Tower Defense Game and requested in the game implementation chat. The sole current approval source remains local under `output/design/fr003-approval-20261101/current/`. Its exact input hashes and semantic pins are recorded with the release; no full gallery source or obsolete proposal snapshot is copied into the game distribution.

## Resulting behavior

- Exactly 37 profile deltas apply over implemented FR-002. All 21 former timed immunity-cancellation owners migrate once to continuous Cancel Physical Immunity Aura or Cancel Magic Immunity Aura. The old effect does not cast alongside the replacement.
- Both auras have six shared levels: 25%, 35%, 50%, 65%, 80% and 100% of normal matching damage through immunity at radii 2.5, 3, 3.5, 4, 4.5 and 5 tiles. The strongest covering aura per damage channel applies once at the immunity gate, before armor and flat shell reductions. Channels coexist; same-channel auras do not add or multiply.
- The center follows the retained active defender. Coverage includes the boundary and eligible ground, flying, boss and hidden enemies. It grants no visibility or targeting exemption and leaves no lingering debuff. Paused/disarmed defenders keep this passive aura; drafts, reserves and ruins do not. Range Aura does not enlarge its radius.
- Primary, secondary, continuous, damaging-aura and valid damage-over-time packets use the same live defense gate. Holy, evasion, refraction, shell, armor and ordinary companion status eligibility retain their rules. The support aura deals no damage and triggers no offensive proc itself. Status-ineligible poison/burning applications remain blocked.
- Fifteen approved damage changes and fourteen Dwarf range changes are active. Lionheart Champion is the sole Human numeric exception, at 700 damage and 980 unbuffed expected ordinary critical primary DPS. Both selected melee TOP ranges are 4.5 tiles. Armored Griffin Rider uses Sky Hunt III (+75%).
- Rifleman uses 280 damage, 8 range and 1 second in both displayed cadence and actual weapon cycle. Its three shots and 4.05-second reload remain unchanged: 840 damage per 7.05-second complete cycle, approximately 119.15 Base DPS. Other selected sniper magazines, reloads, spin-up and cadence remain exact; Mortar Dwarf remains ground-only.
- Base DPS displays sustained primary output per target, including full weapon cycles and explicit continuous DPS. Criticals, secondary effects, extra targets, support and MVP remain separate. Selected-source radius indicators and visible enemy markers show live aura coverage, including coverage from attack-paused sources.
- Immunity aura definitions are cached by immutable ability array. Live state and positions are evaluated at the actual event; enemies without damage immunity skip aura-source scanning.
- All recipes, all three Lady Claire profiles and unrelated Human combat remain exact. Original FR-001/FR-002 data, art, textures, model mappings, native animations and prior 0.6.5 presentation changes are preserved.
- Version 0.6.6 uses statistics identity `fr003-r2-20261101`. Version 0.6.5 retains its FR-002 identity and older cohorts retain their existing identities. The statistics service was updated without a database reset, migration or synthetic live result.

## Verification

All **1,998 automated tests** passed, including every migrated owner, all aura levels, radius boundaries, immediate entry/exit, strongest-only overlap, independent channels, nonimmune/Holy behavior, defense ordering, status eligibility, old-clock removal, actual Rifleman releases, actual Human criticals and real statistics API/database checks.

All **258 actual native defender profiles** loaded with their exact approved GLBs and real animation/emission samples. Runtime values matched the current approved local source for all **258 profiles, 570 ability occurrences and 114 recipes**, including complete ability contracts, weapon/cone mirrors, targeting and sustained Base DPS.

Controlled comparisons covered **9,288 before/after profile battle cases**, with nine scenarios and support on/off. Separate equal-budget comparisons covered **180 pairs / 360 actual army cases**, with finite-HP targets, nonoverlapping repeated armies and paid support. The synthetic billion-HP profile arenas can amplify instant Execution; raw profile damage is not a universal ranking. Repeated army fixtures do not establish acquisition probability.

There were **96 legal full campaign attempts**: eight seeds, two fixed imperfect policies, three factions and baseline/current rules. They performed 290 crafts and 174 paid reservations without injected resources or forced draws. Mean completed waves in this bot cohort were:

| Faction | FR-002 baseline | FR-003 revision 2 |
| --- | ---: | ---: |
| Human | 14.5 | 14.5 |
| Dwarves | 13.0625 | 14.0625 |
| Elves | 14.25 | 14.3125 |

All attempts ended naturally; the bot completed at most 27 waves and won no 50-wave campaign. Only reached sections were evaluated. These results do not certify player win rates, late-campaign balance, no-TOP completion or equal faction difficulty. Paired seeds do not force identical later drafts when combat consumes RNG differently. No further numeric retuning is included.

Lady Claire passed **66 real eligibility/acquisition checks**, including natural unforced draft seeds, invalid identities and returned reserves. These controlled acquisition fixtures do not claim full played-wave survival or an observed player acquisition rate.

Browser and physical iPad verification remain explicitly waived by the user. No new browser or device verification is claimed.

## Local handoff and recovery

The one English design gallery remains local only at `http://127.0.0.1:59544/`. It maintains the current approved data in place, with no archived gallery versions, comparison copies or version controls. Approved original artwork, prompts, appearance decisions, voices, review storage and local model files retain their separate identities. Approval-time evidence remains separate from implementation and publication records.

The default runtime, exact CI/deployment checks, public files, statistics deployment and local-only gallery metadata are recorded under `output/releases/v0.6.6/`. The existing `v0.6.5` tag remains the previous working game backup.
