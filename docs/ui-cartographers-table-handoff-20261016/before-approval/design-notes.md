# The Cartographer's Table — phase design

October 16, 2026. Source reference: edition 0.3.31. **DIRECTION SELECTED FOR FURTHER DESIGN; SCREEN DESIGNS PROPOSED; NOT IMPLEMENTED.**

The user selected direction A for refinement across construction, combat, defender selection, recipes and enemy intelligence. This working design accompanies the visual studies. It is a design-review draft, not implementation authorization or a frozen final engineering handoff. The original requirement to approve the visual concepts before implementation still applies.

Current amendments: [rank statistics, quantified effects and one preparation folio](reviews/20261016-comments-03/README.md), following the preserved [second review](reviews/20261016-comments-02/README.md) and [first review](reviews/20261016-comments-01/README.md). These user-requested design changes supersede conflicting earlier screen details; game implementation remains separate.

## The design idea

The player commands a miniature battlefield from a cartographer's table. Paper is a functional surface for orders, comparisons and planning. It should not become a decorative frame around every object. The 3D world supplies atmosphere; interface surfaces supply legibility.

Three consistent surfaces serve different tasks:

1. **Reconnaissance slip:** phase-dependent enemies above measured DPS: Current wave during combat (including paused combat), Next wave between waves. The two sections have independent disclosures; collapsing DPS retains its score and measurement context.
2. **Muster folio:** the current five recruits, comparison and explicit commitment. It is open during construction/choice, becomes a short readiness rail after commitment, and folds away during combat.
3. **Atlas folio:** recipe or wave exploration. List, detail and navigation share one workspace; the player does not navigate a stack of unrelated full-screen cards.

Collapsed DPS now uses one shallow score/measurement-wave/disclosure strip. During Building, omit unavailable Reroll and Reserve controls. During Choose keeper, retain the five-slot folio and show permitted commitment actions with their actual costs.

Multiple combination options use a compact vertical list and one shared expanded detail. Only the selected recipe exposes its allocated ingredients and Preview action; no automatic craft or simultaneous expanded trees. Real examples: Archer II has Frost Knight / Fire Ballista; Frost Warden V has Frozen Celestial / Angel / Lady Claire. Existing map portrait badges, role colors and guarded input are preserved exactly through reuse of the existing renderer.

The top resource register remains stable. A panel opening must not move a dangerous command under the pointer or finger. Contextual views may change what is shown without changing the underlying selected unit, round or draft.

## Phase and presentation matrix

Catalogs and previews are presentation states over a game phase, not new simulation phases.

| Study | Game context | Main decision | Persistent information | Explicit exit or commitment |
| --- | --- | --- | --- | --- |
| 01 Building | Build, three of five placed | Where to place the next unrevealed recruit | Five slots, future odds, exact pinned progress, upcoming wave and last measured DPS | Place at a legal free foundation; no premature Keep/Start |
| 02 Choose keeper | Select, all five placed | Keep a candidate or inspect a combination | Actual rank, rank comparison, family count, potential combinations and five candidates; no Future rank odds block | Keep selected candidate; Preview combination is non-committing |
| 03 Combination preview | Select, eligible mixed owned/draft recipe | Accept the exact transformation | Result anchor, allocated ingredients, consumed units and wall outcomes | Combine or Cancel preview |
| 04 Ready / defender | Ready, keeper committed | Inspect, adjust the route or start | Committed identity, correct champion/basic rank behavior, MVP, support, next wave/DPS | Start the actual next wave; Move enters its existing guarded mode |
| 05 Combat | Combat, wave 9 | Observe and inspect | One Current wave summary above DPS with MVP; one Speed button and separate Pause; global catalogs only in the header | Pause/Speed; open current enemy or defender view |
| 06 Current wave | Combat, boss wave 10 | Assess current revealed threats | Combined revealed living boss HP at top center; independent counts/traits; Current wave above DPS | Close panel or return to defender context |
| 07 Future waves | Catalog over actual round 9 | Prepare for a selected future wave | Current round distinct from selected catalog wave, shared facts and variant differences | Previous/Next catalog wave, Return to battlefield |
| 08 Recipe selection | Catalog over construction | Find a candidate goal using search and filters | Full names, Built basics counters, ownership states, selected recipe versus pinned goal | Pin a goal explicitly; open detail or return |
| 09 Recipe browsing | Recipe detail | Compare ordered neighbors or inspect components | Persistent filters, exact components, ingredient counts in list rows, pinned goal, separate exploration history | Previous/Next recipe, Back/Forward in exploration, Return to catalog |

## A coherent command loop

Construction begins with five unrevealed slots. Placing a recruit reveals its real identity; neither the pin nor future odds may reveal another slot. A selected placement slot uses an ink/brass selection treatment. A cyan ingredient pin belongs only to an eligible, already revealed unit.

After five placements, the folio changes its instruction to Choose keeper. Selection opens the candidate's comparison and potential-combination information. A single labelled Keep command identifies the exact unit. Reroll and Reserve show their real CP cost, availability and reason when disabled. A legal rank merge keeps its separate violet action; it must not resemble the gold champion combination. A basic candidate above rank I can expose the existing conditional **Downgrade and Keep — 200 gold** action, with its one-step decrease and commitment clearly stated. Its absence for the rank-I examples is not approval to remove it. Ordinary single activation must work for touch, pen, mouse and keyboard; existing guarded input semantics and commitment rules remain authoritative.

The recipe-preview branch uses an actual simple recipe: **Elven Ranger = Cleric I + Druid I + Archer I**. The example starts with a retained Cleric I and current Druid I/Archer I. Archer is the result anchor. Mage, Engineer and Soldier are the other three current recruits. The preview labels the retained/draft distinction before the player commits. It contains no future-draw odds or repeated full roster. Use one transformation and wall outcome summary with explicit Combine / Cancel preview. Consumed units are not simply deleted from terrain: their foundations follow the current wall/ruin rules. Selection, preview and pinning never transform anything.

Once committed, five current-candidate cards stop competing with the battlefield. Ready exposes the selected defender inspector through normal map-unit selection. Remove Inspect keeper, permanent recruitment receipts and future-draw odds. A compact bottom-right dock holds only secondary Maze plans and primary Start wave. Start cannot be used to jump to the wave selected in the atlas.

Combat folds away the construction folio. The current assault immediately has a visible identity and counts; its expanded detail and defender detail are reachable without losing the previous inspection context. Use the single reconnaissance wave slot for Current wave while combat is active; do not add a second current-wave banner or show Next wave simultaneously. After the actual wave finishes and construction resumes, switch the slot to Next wave, retaining truthful DPS measurement context. Do not invent Next wave 51 after a completed run. Recipes and Enemy waves remain in the top resource register only. A compact combat dock contains separate Pause and one Speed button showing the current value and cycling between the existing 1x and 2x speeds; there is no full-width footer or extra catalog button set. The compact pinned goal remains a bookmark. Attack Pause on a defender must be distinct from global Pause. The wave and measured DPS retain their own disclosures and saved choices. Existing expanded first-open defaults remain authoritative unless explicitly changed at design review; compact states in these studies illustrate a user's disclosure choice, not a forced reset on selection or phase change.

## Defender inspection

Building and Choose keeper share the same candidate-card and detail components. The displayed-rank detail has quantified effects near identity, I–VI comparison controls, then Damage / hit, Base direct DPS, Range and Interval. Changing displayed rank updates the full numeric/effect profile without changing actual identity or commitment/crafting eligibility. Preview captions must identify a differing rank. Replace generic prose with truthful effect magnitude, duration, area/targets and chance; no extra effect means say so. Base direct DPS is single-target pre-defense and stays separate from measured Peak DPS, MVP and support. Runtime reference for this review corrects Frost Warden to Physical and Archer to a single-target attacker.

Identity, actual rank and legal actions come first, followed by one statistics/abilities core and then support detail. Basic units retain visible I–VI comparison controls. Comparing a rank does not change the unit or authorize actions at that rank. Fixed champions have a fixed champion label instead of six fictitious ranks.

Show actual active family count across ranks, with candidates/reserves/walls excluded. A family count is not ingredient eligibility: a retained Archer III does not satisfy Archer I. Always-visible Potential combinations uses real matching and legality, not guessed future draws. Incomplete possibilities may be inspected, but their action cannot masquerade as an available craft.

MVP level is visible beside identity and on measured DPS rows. Distinguish base hit, pre-defense current modifiers and measured damage. Never treat damage/interval as measured DPS. Support is explained through actual providers, strongest-only rules and ranges. Defenders do not acquire invented HP bars.

## Recipes as a working atlas

The catalog uses compact portrait/name rows, not a long procession of expanded hero cards. Search, damage type, ability, against-defense and availability filters retain their current runtime meaning. The list and selected detail can scroll independently when needed, while essential navigation and the planning action remain reachable.

Selecting Kingslayer in the example does not replace the pinned Elven Ranger. **Pin Kingslayer** changes only the planning goal. It does not craft, reserve ingredients or guarantee future units. An unavailable recipe has a clear missing state and no enabled Craft command. Available retained-only combinations keep their existing legality; the interface must not impose a universal five-placement gate.

Ingredients use portraits, full champion names and exact basic ranks. The three mutually exclusive planning statuses are Built, This round and Missing. Built components cover their allocated subtree exactly once; a consumed leaf cannot reappear as an additional owned ingredient. Duplicates, reserves and unrevealed/current-but-unplaced recruits follow the actual allocator. Full trees expand on demand with readable branches; summaries must not double-count them.

Recipe-list rows show Built basics as built basic ingredients / required, using the sums of ownedCount and count from expandedRecipeProgress. Exclude draftCount from the numerator. A built intermediate champion covers its allocated basic-leaf subtree once. Exact required basic ranks count individually, without conversion into hypothetical rank-I copies. This is planning progress, not craft eligibility. Example inventory and runtime-derived fractions are recorded in the current review: Kingslayer 2/11, King 2/13. Preserve all availability filters, including In progress. Remove the redundant Not this draft caption during Building; remove Future rank odds from Choose keeper and all future odds from combination preview, keeping selected-unit rank comparison.

The two navigation systems stay separate:

- **Previous recipe / Next recipe:** current filtered catalog order, no wrap, disabled at endpoints. In the unfiltered catalog, Kingslayer is page 4/38, preceded by Lionheart Champion and followed by King.
- **Back / Forward in exploration:** the player's inspected-component history, preserving catalog filters and the pinned goal. Inspecting a component outside the filtered list must say so and must not fabricate a list position.

Touch swipe may supplement recipe navigation, but labelled buttons remain available. Changing filters may change ordered neighbors; the catalog must not silently switch to unfiltered order.

## Enemy intelligence

Keep the actual current round distinct from the catalog's selected wave. The future-wave index shows all authored waves and boss milestones. The preview describes possible variants, never a predetermined rolled composition.

For wave 31, shared facts appear once: **22 total invaders, 12,443 HP each, armor 20, three direct-hit shields**. Ashen Dual-Seal Inquisitors have Magical immunity; Spectral Dual-Seal Inquisitors have Physical immunity. They are possible independently rolled forms, not an 11/11 guarantee. Holy's existing interaction with both immunities must remain truthful; this UI work does not implement D001 balancing. There is no extra numerical magic-resistance stat in the current campaign adapter.

If a pair is still mechanically identical, state that honestly. A visual redesign cannot invent differences for wave 29. Moon Clan Evasion and the approved wave-38 regeneration rate must come from current runtime adapters.

Current wave is factual observation. Counts separate enemies on the field from queued enemies. Boss HP appears in one prominent top-center current/max strip below the resource register, using the existing combined model for revealed, living bosses. The side inspector does not repeat the live bar. It includes only revealed, living bosses; concealed or approaching bosses get a status, not leaked HP or coordinates. Individual remaining HP/effects require a revealed selected enemy. Opening the defender inspector must not erase the current-wave context.

## Desktop and iPad layout targets

The studies use approximately 16:10 desktop and 4:3 iPad landscape. These are reference proportions, not a claim that every iPad uses 4:3. The later implementation must also handle iPad Air-style landscape proportions, safe areas, browser chrome and enlarged text.

Desktop uses extra width primarily for the battlefield and side-by-side atlas pages. iPad gives priority to reachable commands, a concise fold-out note and a low muster folio. It must reflow rather than shrink desktop text. No required command depends on hover, tiny map labels or a swipe gesture.

Proposed engineering targets for the later handoff, subject to layout verification:

- Warm paper background around `#F5EBD4`, light paper surface around `#FFFBF0`, dark ink around `#29251F`, restrained brass around `#B18B45`. Cyan and violet retain planning/merge meanings. Color values require final contrast verification; these notes do not certify accessibility.
- Characterful serif headings, clear sans-serif body labels and stable aligned numerals. Text hierarchy should remain calm; one large phase instruction is enough.
- Primary touch commands target at least 48 CSS pixels in height, secondary interactive controls at least 44. Ordinary game text should usually remain 16 CSS pixels or larger on iPad; avoid compressing essential labels to make a dense panel fit.
- Normal construction aims for a roughly 200–240 CSS-pixel folio on sufficiently tall viewports; smaller heights require compact portraits and internal detail scrolling. Raster proportions are illustrative and do not override usable map space.
- Keep the map center clear during normal combat. Context notes attach to an edge or choose a collision-free position; they must not cover the inspected enemy, a pending placement or the primary command.
- Catalogs may claim most of the screen because reading is their task. They retain the resource/reconnaissance context and have a fixed, reachable close/return control. Do not put a second full-screen scroll inside a third nested scroll container.

## Transitions and auxiliary states

Build → Choose preserves the five identities and pin allocation; only the instruction, available actions and selected-detail area change. Preview → Cancel restores the previous selection/draft; Preview → Combine uses the existing guarded Game action. Ready → Combat closes construction-only controls and shows current assault automatically. Combat → next construction restores the folio while preserving the user's panel disclosure choices and identifying the just-completed measurement wave.

Recipe/wave modal exploration uses the existing pause contract: capture the previous paused state, pause while open, and restore exactly that state on closing. Do not always resume an already paused battle. Gallery navigation is unrelated to this game behavior.

Pause and run-ended presentation use the same paper language but are not additional generated screen pairs in this requested scope. Pause retains a clear Resume command, independent Music/Sounds settings and an unambiguous active speed. Results should prioritize factual outcome, reached wave, leaks and measured contributions, with separate Retry and read-only battlefield review. They must not falsely claim that an escaped boss was killed. Existing default Music 80% / Sounds 40% and persistence remain unchanged.

## Acceptance before implementation approval

Review each visual pair for phase clarity, readable map area, reachable primary action and useful information hierarchy. Confirm the new atlas arrangement and the construction-to-combat transition. Once these screens are accepted, freeze the final component/interaction specification, reconcile every approved 0.3.31 requirement and then request or follow the separate implementation instruction. No source-level game implementation is part of this artifact.

Later implementation verification must use actual game state: unrevealed drafts, exact duplicate/recursive allocation, legal retained-only crafts, rank comparison, CP gates, current enemy visibility, boss states, catalog endpoints/history, live versus retained DPS and repeated phase transitions. Generated pixels are neither test evidence nor numeric source of truth. The runtime snapshot and the design rules above take precedence over raster text drift.
