# UI refinements 0.4.5 — 18 October 2026

This follow-up addresses the eight comments made against 0.4.4. Current UI copy and this report are in English. Historical prompts, approved artwork and previous release records remain unchanged.

**Release status: published and verified.** Release [`0e651f0d8b3d25b8dc1ac1eae5e672977d5b91df`](https://github.com/sinaglr-eng/bastions-of-the-last-kingdom/commit/0e651f0d8b3d25b8dc1ac1eae5e672977d5b91df) is tagged `v0.4.5`. All **1,562 tests**, the **199-module** build, [Pages CI](https://github.com/sinaglr-eng/bastions-of-the-last-kingdom/actions/runs/39144470172) and **207 public GET/hash checks** pass.

## Scope and preservation

The immutable isolated-source baseline is `c0af485e1107ee8a907839359d2d98bdc520362f`. The saved MAIN snapshot protects 830 paths. The 0.4.5 mirror and staging helpers use explicit task path lists. They reject unexpected MAIN content, changed payloads, redirected paths and changed Git indexes. README and CHANGELOG use reviewed three-way candidates to preserve pre-existing MAIN documentation.

Existing approved portraits, cutouts, FRONT derivatives, result images, models, audio, concepts, prompts and historical evidence are protected. New outcome variants belong in their own versioned directory. Renderer modules are protected without exceptions in this release's preservation audit. Preparing release helpers does not apply a mirror, stage files, commit or publish.

## Comment record

| Comment | Requested change | Implementation and review |
| --- | --- | --- |
| 1 | Remove the static book page numbers completely. | Both page-number elements and their accessibility labels are removed from the shared catalog markup. This also covers Basic defenders and the selected recipe page. The unused number styling is removed. |
| 2 | Make the recipe filters smaller and simpler. | Three labeled selects sit above compact progress choices and a live count. The desktop toolbar measures 83.86 pixels high, compared with the selected 154-pixel region; selects are 30 pixels and progress choices 27 pixels. All three phone filters remain on one row with 36-pixel controls. |
| 3 | Remove the campaign-length choice and keep the current map at 50 waves. | The selector, its change handler and mutable mode are removed. Normal new games always use the full authored 50-wave roster. Help describes that campaign. Historical scores and developer/core support for older test runs remain intact. |
| 4 | Replace the unrevealed defender illustration with a simpler mystery symbol. | A single large native question mark replaces the figure, tile and arrow. The visible and accessible placement instruction remains. Rendering does not inspect hidden defender identities or consume simulation randomness. |
| 5 | Keep Potential combinations collapsed by default. | The whole native disclosure and its recipe details start closed. The first deliberate click opens the selected detail. Manual open/close survives rank changes, sidebar rerenders and movement into the preparation folio. |
| 6 | Count built defenders at the rank currently being inspected. | The family and displayed rank determine the count. Native review of an actual rank I Stormcaller shows 1 at rank I, 2 at rank II and 0 at rank III; the actual selected defender remains rank I. This intentionally supersedes the 0.4.4 actual-rank count. |
| 7 | Move the unit attack pause control beside the defender name and make it smaller. | One 28-pixel pause/play control sits beside the name, with an accessible action label, native tooltip and pressed state. Coarse-pointer targets use 36 pixels. The bottom duplicate is removed; targeting remains below. The command affects the actual defender even while another rank is inspected. |
| 8 | Add several result-image variants with different actual defenders and enemies, and choose between them randomly. | Four new ImageGen scenes join the two preserved 0.4.4 scenes: three defeats and three victories. Each ended attempt selects randomly, excludes the preceding same-outcome scene, and caches its choice when reopened. Separate presentation randomness never consumes Game.rng or changes gameplay fields. |

The book's bowed paper silhouette, continuous center crease and native decoration are retained. All three damage/ability/defense filters and the All / Available / In progress choices remain functional. Removing static leaf numbers does not remove working previous/next recipe navigation or its changing ordinal.

## Validation record

- [Book focused checks](../output/design/ui-refinements-v045-20261018/book-focused-tests.log): 43 passed. These exercise real catalog filtering, progress allocation, rank profiles, recipe navigation, selection, pinning and state preservation. The catalog contract also rejects static page-number markup in champion, basic and selected-recipe states.
- [Folio focused checks](../output/design/ui-refinements-v045-20261018/folio-focused-tests.txt): 69 passed, including actual rank counts, native disclosure preservation, hidden-card safety and actual pause commands.
- [Outcome checks](../output/design/ui-refinements-v045-20261018/outcome-art-tests.log): 19 passed, including PNG provenance, stable reopening, actual Sandbox replay and unchanged simulation state/RNG.
- [Final complete validation](../output/design/ui-refinements-v045-20261018/local-validation-final.json): 1,562/1,562 tests and 199 modules, no source changes during or between tests and build. The first full run's one obsolete campaign-selector expectation is retained in tests-first-attempt.log and validation-first-attempt.json; its narrow fixture repair asserts that the removed control stays absent.
- [Verifier fixtures](../output/design/ui-refinements-v045-20261018/public-verifier-tests.log): 19 passed. [Actual local build smoke](../output/design/ui-refinements-v045-20261018/local-public-checker-smoke.json): 207 local fixture requests passed; this is not a public deployment claim.
- [Preservation audit](../output/design/ui-refinements-v045-20261018/preservation-audit.json): all 3,100 protected baseline files match, including every renderer module, 600 model files, 205 audio files and all prior public assets. All 830 captured MAIN paths and both indexes were unchanged before handoff.
- [Native browser review](../output/design/ui-refinements-v045-20261018/browser-qa.json) records actual UI states and responsive geometry. Physical iPad/Safari certification is unavailable.
- Publication and delivery evidence are recorded below.

## Outcome artwork

[The new manifest](../public/assets/ui/results/v045/manifest.json) records every exact built-in ImageGen prompt, all ordered approved reference hashes, visual reviews and untouched output PNG hashes. The original 0.4.4 manifest and images are unchanged.

The new defeats show Elven Mage/Elven Ranger beneath Mogrok/Orc Mirror Shieldbearer, and Paladin/Baby Fire Dragon beneath Silent Orc Executioner/Bloodwolf Orc Rider. The victories show King/Elven Elite Warrior and Lady Claire/Archangel over defeated Bernhard and his wyvern, with different subdued enemies. Artwork illustrates campaign outcomes; actual recorded Sandbox facts remain independently factual.

The initial development server was started before the new public images existed and did not rescan its ignored public tree. Its retained early defeat capture has an unloaded image; final outcome checks use the finished production build with all PNGs served, rather than treating that early capture as proof.

## Published verification and delivery

- [Exact-commit CI proof](../output/design/ui-refinements-v045-20261018/publication-ci-proof.json): test, build, artifact upload and publish all passed for `0e651f0d8b3d25b8dc1ac1eae5e672977d5b91df`.
- [Public verification](../output/design/ui-refinements-v045-20261018/public-verification.json): 207 successful GETs, exact HTML and all five compiled hashes, 136 original cutouts, legacy crimson, 50 FRONT derivatives, the previous city scene, both 0.4.4 scenes and all four 0.4.5 variants. Complete metadata and ordered reference hashes are preserved; PNG/compiled bytes match exactly.
- [Public browser QA](../output/design/ui-refinements-v045-20261018/public-browser-qa.json): the deployed 50-wave UI and compact book without static page numbers were verified through two native browser captures. All 42 catalog portraits loaded; no browser errors or warnings were reported.
- [Final guarded delivery](../output/design/ui-refinements-v045-20261018/final-delivery.json): owned MAIN payloads match the reviewed bytes, pre-existing README/CHANGELOG edits survive clean three-way merges, all unowned captured paths and the MAIN index remain unchanged.

The deployed runtime remains unchanged by the documentation/evidence follow-up. The 0.3.31 recovery point and earlier release tags are preserved.

<!-- V045_RELEASE_GATES_COMPLETE -->
