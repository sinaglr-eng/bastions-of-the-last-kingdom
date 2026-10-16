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

The current full local suite passes **1,448/1,448**, with no failures, skips or cancellations. Production build succeeds. Focused actual-Game tests cover rank comparisons, all 38 current recipes, exact confirmation guards, modal pause restoration, native command input semantics, hidden identity access, repeated DOM relocation and keyboard focus recovery. Four synthetic rollback checks exercise the real script without credentials or dispatch.

Browser evidence and final input hashes are recorded under `output/design/cartographer-ui-v040-20261016/`. Earlier intermediate screenshots/test logs in that directory are checkpoints; final receipts identify the published source and compiled assets. Desktop/iPad viewport inspection is browser evidence, not a claim about physical iPad Safari. Physical iPad/Safari testing is unavailable in this environment.

Publication, served-file verification and the rollback rehearsal are recorded in the final release receipt after their actual completion.
