# Current game release only

The sole maintained local game release is **0.6.10**, implementing user-authorized FR-006 and FR-007 revision 2 on 6 November 2026. Previous release directories, source/production backup packages, old release tags and backup branches are not maintained. Ordinary Git change history is retained.

Exact original artwork, models, recorded prompts/reviews, current runtime dependencies and player score records remain intact. The exact FR-003 terminal-comparison input required by the FR-002/FR-003 army verifiers is retained as `tests/fixtures/fr003-approved-terminal-results.json`; its source hash is unchanged and it contains no older runnable game. The exact approval verification is retained under `design/reviews/`.

The current implementation receipt and verification evidence are under `output/implementation/fr006-fr007-current/`. The files under `output/releases/v0.6.8/` are historical publication and retention evidence, not an older runnable release or backup package. The single English design gallery stays local only. No new release tag or backup package is created.

The earlier automatic-review exception for `artifacts/bastions-statistics-site.tar.gz` remains recorded in the retention receipt. That obsolete service packaging file is not a game release, and this publication did not retry its previously blocked deletion.

The public game and existing statistics service still run 0.6.9; deployment of 0.6.10 is pending. Their deployed state is not a retained local backup. Historical implementation authorities used by regression tests remain preserved as data, with no older runnable release package.
