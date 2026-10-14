# Bastions of the Last Kingdom

## CURRENT GAME RULES — verified baseline, 2026-10-13

**Status: CURRENTLY IMPLEMENTED.** Audit of the current working tree, package version 0.3.27. This section supersedes conflicting descriptions in the historical material below. Existing local modifications were included in the inspection; this is not a claim about a committed or deployed build. Only documentation was changed for this audit.

### Source of truth and architecture

`game/main.js` constructs playable data through `campaignTowers`, `campaignRecipes`, `campaignEnemies` and `campaignWaves` in `game/core/campaign-roster.js`. Reading raw JSON alone gives an incorrect current roster, names and several combat values. The eight basic families have 48 rank profiles; the playable campaign has 37 ordinary champions and one Secret champion (Lady Claire), for **86 playable profiles and 38 recipes**. Historical JSON also contains the retired allied Lord Bernhard; the adapter excludes him and names the final enemy boss Lord Bernhard.

`Game` owns phase transitions and legal actions. `GridManager` owns occupancy and cardinal BFS; `DraftManager` owns seeded draws and reserve identity; `EconomyManager` owns gold/XP/mastery; `CommandPoints` owns tactical spending; `CombatManager` owns spawning, targeting, projectiles, statuses and damage; `MvpManager` owns actual damage attribution and wave awards. UI and Three.js rendering subscribe to game events. Profile persistence and the optional statistics backend are separate from battlefield state. Combat details are maintained in [COMBAT_RULES.md](docs/COMBAT_RULES.md); tactical draft rules in [CONTROLLED_RNG.md](docs/CONTROLLED_RNG.md).

### Core loop and player decisions

Choose the 50-wave campaign or 10-wave skirmish. A new run starts directly in construction, with 30 keep health, 90 gold and 3 Command Points (CP). Place five candidates, inspect the upcoming wave, then keep one, merge eligible defenders or craft an exact recipe. Placement reveals family/rank only after its tile is committed. Unchosen candidates and consumed ingredients become walls. A reserved candidate is an exception: it remains an inactive blocker and returns in the next draft. Choose when to reroll, reserve, move, downgrade, demolish walls, commit ingredients, and start the wave. Combat is automatic; targeting priority, individual attack pause, global pause and speed controls remain player choices. A survived wave grants rewards/MVP growth and immediately opens the next construction round.

Phases are `build → select → ready → combat → build`, with a transient `reward` phase before automatic `nextRound()`. Final states are `won` and `lost`. Combining only retained ingredients need not resolve the current draft; consuming a current candidate resolves that round's keeper decision.

### Map, placement and movement

The open board is 37 × 37. Ordered zero-based waypoints are (0,4), (4,18), (32,18), (32,4), (18,4), (18,32), (36,32). Ground enemies follow the concatenated cardinal shortest paths through all waypoints. Flying enemies move directly between the same waypoints and ignore walls. Crossings do not cause leaks. The unobstructed ground route is 120 steps; detours increase exposure only where defenders can reach enemies.

Each active defender, candidate, reserve and wall occupies one blocked cell. Checkpoints, entrance and exit cannot be built on; a placement must preserve every route segment. Invalid placements consume no draw RNG. Free wall demolition is available between waves; retained defenders cannot be freely sold or demolished. The planner/editor provides suggested and custom structures without spending currency or draws. Its exposure comparisons are geometric estimates, not damage forecasts. Five draft slots per round imply a nominal 250-slot campaign budget or 50-slot skirmish budget; a carried reserve fills one slot without a new foundation. Demolition does not refund spent draw slots.

### Draft, combinations and randomness

Each of eight basic families has equal weight, so an ordinary family roll has 12.5% probability. Rank probabilities use the mastery row frozen at round start. Mastery index is floor(min(round−1,24) × 15 / 24); round 1 rolls only rank I, round 25 onward rolls I–V at 4%, 18%, 27%, 31%, 20%. Rank VI is merge-only. There is no unrestricted shop or paid champion upgrade.

Lower-rank merges require two identical family/rank candidates in the completed current draft. **Rank V exception:** two same-family retained V defenders can merge to VI between waves; mixing a retained V and a current V requires a completed draft. VI cannot merge upward. The selected foundation/identity holds the result; the other becomes a wall. Recipes require three distinct actual defenders at exact family/rank, including crafted champions when specified. All 38 live recipe level requirements are 1, so Kingdom XP currently adds no later recipe gate. Ordinary recipes can use retained ingredients between waves. Lady Claire requires the exact three current-round candidates after all five slots are placed; her special eligibility is enforced through actual draw identities and reserve constraints.

Reroll costs 1 CP, once per completed draft, and changes random candidates on their existing foundations. A returning reserve is protected. Reserve costs 1 CP, one candidate per draft, disables subsequent reroll and carries that identity/rank at its fixed position to next round's slot 1. It cannot attack, support, detect, move, be demolished or satisfy recipes while reserved. Move costs 2 CP and exchanges a retained defender with an existing wall between waves; occupied cells and the exact route remain unchanged. Invalid/cancelled moves spend nothing. Each boss killed grants 5 CP once; a leaking boss grants none.

Seeded game RNG drives draft rolls, individual enemy variants and combat chances. Rendering a preview does not roll variants. Audio randomness is separate. A seed alone does not establish identical outcomes across different player actions or frame schedules.

### Combat and current defender roles

Soldier is short-range ground-only melee; Archer is rapid single-target Physical; Druid applies Magical poison stacks; Mage deals Magical attacks and secondary cleave; Cleric is Holy damage plus haste/detection; Engineer applies armor reduction; Frost Warden deals Physical damage and movement slow; Stormcaller deals Magical attacks against up to three distinct targets. Champions deepen these roles through multi-target attacks, damage auras, criticals, support, armor reduction, healing block and conditional effects. Current names and overrides come from the campaign adapter, not historical display names.

Targets must be visible and within Euclidean range; melee excludes flying targets and rechecks range at impact. Priorities are first/last by fractional route progress, strongest/weakest by current HP, and fastest/slowest by base speed. Druid and Engineer preferentially spread their status, accounting for incoming shots; they may wait for pending applications before normal repeated targeting. Projectiles apply damage on arrival; melee windup is 0.14 seconds. Cooldown overshoot is retained for fast attackers.

Only Physical, Magical and Holy are defense classes. Effective armor is max(0, base + reactive armor − strongest flat shred) × (1 − strongest MVP reduction) × (1 − penetration). **All three** deal damage × 30 / (30 + effective armor). Holy bypasses damage immunity but still respects armor, evasion, hit shields and direct-hit Shell. Direct resolution order is evasion, shield, damage bonuses/armor/immunity, Shell. True Strike prevents evasion only. Live elemental resistances and former Pure defense bypass are removed.

Physical immunity also blocks slow/freeze; Magical immunity blocks poison, burn and healing block, including companion effects from Holy sources. Golem petrification is an explicit separate exception. Each successful damaging poison hit adds an independent five-combat-second stack with its own owner and expiry. Burn is strongest-only. DOT and non-direct damage bypass direct-hit evasion/shields/Shell but retain armor and immunity. Flat armor reduction and slows use strongest effects. Boss slow strength is halved. Standard haste takes the strongest blessing; Archbishop's separate blessing adds once. Support includes its own source.

MVP: each survived wave awards one level to the uncapped active defender with greatest actual HP removed, excluding overkill. Ties prefer higher existing MVP, then lower identity. Cap 10; +10% own damage per level; strongest 1% armor reduction per level within two tiles; level 10 grants other allies within two tiles +75% damage. Own/foreign MVP bonuses add, then ordinary damage support multiplies. Merges and recipes inherit maximum ingredient MVP, not the sum. Per-defender pause stops new attacks/offensive auras but preserves existing shots, DOT, support/detection and MVP auras. Global pause freezes combat clocks.

### Important balance values

Unbuffed direct values below exclude defense, poison, multi-target multiplication, auras, MVP and secondary effects.

| Basic family | Rank I damage / interval / range | Rank VI damage / interval / range | Key utility |
| --- | --- | --- | --- |
| Soldier | 22.5 / 1s / 2.5 | 882 / 0.7s / 2.5 | Ground-only melee |
| Archer | 6 / 0.25s / 4 | 100.8 / 0.1s / 5 | Rapid hits |
| Druid | 6 / 1s / 5 | 36 / 1s / 5 | 6 / 384 poison DPS per stack |
| Mage | 12 / 1s / 5 | 450 / 1s / 5 | 30% / 100% Magical cleave |
| Cleric | 3 / 1s / 5 | 18 / 1s / 5 | +20% / +70% standard haste |
| Engineer | 6 / 0.6s / 5 | 210 / 0.6s / 5 | −2 / −64 armor for 4s |
| Frost Warden | 6 / 1s / 6 | 108 / 0.6s / 6 | 12% / 55% slow for 3s |
| Stormcaller | 9 / 1.3s / 6 | 174 / 0.6s / 12 | Up to three targets |

Full I–VI authored profiles live in `data/towers.json`, interpreted through the campaign adapter and `towerStats`. Champion values also require adapter overrides. High Priest +100% standard haste plus Archbishop +500% separate haste produces ×7 attack rate; Archbishop damage support is ×2. Mother Nature has 9,492 damage/0.5s, range 13 and 1,898.4 poison DPS per stack before support/MVP/defenses. Lady Claire's damage is Holy, sequential chain damage is 250, and Melancholy is disabled.

### Enemies, waves and difficulty

There are 50 sequential authored warbands, one enemy group per wave, with bosses at 10/20/30/40/50. Later threats combine flight, immunity variants, cloak, evasion, shields, disarm, Dread, healing, reactive armor, blink, Shell, rush, theft and haste. Bosses 10/20 are ground; 30/40/50 fly. Regular leaks cost 1 health and these bosses cost 10. Boss death is not mandatory for wave completion: any positive-health run proceeds when no live or queued enemies remain.

| Wave | Count | HP each (base live profile) | Armor | Speed | Spawn interval |
| --- | ---: | ---: | ---: | ---: | ---: |
| 1 | 8 | 9 | 0 | 1.3 | 2.4s |
| 2 | 8 | 52 | 1 | 2.21 | 0.6s |
| 3 | 9 | 68 | 8 | 2.37 | 0.6s |
| 10 | 1 | 4,226 | 14 | 1.65 | 1s |
| 20 | 1 | 25,079 | 22 | 1.65 | 1s |
| 30 | 1 | 118,139 | 20 | 1.65 | 1s |
| 40 | 1 | 440,770 | 26 | 1.65 | 1s |
| 50 | 1 | 1,460,171 | 33 | 1.65 | 1s |

Live tuning: evasion 25% against all direct classes; shields have three charges, refill 2s after depletion; recharge heals 50% missing HP every 4s; regeneration 20% maximum HP/s, or 40% for the wave-38 Blood-Leech variant; reactive armor +8/contact up to 15 stacks, decaying 0.7 stacks/s; blink advances six route tiles every 5s. Shell begins at 100 on wave 39 and increases 10/wave, reaching 210 on wave 50 or 273 for its stronger variant. Dread applies −75% attack speed for 3s to the defender that actually damages its bearer, refreshed by later damage. Disarm lasts 5s in each staggered 8s cycle within three tiles. Cloaked enemies need detection/proximity; basic Cleric detection reaches six tiles.

### Economy, rewards, progression and end states

Kills award enemy XP and score, never gold. XP level is 1 + floor(XP/90); it is separate from automatic construction mastery. A survived ordinary/boss wave grants 50/200 gold and 15 XP even if enemies leaked. Gold currently funds only the 200-gold one-rank downgrade-and-immediate-keep action on a basic current candidate above I. No health purchase, paid mastery or paid champion enhancement is active. Master Ranger retains a 1% successful-hit recovery proc, capped at starting health.

Normal kill score is 10 × wave; boss kill is 500 × wave; survival gives 100 × wave and boss-wave survival another 200 × wave. Win means finishing the selected final wave with positive keep health, including possible surviving boss leaks. Lose means keep health reaches zero. Final victory still receives survival gold/XP and MVP. A new run resets battlefield, tactical resources and run growth. Long-term profile progression is discoveries, wins, best wave, scores and history; no persistent combat-stat purchase was found.

### UX, onboarding, saves and telemetry

The battlefield is the primary screen with five draft cards, selected-unit inspection, rank comparison, combination hints, recipe guide/pinning, maze planner/editor and enemy wave guide. Immediate wave intelligence includes actual HP/count/armor/abilities and possible variants; later forecasts reveal progressively less. Army WEAK/FAIR/GOOD/STRONG labels evaluate composition, own MVP and self-support, not placement, coverage, maze length or allied aura overlap. Live DPS counts actual HP removed and is not base damage/interval.

The seven-step optional tutorial covers placement, keeper, maze, economy, recipes, threat intelligence and starting combat. It omits dedicated CP/MVP instruction and still describes XP as recipe unlocking despite all current recipes requiring level 1. Double-click/double-tap can commit a keeper. Touch tap places/selects, one-finger drag pans, two fingers rotate/zoom. Global speed handler cycles 1×/2×/3×; global pause and individual attack pause have different effects. Result UI offers optional named leaderboard submission, Top 10 and own rank, separated by version and campaign.

`save.js` stores browser-local preferences, discoveries, scores and run history, with a separate score archive and version/mode attribution. Maze plans persist separately. **No battlefield save/resume is implemented.** Leaving/restarting records a run, not a restorable board. TIME counts real time including construction and pauses. Existing statistics code already captures run checkpoints, draws, choices, wave outcomes and defender contributions; actual service availability, data completeness and production cohorts were not verified. Developer Console activation excludes the run from legitimate statistics/awards.

### Verification and limits

Inspected actual source and adapters, data, tutorial/UI integration, combat/CP documentation and automated tooling. Ran nine existing focused test files: **92 tests passed, 0 failed** (core, controlled RNG game/draft, command movement, combat overhaul, MVP, mastery, opening waves, rank/recipes). Repository contains 162 `*.test.mjs` files; the complete suite/build and hands-on desktop/mobile playtests were not run in this audit. Tests establish rules, not fun or campaign win rates.

`tools/balance.mjs` already supports seeded probability checks, base stat exports and a three-seed greedy campaign bot. It loads raw historical JSON without the playable campaign adapters, so its current outputs are not authoritative live-campaign balance evidence. It also writes artifacts; it was inspected, not executed. Existing tests offer deterministic scenarios without creating a new simulation system.

### Current identity — analytical interpretation, not a newly approved specification

Core fantasy: command the kingdom's defenders against escalating warbands. Core hook: revealed-after-placement random recruits become both the army and the maze, while exact recipes transform accumulated units. Strategic pillars: route/exposure design, draft adaptation with scarce CP, recipe investment, and mixed damage/control/support composition. Player promise inferred from mechanics: turn imperfect recruits and permanent foundations into a stronger defense. Whether players experience that promise needs playtesting.

## Design decisions and discussion register

Operating mode: **DESIGN / ANALYSIS**. Design approval authorizes documentation only. Gameplay, UI, balance, configuration and production assets require explicit implementation instruction.

Workflow clarified by the user on 2026-10-13: this chat records and refines requirements only, including instructions phrased as "add" or "change". Record accepted requirements as **APPROVED DESIGN — NOT IMPLEMENTED**. The user will separately authorize implementation of the collected requirements in the chat **Master verze hry**. Do not implement changes or message that chat from here; the shared document is the handoff specification.

Current implementation delivery, October 13, 2026: **D006 R01–R10 implemented in 0.3.29**, with repeated phase, catalog, results, five-size browser and 150% text checks recorded in [the implementation report](docs/PHASE_UI_D006_IMPLEMENTATION_20261013.md). Earlier D002–D005 retain their scoped 0.3.28 delivery evidence. **D001 analysis has resumed at the user's request**, with a no-TOP completion benchmark and required Physical + Magical damage; [current audit](docs/D001_NO_TOP_BALANCE_AUDIT_20261013.md). Numerical/mechanical proposals remain unapproved, and actual implementation still requires separate authorization in Master verze hry.

States: **CURRENTLY IMPLEMENTED**, **PROPOSED — NOT APPROVED**, **APPROVED DESIGN — NOT IMPLEMENTED**, **APPROVED DESIGN — IMPLEMENTED**, **REJECTED**, **DEPRECATED**. The baseline above records verified implementation, not new approval. Historical documents contain prior approval claims; this audit does not retroactively approve undocumented changes. Latest accepted requirements are recorded below, separately from the baseline and proposed backlog.

For future approved decisions, record: ID, System, exact Decision/Rules, Balance Values, Reasoning, Status, Dependencies, Risks/Notes and Version/Date. Keep one latest approved specification; retain superseded history as DEPRECATED. Verify implementation separately before marking an approved decision implemented.

### Pending design backlog — all PROPOSED — NOT APPROVED

| ID | Discussion topic | Evidence / question | Technical impact if later implemented |
| --- | --- | --- | --- |
| P01 | Current-rule clarity and onboarding | Historical GDD conflicts with runtime; tutorial omits CP/MVP and implies nonexistent recipe XP locks. Which rules must players understand first? | LOW–MEDIUM: tutorial, help, guide copy |
| P02 | Early-wave fairness and placement literacy | Wave 2 total base HP is 416 versus wave 1's 72, while spawn interval drops from 2.4s to 0.6s. Measure novice leaks and understanding across draft seeds. | MEDIUM: waves, preview, onboarding |
| P03 | Support/poison/MVP balance | ×7 haste, ×2 support damage, independent poison stacks and damage-based MVP may concentrate power. Compare full setups including acquisition cost, uptime, armor and immunity. | MEDIUM–HIGH: combat, roster, readiness |
| P04 | Flying boss exposure and viable counter paths | Ground maze investment does not lengthen flying routes; late bosses combine large HP, Shell and variants. Test reachable army compositions before asserting unfairness. | MEDIUM: wave/roster/preview balance |
| P05 | CP decision quality and gold usefulness | CP is boss-kill dependent; gold has one spending action. Are reserve/move/reroll meaningful alternatives, and does unused gold confuse players? | MEDIUM: economy, draft UI, statistics |
| P06 | Mobile sessions and loss explanation | 37 × 37 precision, nested recipe information, double-tap commitment and no resume need observed device playtests. Do players know why they leaked? | MEDIUM–HIGH depending on chosen design |

These are analysis topics, not approved mechanics or implementation tasks. No new currency, feature or telemetry system is authorized by listing them.

P03 analysis, 2026-10-13: [Support, poison and MVP balance](docs/SUPPORT_POISON_MVP_ANALYSIS.md) records current runtime calculations, one-off combat probes, recipe costs and candidate adjustments. All adjustments remain **PROPOSED — NOT APPROVED**; none were implemented.

### D001 — Campaign fairness and distinct variants, 2026-10-13

- System: enemy waves, variant design, defender balance and campaign progression.
- Decision: the campaign must be completable but challenging, with multiple viable combinations rather than a single mandatory army. Enemy alternatives within the same wave must have different gameplay properties; visual/name changes alone do not satisfy this requirement.
- Rules: evaluate every actual variant after runtime inheritance/overrides, including unfavorable mixtures. The user's resumed criterion requires a combination of Physical and Magical damage; a magic-only army must not suffice, and Holy must not provide a universal substitute for both. The no-TOP audit benchmark excludes actual TOP classification, not Basic rank VI; it does not remove TOP defenders from the game. Verify multiple obtainable mixed-damage paths with complementary support and meaningful losses for inadequate choices.
- Balance values: no enemy or defender numerical changes approved; no target win rate specified.
- Reasoning: preserve meaningful adaptation, fair difficulty and replayability.
- Status: **APPROVED DESIGN — NOT IMPLEMENTED** (design acceptance criterion; compliance of current gameplay still under audit).
- Implementation scheduling: the user resumed **ANALYSIS / TESTING** on 2026-10-13. No numerical or mechanical adjustment is approved or authorized by that request. Implementation remains pending separate instruction in Master verze hry. D002–D005 are recorded as delivered; the additional D006 UI scope is implemented in 0.3.29.
- Dependencies: campaign adapters, enemy definitions, combat, draft/recipe acquisition, route coverage, preview information and playtests.
- Risks/Notes: fixture armies prove combat capability, not obtainable progression; independent seeded drafts need separate verification. Previously proposed support/poison/MVP adjustments remain **PROPOSED — NOT APPROVED**.

D001 historical audit, 2026-10-13, runtime 0.3.27: [All waves, variants and viable paths](docs/WAVE_DESIGN_AUDIT_20261013.md) records the earlier profiles and probes. Its cosmetic-only variants in waves 5/15/27/29/41 describe the pre-D002 state and are preserved as historical evidence.

D001 resumed audit, 2026-10-13, runtime 0.3.28: [No-TOP completion and balance](docs/D001_NO_TOP_BALANCE_AUDIT_20261013.md), with [recorded evidence](artifacts/d001-no-top-20261013-v1/README.md). All 50 waves / 62 profiles were covered; 911 controlled scenarios and 43 legal campaign attempts. Several distinct mixed cores clear all 27 late-wave profiles as injected combat fixtures, including cores without Kingslayer or High Priest. No legal full campaign won; best reached wave 42. This does not prove impossibility or estimate human win rate. Holy bypasses both immunities, current victory allows final-boss escape, and wave 29 still has identical forms. Candidate regeneration/Dread/Shell/acquisition/victory changes remain **PROPOSED — NOT APPROVED / NOT IMPLEMENTED**. No gameplay source or production balance value was changed.

### D002 — Evasion for every Moon Clan variant, 2026-10-13

- System: enemy variant abilities and wave intelligence.
- Decision: every Moon Clan variant must have the existing Evasion ability.
- Rules: use the current Evasion contract: **25% chance to evade a direct hit**, applying to Physical, Magical and Holy direct hits. True Strike bypasses Evasion. Already applied DOT and other non-direct damage retain their existing rules. Preserve other abilities, immunities, HP, armor, speed, spawn counts, rewards and appearance. Do not stack Evasion or increase it on a variant that already has it.
- Scope: wave 5 **Bat Scouts · Moon Clan**; wave 15 **Blood Bat Riders · Moon Clan**; wave 27 **Spectral Bat Riders · Moon Clan**; wave 28 **Goblin Scrapwings · Moon Clan**; wave 29 **Prismatic Bat Tricksters · Moon Clan**; wave 41 **Orc Crystal Phalanx · Moon Clan**. The request applies to every Moon Clan form, including wave 28, not only the five previously cosmetic pairs.
- Current implementation (0.3.28): all six Moon Clan forms have 25% Evasion. Wave 29 retains its existing value; the other five Moon Clan adapters now add it.
- Balance values: reuse the existing 25% Evasion value; no other tuning is approved.
- Reasoning: give Moon Clan forms a shared gameplay property and distinguish currently cosmetic alternatives.
- Status: **APPROVED DESIGN — IMPLEMENTED** in 0.3.28, following separate authorization in Master verze hry on 2026-10-13.
- Dependencies: playable campaign variant adapters, combat, actual spawn inheritance, enemy previews/inspection and regression checks.
- Risks/Notes: increases pressure in early waves 5/15 and combines with existing defenses later; campaign balance must be rechecked after implementation. Wave 29 remains mechanically identical because both forms already have Evasion; a separate future decision is still needed to distinguish that pair. This requirement does not approve any previous support, poison or MVP adjustment.
- Implementation verification: actual spawned Moon Clan enemies must have 25% Evasion; True Strike must bypass it; non-Moon Clan forms and archived evidence must retain their values; previews must show the added ability. These scoped checks passed; seeded combat probes are documented in the implementation report. They do not certify deferred D001 campaign completion.

### D003 — Separate Music and Sounds volume sliders, 2026-10-13

- System: audio controls and game interface.
- Decision: beneath the music/audio icon, provide two independently adjustable volume sliders labelled **Music** and **Sounds**.
- Rules: **Music** controls background music; **Sounds** controls attack sound effects. Use a percentage range of 0–100%, with the current value visible. Each slider affects only its assigned category; 0% silences that category. The defaults are initial settings, not a reset every time the panel opens. Changes should take effect while adjusting the slider, without restarting the run or track. Existing relative clip levels and music ducking should be respected beneath the category volume setting.
- Balance values: default **Music = 80%**; default **Sounds = 40%**. These are player-facing category volume percentages, not a specification to replace every individual internal gain with 0.8 or 0.4.
- Reasoning: allow the player to tune background music separately from combat attack effects.
- Status: **APPROVED DESIGN — IMPLEMENTED** in 0.3.28. The user additionally approved saving Music and Sounds between visits; Mute all remains a separate control.
- Dependencies: current audio icon/control in `game/main.js`, `AudioManager`, `RecordedMusic`, attack-effect routing, responsive UI and accessibility.
- Risks/Notes: keep sliders usable with touch and keyboard. Recorded and fallback attack effects must follow Sounds. Spoken defender lines, unrelated UI sounds and victory cues were not explicitly assigned to these two categories and must not silently receive a new volume policy. The user separately approved persistence during implementation; the panel retains a separate Mute all action.
- Implementation verification: independent controls; initial 80%/40%; silence at 0%; no cross-category volume change; live changes during playback; preserved ducking/relative mix; mobile and keyboard operation. These scoped checks passed, including native keyboard adjustment, persistence after reload and approved audio decoding.

### D004 — Visible DPS beneath Next wave, 2026-10-13

- System: battlefield overlays, construction phase and responsive interface.
- Decision: retain the measured DPS score visibly **below Next wave**, with an independently collapsible display that can become a narrow line while keeping a score and an expand control visible.
- Rules: do not remove the DPS entry from construction or replace the collapsed state with a scoreless menu button. Expanded and compact presentations must remain usable on desktop, iPad landscape and mobile landscape. Recipe inspection/pinning must not relocate the DPS entry above Next wave or hide it behind the inspector.
- Measurement: keep the existing actual peak DPS over a five-game-second window. During construction, label preserved results with their completed wave; do not confuse them with catalog base DPS, predicted damage, or new draft performance. Before the first combat, use a truthful not-measured state instead of fictional values. How much of the ranking remains in the compact line is a proposed visual detail.
- Reasoning: the user wants to monitor defender performance while planning a champion and placing the next draft.
- Status: **APPROVED DESIGN — IMPLEMENTED** in 0.3.28 after the separate implementation instruction. Original concepts remain historical evidence.
- Dependencies: Next wave/DPS overlay layout, `ui/tower-dps.js`, disclosure state and responsive construction panels.
- Risks/Notes: overlays must remain short enough to leave placement visible on low-height screens. The user's preference overrides any interpretation of UI05 that would make DPS disappear during building. D005 subsequently approves the latest dynamic visual treatment.
- Implementation verification: correct vertical order, score retained in compact mode, independent disclosure controls, truthful wave/measurement labels and reachable controls on all three device classes. These checks passed in real game tests and native browser viewport checks. Physical iPad hardware and a full campaign completion remain outside this verification.

### D005 — Dynamic champion crafting and pinned recipe UI, 2026-10-13

- System: contextual champion combinations, pinned recipe planning, construction interface and responsive battlefield overlays.
- Decision: approve the latest three dynamic UI concept boards for future implementation on desktop, iPad landscape and mobile landscape: available champion combination, pinned construction goal with expanded DPS, and the same goal with compact DPS.
- Rules: contextual exact recipe/result preview and explicit Recruit champion; visible pinned goal; Built / This round / Missing states; matching revealed recruit highlights; accurate five-slot/phase presentation; independently collapsible DPS beneath Next wave with its score retained, as required by D004. Preserve existing recipe legality, result-anchor rules, approved art and measured peak-DPS semantics.
- Balance values: none changed. Illustrated inventories, 7.0/2.9 scores, generated enemy placeholders and approximate raster proportions are examples, not runtime specifications.
- Reasoning: the user approved the new dynamic visual treatment for implementation preparation.
- Status: **APPROVED DESIGN — IMPLEMENTED** in 0.3.28 after separate authorization in Master verze hry.
- Specification: [approved implementation handoff](docs/UI_DYNAMIC_CRAFTING_APPROVED_20261013.md), including the approved scope, integration targets and acceptance requirements.
- Dependencies: recipe/inventory helpers, crafting preview and map markers, recipe browser/pinning, draft cards, Next wave/DPS disclosures and responsive styling.
- Risks/Notes: do not copy generation errors or introduce a blanket placement gate for retained-only legal combinations. Pinning and previewing are non-committing. This approval applies to the latest crafting/pinning/DPS studies; other UI audit proposals retain their independently recorded states.
- Implementation verification: exact ingredients and anchor, unchanged commitment rules, truthful ownership/draft progress, recursive allocation, DPS ordering/measurement labels, visible compact score and touch/focus operation on all three layouts. Scoped verification passed; see [implementation and verification](docs/AUDIT_IMPLEMENTATION_20261013.md).

### D006 — Complete phase-driven UI and panel transitions, 2026-10-13

- System: responsive layout, phase transitions, draft/inspection panels, map overlays, HUD, catalogs, maze planning, onboarding and results.
- Decision: record all ten areas in the user-supplied UI analysis as approved implementation requirements, extending D005 beyond crafting/pinning. The interface must change its priorities and panel sizes through Building, Choosing keeper, Ready, Combat, Paused and Run ended/review.
- Rules: low-height layout; thin combat strip and restored construction draft; combat-first defender detail hierarchy; nearby mobile inspection; compact Next wave with visible DPS below it; phase-specific HUD and advanced Developer entry; searchable compact recipes and correct runtime damage copy; compact enemy navigation/variant comparison with independent boss/count summary; maze thumbnails; contextual CP/MVP guidance and factual result/retry/read-only review.
- Precedence: preserve D004's visible measured DPS beneath Next wave, including before combat as a truthful not-measured entry. The older source's suggestion to collapse DPS does not authorize hiding its entry. Preserve delivered D003 audio/persistence behavior, existing D005 recipe legality/pinning, approved production art and game mechanics.
- Balance values: no changes approved by D006; no new enemy variant properties or campaign-completion rule is authorized for implementation. D001 testing has resumed separately, and support/poison/MVP balancing stays proposed.
- Reasoning: the user reports that implementation did not cover all intended dynamic panel changes; the earlier D005 scope and 0.3.28 report addressed only a subset of the supplied analysis.
- Status: **IMPLEMENTED in 0.3.29 — scoped verification passed**, following the explicit user implementation request in Master verze hry. Existing 0.3.28 behavior was reused and preserved. See [implementation evidence and limits](docs/PHASE_UI_D006_IMPLEMENTATION_20261013.md).
- Specification: [ten-area requirements and phase matrix](docs/UI_PHASE_DRIVEN_REQUIREMENTS_20261013.md). The original attached Czech text is preserved byte-for-byte as clearly identified historical evidence.
- Dependencies: phase state and presentation, draft/selection disclosures, HUD/menu, catalogs, existing plan data, tutorial/result flow and appropriate gameplay/UI verification.
- Risks/Notes: this record is a scope/acceptance update, not a new runtime gap audit. Do not infer that all previous D002–D005 work failed or is missing. Use runtime values instead of historical screenshot figures or generated placeholders.
- Implementation verification: all R01–R10 checks, complete repeated phase transitions and catalog/results flows on desktop, iPad/tablet and mobile portrait/landscape, with real interaction and touch/focus checks. Repeated actual gameplay phases, production touch/raycast checks, catalogs/results, five viewport classes and a temporary 150% text fixture passed. Physical iPad/Safari and comprehensive accessibility certification remain unavailable; see the report.

### UI follow-up — 22 browser comments for edition 0.3.30, 2026-10-13

- System: game dialogs/audio, construction footer/cards, recipe exploration/pinning, defender hierarchy, map overlays and combat inspectors.
- Authorization: the user separately requested implementation of the latest 22 browser comments in Master verze hry. These follow-up preferences supersede the relevant earlier D006 layout choices, without rewriting its 0.3.29 delivery history or accepting balance proposals.
- Rules: uninterrupted music/committed speech through dialogs; compact 3 × 2 odds; component/downstream recipe exploration; ingredient portraits, inline abbreviations and abilities before ingredients; allocated missing-basic pinned summaries; canonical Keep through eligible pinned map-badge double activation; equal draft portrait widths and shared action row; top-center Start; automatic Current wave view with runtime counts/defenses/abilities; toggled keeper/wave inspection; Potential combinations then Compare ranks before the single upper stats/complete abilities area; no Enemy Waves quick-jump or combined army-response section; five complete DPS rows before list scrolling; expanded immediate Next wave without contained scrolling.
- Mechanics: existing Game action legality, result foundations, draft budget, allocated ingredients, actual/preview rank separation, RNG, combat, audio categories and approved media remain authoritative. UI navigation is non-committing; keeping a pinned candidate creates no new placement.
- Status: **DELIVERED / PUBLISHED 0.3.30** from implementation commit `beb391099d5233dade1ea71bb50ca65ef7947322`; Pages CI 38459146490 passed tests/build/deployment. All 1,366 tests, five native viewport classes and the final responsive build passed. Five public compiled assets match local dist; all 113 approved MP3 hashes and HTTPS browser decodes passed. Audio continuity is verified by actual-main AudioContext tests; hidden-audio inspection and physical listening are not certified.
- Evidence: [all 22 comments and scope boundaries](docs/UI_REFINEMENTS_V30_20261013.md), final 1,366/1,366 test log and native browser proof. Focused proof sets record audio/catalog 154/154, recipes revision 3 76/76, defender preview 73/73, and pinned map input revision 2 28/28; these overlap. Native checks cover ordinary placement/Keep/Start, preview versus actual commands, recipe history/pinning, keeper/wave toggles, uniform cards/odds, full Next wave and five visible DPS entries. Public HTTPS checks at 1280 × 720 confirm recipe component/history and loaded portraits, five ordinary placements/Keep, top-center Ready Start, and Druid-II preview with actual-I commands; no runtime errors were recorded. Low landscape places Next/DPS side by side with two-column 44-pixel entries above the footer.
- Backend: the separately owned statistics service is live at edition 0.3.30, saved Sites version 11, with HTTP 200 health and preserved safe metadata for 83 run rows / 21 completed historical records. See the report for the exact comparison boundary.
- Limits: native UI checks passed at 1715 × 1244, 1180 × 820, 820 × 1180, 390 × 844 and 844 × 390 browser viewports. Physical iPad/Safari, enlarged text and comprehensive accessibility are not certified; no 150% font QA was performed in this follow-up. D001 analysis/testing remains resumed exactly as recorded above; no numerical or mechanical proposal is approved or implemented here.

### UI follow-up — 16 browser comments for edition 0.3.31, 2026-10-14

- Authorization: the user's latest sixteen comments supersede the relevant 0.3.30 presentation choices. The dated twenty-two-comment record remains historical evidence; the imported D001 resumed analysis/testing instructions remain active and are preserved unchanged.
- Ordinary commands: an accepted touch or pen release executes Start, Demolish and other ordinary commands once even if the compatibility click is missing or the pressed button was replaced. The release must hit the same logical action and full dataset, with current Game, phase, selection, foundation, move, pause and speed identities revalidated. Drag, scrolling, cancellation, capture loss, secondary/multiple pointers and stale commands reject activation; retargeted/duplicate compatibility clicks are consumed before canvas or delegated actions. Native mouse and keyboard/accessibility activation remain available. The physical Safari trigger is not established.
- Stacking: header/menu, inspector, footer and Start controls sit above optional map overviews. Expanded Next wave and DPS frames stay within map width; an overview cannot cover a visible sidebar command. Native center hit tests confirm the checked Start and Demolish targets.
- Defender and recipe UI: Potential combinations and basic-rank comparison controls are always visible above the single preview statistics/complete-abilities core. The selected-family count includes actual active defenders across ranks, including attack-paused units, and excludes candidates, reserves and walls. Holy inspector copy is concise; the complete map-effect legend lives in Help. Champion ingredients keep names, exact ranks, portraits and component links without acronym codes. Ordered Previous/Next follows the filtered recipe list without wrapping; exploration Back/Forward remains separate. Missing basics use readable spacing/multiplicity, and Engineer is displayed as E while canonical R and runtime family identifiers stay unchanged.
- Construction and measurements: Future odds is a static visible panel. Next wave and DPS start expanded and retain later disclosure choices; enemy abilities form a vertical list. Pinned ingredients are cyan, rank merges violet and champion combinations gold, with eligibility unchanged. DPS rows include actual MVP levels. **Sum peak DPS** adds independent measured defender peaks, which need not occur simultaneously; it is not a simultaneous army damage rate. The DPS list keeps five complete entries before scrolling to the sixth; short screens may also need to scroll the outer overview stack.
- Sole approved mechanical exception: explicit comment 8 changes only the wave-38 Blood-Leech Troll regeneration from **40% to 25% of actual maximum HP per second** through the campaign adapter; other regeneration profiles retain **20%**. This separate authorization does not approve any other D001 regeneration, Dread, Shell, acquisition, victory, support, poison or MVP proposal. D001 analysis/testing continues under its unchanged instructions above.
- Status and evidence: edition metadata is **0.3.31**, dated October 14, 2026. Implementation, **1,404/1,404** tests and the production build passed. See the English [sixteen-comment report](docs/UI_REFINEMENTS_V31_20261014.md) and its scoped evidence; the 9/9 production command-wiring and 71/71 combined input checks overlap the full suite.
- Native local QA: Chromium IAB single mouse clicks started a wave and demolished a selected wall. Both controls measured at least 44 pixels in each dimension with uncovered center targets at **1715 × 1244, 1180 × 820, 820 × 1180, 844 × 390 and 390 × 844**. A real six-defender wave-8 fixture displayed Sum peak DPS **514.7**; the end-of-wave MVP award reached level **3**, existing levels **7** and **5** remained visible, and five complete list rows plus scrolling to row six passed. All five rows were simultaneously onscreen at 1180 × 820; short/mobile layouts may require outer overview scrolling, and mobile overviews temporarily hide while the inspector is open. Final six Future odds cells at 844 × 390 have positive dimensions after the legacy display override. These are actual runtime fixture/layout results, not campaign-completion or human-win-rate evidence.
- Publication boundary: the **public game is pending** final deployment and HTTPS verification. The separate statistics backend is already **LIVE at 0.3.31**, with the recorded 88-row comparison, 21 completed historical records and existing leaderboards preserved within its safe metadata boundary. Physical iPad/Safari, enlarged-font QA, physical listening and comprehensive accessibility are not certified.

### UI audit backlog, 2026-10-13

[UI/UX audit](docs/UI_DESIGN_AUDIT_20261013.md) records historical source inspection and screenshots across desktop, tablet, portrait and landscape sizes. Its original proposed/not-approved labels are preserved as historical evidence. Current approvals are the scoped D003–D005 decisions and **D006's ten areas from the user-supplied summary**, mapped to related audit sections in the new specification. Audit suggestions outside that defined scope retain their prior status. The original design chat recorded requirements; the user subsequently authorized D006 implementation in Master verze hry, delivered in 0.3.29.

Visual studies: [three generated layout concepts](output/design/ui-concepts-20261013-v1/README.md) show desktop selection/audio, mobile selection and landscape combat. **PROPOSED — NOT APPROVED**; illustrative mockups only. Original prompts/revisions are preserved alongside them, and no interface was implemented.

Responsive visual suite: [nine comparison boards](output/design/ui-concepts-responsive-20261013-v1/README.md) cover UI01–UI16 across desktop, iPad landscape and mobile landscape, including D003 audio controls. **PROPOSED — NOT APPROVED — NOT IMPLEMENTED**. The suite contains 27 illustrative layouts, coverage mapping and verbatim generation/edit prompts. Raster labels, miniature placement and device proportions are conceptual; the audit and runtime remain authoritative. This record does not approve additional settings or authorize game implementation.

Champion crafting studies: [available combinations, pinned building goals and expanded/compact DPS](output/design/ui-crafting-pinning-20261013-v1/README.md) extend the responsive suite across desktop, iPad landscape and mobile landscape. These three dynamic visual layouts were implemented in 0.3.28 as **APPROVED DESIGN — IMPLEMENTED** under D005, with the approved D004 requirement retaining the DPS score below Next wave. The [implementation handoff](docs/UI_DYNAMIC_CRAFTING_APPROVED_20261013.md) defines the authoritative behavior; illustrated inventories and DPS scores remain fixtures, not measured balance results. Original images, prompts and generation review records are preserved.

## Historical design reference — preserved below

The following earlier specification remains as design history. Conflicting counts, names, combat rules, mastery timing and opening values must not be used as current rules; consult the dated baseline and source modules above.

## Battlefield and core loop

The browser version uses a completely open 37 × 37 board. No scenery blocks any playable cell. Camp and keep models stand outside the board. Zero-based coordinates:

| Marker | X | Z |
|---|---:|---:|
| Entrance | 0 | 4 |
| Checkpoint 1, left midpoint | 4 | 18 |
| Checkpoint 2, right midpoint | 32 | 18 |
| Checkpoint 3, upper-right corner | 32 | 4 |
| Checkpoint 4, top midpoint | 18 | 4 |
| Checkpoint 5, bottom midpoint | 18 | 32 |
| Keep gate | 36 | 32 |

Checkpoints sit on the fifth tile from each nearest edge: zero-based index 4 or 32, with four full cells before the marker. The route loops through 2–3–4 and crosses itself in the middle. Ground troops visit all five in order using cardinal shortest paths; flying troops traverse the same ordered checkpoints directly. Reaching a crossing or checkpoint never costs lives. Only completing the final segment to the keep does.

Each round grants five sealed build slots. A successful placement commits its tile, then independently rolls a defender family and rank; no identity, portrait, rank or recipe hint exists beforehand. Invalid placement consumes no randomness. Mastery odds are frozen at round start. Place all five, then keep one, merge a matching pair, or complete a recipe. Unchosen defenders and consumed ingredients become barricades. Each placement must leave every route segment reachable. Between waves, existing active ingredients can also combine. The selected ingredient's position holds the result. There is no unrestricted tower shop.

## Valley scenery and recommended maze

Terraced snow-capped peaks, branched conifers and birches, rocks, flowers, a winding river and an animated waterfall frame the board. River highlights and foam travel along the curved current; sheets, spray and expanding splash rings animate the waterfall. Ground scenery stays outside the playable grid; a bridge connects the final tile to the keep. Soft drifting clouds fade in only when the camera pulls back. The default camera frames the field and surrounding valley.

The maze button (M) opens the three user-provided reference layouts and three curated central-fire variants, plus saved custom plans. The new variants use 134, 143 and 148 occupied cells, with 772, 820 and 864 route steps and 69%, 72% and 71% central-fire coverage. They bring every checkpoint leg through central firing circles and make 8, 8 and 14 continuous firing passes. The chooser shows in-range seconds at a stated two-cell-per-second reference speed and six-cell range; these are geometric comparisons, not a damage prediction. Earlier automatic suggestions have been removed. Selecting closes the panel and fixes every planned cell. Building only updates progress, remaining-budget and conflict warnings; no background search changes the chosen structure. M opens the chooser again. Cyan cells are future foundations; gold marks firing positions. Counts sum exact six-leg gameplay BFS steps, including repeated visits. The custom editor supports mouse drag strokes, touch taps, erase, undo/redo, names and browser-local persistence; it pauses gameplay and never spends draws or gold. A one-finger touch drag pans instead of drawing. Save rejects sealed checkpoints, reserved cells and more than 250 positions. Prepared variants are best-found routes, not proven global optima.

The ground uses one continuous world-space meadow shader across the field and surrounding shoulders. Layered grass patches, fine blades and clover provide detail without blocking tiles. The construction grid has internal lines only; there is no rectangular frame or raised board.

## Eight families, six ranks

The user supplied [Gem TD on the Dota 2 Wiki](https://dota2.fandom.com/wiki/Gem_TD) as the mechanical reference. Original heroes, creatures and siege machines replace gems and named source towers. This adaptation uses the Dota 2 variant's armor-reducing Amethyst, not the older Warcraft variant's air-only Amethyst.

| Defender | Unit code | Role |
|---|---|---|
| Soldier | S | Heavy single-target sword strikes |
| Archer | A | Rapid single-target arrows |
| Druid | D | Poison lasting five seconds |
| Mage | M | Arcane hit with pure splash damage |
| Cleric | C | Attack-speed blessing |
| Engineer | R | Shatters enemy armor |
| Frost Warden | F | Slows enemy movement |
| Stormcaller | T | Strikes three enemies at once |

Ranks I–VI are Militia, Trained, Veteran, Elite, Royal and Mythic. Display labels combine the family letter with the Roman rank, such as `S I` or `S VI`. Every family has an explicit six-row profile in data/towers.json. Two identical units of the same rank among the current round’s five draft candidates merge one rank upward; VI is capped. Mythic VI is merge-only, while mastery rolls ranks I–V. The grimoire exposes all 48 profiles; artifacts/defender-ranks.csv provides an editable comparison export.

Gem TD supplies the basic identities and recipe topology. Soldier has 2.5-cell ground-only reach and 50% stronger rank I–V strikes. Soldier, Archer and Stormcaller VI deal roughly 3.5 times rank V direct DPS. Stormcaller VI reaches 12 cells. Mythic frost slows by 55%. These are campaign adaptations, not exact Dota combat equivalence.

Mythic upgrades alter defining abilities: faster arrows, stronger sword hits, independent poison DPS, larger pure cleave, stronger blessing, armor reduction, nearby frost slow, or twelve-tile triple targeting. Models add equipment and floating ornaments while keeping one-cell footprints.

## Champion recipes

All combinations require exactly three distinct defenders with the stated families and ranks. The approved roster contains 37 ordinary champions and two Secret champions, using stable family IDs for renamed units and including all restored reference combinations. An advanced ingredient is a complete crafted defender. Recipe requirements themselves gate progression, without additional Kingdom-level locks. Every champion has one fixed form; paid enhancements and obsolete upgrade multipliers are unavailable.

| Champion | Reference recipe | Required ingredients |
|---|---|---|
| Frostbolt Watchmen | Silver | Frost Warden F I + Soldier S I + Stormcaller T I |
| Knight | Silver Knight | Frostbolt Watchmen I + Archer A II + Mage M III |
| Lionheart Champion | Pink Diamond | Soldier S V + Soldier S III + Stormcaller T III |
| Kingslayer | Huge Pink Diamond | Lionheart Champion I + Knight I + Frostbolt Watchmen I |
| King | Koh-i-noor Diamond | Kingslayer I + Engineer R VI + Soldier S VI |
| Elven Ranger | Malachite | Cleric C I + Druid D I + Archer A I |
| Elven Elite Warrior | Vivid Malachite | Elven Ranger I + Soldier S II + Stormcaller T III |
| Elemental Mage | Uranium-238 | Stormcaller T V + Frost Warden F III + Cleric C II |
| Elemental Archmage | Uranium-235 | Elemental Mage I + Elven Ranger I + Elven Elite Warrior I |
| Fire Baby Dragon | Asteriated Ruby | Mage M II + Mage M I + Engineer R I |
| Fire Mother Dragon | Volcano | Fire Baby Dragon I + Mage M IV + Engineer R III |
| Thunderbird | Bloodstone | Mage M V + Archer A IV + Engineer R III |
| Dragonrider | Antique Bloodstone | Thunderbird I + Fire Mother Dragon I + Mage M II |
| Mage Dragon rider | The Crown Prince | Dragonrider I + Mage M VI + Druid D VI |
| Master Druid | Jade | Druid D III + Cleric C III + Frost Warden F II |
| Archdruid | Grey Jade | Master Druid I + Frost Warden F IV + Archer A III |
| Ballista | Gold | Engineer R V + Engineer R IV + Soldier S II |
| Priest | Chrysoberyl Cat's Eye | Cleric C V + Soldier S IV + Archer A III |
| Frost Colossus | Yellow Saphire | Frost Warden F V + Mage M IV + Stormcaller T IV |
| Angel | Star Sapphire | Frost Colossus I + Frost Warden F VI + Cleric C VI |
| Dwarf Firebomber | Paraiba Tourmaline | Archer A V + Cleric C IV + Druid D II |
| Catapult | Dark Emerald | Druid D V + Frost Warden F IV + Stormcaller T II |
| Ranger | Quartz | Druid D IV + Mage M III + Engineer R II |
| Royal Storm Arsenal | Deplemented-Kyparium | Elemental Archmage I + Archer A VI + Stormcaller T VI |
| Bearking | Monkey King Jade | Archdruid I + Druid D IV + Engineer R II |
| Paladin | Deepsea Pearl | Archer A IV + Soldier S IV + Cleric C II |
| Nature Spirit | Diamond Cullinan | Bearking I + Soldier S VI + Frost Warden F VI |
| Royal Ranger | Lucky Chinese Jade | Ranger I + Master Druid I + Druid D III |
| King's Ranger Guard | Charming Lazurite | Ranger I + Engineer R IV + Stormcaller T II |
| Elven King | Golden Jubilee | King's Ranger Guard I + Stormcaller T VI + Mage M VI |
| Fire Ballista | Egypt Gold | Ballista I + Engineer R V + Archer A II |
| Golem | Emerald Golem | Catapult I + Ballista I + Soldier S III |
| Dwarf Griffin bomber | Elaborately Carved Tourmaline | Catapult I + Dwarf Firebomber I + Druid D II |
| Mechanical Golem | Sapphire Star of Adam | Dwarf Griffin bomber I + Druid D VI + Engineer R VI |
| Monk | Red Coral | Paladin I + Priest I + Cleric C IV |
| Archbishop | Carmen-Lucia | Monk I + Cleric C VI + Archer A VI |
| Archangel | Northern Saber's Eye | Frost Colossus I + Thunderbird I + Frost Warden F V |
| Lady Claire · Secret | Fantastic Miss Shrimp | Mage M V + Druid D V + Frost Warden F V · current round only |
| Lord Bernhard · Secret | Diamond Cullinan | Soldier S V + Soldier S IV + Soldier S III · current round only |

The recipe dependency graph follows these selected reference combinations, including crafted ingredients and VI requirements. The approved data retains the agreed combat values, reference notes and explicitly identified adaptations. Data files and the grimoire describe the implemented effects; source-verification notes stay separate from player-facing ability labels.

There are exactly 39 champion families and 39 fixed recipes (37 ordinary and two Secret); champion Ascension is disabled. Basic rank merging remains restricted to two current-round candidates, capped at VI. Champions have fixed statistics and no paid enhancements. Champion cards show readable effects plus direct attack damage and DPS (damage divided by attack interval); conditional criticals, multi-target hits, support bonuses and continuous damage are described separately. Pinning a recipe recursively expands its crafted ingredients into basic family/rank requirements and aggregates duplicates. Existing component champions contribute their underlying basic ingredients to progress without consuming stock twice.

The 37 ordinary champion classifications follow the wiki Towers table: 5 Basic, 13 Intermediate, 11 Advanced and 8 TOP. Lady Claire and Lord Bernhard use the Secret classification with gold auras. All classes have equally large cosmetic auras: Basic blue, Intermediate green, Advanced purple, TOP gold and Secret gold. Basic recruit ranks use their existing six colors independently of champion classification.

Every basic family and rank I–VI now appears in at least one fixed champion recipe. Royal Storm Arsenal retains the reference recipe, but its rapid three-target physical true strike is an authored adaptation because the source does not specify its ability.

The 37 ordinary champion models are original characters, creatures or siege machines: distinct armored heroes, rangers and druids; dragons and riders, a thunderbird, bear king and golems; priest, monk, bishop and angelic silhouettes; and catapult, cannon and ballista variants. Basic and advanced units occupy one cell, while advanced wings and weapons may overhang visually. Original family IDs and recipe branches remain stable. `data/towers.json`, `data/recipes.json` and `data/balance.json` are the authoritative approved settings. `tools/author-roster.mjs` validates the full roster and can refresh presentation fields from the catalog without regenerating combat values or recipes. Runtime models, thumbnails and Blender exports share the same source geometry.

## Secret champion selection

Lady Claire and Lord Bernhard can be crafted only in the selection phase after all five current-round candidates have been placed. Their exact three ingredients must be distinct actual draw IDs from that same round. Retained defenders, stale candidates, incomplete placement or a selected noningredient cannot offer the combination. Selecting any one of the three valid ingredients anchors the result there; the other four current foundations become walls. No gold is charged. Ordinary recipes retain their existing use of retained ingredients.

Claire attacks for 1225 arcane damage every 0.5 seconds at range 10. A successful hit rolls chain (20%) and fork (50%) independently: chain deals 150 through up to five additional distinct hops, and fork deals 2500 to up to five eligible targets with a 50-tile impact-centered reach. Her attack-start Melancholy roll is 3%, cancels that attack and blocks new attacks for five combat seconds. A moon symbol and countdown report the live state; already launched shots continue.

Bernhard attacks one target for 3164 poison-type damage every 0.5 seconds at range 13, applying 16 poison damage per second for five seconds. His three-tile support aura grants allies +3 range and true strike, including himself and the exact boundary. “Poison 5” is an ability grade, not five targets. Existing strongest-effect stacking and immunity rules apply. Exact source precedence and adaptations are in [SECRET_CHAMPION_RULES.md](docs/SECRET_CHAMPION_RULES.md). Nature Spirit remains a separate approved ordinary champion even though it shares the Diamond Cullinan reference.

## Combat and economy

Armor uses 30 / (30 + effective armor), after flat reduction and penetration. Magic damage applies generic and typed resistances; pure cleave ignores both. Projectiles deal damage on arrival. Soldier strikes have a short windup and check melee range again at impact. Criticals and chain procs use seeded randomness. Attack cooldown overshoot is retained for fast attackers at accelerated game speed.

Poison has its own per-rank DPS and five-second duration. Druid and Engineer first select enemies without the corresponding live status or an incoming effect shot, preserving selected priority within that group. When all eligible targets are marked they follow ordinary priority; failed shots and expired effects release the target. Master Druid applies 24 poison DPS; Archdruid applies 48 poison DPS and grants three extra tiles of ally range. Reapplying a status refreshes it without duplicating it, retaining the strongest magnitude and kill owner. Cleric blessings of different ranks combine; duplicates use the strongest value. Range, damage, control protection, armor reduction and slows use their strongest value. Frost Colossus and Angel have a 75% slowing aura; Archangel starts at 70%. Bosses suffer half the normal slowing strength.

Dwarf Firebomber applies a −15 armor aura within four tiles. Catapult has a 10% chance to stun for two seconds, with half duration on bosses. Ranger applies −10 armor and 30% slow only to flying targets; magic immunity blocks its slow. Royal Storm Arsenal fires three physical true-strike shots every 0.25 seconds. Bearking grants true strike and +3 range within six tiles; true strike bypasses evasion but not shields, armor or physical immunity. Paladin completely protects nearby allies from disarm and dread. Ballista removes 30 armor; Fire Ballista removes 40 armor; champion attacks do not generate gold.

Royal Ranger has a 1% chance on a successful attack to restore one keep health, capped at starting health. Monk combines two distinct blessing groups without doubling identical Cleric or Priest groups. Mechanical Golem suppresses healing for three seconds and applies an armor aura to magic-immune enemies. Golem's Stone Gaze requires an enemy to face it for two seconds, then petrifies for three seconds and doubles physical damage received. Dragonrider's forked lightning selects five targets, with magical immunity respected. Archangel has a 25% chance to release ten frost bounces when an allied caster within six tiles lands a magical hit; its own attacks, blocked hits and secondary bounces do not trigger that effect.

Start with 90 gold and 30 keep health. Kills grant XP and score. Each 90 XP raises Kingdom level; construction mastery advances automatically to Kingdom level minus one, capped at 15. Current-round draw odds stay frozen, and new odds apply next round. Perfect kill XP reaches maximum mastery after wave 22, without spending gold. Completed normal waves award 50 gold and boss waves award 200 gold once; kills and champion attacks do not add gold. Gold is reserved for downgrading candidates. Wall demolition is free; keep health cannot be purchased; Royal Ranger's approved recovery proc is the champion health-recovery mechanic. A current basic candidate above Tier I may be downgraded by one rank and immediately kept for 200 gold. There is no pre-placement reroll: recruits do not exist until placed. Mastery changes next round’s odds. The main campaign has 50 original orc warbands with bosses every tenth wave, plus an optional ten-wave skirmish. The Warbands guide (V) exposes all waves, movement classes and counters. docs/WAVE_REFERENCE.md records the reference mapping. Orc names, numerical balance and combat timings are original adaptations.

Only the first wave allows extra time to establish a basic defense near a checkpoint or central crossing: 9 HP, zero armor, movement speed 1.3 and a 2.4-second spawn interval. Waves 2 and 3 return to their original normal pressure: 61/80 HP, 1/8 armor, movement speeds 2.21/2.37 and 0.6-second spawn intervals. Enemy counts remain 8, 8 and 9. Combat tuning for waves 4–50 is unchanged; placing defenders away from the route can still allow leaks.

Enemy mechanics include veil detection, evasion, periodic disarm, three-hit refraction shields, physical/magical immunities, theft on leaking, non-stacking attack suppression, periodic rush, reactive armor, healing recharge, checkpoint-preserving blink, flat shell protection and war-drum haste. Pure damage bypasses damage-type immunity, armor and shell; refraction still absorbs direct pure hits. Damage over time bypasses direct-hit shields. Clerics reveal veiled enemies within six tiles. Flying variants include wyvern riders, giant bats, goblin scrapwings and dragon-mounted warlords; the old balloon silhouette is retired. All active names and appearance descriptions are in English. Native bats flap, heavy flying mounts use slower wing cycles, and ground actors move their legs and breathe. The simulation clock freezes living enemy motion while paused; reduced motion restores their authored poses. Variants are seeded once per wave, and the combat sidebar reports that actual variant's traits and resistances. Boss health updates while the battle runs.

Score starts at zero. Each killed regular enemy grants 10 × the current wave; a boss grants 500 × the wave. Surviving grants 100 × the wave, with an additional 200 × the wave on boss rounds. Rewards are awarded once, and leaking enemies grant no kill score. The browser-local profile stores the best score. Selected-defender counts include retained units of the exact family and rank; grimoire cards count retained results across champion ranks.

Balance remains provisional. Seeded simulations exercise the real game loop, but do not replace human playtesting. Original low-poly art, browser-local profile saves and synthesized sounds are prototype assets; in-progress save/load is not implemented.


## Current-round clarity and demolition

Each successfully placed current-round draft has a stable numbered marker matching its card and keyboard slot 1–5. It has no rotating arrow. An available advanced recipe replaces its large numeral with a result portrait; the small hotkey number remains and the whole icon stays readable. Retained ingredients also display recipe portraits without a current-round number. A star identifies the exact result anchor, minus identifies consumed ingredients, and a wall identifies other candidates that the decision discards. Selecting an ingredient or a recipe preview changes the indicated result anchor. Crowded portraits are separated and linked to their units. Keep/merge/craft resolves current-round markers immediately.

Delete or Backspace demolishes only a selected castle wall for free, without refunding the construction draw. Retained defenders cannot be demolished; advanced recipes can consume them and leave removable walls. Unresolved candidates, combat/end states and no selection reject removal without changing the grid. Cleared draws remain spent. Masonry connects both cardinal and diagonal neighbors; decorative bridges do not block extra navigation cells.

Commander's spiral contains 136 planned cells and 590 cardinal steps: 88 + 98 + 124 + 96 + 66 + 118. Its central nine positions form a contiguous 3 × 3 block at x/z 17–19. The route passes around the battery, never through its interior. Six-tile firing circles around those nine cells cover 265 counted steps (45%).

A survived non-final wave awards its reward exactly once and immediately increments the round and creates five hidden construction slots. The final wave still ends in victory. Mouse-edge panning uses the battlefield bounds, stops outside the canvas or with a modal, and excludes touch input. The compass rotates with camera azimuth. Blender enemy silhouettes stand about 1.82–1.98 world units tall, comparable to defender characters; bosses reach about 3.1–3.4 with distinct auras. Kept defenders stand on a 0.74-unit stone platform connected to neighboring walls and other retained foundations. Only the character rotates or recoils. Drafts remain on the ground until kept. Killed enemies collapse into retained corpse models; flying enemies fall and fold their wings. Corpses clear at the next construction round. Catapult arms pivot during attacks, including continuous aura attacks. Enemy statistics are separately tuned in tools/author-campaign.mjs; docs/ECONOMY_BALANCE.md records the pressure curve and role defenses.

## September 30 — host and economy revision

The planner explicitly reports the 250-placement campaign ceiling, the union of planned cells and existing off-plan buildings, and remaining unspent draws. Walls and defenders each occupy one cell. Demolition never restores the used draw. Potential combinations require an exact family and tier match. Redundant Preview buttons are removed; automatic recipe ingredient markers remain.
