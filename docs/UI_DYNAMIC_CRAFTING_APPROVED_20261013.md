# Approved dynamic crafting and recipe UI

**Decision D005 · APPROVED DESIGN — IMPLEMENTED IN 0.3.28**

Approved on October 13, 2026. This is the implementation handoff for the latest three concept boards, across desktop, iPad landscape and mobile landscape. D004 remains the approved DPS placement requirement.

The user separately authorized implementation in **Master verze hry** on October 13, 2026. Release 0.3.28 implements this handoff; [implementation and verification](AUDIT_IMPLEMENTATION_20261013.md) records the acceptance evidence. The original design approval, images, prompts and review records remain unchanged.

## Approved visual references

| Reference | Approved behavior |
| --- | --- |
| [Champion combination available](../output/design/ui-crafting-pinning-20261013-v1/01-champion-available.png) | Contextual champion preview, exact ingredients and states, result foundation, consumption/wall consequences, explicit Recruit champion action. |
| [Pinned recipe during building: expanded DPS](../output/design/ui-crafting-pinning-20261013-v1/02-pinned-building-expanded.png) | Persistent pinned goal and ingredient progress near the battlefield, matching revealed recruit highlights, expanded DPS below Next wave. |
| [Pinned recipe during building: compact DPS](../output/design/ui-crafting-pinning-20261013-v1/03-pinned-building-compact.png) | Same planning state with the DPS score retained in an expandable narrow line below Next wave. |

The approved images must remain unchanged. Their original prompts, recorded review notes and generation manifests remain historical evidence. The [approval record](../output/design/ui-crafting-pinning-20261013-v1/approval.json) identifies the selected files by SHA-256 hash.

Approval covers the dynamic layout, hierarchy, state distinctions and interaction treatment in these three references. Use actual runtime values, legally eligible ingredients and existing approved assets when implementing. Generated enemy placeholders, fixture DPS values, approximate device proportions and accidental miniature positions are not production specifications.

Other audit topics and older visual studies retain their independently recorded approval states. D001–D004 retain their existing decisions.

## 1. Dynamic champion combination

- Derive availability from the game's legal recipe/inventory/phase rules and selected matching ingredient. The Elven Ranger example uses Cleric I + Druid I + Archer I; the interface must support the existing champion catalog, not only this example.
- When a combination is available, show the champion name, existing approved portrait, exact ingredient family/rank, ingredient states and a prominent **Recruit champion** action.
- Preview the champion at the selected eligible ingredient's foundation. Distinguish that result foundation, consumed ingredients and other current candidates that become walls when the draft is committed. Previously retained unrelated defenders remain outside that outcome.
- Selecting a recipe or previewing a result must not commit the keeper, consume ingredients or create a champion. The explicit craft action is reachable on every device; existing shortcuts retain their current rules.
- Keep alternatives visually distinct: a legal Keep action, same-family rank Merge, champion crafting and recipe pinning must not appear as the same operation.
- Disable or omit an unavailable craft action with a concise contextual reason. Current-draft ingredients require all five placements before commitment. Retained-only ordinary combinations remain available wherever current game rules permit; do not introduce a blanket five-placement gate for them.
- Refresh preview/availability after placement, selection, reroll, reserve, merge, crafting or an inventory change. Stale highlights must not authorize an invalid action.

## 2. Pinned recipe during construction

- Keep the pinned champion goal visible near the map throughout construction, with its name, a compact approved portrait, progress and **Unpin**.
- Show exact family/rank requirements and three distinct states using both text and symbols: **Built** (check), **This round** (diamond) and **Missing** (hollow circle).
- Separate committed ownership from current-draft availability. Example: Cleric I = 1/1 Built; Druid I = 0/1 Built +1 This round; Archer I = 0/1 Built / Missing. Summary: 1 built, 1 this round, 1 missing. Do not call this two permanently owned ingredients.
- Highlight only matching, already revealed, eligible recruits in the five-card draft and on the map. Unrevealed slots stay unrevealed, and an inactive/reserved defender must not become a usable ingredient through a visual badge.
- Provide an expandable full ingredient chain using existing recursive recipes and allocation rules. A component champion satisfies its corresponding subtree without double-counting consumed ingredients as separate inventory units.
- Pinning is a planning action and does not consume, reserve or guarantee a recruit. A missing ingredient is a requirement, not a prediction of an upcoming draw.
- Keep the phase instruction accurate: Place recruits 3/5, Choose your keeper 5/5, or Ready. The current draft contains exactly five slots; retained defenders are not extra draft cards.

## 3. Next wave and DPS

- Keep **Next wave above DPS** on all three device classes. Recipe inspection and pinning must not move DPS into the recipe panel, above Next wave or behind a scoreless menu entry.
- Provide independent expanded and compact states. Expanded DPS shows its existing measured ranking. Compact DPS retains a measured score, sufficient context to identify its meaning, and a reachable expand control.
- Preserve the user's disclosure choice during selection and phase updates within a run; avoid automatically expanding every panel when a recruit is selected.
- Retain the existing peak actual DPS over a five-game-second window. During building, label retained measurements with the completed wave. Do not substitute catalog damage/interval, forecast damage, sum unrelated peak values or invent performance for a new draft.
- Before the first combat, display a truthful not-measured state. The concept values 7.0 and 2.9 are illustrative and must never be hard-coded as live scores.
- Use runtime enemy information and the existing disclosure/detail entry for Next wave. Generated Wave 3 placeholder counts and HP are not authoritative.

## 4. Responsive layout and visual treatment

- Desktop: a dominant battlefield, short Next wave/DPS overlays, an adjacent contextual recipe/combination dock and the five-slot construction strip.
- iPad landscape: a compact touch dock, readable ingredient states, reachable actions and a usable five-slot strip. Preserve the same phase/recipe/DPS semantics.
- Mobile landscape: a low construction strip and a collapsible compact recipe/combination drawer. Keep the result/craft action reachable without long page scrolling. Keep the DPS score directly below Next wave, even when the drawer is open.
- Reuse the existing low-poly artwork, square 37 × 37 battlefield, dark teal panels, cream headings, gold primary action and established selection styling. Implement actual device proportions rather than raster-board geometry.
- Use symbols plus readable labels for selection, ownership, provisional ingredients, missing requirements and wall outcomes. Disclosure actions and tooltips must work with touch and focus; verify control size and readability on real devices.
- Conversation language remains Czech. This gallery and its documentation remain English. Use the game's existing localization conventions when implementing player-facing copy.

## Integration targets

Inspect the current versions before editing: game/main.js, ui/grimoire.js, ui/draft-cards.js, ui/recipe-marker-input.js, ui/tower-dps.js, game/core/recipes.js, game/core/game.js, recipe/map markers and the responsive battlefield/draft styles.

The intended change is UI presentation and behavior around existing rules. No new champion recipes, costs, currencies, balance adjustments, automatic keeper selection or regenerated production art are part of D005.

## Acceptance checks after implementation

1. With all five current recruits placed and a legal mixed retained/draft recipe, the UI previews the exact result foundation and ingredients; selection alone changes nothing, and explicit crafting produces the existing legal outcome.
2. During a three-of-five placement state, the pinned goal distinguishes Built / This round / Missing, highlights only revealed usable recruits and preserves exactly five slots.
3. Complete and incomplete ingredient inventories, duplicate ingredient requirements, nested champion components, reservations, rerolls and secret current-round-only rules retain their actual legality and correct counts.
4. Expanded and compact DPS remain below Next wave on desktop, iPad landscape and mobile landscape. The compact state retains a meaningful score; disclosure choices survive routine UI updates.
5. Before first combat, no score is invented. During later construction, measurements identify the completed wave; new draft units are not presented as measured combat performers.
6. Primary actions, all draft slots and essential progress remain reachable at representative desktop, 1024 × 768 iPad landscape and 844 × 390 mobile landscape sizes, including safe areas and larger text. Verify touch and focus behavior with actual interaction.
7. Existing approved assets and gameplay/balance behavior are preserved, and recipe/keeper progression checks pass. These checks are pending; no implementation has been verified in this approval step.

## Handoff state

The design is ready for the separately authorized implementation step in Master verze hry. No message has been sent to that chat, no implementation branch has been created and no gameplay change has been made here.
