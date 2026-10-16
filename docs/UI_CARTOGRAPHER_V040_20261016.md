# Edition 0.4.0 — The Cartographer’s Table

This implements the approved UI handoff from **Audit Tower Defense Game**, including its three review rounds. The authoritative package is [ui-cartographers-table-handoff-20261016](ui-cartographers-table-handoff-20261016/README.md): all 22 selected concepts, 40 requirements, 29 acceptance scenarios, original prompts, review evidence and source-art provenance are retained verbatim. The package remains historical approval evidence; implementation results are recorded separately here.

## Interface

- A warm paper resource register, reconnaissance note, preparation folio, contextual map inspector and compact command dock replace the previous phase layout. Building and Choose keeper share one five-card roster and one selected-defender component. Unplaced identities remain concealed.
- Legal actual-rank actions stay with the roster. Displayed-rank effects, portrait and four base statistics share one profile; comparing ranks does not change Keep, recipe eligibility, selected foundations or RNG. Actual-rank recipe options have one expanded ingredient detail.
- Combination previews display the existing allocator’s exact ingredients, result foundation and wall outcomes, with explicit Combine and Cancel. Retained-only Ready previews temporarily use the same folio, then return to the map inspector.
- Ready exposes Maze plans and Start wave in a small bottom-right dock. Combat has one mounted Pause/Resume pair with Speed cycling 1×/2×. The underlying simulation still supports its existing developer test speeds.
- A single wave note switches Next/Current by phase. DPS remains the sum of independent measured defender peaks, with wave and MVP metadata. The top-center boss bar is the sole live aggregate, limited to revealed living bosses; individual revealed enemy inspection remains available.
- Recipe search, filters, ordered navigation, exploration history and Back to list remain independent. Built basics uses recursive retained ownership allocation, excluding provisional draft contributions. Help, tutorial, maze tools, audio, results, Retry, records and developer exclusion remain available.

## Original illustration portraits

All 136 UI identities use reviewed integer crops from 107 approved original geometric reference images. They do not use game-model portrait renders. New assets live under `assets/ui/reference-portraits/`, with an independent revision and root/project-base resolver. Missing exact-rank or unknown identities use a neutral unavailable state. Decoder completion cannot migrate to a new identity.

The generated crop manifest records each source SHA-256, integer rectangle and output SHA-256. All original images, prompts and reviews are preserved; the crop verifier checks exact source pixels. The existing map badge geometry, symbols, colors, collision handling and input guards are retained; only its portrait resolver changes.

## Preservation and rollback

The exact 0.3.31 source is protected by remote annotated tag `v0.3.31-stable` and branch `codex/backup-v0.3.31`, both resolving to `c01ac5a2ab1ef62e77d2ce545f24234b80b5c847`. Verified offline production/source archives are in the primary workspace’s `backups/releases/v0.3.31/` directory. See [the rollback instructions](ROLLBACK_0.3.31.md).

The current Pages workflow accepts an optional `release_ref` while retaining the existing main-only deployment environment. Rollback rebuilds and tests the stable tag through a workflow dispatched on main; it does not reset a checkout, rewrite main history or touch the statistics database. `tools/rollback-v0331.ps1` defaults to read-only preflight; `-Deploy` explicitly requests restoration using GitHub CLI or existing Git Credential Manager credentials.

Game rules, balance, recipes, hidden acquisition, saves, statistics contracts, model/scenery/animation/effect sources and audio remain unchanged. Protected-file comparison allows only the map-badge portrait import; release metadata changes separately to 0.4.0. The statistics service remains its independent existing deployment.

## Validation record

The current full local suite passes **1,448/1,448**, with no failures, skips or cancellations. Production build succeeds. Focused actual-Game tests cover rank comparisons, all 38 current recipes, exact confirmation guards, modal pause restoration, native command input semantics, hidden identity access, repeated DOM relocation and keyboard focus recovery. Five synthetic rollback checks exercise the real script without credentials or dispatch.

Browser evidence and final input hashes are recorded under `output/design/cartographer-ui-v040-20261016/`. Earlier intermediate screenshots/test logs in that directory are checkpoints; final receipts identify the published source and compiled assets. Desktop/iPad viewport inspection is browser evidence, not a claim about physical iPad Safari. Physical iPad/Safari testing is unavailable in this environment.

Publication and rollback are complete. Final source `v0.4.0-final` (993a1ee1289fa137a68b7bbdad48b81b2e18befe) passed [CI 38902615525](https://github.com/sinaglr-eng/bastions-of-the-last-kingdom/actions/runs/38902615525) and fresh public compiled/portrait/audio/metadata verification. The initial 0.4 build, actual 0.3.31 rollback, return and final CSS refinements are separately recorded in [the release receipt](../output/design/cartographer-ui-v040-20261016/release-receipt.json). The original 0.4 and color-review tags remain unchanged as historical checkpoints.

Public verification passed all five compiled JS/CSS entries, 136 PNGs with signatures/dimensions, the committed portrait manifest, two committed audio catalogues and all 113 active MP3 hashes. Windows-local CRLF JSON is compared against exact committed public Git blobs; the generated HTML expectation uses the Linux CI LF representation. Compiled code, PNGs and MP3s require exact byte equality. The initial EOL-only comparison failure remains as an intermediate receipt.

The actual public browser run passed five placements, Keep, one-click Demolish, one-click Start wave and Pause. Browser audio decoding passed 113/113 on the local reviewed build; this is separate from public byte verification. See [acceptance coverage](../output/design/cartographer-ui-v040-20261016/acceptance-coverage.md) for the remaining physical Safari, native zoom and full accessibility-matrix limits.

The final visual audit restored the exact 0.3.31 map role colors (cyan pins, violet merges and gold combinations), including cyan overlap stripes and pinned-card labels. Paper ingredient codes use muted ink, and archived DPS retains its prior readable opacity. This follow-up changes CSS only; map geometry, command handlers and simulation remain unchanged. The final source is identified by `v0.4.0-final`; the initial `v0.4.0` tag remains preserved as the earlier reviewed build.

Shared pinned-recipe descriptions, status counts, ingredient chains and disabled recruitment reasons use readable paper ink. The sticky action footer has an opaque paper background, preserving separation from scrolling recipe content. This final adjustment changes only CSS.
