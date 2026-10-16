# Edition 0.4.1 — The Cartographer’s Table, concept fidelity

This follow-up replaces the flat 0.4.0 presentation with the materials, proportions and reading order of the approved concepts. Recipes now open as a bound book with two paper leaves, a central fold, page edges, leather cover, gilt corners, chapter tabs and a pinned-recipe bookmark. The battlefield interface uses fine engraved frames, subtle paper grain, clearer serif typography and framed character cutouts.

The authoritative source remains [the approved handoff](ui-cartographers-table-handoff-20261016/README.md), including all 22 desktop/iPad concepts, the original prompts and three review rounds. Those historical files are preserved. Raster examples guide composition; live game state, exact recipe allocation and current combat adapters supply every displayed identity, number and legal action.

## Mapping the eleven concept states

Each concept has desktop and iPad artwork in the handoff's `reference-ui/` directory. The implementation shares components across phases rather than placing screenshot images over the game.

| Concept | Implemented composition and behavior |
| --- | --- |
| [01 — Building](ui-cartographers-table-handoff-20261016/reference-ui/01-building-desktop.png) | Engraved resource register; Next wave and measured-DPS reconnaissance note; paper preparation folio with exactly five slots, placed recruits, a construction instruction, future odds and optional selected-unit/planning detail. Unplaced identities remain unknown. |
| [02 — Choose keeper](ui-cartographers-table-handoff-20261016/reference-ui/02-choose-keeper-desktop.png) | The same five cards become the keeper decision. Selected cards use a clear cyan frame; actual-rank Keep and legal Merge, Downgrade, Reroll and Reserve remain reachable. The center profile and right planning page use the same paper components as Building. |
| [03 — Combination preview](ui-cartographers-table-handoff-20261016/reference-ui/03-combination-preview-desktop.png) | The folio shows exact allocated physical ingredients, an arrow to the result portrait/profile, and consumed or discarded foundations that become walls. Explicit Combine and Cancel retain the existing identity and allocation guards. |
| [04 — Ready defender](ui-cartographers-table-handoff-20261016/reference-ui/04-ready-defender-desktop.png) | The recruitment folio folds away. A selected retained defender opens the framed map inspector; Maze plans and Start wave occupy the compact command dock. No permanent five-card recruitment receipt remains. |
| [05 — Combat](ui-cartographers-table-handoff-20261016/reference-ui/05-combat-desktop.png) | The map remains central. Current wave replaces Next wave, measured DPS/MVP stays below it, and one compact dock provides Pause/Resume and Speed 1×/2×. Boss aggregate and selected-unit controls retain their existing roles. |
| [06 — Current wave](ui-cartographers-table-handoff-20261016/reference-ui/06-current-wave-desktop.png) | The contextual field report uses the same paper frame. Counts, traits and visible-enemy inspection come from observed/runtime profiles; the presentation does not reveal hidden enemies. |
| [07 — Future waves](ui-cartographers-table-handoff-20261016/reference-ui/07-future-waves-desktop.png) | Enemy Waves opens a numbered atlas index and one selected wave report. The campaign's current wave and the selected atlas page have separate markers. Shared statistics appear once, with actual variant differences in adjacent panels. Previous/Next respects the remaining campaign range and the 10/50-wave cap. |
| [08 — Recipe catalog](ui-cartographers-table-handoff-20261016/reference-ui/08-recipe-catalog-desktop.png) | An open book separates the compact searchable/filterable champion index on the left from the selected recipe on the right. The hero portrait sits beside its identity and four metrics; exact ingredients appear as three illustrated cards. Pin and any legal Recruit champion command remain in a fixed footer outside the scrolling recipe content. |
| [09 — Recipe navigation](ui-cartographers-table-handoff-20261016/reference-ui/09-recipe-navigation-desktop.png) | Filtered Previous/Next and separate exploration Back/Forward remain reachable above the reading pane. Component links, full ingredient chains, Back to list and the pinned bookmark preserve the distinction between browsing, planning and crafting. Kingslayer's next unfiltered recipe remains King. |
| [10 — Three combinations](ui-cartographers-table-handoff-20261016/reference-ui/10-three-combinations-desktop.png) | The planning page keeps the compact potential-combination list visible with a single selected detail. It displays only combinations allowed for the actual selected identity and phase; a displayed comparison rank does not grant a recipe. |
| [11 — Rank comparison](ui-cartographers-table-handoff-20261016/reference-ui/11-rank-comparison-desktop.png) | The same selected-defender profile compares I–VI through the existing display-rank adapter, including the matching transparent portrait, quantified effects and base statistics. Actual rank, commitments, crafting eligibility and RNG remain unchanged. |

The shared paper treatment also covers the existing Help, audio controls, maze tools, results and developer surfaces. It does not add new game rules or replace battlefield models, terrain, animations or effects.

## Book and atlas details

`ui/cartographer-crafted.css` provides the phase materials and composition. Its small native SVG paper/frame assets add grain and engraved corners without changing any approved illustration. `ui/cartographer-book.css`, imported last, owns the book/atlas layout and responsive reading panes.

Desktop Recipes sits near the bottom of the battlefield, leaving the map visible above. The chapter tabs switch between Champions and Basic defenders. Search and the three primary filters remain visible; explanatory filter tools are a secondary disclosure. The index uses compact rows with Built basics progress. That progress continues to use retained recursive allocation and excludes provisional current-draft counts.

The right page separates navigation, scrolling recipe contents, and the fixed action footer. Hero statistics use the existing adapter, with the explicit **Base direct DPS** label. Long effects and full chains scroll inside the content region; the Pin command is not dependent on reaching the end of a long recipe. Small screens show a single readable leaf with Back to list, while preserving the same state and actions.

Enemy Waves uses the new atlas mode without changing the legacy reusable remaining-wave renderer. Numbered pages are inspection controls, not campaign jumps. Selecting another page cannot start a wave, spend resources or roll variants. The selected page, index focus and nested lore survive data refreshes. Completed waves stay excluded according to the existing campaign semantics; sandbox copy does not invent completion history.

Catalog opening/closing still uses the established modal pause contract. Closing restores the prior paused state. Start wave, Demolish and all existing touch/pen identity, cancellation and duplicate-click guards retain their original implementation.

## Transparent original-reference portraits

The 136 UI identities now resolve to separate PNG derivatives in `public/assets/ui/reference-cutouts/`, revision `reference-cutouts-20261016-v1`. These comprise 48 basic ranks, 38 fixed champions and 50 campaign enemy identities. The opaque original crops and the 107 approved source images remain available and unchanged.

The cutout process changes alpha and empty canvas margins. It retains the exact original RGB pixels in the corresponding integer crop rectangle; it does not redraw, recolor or resample runtime artwork. Character pedestals, equipment, crystals and detached flying parts remain part of their original illustration. Pale cloth, silver armor and bow/staff openings receive explicit foreground/background review.

The independent [pixel verification](../output/design/cartographer-ui-v041-20261016/portraits/pixel-verification.json) records real PNG alpha, all 136 immutable original crops, all 107 immutable sources, exact retained RGB, 23 pale-foreground probes and 30,418,257 output bytes. Its manifest SHA-256 is `50babe99b9f67691092a7720d05115311d47ee71f2c4f4871a393f91d981fb9d`. The [portrait review record](../output/design/cartographer-ui-v041-20261016/portraits/visual-review.json) documents inspection of all identities on parchment and dark backgrounds. The [English review gallery](../output/design/cartographer-ui-v041-20261016/portraits/index.html) and [rebuild instructions](../output/design/cartographer-ui-v041-20261016/portraits/README.md) accompany those records.

The runtime namespace and decode guard change together. A stale decode cannot paint a newly selected identity, and an unknown identity cannot fall back to the wrong portrait. Original gallery prompts, approval records and source provenance remain historical evidence rather than rewritten current copy.

## Behavioral review and verification

The book/atlas review covers recipe allocation, filtered ordering, history, component navigation, bookmark navigation, actual guarded crafting, remaining-wave limits, focus/disclosure restoration and absence of game/RNG mutation. One new-book defect found in review was corrected: opening the pinned recipe from the Basic defenders chapter now switches to the Champions reading page while preserving filters and the pinned goal.

The focused book/atlas/grimoire suite passes **77 tests**. It includes new checks that wave 31 retains its exact shared statistics and mutually exclusive immunity variants, that atlas inspection leaves seeded campaign state unchanged, that current-wave markers remain distinct from the inspected page, and that keyboard focus/lore and endpoints survive refresh. [Focused test output](../output/design/cartographer-ui-v041-20261016/book-atlas-focused-tests.txt) and the [code-review receipt](../output/design/cartographer-ui-v041-20261016/book-atlas-code-review.json) record this scope.

The final local suite passes **1,454/1,454 tests** with no failures, skips or cancellations. The production build succeeds with the repository base path. See [final test evidence](../output/design/cartographer-ui-v041-20261016/final-tests-summary.json), [compiled hashes](../output/design/cartographer-ui-v041-20261016/final-build-summary.json) and the [eleven-state comparison gallery](../output/design/cartographer-ui-v041-20261016/index.html). Publication identity and served hashes are recorded separately in the release receipt after deployment.

Integrated browser evidence belongs to `output/design/cartographer-ui-v041-20261016/`. Screenshot capture, viewport geometry and actual input checks are separate evidence from unit tests. The final integration record must identify the source/build actually exercised; intermediate screenshots or earlier test totals do not certify a later revision.

Physical iPad/Safari testing is **not available** in this environment. Desktop browser checks at iPad-sized viewports, including low-height layouts, are responsive-layout evidence. They do not certify physical touch hardware, mobile Safari behavior, all safe-area combinations or every phase at every zoom level.

## Preservation and rollback

The [protected-file audit](../output/design/cartographer-ui-v041-20261016/preservation-audit.json) compares against `ed9527a0bcd005df8987145f75a3bac16be880ab`. It records unchanged core, renderer, data, backend, audio code, existing public assets and the approved handoff. This includes 352 original GLB files and 205 original MP3 files. New transparent UI derivatives are separate files; no original character/model/audio asset is replaced by those derivatives.

The 0.3.31 recovery point remains `v0.3.31-stable` and `codex/backup-v0.3.31`, both identifying `c01ac5a2ab1ef62e77d2ce545f24234b80b5c847`. Verified offline source and production archives remain in the primary workspace's `backups/releases/v0.3.31/`. The prior 0.4.0 final runtime is separately retained by `v0.4.0-final` at `993a1ee1289fa137a68b7bbdad48b81b2e18befe`.

See [rollback instructions](ROLLBACK_0.3.31.md). The existing helper defaults to a read-only preflight; explicit deployment uses the main workflow with the stable release reference. This UI follow-up does not rewrite recovery tags, reset repository history, migrate statistics or change the statistics-service deployment.
