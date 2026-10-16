# Cartographer UI design specification

The approved interface is a restrained cartographer's table around the **existing battlefield**. Paper supports decisions, comparisons and planning. Implement the interface composition, not the generated concept's terrain, character designs or model poses. Use the original geometric reference illustrations for all character preview images as specified in [ASSET_POLICY.md](ASSET_POLICY.md).

## Stable layout and styling

Use four named regions: resource register at the top, reconnaissance note at the left edge, preparation folio below the map when preparing, and a contextual inspector at the right edge. Recipe/wave exploration uses an atlas with a list and detail. Keep the central fighting area clear. Ready/combat commands occupy a small bottom-right dock; do not restore a full-width empty footer.

Use warm paper `#F5EBD4`, light surface `#FFFBF0`, dark ink `#29251F`, muted ink near `#706752`, fine separators near `#C4B18B` and brass near `#B18B45` as implementation starting tokens. Confirm contrast in actual rendered states. Titles use a characterful serif; body, controls and numerals use a legible system sans-serif with tabular numbers. Keep texture subtle at edges; avoid large decorative ornaments, giant portraits, decorative empty areas and repeated boxed statistics. No new external font dependency is required.

Cyan denotes allocated pinned planning ingredients; violet denotes legal rank merge; gold denotes champion combination/primary commands. Use text and symbols as well as color. Existing map badge shape, colors, role priorities, leader/collision behavior and guarded input stay authoritative. Replacing a badge's picture with its correct original reference portrait must not change its action role.

Primary touch controls target 48 CSS px height; secondary controls at least 44 CSS px with clear spacing. Normal iPad text should generally be 16 CSS px or larger. Use safe-area insets. Required commands must work with touch, pen, mouse and keyboard; neither hover nor swipe is essential. Aim for at least 4.5:1 normal text contrast, 3:1 large text/control boundaries where applicable, visible focus and a logical focus order. Validate rather than claim accessibility from raster colors.

## Desktop and iPad rules

Use desktop width for map area and side-by-side atlas reading. At a spacious desktop viewport the preparation folio has five candidate cards on the left, a selected-unit detail in the middle, and a compact pinned plan or combination list on the right. All preparation states reuse the same card, heading, spacing, separator and detail components.

On iPad landscape use the same components, reflowing their sections rather than scaling the desktop to tiny text. If height is short, bound the detail/combination scrolling area and keep the phase instruction, candidate selection and primary commitment reachable. Start with a 200–240 CSS px preparation rail on sufficiently tall viewports; dense states may need more space, subject to the map/readability acceptance checks. Do not rigidly copy raster percentages or create three nested scroll containers. A contextual pane must avoid the selected map target and pending placement.

Verify at 1715 × 1244 and 1440 × 900 desktop; 1180 × 820 and 1024 × 768 iPad-like landscape; 820 × 1180 portrait fallback; 844 × 390 and 390 × 844 regression layouts. Also verify an intermediate iPad landscape proportion, safe-area simulation and 200% text/zoom. The work prioritizes desktop and iPad but may not break existing phone access. Record real device Safari verification separately if unavailable.

## Resource register and global navigation

Keep actual wave/total, Keep Health, gold, CP, Recipes, Enemy waves, music/audio and game-menu access stable. Do not rebrand the game or hardcode sample resources. Global Recipes/Enemy waves appear once in the top register, with reachable overflow on narrow screens; remove duplicate bottom controls. Retain the existing other menu, Help, tutorial, results/statistics and developer access under their established visibility rules. Do not expose developer commands on the public surface.

Preserve independent Music and Sounds sliders, defaults 80% and 40%, stored preferences, mute, gesture unlock and actual audio categories. Use the present audio implementation. Sliders must not be reinitialized on phase changes, inspection, pause, speed changes or catalog opening. Existing final-choice voice timing remains unchanged.

## Reconnaissance note and measured DPS

The note has a single phase-dependent wave slot. Build, Select, Ready and between-wave preparation show **Next wave**. Combat, including global pause, shows **Current wave** and actual counts. Switch only when the actual Game phase/round advances; not because a timer finishes or a catalog selection changes. Combat does not display a simultaneous Next wave card or a second current-wave banner. Opening current-wave detail is not a second compact summary.

Measured DPS is directly below the active wave slot. In its expanded form retain **Sum peak DPS**, real per-defender rows, MVP metadata, ordering, scrolling and measurement context. The sum contains independent peaks; it is not a simultaneous army rate. The collapsed form is one shallow, reachable disclosure strip, such as **Peak DPS 514.7 · W8**, not a large score with explanatory paragraphs. The accessible label explains the measured wave and expand/collapse operation. Use an honest unmeasured state. Preserve disclosure choices; existing expanded first-open defaults are not overturned by screenshots illustrating collapsed states.

Retained completed-wave rows remain bound to their measured identities. Crafting/upgrading a defender with a reused ID must not inherit the old score. Live combat measurements are distinguished from last-completed measurements. Rank comparison does not rewrite measured values. Never relabel the retained score as Base direct DPS. Ended runs must not show an invented Next wave 51.

## Shared preparation folio

| State | Candidates and detail | Planning content | Primary/secondary actions |
| --- | --- | --- | --- |
| Building | Exactly five slots; reveal only actually placed recruits. Inspect a revealed recruit in the same detail component used by Select. | Compact pinned plan and future-draw odds under the cards. | Legal map placement. No Keep, Reroll, Reserve or unavailable placeholders. |
| Choose keeper | Same card geometry and detail position, all five actual identities. One actual selected candidate. | Visible potential combinations and one selected detail. No Future rank odds block. | Explicit Keep of selected actual candidate; legal Reroll/Reserve costs; contextual legal Merge and Downgrade and Keep. |
| Combination preview | One exact transformation and anchored result, not another full repeated five-card roster. | Built/This round allocation and consumed/wall outcomes; no future odds. | Explicit Combine and Cancel preview; no mutation before confirmation. |
| Ready | Preparation roster, permanent recruitment receipt and future odds disappear. Unit selection on map opens the side inspector. | A useful pinned bookmark can remain compact; no redundant completed-plan slab. | Small dock with subdued Maze plans and primary Start wave. No Inspect keeper button. |

Keep hidden slots genuinely unknown in text, images, attributes, ARIA, preload requests and planning allocations. A selected placement slot is not an ingredient claim. Future odds describe future draws, not hidden current recruits or fixed champion ranks. Retain the useful construction probabilities without Not this draft captions or duplicated blocks. Inspection is optional and is never a prerequisite for a legal placement.

All commitments use current state and exact identity guards. Preserve actual CP costs, active Move cancellation and retained-only recipe legality. A basic candidate above rank I retains the conditional one-step **Downgrade and Keep** action with its actual 200-gold runtime cost; do not remove it because a concept omits it. Current-draft and retained rank-V merge rules stay intact. Use the existing input helpers; do not make single ordinary commands depend on a later compatibility click or erase safeguards for recipe markers.

## Defender detail and rank comparison

Show identity, actual rank, state and active family count. Active attack-paused defenders count as built; draft, reserve and ruin do not. Fixed champions use fixed-champion presentation rather than fictitious I–VI progression. Map selection opens or updates the contextual inspector without a separate Inspect keeper command.

For a basic defender, replace generic prose with quantified effects near identity: amount, duration, area/targets and chance when present. Then show I–VI comparison and the four-field grid: **Damage / hit**, **Base direct DPS**, **Range**, **Interval**. Both grid and effects come from the same displayed rank through existing runtime adapters. If there is no additional status effect, say so rather than inventing one. Extra long abilities can expand without hiding their main numerical effect.

The actual unit and commitment remain unchanged while comparing. Caption a different rank explicitly, for example **Preview rank IV · Actual rank II unchanged**. Keep the real card label and **Keep Archer II**. Comparing IV does not make IV recipes/merges craftable. The actual unit's action context remains visible. Selecting a different unit resets comparison according to the current rank-preview identity rules.

Base direct DPS means one-target hit damage divided by interval before defenses, without extra targets, splash, poison, aura, support or MVP. Keep effective modifiers and providers separately labelled in the existing support section. Show MVP by identity and measured DPS rows; do not invent defender HP. Preserve targeting, attack pause, legal Move, mastery and support inspection.

| Base profile example | Damage / hit | Base direct DPS | Range | Interval | Effect |
| --- | ---: | ---: | ---: | ---: | --- |
| Archer II, Physical | 12 | 48 | 4 tiles | 0.25 s | 1 target, no additional status |
| Archer IV comparison, Physical | 48 | 192 | 4 tiles | 0.25 s | 1 target, no additional status |
| Mage I, Magical | 12 | 12 | 5 tiles | 1 s | 30% Magical splash: 3.6 damage to other enemies within 3 tiles |
| Frost Warden V, Physical | 30 | 30 | 6 tiles | 1 s | 36% movement slow for 3 s |

These are 0.3.31 fixtures, not hardcoded UI constants. Use current adapters if the baseline legitimately advances. Nominal effects retain immunity, strongest-only stacking and boss modifiers. Frost Warden is Physical; the old Magical/Frost damage labels are raster errors. Archer is not multi-target.

## Multiple combinations and preview

Use **Potential combinations (N)** as compact portrait/name/status/chevron rows and a single shared detail. Opening a row replaces the expanded recipe; it never appends another tree or obscures other options. The list remains visible and independently scrollable when needed. Missing recipes are inspectable but not falsely enabled. Do not silently pin, Keep, consume or craft when selecting a row.

Archer II has Frost Knight and Fire Ballista. Frost Warden V has Frozen Celestial, Angel and Lady Claire. Exact recipes are recorded in RUNTIME_REFERENCE.json and the preserved combination-options evidence; no ingredient substitution is allowed. Current recipes use stable IDs, not localized labels or the old visual names.

Preview selects an eligible result foundation and exposes allocated retained/current ingredients, transformations, walls and discarded candidates. It uses existing gold/star result, consumed-minus, wall/cross, violet merge and cyan pinned portrait badges with their original guard semantics. Show one active preview's associations; do not draw three simultaneous decorative connector systems. Confirm recomputes validity; Cancel restores the prior selection/draft. Foundation outcomes follow current rules rather than simply deleting consumed units.

## Combat and boss UI

Fold away construction controls. Keep one Current wave note above DPS and optional contextual defender/enemy inspection. Pause/Resume and one **Speed 1x/2x** cycling button occupy a compact dock. Reuse actual supported speeds; do not add 3x/4x. Stable controls must survive HUD refreshes without losing pointer capture or focus. Unit attack pause remains distinct from global pause. Existing keyboard shortcuts remain intact.

Boss health appears at top center below the resource register, clear of inspection controls. It sums current/max HP for revealed living bosses only. For multiple visible bosses use the existing combined model; concealed/approaching bosses show status without leaking their HP, identity-specific live state or coordinates. Remove repeated live HP bars from side panels; retain truthful static maximum HP, armor, speed, traits and counts. On-field/queued totals remain distinct from the health total. A defeated/escaped/ended state must use actual outcomes rather than assuming a kill.

## Recipes and enemy atlas

Recipe selection is a compact list plus selected detail. Preserve search, damage/ability/against-defense filters and All/Available/In progress. Selecting is not pinning; Pin is explicit and planning-only. Full champion names, exact ranks and component links stay readable. Lists and details can scroll separately; return/navigation/Pin remain reachable.

Recipe row **Built basics** is `sum(ownedCount) / sum(count)` from the exact recursive allocator; exclude `draftCount`. A built intermediate champion covers its allocated subtree once, and an exact rank counts as one required basic rather than hypothetical rank-I equivalents. This is progress, not craft eligibility. Use the inventory semantics already used by the catalog/allocator, retaining duplicate allocation and reserve/hidden exclusions. Keep separate Built, This round and Missing statuses.

Ordered Previous/Next follows current filtered catalog order, does not wrap and disables endpoints. Kingslayer is followed by King in the baseline unfiltered order. Back/Forward in exploration is a separate history and preserves filters/pin. Out-of-filter component inspection has an honest position label. A separate page position such as 4/38 may remain; recipe row counters do not use champion ordinals.

Future waves show the selected catalog wave separately from the actual campaign round. Show shared profile facts once and actual variant differences beneath them; do not turn possibilities into guaranteed counts or invent resistance stats. Current-wave details show observed/runtime profiles and individual revealed-enemy HP/effects only under existing visibility rules. No D001 rebalance or variant redesign is included.

Catalogs preserve the existing pause contract: remember prior paused state, pause while open and restore that exact state on close. Closing a catalog must not resume a previously paused battle. Selection in the atlas never starts that wave. Retain existing Help/tutorial, maze editing, results/read-only battle review, Retry, statistics/leaderboard and loading/error recovery, restyled only where needed for a coherent interface.

## Known raster corrections and final authority

Use the selected screen files for composition. Correct tiny duplicated rank glyphs to I, II, III, IV, V, VI. Correct false damage categories, mismatched portraits, inaccurate wall/consumed badge pictures and any Base direct DPS label attached to the measured 514.7 score. Use an accessible disclosure instead of an information glyph on unmeasured collapsed DPS. Restore missing ingredient-status captions. Preserve legal contextual actions omitted in illustrative layouts. Replace every illustrated character preview with its mapped approved source-art image; keep actual battlefield models, map, animations and effects unchanged.
