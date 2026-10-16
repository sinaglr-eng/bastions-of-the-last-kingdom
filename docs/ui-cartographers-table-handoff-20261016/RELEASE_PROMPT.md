# Release prompt for an authorized UI publication

Use after the implementation is complete and the user has authorized production publication in Master verze hry. No action in this prompt has been performed by preparing the package.

---

Prepare and publish the completed Cartographer UI release under the authorization in this chat. Read `docs/ui-cartographers-table-handoff-20261016/README.md` and the implementation evidence first. Reconcile the actual current version and concurrent work. The baseline was 0.3.31; use the next appropriate available release, not an unconditional 0.3.32 overwrite.

Verify the approved scope is UI-only. Compare protected model, source-art, map/scenery, animation/effect, audio, data/gameplay, save and statistics behavior with the recorded baseline and any separately authorized intervening changes. New source-art-derived UI portraits must have exact identity/crop provenance and project-base URLs. No D001 balance changes or artwork regeneration are included.

Complete all current tests, production build, UI acceptance and browser evidence before publication. Keep final changes concrete and reviewable. Update only necessary release/cache/metadata records consistently. Do not regenerate approved 3D/audio assets, replace galleries, reset a database or alter leaderboard history. A statistics service metadata sync, if required by established release procedure and authorized here, must not change schema or historical records.

Remember that `.github/workflows/pages.yml` publishes pushes to main. A main push/merge is a deployment step, not a harmless way to save a draft. Use the project's existing authorized release flow. If a pull request is created, attach its URL to this task. Record the exact implementation commit and CI result; do not assert deployment success from a local build.

After publication verify the served game version, compiled assets, new UI portrait images and base-path routing over the actual production URL, and confirm protected asset identities and preserved statistics. Save publication receipts and screenshots. Report what was deployed, evidence, any unavailable physical-device checks and a reversible rollback reference to the preceding known-good deployment. Do not claim a physical iPad listening/Safari test without performing it.
