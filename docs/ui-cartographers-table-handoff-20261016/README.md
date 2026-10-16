# Cartographer UI implementation handoff

**Approved UI design and implementation preparation. No game implementation or production deployment is authorized by this preparation request.** Prepared October 16, 2026 against local edition 0.3.31.

This is the entry point for the future implementation in **Master verze hry**. The user accepted The Cartographer's Table and the three browser-review rounds, requested a complete saved handoff, and then limited the work to UI. Defender, enemy and map appearance stays unchanged. UI portraits must use original approved geometric reference illustrations used to create the models, not renders of those models.

## Read in this order

1. [Approval and scope](APPROVAL_RECORD.json) and [UI specification](DESIGN_SPEC.md).
2. [Portrait sources and preservation policy](ASSET_POLICY.md), [all 136 source identities](PORTRAIT_SOURCES.json) and [22 selected layout references](SELECTED_CONCEPTS.json).
3. [Implementation plan and existing-code map](IMPLEMENTATION_PLAN.md).
4. [Requirements register](REQUIREMENTS.json) and [acceptance scenarios](ACCEPTANCE.md).
5. [Implementation prompt](IMPLEMENTATION_PROMPT.md); use only after the user authorizes implementation in Master verze hry. [Release prompt](RELEASE_PROMPT.md) governs a separately authorized publication step.

## Contents and authority

`reference-ui/` contains exact copies of the 22 selected layouts. `reference-art/` contains 107 distinct original illustration PNGs covering 136 identities: 48 basic ranks, 38 fixed champions and 50 campaign enemies. Several champions share an authoring board, so they need distinct subject crops; they must never share the whole board as their portrait. No crops, new art, models or production files were generated for this package.

`prompts/` preserves the original image-generation brief and review edit prompts verbatim. `evidence/` preserves original comments, review limitations and numeric references. These historical records are evidence, not current implementation instructions. All newly authored package/gallery copy is English; communicate with the user in Czech.

Use this precedence: latest direct human instructions; this approved handoff and explicit preservation constraints; actual runtime data/eligibility; current model-authoring illustration provenance; selected layout geometry; historical prompts and older screenshots. The illustrative characters, enemy art, terrain, sample inventories, map positions and some tiny text in generated concepts are **not replacement production assets or legal saved runs**.

The three review rounds supersede older proposals where they conflict: Current wave replaces Next wave during combat, collapsed DPS is one shallow line, Ready loses permanent recruitment/odds/Inspect keeper controls, only one combination detail expands, and rank statistics/effects follow the displayed rank while actions use actual identity. All original evidence remains preserved.

## Portrait source reconciliation

Every source identity has a verified original raster and SHA-256. Ninety-four latest gallery aliases match the current authoring sources; 42 differ. For the 38 V8 champions use their current reconstruction's published original concept boards. Four enemy identities use the exact earlier geometric turnaround recorded by their current model source. Do not substitute a later gallery revision and then remodel the game to match it. The per-ID manifest records both the current-model source and the differing gallery alias. This resolves the user's requirement that the portrait is the reference from which the existing model was made.

Cropping these originals into per-identity UI images, validating every crop and connecting a new UI-only resolver are future implementation tasks. Their inputs and acceptance criteria are prepared here; the package is not a claim that those future tasks are already complete.

## Baseline and release boundaries

[SOURCE_BASELINE.json](SOURCE_BASELINE.json) records 1,221 current source/asset hashes. [RUNTIME_REFERENCE.json](RUNTIME_REFERENCE.json) records current names, recipe identities and sample rank profiles. Recheck the live checkout in Master: other work may advance it after this snapshot. Do not reset unrelated changes or downgrade a newer release. The new UI can become the next release, tentatively 0.3.32 only if 0.3.31 is still current at implementation time. This package changes no release number, gameplay rules, saved games, audio, statistics service, models or production deployment.

This handoff does not authorize D001 balancing, altered wave resistances/abilities, support/poison/MVP mechanics, new acquisition rules or TOP restrictions. Existing mechanics, including previously delivered approved changes, remain in force. No campaign rebalance is hidden in the redesign.

The [verification receipt](PACKAGE_VERIFICATION.json) checks this package and unchanged preparation baseline. It is not a production test run. The [ZIP beside the design outputs](../../output/design/cartographer-ui-handoff-20261016-v1.zip) provides a portable copy. Relative source-code links in the technical documents assume the project checkout; the portable package still contains all selected screenshots, source illustrations, prompts and requirements.
