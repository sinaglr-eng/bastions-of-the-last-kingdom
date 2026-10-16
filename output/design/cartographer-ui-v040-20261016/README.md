# 0.4.0 release evidence

Final source: `v0.4.0-final` (993a1ee1289fa137a68b7bbdad48b81b2e18befe). [Release receipt](release-receipt.json) is the closeout authority. The original approved handoff remains unchanged in `docs/ui-cartographers-table-handoff-20261016`.

- Final tests: `tests-release.log` (1,448/1,448). Final build: `build-paper-recipe-final.log`.
- Final CI: `publication-ci-final.json`; final public assets: `public-http-v040-latest.json` and its timestamped stable receipt.
- Actual rollback: `publication-ci-rollback.json`, `public-http-v0331-latest.json`, and `rollback/actual-rollback-dispatch.txt`. Initial/return receipts retain their distinct source identities.
- Browser actions: `public-browser-final.json`; semantic role colors: `semantic-color-final.json`; representative layouts: `final-viewport-building-*.jpg`.
- Coverage and limits: `acceptance-coverage.md`; the companion snapshots are historical hashes taken before final mutable aliases were refreshed.
- Preservation/crops: `final-preservation-proof.json` and `portraits/`.

Earlier failed test logs, immediate-resize screenshots, API race snapshots, the first EOL-only HTTP mismatch and screenshots before semantic color restoration are intermediate evidence. They are not the final result. The immutable initial `v0.4.0` tag is preserved; use `v0.4.0-final` for the final reviewed UI. No physical iPad/Safari, native zoom/notch hardware or exhaustive cross-viewport certification is claimed.

Reproduce public read-only checks from the repository root with `node tools/v040-check-ci.mjs --run 38902615525` and `node tools/v040-verify-public.mjs --mode=40 --label=final`. Mode31 reads the original offline production archive without extracting it. The verifier records exact committed JSON / generated HTML representation separately from strict compiled/media equality.
