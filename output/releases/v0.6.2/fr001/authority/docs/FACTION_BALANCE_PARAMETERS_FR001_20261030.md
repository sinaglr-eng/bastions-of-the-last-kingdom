# FR 001 Tested faction balance parameters

Date: 30 October 2026. Status: **user-approved numeric set for FR-001; implementation deferred to another chat; no game implementation or publication**. Human is the fixed reference. This addendum specifies the approved 492-field set alongside the approved 18 recipe changes and unchanged Lady Claire contract.

The recommendation brings Elves substantially closer to Human in early and middle campaign tests and improves Dwarf recruitment and air response. It preserves faction mechanics and role tradeoffs. These results support the proposed parameters; they do not establish equal human-player win rates or certify the entire 50-wave campaign.

## Numeric approval

The user explicitly approved this exact tested set on 30 October 2026. The [approval receipt](../output/design/faction-balance-fr001-20261030/approval.json) records the instruction and the four frozen input hashes. The approval covers 492 deltas across 85 Elf and 48 Dwarf profiles, including nine descriptive expected-DPS corrections. Original test records retain their collection-time proposal labels as historical evidence. The approved values are part of FR-001; full-campaign parity remains a separate verification condition.

## Scope and immutable reference

- **Human:** no parameter, ability, recipe, enemy, economy or model change. Runtime Human data is deeply equal before and after the candidate overlay.
- **Elves:** role-specific numeric changes across all 48 draft ranks and 37 ordinary champion profiles. Lady Claire is excluded. Attacks, intervals, range, existing ability damage and selected existing armor-reduction values change; damage types, ground-only restrictions, target caps, cone angles, proc chances, immunity windows and mechanic flags do not.
- **Dwarves:** targeted changes to the eight basic families and their 48 ranks. All 37 ordinary champions and Lady Claire remain unchanged. The emphasis is early damage, ranged exposure, Musketeer reload and Griffin anti-air bonuses.
- **Other systems:** mastery, draft family weights, rank-VI merge eligibility, starting resources, enemies, waves, approved recipes, artwork, models and voices remain unchanged.

All numeric comparison arms use the same approved FR-001 recipes. The comparison therefore measures parameter tuning rather than mixing recipe and combat changes. Production and gallery sources remain unchanged across 475 inspected files.

## Approved Elf parameters

### Recruits and opening champions

| Defender | Damage | Attack interval in seconds | Range |
| --- | --- | --- | --- |
| Emerald Elf I | 9.5 → 16 | 1.1 → 1 | 2.5 |
| Elven Ranger I | 6 → 9 | 0.85 → 0.35 | 4.5 |
| Stormspear I | 11 → 18 | 1.1 → 1 | 4 → 4.75 |
| Lunar Spirit Shaman I | 5 → 6 | 1.1 → 1 | 3.5 → 4.5 |
| Nightweaver Spider I | 8 → 9 | 1.15 → 0.75 | 4 → 4.75 |
| Moonblade Assassin I | 12 → 20 | 1 → 0.9 | 2.5 |
| Elven Priestess I | 8 → 14 | 1 | 3.5 → 4.5 |
| Dragon Keeper I | 9 → 10 | 1.15 → 1 | 4 → 4.5 |
| Emerald Sentry | 45 → 90 | 1 → 0.95 | 3 → 3.25 |
| Stormspear Initiate | 64 → 110 | 1 → 0.9 | 4.25 → 5 |
| Drow Wraithcaller | 32 → 100 | 1.1 → 1 | 3.75 → 4.75 |

Shorter intervals mean faster attacks. These are representative rank-I values and entry champions; [the complete profile ledger](../output/design/faction-balance-fr001-20261030/profile-values.md) specifies every rank and champion.

The changes address specific deficits:

1. Elven Ranger becomes a frequent projectile attacker comparable to the Human Archer role, with Elf range retained. Damage and cadence are considered together to avoid treating a slower, larger arrow as equivalent on low-HP targets.
2. Stormspear receives more useful primary attacks, range and existing lightning damage. Priestess and Dragon Keeper damage abilities scale with their intended roles rather than receiving the same multiplier.
3. Nightweaver Spider prepares armor more effectively. Existing armor reduction progresses through **2, 4, 8, 16, 32 and 64** across ranks I–VI. This helps the whole army against armor without granting a new damage type or immunity bypass.
4. Shaman stays a utility and immunity-support defender. Her finite immunity windows and cooldowns remain fixed; she is not converted into a principal damage dealer.
5. Drow Wraithcaller receives a stronger attack and reach because the existing mixed I and II recipe had unusually low keeper value. Ordinary recipe inputs remain unchanged.
6. Rank VI uses individual role comparisons with Human rather than one common multiplier. Its rarity and fresh-V merge requirements remain intact. The full cycle, critical, chain, cleave, poison and support kit matters when comparing ranks.

### Advanced and TOP champions

| Defender | Damage | Attack interval in seconds | Range |
| --- | --- | --- | --- |
| Ironbark Ent | 230 → 1250 | 1 → 0.85 | 3.5 → 4.25 |
| Moonlight Ranger Warden | 95 → 900 | 0.85 → 0.6 | 5 → 6.5 |
| Thunder Phoenix | 300 → 1800 | 1 → 0.7 | 4.75 → 6.5 |
| Tempest Phoenix | 960 → 7200 | 1 → 0.4 | 5 → 7.5 |
| Stormwing Phoenix Rider | 336 → 2000 | 1 → 0.75 | 4.75 → 6.5 |
| Moonlight Eagle Rider | 450 → 2600 | 0.85 → 0.6 | 5.5 → 7.5 |
| Moonshadow Huntress | 107 → 1300 | 0.85 → 0.65 | 5 → 6.75 |
| Elven Battlemage Master | 700 → 4200 | 1 → 0.65 | 4.5 → 6.75 |
| Ancient Dragon Patriarch | 0 | 0 | 4.5 → 6 |

Some increases are large because the prior fixed champion values were far below Human champions at similar recipe complexity. They are checked against actual combat and existing Human single-target and area roles, not selected from a uniform faction factor.

Moonlight Eagle Rider keeps its ten-target identity and receives **16 armor reduction**, while the five-target Moonshadow Huntress receives **32**. Concentrating the stronger armor preparation on the narrower specialist avoids combining the ten-target Eagle with excessive armor removal. The ordinary Physical flying-counter routes become useful against Magical immunity; Magical Phoenixes retain that natural weakness.

Continuous Dragon attacks require their explicit cone DPS and range projections to change together. The full patch includes those numeric mirrors. No cone angle, target count or attack mechanism is enlarged.

## Approved Dwarf changes

| Defender | Damage | Attack interval in seconds | Range |
| --- | --- | --- | --- |
| Shieldguard I | 8 → 18 | 0.9 | 2.5 |
| Musketeer I | 12 → 20 | 0.4 | 4.5 → 5 |
| Runesmith I | 5 → 7 | 1.1 | 3.5 → 4.25 |
| Boar Rider I | 11 → 20 | 1.3 → 1.2 | 2.75 |
| Grenadier I | 9 → 14 | 1.4 → 1.2 | 4.5 → 4.75 |
| Dwarf Miner I | 5 → 7 | 0.8 | 3.75 → 4.25 |
| Griffin Handler I | 7 → 11 | 1 → 0.9 | 4.5 → 5.25 |
| Blacksmith I | 7 → 10 | 1.2 → 1.1 | 3.5 → 4 |

For Musketeer, the interval column is the cadence within a magazine. Rank I–III reload becomes **1.2 seconds instead of 2.4**; rank IV uses 1.8 seconds and V–VI use 2.0 seconds. The three-round magazine and shot interval remain unchanged. Displayed cycle duration and sustained DPS are updated with the weapon fields, so the proposal does not compare only the first burst.

Griffin Handler receives range **5.25** and existing Sky Hunt bonuses **50%, 50%, 60%, 60%, 75%, 75%** by rank. These support air response. Runesmith keeps the existing finite Physical-immunity counter; the proposal does not erase the faction's immunity specialization.

All ordinary Dwarf champion values stay fixed. Master Sniper and other TOP routes already show strong performance in their intended matchups. Further blanket damage increases would also amplify the faction's already strong matchups against Magical immunity.

## Results of the combined recommended set

### Held-out legal campaigns

An initial eight-seed comparison informed the first candidate. The recommended set then ran on **16 separate starting seeds**, never used to select early parameter values, across five numeric datasets: **80 campaigns**. Each arm uses identical approved recipes. The final late-champion revision was selected using role and encounter fixtures, and the complete held-out set was rerun with its final frozen bytes.

| Dataset | Runs | Mean completed waves | Median | Range | Wins |
| --- | --- | --- | --- | --- | --- |
| Human reference | 16 | 13.25 | 12 | 9–20 | 0 |
| Dwarves before tuning | 16 | 10 | 9.5 | 9–12 | 0 |
| Dwarves proposed | 16 | 11.375 | 11 | 9–14 | 0 |
| Elves before tuning | 16 | 8.875 | 9 | 8–11 | 0 |
| Elves proposed | 16 | 12.625 | 13 | 9–16 | 0 |

Elves improve from 8.875 to 12.625 mean completed waves, compared with Human 13.25. Dwarves improve from 10 to 11.375. These are meaningful policy improvements, not guarantees that a particular player will finish a campaign.

The harness uses the actual Game, real seeded drafts, legal shared foundations, actual keeps, fresh merges and engine-authorized recipes. It grants no extra resources, ranks, lives or kills. The deterministic policy uses route exposure, support and whole weapon cycles. It does not use reroll, reserve, move or downgrade and is not an optimized player. Combat shares the draft RNG, so paired starting seeds do not produce identical later inventories after actions diverge.

No arm won the campaign. The new Elf arm reached at most wave 17 and the Dwarf arm at most wave 15, so these campaigns validate the opening and middle progression, not late Advanced/TOP acquisition or final victory. Higher-rank capability is examined separately in controlled fixtures.

### Independent combat matrix

The combined frozen recommendation passed **5,160 individual profile scenarios and 240 army scenarios**, for **5,400 scenarios** in the final comparison. All five datasets were tested against 12 actual wave kits with finite state. Human is included once, and both new factions have before and candidate arms.

Representative effective HP damage per second from eight-family armies on eight distinct tiles:

| Fixture | Human | Dwarves before | Dwarves proposed | Elves before | Elves proposed |
| --- | --- | --- | --- | --- | --- |
| Rank III against flying wave 5 | 306.63 | 171.93 | 249.02 | 139.03 | 266.2 |
| Rank V against armored wave 22 | 1018.15 | 793.76 | 947.98 | 339.96 | 858.42 |
| Rank V against Physical immunity | 1099.66 | 565.27 | 563.78 | 523.3 | 1111.55 |
| Rank V against flying Magical immunity | 609.35 | 1031.18 | 1345.68 | 218.83 | 601.47 |

The stationary enemies retain real HP, armor, immunity, evasion, regeneration and shell values. Three targets respawn after death. The fixture isolates exposure and capability; it is not a legal acquired campaign army or uncapped raw DPS. Different ranges, aura reach and overkill still affect effective damage. Low-HP first-wave ratios are not used to tune high ranks.

The Dwarf advantage against late Magical-immune air is intentionally preserved. A uniform requirement that every faction match Human in every encounter would erase useful faction differences. The remaining weaker Dwarf Physical-immunity result must be read alongside working Runesmith support and ordinary champion counters.

### Moving waves and late-role stress checks

Additional Dwarf moving-wave fixtures use actual Game combat and distinct legal source foundations. With an injected all-rank-I eight-family army, the flying wave-5 kit changes from two kills and seven leaks to eight kills and one leak; Human kills all nine. A rank-III Dwarf army kills the first boss in 55.8 seconds versus Human 55.7, while the prior Dwarf army leaks it. These fixtures test movement and exposure, not legal acquisition of eight defenders by wave 5.

The late Elf V3 study contains **484 focused cases** across baseline, candidate and Human references. It tests all three final-boss variants, single targets, three targets and ten high-HP target copies. Selected results are:

| Fixture | Proposed Elf result | Human reference |
| --- | --- | --- |
| Thunder Phoenix, default single boss effective DPS | 927.57 | Kingslayer 900.95 |
| Tempest Phoenix, default single boss effective DPS | 8,439.02 | Tempest Sovereign 10,632.69 |
| Tempest Phoenix, ten high-HP boss-copy stress DPS | 11,848.74 | Tempest Sovereign 31,898.07 |
| Eagle, Magical-immune boss HP damage in 60 seconds | 179,424.65 | King 446,155.71 |
| Huntress, Magical-immune boss HP damage in 60 seconds | 168,412.86 | King 446,155.71 |

Thunder Phoenix has abstract ingredient complexity 35 versus Kingslayer 36. Eagle has 108 versus Tempest Sovereign 98; other comparisons also differ in role and acquisition. These weights are not expected draw counts. A ten-boss-copy cluster is an explicit area stress test, not an authored campaign wave. The comparisons provide no evidence of an excessive new Tempest area ceiling relative to its Human reference, while single-boss performance and ordinary Physical counter options improve substantially.

The boss tests use MVP level 0 and distinguish nonadjacent Shaman support, finite breach windows and the boss shell. They do not establish that a specific legally acquired army can defeat the boss during real flight exposure. Claire remains optional and unchanged.

## Exact implementation inputs

The selected recommendation contains **492 numeric field deltas across 133 profiles**: 85 Elf profiles and 48 Dwarf profiles. Nine deltas regenerate descriptive expected-DPS projections rather than changing combat. Human and shared Claire have zero changes.

- [Complete machine-readable changes with source paths and reasons](../output/design/faction-balance-fr001-20261030/numeric-changes.json).
- [Readable values for every profile](../output/design/faction-balance-fr001-20261030/profile-values.md) and [CSV](../output/design/faction-balance-fr001-20261030/profile-values.csv).
- [Frozen recommended patch manifest](../output/design/faction-balance-fr001-20261030/iterations/recommended/patch-set.json).
- [Human and source preservation verification](../output/design/faction-balance-fr001-20261030/parameter-verification.json).

Each change identifies faction, stable unit ID, rank, existing numeric path, before value and after value. Validate the before values against the current registry rather than replacing unrelated work. These patches are a numeric specification; the test loader is not a production dependency.

Implementation must also regenerate English ability descriptions and consistent faction-local ability-level identities. Do not rewrite a shared Human ability definition to describe a new Elf value. The nine stale critical expected-DPS fields are already corrected in the selected derived patch; weapon-cycle and continuous-attack numeric mirrors are included. Keep canonical original prompts, artwork, approval records and old combat revisions as historical evidence.

## Remaining release checks

1. Apply the approved FR-001 recipe deltas and the selected numeric set in the implementing chat; preserve all unrelated current work.
2. Prove Human, shared Claire, enemies, waves, economy, draft odds, targeting rules and existing model/voice bindings are unchanged. Re-run the 66 Claire eligibility cases and 1–3 recipe coverage checks on the implemented data.
3. Synchronize every displayed numeric ability description and derived statistic with the changed combat fields, including reload-cycle values and continuous attack DPS.
4. Validate the actual shipped data with engine regressions, UI/build checks and selected device play. Keep the gallery local only.
5. Exercise practical ordinary, non-Secret late armies through actual movement and acquisition, including all three final-boss variants. No legal full-campaign win is established by this candidate, and the high-rank fixture results must not be presented as one.
6. Give the implemented recipe and numeric revision its own ruleset and statistics attribution. Preserve the old 0.6.0 cohort and all earlier evidence.

The numeric set is approved for future implementation as part of FR-001. Full-campaign balance remains a separate verification condition. These approved values are not active in the game yet.

## Evidence

- [Combined campaign outcomes and method](../output/design/faction-balance-fr001-20261030/campaign/recommended-holdout/summary.json).
- [Combined profile and army matrix](../output/design/faction-balance-fr001-20261030/benchmarks/recommended/results.json).
- [Early Elf roles and focused fixtures](../output/design/faction-balance-fr001-20261030/elf-early/FINDINGS.md).
- [Advanced and TOP Elf comparisons](../output/design/faction-balance-fr001-20261030/elf-late/FINDINGS.md).
- [Dwarf cycle, range and moving-wave results](../output/design/faction-balance-fr001-20261030/dwarf/FINDINGS.md).

The [pre-addendum FR-001 document](../output/design/faction-balance-fr001-20261030/baseline/fr001-before-parameters.md) and earlier candidate iterations are preserved. Final result files identify the exact recommended patch hashes; reproductions after implementation must write new evidence rather than overwrite these baselines.
