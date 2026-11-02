# Forged Alliances TD 0.6.7

This release combines the approved FR-004 implementation with the iPad wave-24 graphics-memory repair. The user authorized public deployment on 2 November 2026.

FR-004 changes 85 Dwarf primary fields and the reach of all ten Physical immunity aura owners; its exact targets, legal campaign results and limitations remain in [the implementation report](FR004_IMPLEMENTATION.md). There is no additional balance retuning in this publication.

Unused model and texture resources are released after the last actual scene borrower leaves. Touch devices share one model-decode slot, use smaller framebuffer/shadow budgets and pause the same game during WebGL interruption. Approved model, material and animation files remain unchanged. See [the iPad investigation](IPAD_WAVE24_FIX.md) for confirmed defects and the distinction between measured resource ledgers and an unproven physical-device crash diagnosis.

All 2,023 local regression tests passed before publication. The statistics service is updated with the existing database binding and no schema or score reset. Version 0.6.7 uses ruleset identity `fr004-r1-20261101`; earlier score identities remain valid.

The production build, GitHub checks, statistics deployment and exact public-file verification are recorded under `output/releases/v0.6.7/`. Deployment is not confirmed until those receipts report success. No new physical iPad or browser QA is claimed.

Only this game release is maintained after successful activation. No release tag or source/production backup package is created. The one English design gallery remains local only and is excluded from this publication.

Initial activation: **0.6.7** is the default public game at https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/. Exact runtime commit `f830540a4f15a3f7af054e2442808b842cb2dd64` passed all 2,023 GitHub tests, production build, upload and deployment checks. All 1,004 public files were fetched and checked after deployment, including 312 exact approved model identities. The statistics service is version 0.6.7 on its existing database; no live test score was written. Previous release 0.6.6, its tag and former production package are retired; ordinary Git history remains. [Publication receipt](../output/releases/v0.6.7/release.json) · [CI checks](https://github.com/sinaglr-eng/bastions-of-the-last-kingdom/actions/runs/41398027957).

Current in-place stability repair: runtime `8dece7e8b574479f4633548ed022e2a44b17905b` passed all 2,028 GitHub tests and the actual desktop Chromium paused-recovery check. Native checks cover 258 profiles and offline runtime smoke checks cover 150 faction/wave cases. Griffin Scout crafting and wave 5 at 5x passed; the originally reported desktop freeze remains unreproduced. [Investigation](../output/implementation/griffin-current/REPORT.md) · [Current receipt](../output/releases/v0.6.7/release.json). No game-rule, model, texture or statistics-service changes, new release version, tag or backup were introduced.
