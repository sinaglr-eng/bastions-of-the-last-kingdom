# UI refinements 0.4.2 — 18 October 2026

This follow-up addresses the 39 browser comments made against release 0.4.1. It keeps the Cartographer’s Table art direction while reducing the space occupied by construction controls and field notes, repairing rank-sensitive recipe planning, and improving the open-book catalog. Interface copy and this report are in English.

## Scope and implementation

Recipe inspection remains separate from a real defender’s identity. Changing the viewed rank changes its displayed statistics and possible combinations, but never upgrades the defender, invents an ingredient, spends resources or rolls a hidden draw. Actual creation still requires the existing exact physical allocation and a current foundation/inventory validation key.

The requested speed choices are now **1× → 2× → 3× → 5× → 1×**. Existing combat rules and damage formulas remain authoritative. The new MVP award beam is a transient presentation of a real award, rather than a new source of damage or MVP progression.

## Comment-by-comment record

Test links identify the relevant behavioral coverage. Screenshot and geometry checks are separate from those tests; a test of a renderer or DOM boundary does not certify native browser layout or physical touch hardware.

| Comment | Implemented behavior | Verification scope |
| --- | --- | --- |
| 1 | Wave uses a banner icon that represents an approaching assault. | Header markup and initial desktop browser review. |
| 2 | Command Points uses its own star-emblem token, distinct from Wave. | Header markup and initial desktop browser review. |
| 3 | The preparation folio, five portraits, introductory note and spacing are smaller. Legal actions retain usable target sizes. | Initial 1,715 × 1,244 browser review; [layout tests](../tests/cartographer-layout-v040.test.mjs) preserve shared node ownership and five-slot behavior. |
| 4 | The Next/Current wave note is narrower, with smaller portrait and type spacing. Abilities remain contained under the profile. | Initial desktop browser review; [shared wave-panel integration tests](../tests/battlefield-panel-main-integration.test.mjs). |
| 5 | Folio Potential combinations follows the chosen display rank, not an unrelated actual-rank list. Hypothetical suggestions are marked as planning. | [Rank-planning tests](../tests/preparation-recipe-planning-v042.test.mjs) cover all six ranks of every basic family without Game or RNG mutation. |
| 6 | An expanded champion lists its later combinations. Following one changes the planning context to that champion; Back restores the previous context. | [Planning navigation and downstream tests](../tests/preparation-recipe-planning-v042.test.mjs). |
| 7 | The command inspector is narrower and bounded in height, with smaller identity and statistic spacing and a scrollable content sheet. | Responsive CSS; integrated browser checks remain recorded separately. |
| 8 | The same displayed-rank recipe model is used in the map inspector and preparation folio. | [Production rank-preview tests](../tests/defender-rank-preview.test.mjs). |
| 9 | Clicking the active recipe row collapses it. The default-first-row fallback no longer immediately reopens a collapsed row. | [Collapse/reopen regression](../tests/preparation-recipe-planning-v042.test.mjs). |
| 10 | Maze plans is available at the beginning of construction, before the first placement, and throughout keeper selection and Ready. Start remains exclusive to Ready. | [Actual production map-action test](../tests/cartographer-layout-v040.test.mjs) plus initial browser review. |
| 11 | Adds 3× to the speed cycle. | [Combat-control tests](../tests/header-combat-controls.test.mjs); public/browser verification is tracked separately. |
| 12 | Removes the explanatory armor/immunity paragraph from the selected-enemy inspector. Actual enemy statistics and effects remain. | [Enemy inspection integration](../tests/battlefield-panel-main-integration.test.mjs) and selected-enemy markup. |
| 13 | The Recipes book has equal facing leaves and a narrow gutter aligned to their actual boundary; page furniture and reading areas are separated. | [Catalog tests](../tests/catalog-recipes-d006.test.mjs); visual fidelity requires the integrated book screenshots. |
| 14 | Removes the Back to list button. On small screens, Recipe index and Selected recipe tabs provide explicit page access. | [Catalog navigation tests](../tests/recipe-navigation-v30.test.mjs). |
| 15 | Removes Back in exploration from the Recipes book. | [Catalog navigation tests](../tests/recipe-navigation-v30.test.mjs); ordered recipe navigation remains. |
| 16 | Removes Forward in exploration from the Recipes book. | [Catalog navigation tests](../tests/recipe-navigation-v30.test.mjs). |
| 17 | Ingredient trees use dark ink, readable heading/status sizes, stronger branch lines and distinct owned/current/missing colors, including aggregate totals. | Book CSS and [grimoire/catalog tests](../tests/catalog-recipes-d006.test.mjs); native contrast/layout review is separate. |
| 18 | The pinned bookmark is straight rather than rotated. | Book CSS; integrated screenshot review. |
| 19 | The single Pin/Unpin control sits in the fixed top heading beside the selected champion’s name. It remains outside the recipe body’s scroll area. | [Catalog tests](../tests/catalog-recipes-d006.test.mjs) preserve actual Pin behavior and distinguish it from guarded crafting. |
| 20 | The full combination-plan pane owns native scrolling. Only that outer pane contains overscroll; intermediate dock elements allow scroll propagation. | Native wheel review over the inner content moved the outer pane from 0 to 573.33 pixels (250-pixel viewport, 824-pixel content). See [the successful scroll capture](../output/design/ui-refinements-v042-20261018/08-pinned-plan-wheel-scroll.jpg). Physical touch remains uncertified. |
| 21 | Collapsing the dock moves that same recipe node into a compact strip outside the folio, frees the planning pane and preserves focus. Reopening returns it to the pane. | [Native disclosure/DOM ownership regression](../tests/cartographer-layout-v040.test.mjs). |
| 22 | Crafting history uses compact Back/Forward labels with explicit accessibility names. Separate Previous/Next controls follow the actual recipe order. | [Dock state/focus tests](../tests/crafting-dock.test.mjs) and [recipe navigation tests](../tests/recipe-navigation-v30.test.mjs). |
| 23 | Adds 5× to the speed cycle. | [Combat-control tests](../tests/header-combat-controls.test.mjs). |
| 24 | Removes Preview combination from the Potential combinations detail. Ingredient and downstream planning remain visible. | [Preparation tests](../tests/preparation-folio-v040.test.mjs) assert that the removed button is absent. |
| 25 | Legal Create [champion] controls appear beneath the draft commitment controls. They create at the selected real foundation using an exact current validation key. A hypothetical viewed rank supplies no creation token. | [Actual creation/stale-key tests](../tests/preparation-recipe-planning-v042.test.mjs) and [production crafting integration](../tests/crafting-main-integration.test.mjs). |
| 26 | MVP information is always expanded directly below Move. Actual retained-unit Damage / hit and Direct DPS include current MVP and support contributions, with base and individual bonus/penalty lines. A different-rank comparison remains a base-only preview. | [Effective-stat tests](../tests/defender-effective-stats-v042.test.mjs) compare the display model with real projectile damage and attack cadence. |
| 27 | Current support effects appears below MVP and before the main profile. Providers and penalties remain derived from actual active effects. | [Effective-stat ordering tests](../tests/defender-effective-stats-v042.test.mjs) and [defender panel tests](../tests/defender-panel-preview-v30.test.mjs). |
| 28 | Downgrade & keep has the same 48-pixel height as its neighboring commitment actions. | Responsive CSS; [actual-rank downgrade tests](../tests/defender-rank-preview.test.mjs) retain gold, reserve and identity guards. |
| 29 | A real MVP award briefly illuminates its defender with a narrow warm light beam and floating MVP +1. The 3.2-second cosmetic effect follows that tower, fades, deduplicates awards and disposes its resources. Reduced motion keeps the effect still. | [MVP presentation tests](../tests/mvp-presentation.test.mjs); the award and bonus mechanics are unchanged. |
| 30 | Keeping, merging or creating a final defender leaves the inspector closed. Explicitly clicking a defender or enemy opens its details. | [Actual combine/reselection integration](../tests/cartographer-layout-v040.test.mjs) and [phase integration tests](../tests/phase-main-integration.test.mjs). |
| 31 | Removes Return to battlefield from the bottom of Enemy Waves; the dialog’s close control remains. | [Enemy atlas navigation tests](../tests/enemy-catalog-navigation.test.mjs). |
| 32 | Removes the bottom Next wave button; the numbered wave index remains the navigation surface. | [Enemy atlas navigation tests](../tests/enemy-catalog-navigation.test.mjs). |
| 33 | Removes the bottom Previous wave button. | [Enemy atlas navigation tests](../tests/enemy-catalog-navigation.test.mjs). |
| 34 | Enlarges the enemy portrait area to 290 × 360 pixels on desktop, with responsive smaller-screen sizes. | Atlas CSS; integrated screenshots verify the actual available space. |
| 35 | Lore and guidance starts expanded. A player’s subsequent collapse choice survives refresh. | [Warband markup tests](../tests/warband-cards.test.mjs) and [atlas refresh tests](../tests/enemy-catalog-navigation.test.mjs). |
| 36 | Adds 50 distinct English campaign chronicles. Disposable orc slaves open the campaign; organized warbands, specialists and warlords lead toward Bernhard and the Wyvern Queen. These are UI stories, not new statistics or abilities. | [Lore coverage/preservation tests](../tests/enemy-campaign-lore.test.mjs) cover all 50 identities and immutable source data. |
| 37 | Lord Bernhard uses a separate transparent portrait extracted from the previously approved dark-crimson reference. No original portrait is recolored or replaced. | [Provenance manifest](../public/assets/ui/portrait-variants/manifest.json), RGB-preserving extraction and [portrait tests](../tests/reference-cutouts.test.mjs). |
| 38 | Page footers occupy their own flex row outside the reading scroll area. Expanded How recipes work has its own bounded area rather than painting beneath the footer. | Book CSS and [catalog tests](../tests/catalog-recipes-d006.test.mjs); integrated screenshots verify overlap clearance. |
| 39 | Removes meaningless empty inner-corner frames and adds real page-number badges, 1 and 2, to the facing pages. | [Catalog markup tests](../tests/catalog-recipes-d006.test.mjs) and integrated book review. |

## Validation status

The first complete run exposed obsolete fixture imports and expectations after the requested interface changes. The fixtures now bind the actual planning helpers, DOM hosts and requested behavior. Added production regressions verify that changing an actually craftable Lady Claire ingredient from displayed V to VI removes Create, returning to V restores it, and repeated HUD refreshes use the run-local rules without needlessly replacing unchanged metric nodes.

The final complete suite passes **1,480/1,480 tests**, with zero failures, skips or cancellations. The production build passes with `VITE_BASE_PATH=/bastions-of-the-last-kingdom/` and transforms 190 modules. Vite retains its nonfatal large-chunk warning. The [final validation receipt](../output/design/ui-refinements-v042-20261018/local-validation-final.json) records the exact totals and compiled asset hashes; [test output](../output/design/ui-refinements-v042-20261018/tests-final.log) and [build output](../output/design/ui-refinements-v042-20261018/build-final.log) preserve the actual runs. The [test-source snapshot](../output/design/ui-refinements-v042-20261018/sources-tested-final.json) covers 391 files. A subsequent responsive correction changes only `ui/cartographer-refinements.css` to prevent Create-row clipping; the production build was rerun afterward. The other 390 files, including all runtime JavaScript, campaign data and tests, remain unchanged. The [final build-source snapshot](../output/design/ui-refinements-v042-20261018/sources-built-final.json) and receipt identify this CSS-only difference explicitly.

Initial native browser review at **1,715 × 1,244** confirmed the smaller construction folio, a **224-pixel** field-note width and Maze plans visible before construction. Additional state, book, scrolling and responsive reviews are still in progress. Evidence belongs to [the 0.4.2 evidence directory](../output/design/ui-refinements-v042-20261018/); the initial [compact-building capture](../output/design/ui-refinements-v042-20261018/01-compact-building-desktop.jpg) records that intermediate review.

<!-- V042_FINAL_VALIDATION_PENDING: Local final tests/build passed. Add the root browser-review record and, after publication, exact source commit, CI run, public asset verification and evidence links. Do not infer public verification from the local build. -->

**Local test and build verification passed.** Integrated browser signoff and publication receipts remain pending. No deployment commit, successful CI run or public-runtime verification is claimed by this report yet.

Physical iPad hardware and Safari are unavailable in this environment. Desktop browser checks at iPad-sized viewports establish responsive layout evidence only; they do not certify mobile Safari, touch hardware, every safe-area combination or every zoom level.

## Portrait provenance and preservation

The original 136 approved reference portraits and their 0.4.1 transparent derivatives remain unchanged. Bernhard’s requested crimson appearance is an additional UI derivative with a separate source and manifest:

- Source: `public/assets/ui/portrait-variants/lord-bernhard-crimson-reference.png`, SHA-256 `e57b84ce6650d7633003e7599ec064f310cfc408ed70de5af2e9d75e8b8cce32`.
- Cutout: `public/assets/ui/reference-cutouts/host_50-crimson.png`, SHA-256 `61a4a3e4dae617b6af817d3f825aee707012adb104b357678465f80272eaa82a`.
- Rebuild: [build-bernhard-crimson-cutout.py](../tools/build-bernhard-crimson-cutout.py). Extraction changes alpha and empty margins, preserves the approved RGB pixels exactly, and performs no AI repainting, recoloring or resampling.

The 50 new chronicles live in the UI layer. They leave source enemy definitions, wave composition, threat/counter facts, balance, recipe allocation, hidden-draw rules and statistics contracts intact. Renderer changes are limited to the requested award presentation. Historical prompts, approvals, original art, models and audio remain historical evidence rather than being rewritten as new copy.

## Rollback

The existing 0.3.31 recovery points remain `v0.3.31-stable` and `codex/backup-v0.3.31`, identifying `c01ac5a2ab1ef62e77d2ce545f24234b80b5c847`. The verified offline source and production archives remain in the primary workspace’s `backups/releases/v0.3.31/`. Earlier release tags and history are preserved.

See [the rollback instructions](ROLLBACK_0.3.31.md). This refinement does not rewrite recovery tags, reset history, migrate statistics or redeploy the statistics service.
