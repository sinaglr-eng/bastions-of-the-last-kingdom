# 0.4.0 acceptance evidence coverage

This receipt maps A01–A29 in `docs/ui-cartographers-table-handoff-20261016/ACCEPTANCE.md` to the implementation evidence available on 2026-10-16. It is a coverage inventory, not a certificate that every permutation of all 29 scenarios was exercised in a browser. No tests, network publication, source changes or deployment actions were performed while preparing this receipt.

The implementation baseline is the approved 0.3.31 source `c01ac5a2`; the initial published 0.4.0 implementation is `d010e295e4955d3506258a48e20d9203602d07dc`. All test paths below are relative to the repository root. Evidence paths without a prefix are relative to this directory. Historical design-package verification establishes preparation provenance; it is not evidence that the implemented game passes.

## Evidence types and release snapshot

- **Automated:** the actual implementation tests named below are included in the existing `tests-release.log`: 1,448 passed, zero failed, cancelled or skipped. These include actual Game state, production UI functions and real input handlers where indicated. A passing JavaScript test does not establish physical screen layout or hardware input behavior.
- **Browser:** `browser-layout-checkpoints.json` records 30 state/geometry checkpoints plus the interactions listed in its `additionalChecks`. Screenshots demonstrate their recorded states and dimensions. The seven `final-viewport-building-*` images were captured after the renderer completed a frame; these supersede earlier immediate-resize Build screenshots. Representative screenshots do not establish the full cross-product of every scenario and viewport.
- **Build:** `build-release.log` and `build-repository-base.log` record successful root-base and GitHub repository-base production builds. The ordinary Three.js chunk-size advisory remains an advisory.
- **Published bytes:** `publication-ci-initial.json` records run [38897567377](https://github.com/sinaglr-eng/bastions-of-the-last-kingdom/actions/runs/38897567377), exact head `d010e295e4955d3506258a48e20d9203602d07dc`, with tests, build, artifact upload and Pages deployment successful. The immutable receipt `public-http-v040-initial-2026-10-16T121015788Z.json` checks 259 served files: 136 portraits, 113 MP3s, five compiled files, two audio catalogues, one portrait manifest and two metadata files. All checks passed. The MP3 total is 17,342,625 bytes. Its defined hash/MIME/text-normalization boundaries apply; this is not a re-download of every public asset.
- **Audio decode:** `browser-audio-decode.json` records actual browser AudioContext decoding of 92 selection voices and 21 bank clips, all 113 successful, with the music cache at two buffers. Its recorded origin is `http://127.0.0.1:5194/?debug&seed=4040`. This proves local browser decoding, not HTTPS decoding or a listening review of every clip. Public MP3 byte identity is established separately by the HTTP receipt.
- **Rollback snapshot:** `publication-ci-rollback.json` records successful tests/build/deploy for dispatch [38898797381](https://github.com/sinaglr-eng/bastions-of-the-last-kingdom/actions/runs/38898797381). `public-http-v0331-rollback-2026-10-16T121600156Z.json` verifies the served 0.3.31 rollback, including five compiled files and all 113 active MP3s. At receipt preparation, `publication-ci-restored.json` records return-to-0.4 dispatch [38899342990](https://github.com/sinaglr-eng/bastions-of-the-last-kingdom/actions/runs/38899342990) as in progress. Final return-to-0.4 success and its fresh served identity remain a follow-up gate. Workflow `headSha` identifies the main workflow context; dispatched checkout identity also requires the checkout/served-release evidence.

## A01–A29 mapping

### A01 — Build and Select continuity

Automated: `tests/preparation-folio-v040.test.mjs`, `tests/cartographer-layout-v040.test.mjs`, `tests/phase-main-integration.test.mjs` cover shared five-slot presentation, hidden unplaced slots, legal phase actions and actual phase transitions. Browser: `final-viewport-building-1440x900.jpg`, `final-viewport-building-1024x768.jpg`, `reviewed-select-desktop.jpg` and `reviewed-select-ipad.jpg` show representative Build/Select geometry. Coverage is automated semantics plus recorded desktop/iPad-size layouts; not every placement count at every viewport.

### A02 — Hidden identities and silent inspection

Automated: `tests/preparation-folio-v040.test.mjs`, `tests/draft-presentation.test.mjs`, `tests/recipe-navigation-v30.test.mjs`, `tests/portrait-visibility.test.mjs` cover hidden-slot markup/request identity, pin allocation, legal revealed inspection and preservation of actual state. Browser: representative hidden Build cards in `final-viewport-building-1024x768.jpg`. No exhaustive native network trace of every hidden-slot/rank/pin permutation is claimed.

### A03 — One truthful Build odds row

Automated: `tests/cartographer-layout-v040.test.mjs`, `tests/preparation-folio-v040.test.mjs`, `tests/mastery-support-display.test.mjs` cover the retained odds model and phase-specific visibility. Browser: final Build images, `reviewed-select-ipad.jpg`, `reviewed-ready-ipad.jpg` and `publication-exact-preview-ipad.jpg` show the representative phases. Select, exact preview and Ready do not acquire a second future-draw row.

### A04 — Rank comparison and actual-rank commands

Automated: `tests/preparation-folio-v040.test.mjs`, `tests/defender-rank-preview.test.mjs`, `tests/defender-panel-preview-v30.test.mjs` exercise actual Archer II versus displayed higher-rank statistics, focus/labels, preview reset and unchanged actual Keep/craft identity. The Archer II baseline 12/48/4/0.25 and IV 48/192/4/0.25 are test fixtures, not a claim about an independently measured native session. Browser: `publication-rank-comparison-ipad.jpg` demonstrates the comparison presentation in Ready.

### A05 — Quantified effects from the displayed profile

Automated: `tests/preparation-folio-v040.test.mjs` and `tests/defender-panel-preview-v30.test.mjs` cover Mage splash, Frost Warden V/VI Physical slow/effect values, support/poison/fixed-champion and no-additional-effect presentation using actual profiles. Browser rank/combination captures show representative effect presentation. Every listed family and rank was not separately reviewed on a physical device.

### A06 — Preview identity, built counts and unit controls

Automated: `tests/defender-panel-preview-v30.test.mjs`, `tests/defender-rank-preview.test.mjs`, `tests/preparation-folio-v040.test.mjs`, `tests/support-effects.test.mjs`, `tests/mvp-presentation.test.mjs` cover reset on actual identity, active-family counting independent of recipe exact-rank eligibility, and retained unit/support/MVP behavior. Browser: `publication-combination-confirmed-ipad.jpg` and rank comparison show representative built inspection. The complete mixed active/attack-paused/draft/reserved/ruin count fixture is automated rather than a new native hardware scenario.

### A07 — Actual costs and keeper/merge eligibility

Automated: `tests/command-points-ui.test.mjs`, `tests/command-main-integration-v31.test.mjs`, `tests/rank-five-retained-merge.test.mjs`, `tests/preparation-folio-v040.test.mjs`, `tests/draft-keeper-ui.test.mjs` retain costs, reasons, downgrade, candidate/retained guards and single accepted commands. Browser: ordinary keeper and actual combination flows in `reviewed-ready-ipad.jpg`, `publication-combination-confirmed-ipad.jpg`. Insufficient-resource and retained-V variants are supported by tests, not each by separate screenshots.

### A08 — Potential combinations without competing trees

Automated: `tests/preparation-folio-v040.test.mjs` and `tests/cartographer-layout-v040.test.mjs` cover actual-rank recipe rows, only one expanded ingredient detail, missing-recipe inspection and legal command availability. Browser checkpoint additional checks explicitly record three Frost Warden V recipes and only Lady Claire expanded; see `publication-three-candidate-combinations-ipad.jpg` and `publication-three-combinations-ipad.jpg`. The exact two-recipe Archer fixture is automated.

### A09 — Exact preview, Cancel and revalidated Confirm

Automated: `tests/cartographer-layout-v040.test.mjs`, `tests/preparation-folio-v040.test.mjs`, `tests/crafting-main-integration.test.mjs` exercise exact mixed current/retained allocation, anchor/foundation, unchanged state before confirmation, cancellation and live revalidation. Browser: `publication-exact-preview-ipad.jpg` and `publication-combination-confirmed-ipad.jpg`; the recorded native example is Lady Claire on the selected Frost Warden foundation, not the prescribed Elven Ranger fixture. The latter remains test evidence.

### A10 — Commitment gesture preservation

Automated: `tests/command-pointer-input-v31.test.mjs`, `tests/draft-pointer-input.test.mjs`, `tests/pinned-recruit-map-v30.test.mjs`, `tests/recipe-marker-input.test.mjs`, `tests/crafting-main-integration.test.mjs` exercise actual command/pointer handlers against stale state, movement, multi-touch, cancellation, capture loss and repeated command rejection. Browser ordinary Combine/Pause checks establish representative operability. Physical touch/pen Safari and every held-control hardware permutation were not certified.

### A11 — Map badge preservation and actual identity

Automated: `tests/pinned-recruit-map-v30.test.mjs`, `tests/recipe-marker-input.test.mjs`, `tests/preparation-folio-v040.test.mjs` cover actual marker handlers/priority and actual-rank commands. `final-preservation-proof.json` identifies the sole protected renderer change as the approved portrait import. Browser exact-preview and candidate-combination captures show representative badges. No exhaustive native collision/overlap matrix is claimed.

### A12 — Recursive Built basics accounting

Automated: `tests/catalog-recipes-d006.test.mjs`, `tests/recipe-breakdown.test.mjs`, `tests/recipe-tree.test.mjs`, `tests/recipe-navigation-v30.test.mjs` exercise each-identity allocation, duplicate/intermediate coverage, excluded draft/reserve/hidden ownership and separate navigation/pin state. The preserved probes Kingslayer 2/11, King 2/13 and intermediate Frost Knight 5/11 are automated assertions. Browser catalogue captures are representative presentation evidence, not separate native measurements of all three inventories.

### A13 — Compact Ready, map inspection and tools

Automated: `tests/phase-main-integration.test.mjs`, `tests/cartographer-layout-v040.test.mjs`, `tests/command-move.test.mjs`, `tests/maze-comparison.test.mjs` cover compact Ready actions, no recruitment receipt/Ready odds/Inspect keeper, map selection, focus and legal tools. Browser: `reviewed-ready-ipad.jpg`, `publication-combination-confirmed-ipad.jpg`, `publication-maze-tools-desktop.jpg`. The Maze tools screenshot proves reachability; it is not an exhaustive native Move/maze-edit round trip.

### A14 — One phase-driven wave slot and truthful end state

Automated: `tests/battlefield-panel-main-integration.test.mjs`, `tests/battlefield-overlay-panels.test.mjs`, `tests/phase-main-integration.test.mjs`, `tests/run-results.test.mjs` cover Next/Current host switching, preserved disclosure, pause/phase lifecycle, factual completion and no Wave 51. Browser: Ready/Current captures and `publication-result-excluded-desktop.jpg`, `publication-read-only-review-desktop.jpg`. The recorded won result uses existing Developer completion of Sandbox wave 50 and remains excluded; it does not claim an ordinary 50-wave campaign completion.

### A15 — One stable global control pair

Automated: `tests/header-combat-controls.test.mjs`, `tests/command-pointer-input-v31.test.mjs`, `tests/battlefield-panel-main-integration.test.mjs` cover one dock control pair, 1×/2× UI cycle, actual clock behavior, stable nodes through refresh and separation from unit attack pause. Browser: boss Pause check and `publication-individual-enemy-desktop.jpg` show one Resume/1× dock. The engine retaining its broader internal speed support is not exposed as a third UI cycle step.

### A16 — Measured DPS, score identity and shallow disclosure

Automated: `tests/tower-dps.test.mjs`, `tests/dps-measurement.test.mjs`, `tests/battlefield-overlay-panels.test.mjs`, `tests/mvp-presentation.test.mjs` cover actual measurement windows, independent peaks, sum/order, archived identities and MVP metadata, zero/support rows, stable disclosure/focus and shallow collapsed summary. Browser combat/Current/individual captures show representative placement. The entire long-list/archive/score-history matrix was not separately exercised in a native session; base direct DPS is not substituted for measured score.

### A17 — Visible boss aggregate and individual HP

Automated: `tests/current-wave-panel.test.mjs`, `tests/phase-ui.test.mjs`, `tests/phase-touch-d006.test.mjs`, `tests/selected-enemy-panel.test.mjs` cover revealed living boss inclusion, concealment-safe reads/markup, departure semantics and absence of duplicate live side aggregates. Browser: `publication-boss-combat-ipad.jpg`; `publication-individual-enemy-desktop.jpg` records a canvas-selected Bat at 691/975 HP with one individual bar and correct loaded original portrait, without a side aggregate. Multiple/concealed/queued/escaped cases rely on tests rather than separate native captures.

### A18 — Catalogue filters and narrow-screen return

Automated: `tests/catalog-recipes-d006.test.mjs`, `tests/recipe-filters.test.mjs`, `tests/recipe-navigation-v30.test.mjs` cover zero/one/many matches, combined filters, detail/list state and the restored narrow Back to list path. `catalog-return-proof.json` records preservation of history, filters, pin, disclosure and focus to the prior selected list button. Browser: `recipe-navigation-desktop.jpg`, `reviewed-recipe-navigation-phone.jpg`. Every filter cross-product was not separately captured in a browser.

### A19 — Ordered navigation versus exploration history

Automated: `tests/recipe-navigation-v30.test.mjs` and `tests/catalog-recipes-d006.test.mjs` cover filtered ordered navigation, endpoints/no-wrap, out-of-filter components, distinct Back/Forward history and unchanged filters/pin/progress. Browser desktop/phone recipe-navigation captures demonstrate representative forward/component/return navigation. Row progress and page index remain separately tested values.

### A20 — Factual future/current enemy information

Automated: `tests/enemy-catalog-navigation.test.mjs`, `tests/warband-info.test.mjs`, `tests/battlefield-overlay-panels.test.mjs`, `tests/current-wave-panel.test.mjs`, `tests/selected-enemy-panel.test.mjs` cover current adapters, mechanically shared traits, variant possibilities and visibility-safe individual facts. Browser: `publication-future-wave31-desktop.jpg` shows the real wave-31 row with shared 12,443 HP, 20 armor, 2.05 ground speed and three shields, distinct Physical/Magical immunity and random possibilities; Current/Bat captures cover representative live information. Variant possibilities are not guaranteed composition splits.

### A21 — Catalogue modal pause restoration

Automated: `tests/header-combat-controls.test.mjs`, `tests/audio-main-dialog-music.test.mjs`, `tests/enemy-catalog-navigation.test.mjs` exercise production main functions for prior running/paused state, frozen combat while a dialog is open, correct restoration and catalogue selection independent of campaign round/Start. Browser catalogue captures establish reachability, not every before/after pause state; those semantics are established by the actual-function tests.

### A22 — Audio preferences, transport and silence boundaries

Automated: `tests/audio-category-volume.test.mjs`, `tests/audio-volume-preferences.test.mjs`, `tests/audio-controls.test.mjs`, `tests/audio-main-dialog-music.test.mjs`, `tests/audio-selection.test.mjs`, `tests/audio-recorded-music.test.mjs`, `tests/audio-wave-soundtrack.test.mjs` cover 80%/40% fresh defaults, stored independent gains, mute/unlock, silent inspection, final choice voice and pause/modal/rotation behavior. Local browser decoding is 113/113 with cache two, as recorded in `browser-audio-decode.json`; initial public MP3 SHA/byte checks are separate. No claim of HTTPS decode or listening to every clip is made.

### A23 — Secondary flows and truthful results

Automated: `tests/tutorial-v040.test.mjs`, `tests/context-guidance.test.mjs`, `tests/maze-comparison.test.mjs`, `tests/command-move.test.mjs`, `tests/phase-main-integration.test.mjs`, `tests/run-results.test.mjs`, `tests/developer-statistics-exclusion.test.mjs`, `tests/backend-statistics.test.mjs` cover tutorial/help guidance, legal tools, result/review/retry, statistics contracts and Developer exclusion. Browser: Maze tools, won Developer-excluded result and read-only review screenshots. Review exposes Results/Play again without build actions or Wave 51. An ordinary live leaderboard submission and complete current database row snapshot were not performed for this receipt.

### A24 — Exact original-raster portrait identity

Automated: `tests/reference-portraits.test.mjs` and `tests/preparation-folio-v040.test.mjs`. Evidence: `portraits/crop-proof.json`, `portraits/pixel-verification.json`, `portraits/crop-plan.json`, `portraits/index.html` and six `portraits/contact-sheet-0*.jpg` sheets map 48 basic ranks, 38 champions and 50 enemies: 136 outputs from 107 unique approved source rasters, with source rectangles/output hashes. Public HTTP verifies all 136 served PNGs. Pixel/source mapping and recorded contact-sheet review do not constitute a new human approval or physical-device certification.

### A25 — Deferred image ownership and neutral fallback

Automated: `tests/portrait-visibility.test.mjs`, `tests/reference-portraits.test.mjs`, `tests/preparation-folio-v040.test.mjs` cover request/identity ownership, A→B→A, rank transitions, failure/retry, hidden-slot nonrequests and neutral fallback without a UI character WebGL renderer. Browser checkpoints record loaded representative portraits, including comparison and the individually selected Bat. Not all 136 images were individually browser-decoded with injected failures; HTTP source identity and automated race tests are distinct evidence.

### A26 — Protected runtime, source art and media

Evidence: `final-preservation-proof.json` and `before-protected.json`, supported by `tests/reference-portraits.test.mjs`, `tests/audio-assets.test.mjs`, `tests/audio-recast-assets.test.mjs`. The scoped audit checks 1,039 protected inputs: 1,038 exact and the approved draft-marker portrait import. The handoff package has 167 manifest-listed files exact; its total is 169 including two preparation receipts. All 205 protected MP3s, including archived clips, are distinct from the 113 active publication clips. Of 136 original-source portrait identities, 94 match latest aliases and 42 use explicitly approved source precedence; the 42 are not new redraws. The proof covers its enumerated inputs, not every untracked historical file or a live database contents audit. Existing source-precedence decisions and package provenance remain visible.

### A27 — Responsive accessibility: partial matrix

Automated: `tests/cartographer-layout-v040.test.mjs`, `tests/command-pointer-input-v31.test.mjs`, `tests/header-combat-controls.test.mjs`, `tests/catalog-recipes-d006.test.mjs`, `tests/portrait-visibility.test.mjs` cover layout contracts, keyboard/native control semantics, stable input targets and hidden panel/portrait rules. Browser: seven final Build viewports plus representative eleven-situation captures listed below and 30 recorded geometry checkpoints. This is **partial coverage of the requested full matrix**. Physical iPad Safari, actual notch/safe-area hardware, native browser zoom/text enlargement, and exhaustive keyboard-order/contrast checks for all eleven situations at every target viewport were not certified. The two 200%-equivalent CSS viewport screenshots are resize equivalence evidence, not proof of actual browser zoom.

### A28 — Builds, asset delivery and cache/loading checks

Automated: the 1,448-test full suite plus `tests/reference-portraits.test.mjs`, `tests/portrait-visibility.test.mjs`, `tests/audio-selection.test.mjs` cover manifest/base-path/cache identity and image/audio loading ownership/error behavior. Root and repository-base builds passed; initial CI tests/build/deploy passed. The immutable initial HTTP receipt checks the exact served set and MIME/hash boundaries; `public-initial-desktop.jpg` records the public initial GUI, and local audio decoding is independently recorded. No full native loading-failure injection or physical Safari pass is claimed. Original model/audio/scenery preservation follows the protected manifest, not the HTTP portrait set alone.

### A29 — Authorized publication and exercised rollback: final return pending

Available: initial authorized 0.4 publication run 38897567377 and served 0.4 identity; `production-backup-proof.json`, `rollback-identity.json`, `rollback/rollback-proof.json`, `rollback/credential-fallback-tests.json`, source/preservation receipts and screenshots. Actual live 0.3.31 rollback run 38898797381 passed all gates and its immutable HTTP receipt verifies version 0.3.31, five compiled files and 113 MP3s. Return-to-0.4 run 38899342990 is still in progress in the saved snapshot. A final acceptance closeout must add successful restored CI plus fresh served 0.4 compiled/portrait/audio/metadata identity and any final public GUI check. Backup/tag/branch/release-ref workflow avoid history rewriting; the statistics service is independent. Preserved backend contracts do not alone prove a fresh row-by-row leaderboard audit. A29 is not marked finally complete here.

## Representative eleven-situation browser index

| Situation | Existing representative evidence | Boundary |
| --- | --- | --- |
| 01 Building | `final-viewport-building-1440x900.jpg`, `final-viewport-building-1024x768.jpg` | Seven final Build viewport captures exist; not every situation at all seven. |
| 02 Choose keeper | `reviewed-select-desktop.jpg`, `reviewed-select-ipad.jpg` | Desktop and emulated iPad-size browser. |
| 03 Combination preview | `publication-exact-preview-ipad.jpg` | Exact Lady Claire native example; Elven Ranger also tested automatically. |
| 04 Ready defender | `reviewed-ready-ipad.jpg`, `publication-combination-confirmed-ipad.jpg` | Compact Ready after actual confirmation. |
| 05 Combat | `reviewed-combat-ipad.jpg`, `publication-boss-combat-ipad.jpg` | Representative live combat/boss and one Pause interaction. |
| 06 Current wave | `publication-current-wave-ipad.jpg` | Shared wave slot, actual current information. |
| 07 Future waves | `publication-future-wave31-desktop.jpg` | Actual wave-31 adapter facts and variant wording. |
| 08 Recipe catalogue | `recipe-navigation-desktop.jpg`, `reviewed-recipe-navigation-phone.jpg` | Reachable list/detail, representative filters. |
| 09 Recipe navigation | Same recipe navigation captures and catalogue return proof | Distinct ordered/exploration paths are also tested. |
| 10 Three combinations | `publication-three-candidate-combinations-ipad.jpg` | Frost Warden V three rows; only one expanded. |
| 11 Rank comparison | `publication-rank-comparison-ipad.jpg` | Representative Ready comparison; exact Archer fixture is automated. |

Final Build captures are 1715×1244, 1440×900, 1180×820, 1024×768, 820×1180, 844×390 and 390×844. Equivalent 200% CSS viewport captures are `reviewed-zoom200-css-viewport-desktop.jpg` and `reviewed-zoom200-css-viewport-ipad.jpg`; these were not actual native zoom certification. Screenshots named `publication-*` are not automatically claimed to be HTTPS captures: origin must come from their associated session evidence. The explicitly public initial capture and HTTP receipts establish their own narrower public boundaries.

## Outstanding closeout boundaries

1. Parent release owner must append the final return-to-0.4 CI outcome and served identity after run 38899342990 finishes. Initial 0.4 and completed 0.3.31 rollback identities are already separately recorded.
2. Physical iPad/Safari, native browser zoom/text-size, notch hardware and the complete eleven-situation × every-viewport accessibility matrix remain unperformed or uncertified as described under A27.
3. Browser audio receipt is local decoding; public SHA/MIME equality does not turn it into an HTTPS decode or speaker-listening result.
4. Source/contract preservation and Developer-exclusion tests are not a fresh exhaustive database-history audit or a new ordinary online score submission.

The companion `acceptance-coverage-snapshots.json` records the hashes of the referenced files as read when this receipt was prepared. Mutable CI/latest aliases may subsequently be refreshed by the release owner; those later states require their own closeout evidence.
