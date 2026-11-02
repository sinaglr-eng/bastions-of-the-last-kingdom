# iPad wave-24 graphics/memory repair — local game 0.6.7

This is the implementation-stage record from 1 November 2026. Public deployment was subsequently authorized on 2 November; the current local release is documented in [release 0.6.8](RELEASE_0_6_8.md). The public game still runs 0.6.7 until a new deployment is requested.

The public game observed during this investigation was **0.6.6**. Its rendering/loader code for the affected paths was byte-identical in Git to the local candidate before this repair. The reported wave has **19 Riveted Goblin Mutants (host_24)**. The exact approved GLB digest passed; its model, embedded PNG bindings and finite animated geometry passed a 19-private-actor CPU test. This test does not reproduce Safari pixels or its GPU driver.

## Confirmed defects and repair

Previously, every encountered Dwarf family/rank remained in the template cache until the run ended. The full 86-appearance faction package totals 871,977,728 decoded source bytes, before renderer allocations and decoded textures. Enemy, defender and scenery loads could overlap; a large packed GLB also received an avoidable full-buffer copy before parsing. The full package is not eagerly downloaded, but retained appearances accumulated over successive waves.

Unused defender sources now leave a bounded cache only after their last real scene borrower has gone. Their geometries, materials, texture resources and image bitmaps are disposed exactly once, and a future real request decodes a fresh asset. In-flight obsolete results are discarded safely. No raw GLTFParser/transport caches are retained in the new ownership map. Native landmarks now release their private PBR maps on replacement/closure. A closed battlefield also explicitly retires its old WebGL context after private actors/caches and the renderer are disposed, without closing the replacement battlefield’s context. These ownership rules follow [Three.js resource-disposal guidance](https://threejs.org/manual/pages/how-to-dispose-of-objects.html).

Touch devices share one native-load/decode slot across defenders, enemies and landmarks. Desktop-mode iPads are included. Initial touch rendering caps pixel ratio at 1.25 and shadows at 1,024, with antialiasing retained; ordinary desktops keep their previous 1.6/2,048 limits. Recovery uses a conservative ratio of 1. Authored model geometry, texture files, skins and animation samples remain exact. This reduces framebuffer/shadow allocation rather than changing combat rules or model assets.

A graphics-context interruption now pauses the same Game object, stops further dispatch and prevents blind combat progress. Run wall time still counts. Three.js owns GPU restoration; the player sees a simple recovery notice and explicitly resumes afterward. No automatic page reload or Game reconstruction occurs. A bounded local-only eight-incident record retains wave/faction and resource counters for future diagnosis; no player names, scores or external telemetry are written.

## Measured representative lifetime replay

The unchanged legal Dwarf controller (seed 13,000,019, immediate policy) was observed through wave 24 of local FR-004 rules. Its 144 distinct placed-model transitions were replayed through the production loader. At the final wave-24 transition, retained model identities fell from **33 to 16**, decoded-source ledger bytes from **314,091,392 to 158,622,208**, and estimated RGBA/mipmap texture bytes from **276,762,816 to 134,188,032**. These are source-size/texture estimates, not physical iPad heap or VRAM measurements. This is a representative legal army, not the user’s unknown exact army or a reproduced public-0.6.6 campaign.

All **2,023 tests** passed and the **229-module** local build passed. New checks cover real Battlefield borrower retirement, rank churn, fresh reload after eviction, late results, suspension/closure, native landmark cleanup, packed-buffer identity, original host_24 PBR bindings and finite 19-actor motion, recovery without RNG/army/score resets, pause timing, and bounded local diagnostics. Existing classification/animation/aura/FR-004 combat contracts remain intact. All protected combat data, approved model/image/audio files and score-service source files retain their hashes.

## Limits and delivery

The exact iPad/Safari failure is not yet reproduced. Memory pressure is supported by concrete lifetime defects and the report sequence, but is not a confirmed device crash diagnosis. If iPadOS kills/reloads the entire page, no in-memory controller can preserve that process; this repair does not claim exact mid-wave restoration after process death. Physical-device verification is still required. Browser/device QA was previously waived.

The repair is installed in the local **0.6.7** candidate. Hosted game **0.6.6** was not changed; no new release tag, backup package or gallery was created. Start locally with `START_GAME.cmd`. The existing single English local gallery, source artwork, prompts, appearance/voice decisions, native models and saved player records are untouched.

[Result](../output/implementation/ipad-wave24-current/result.json) · [Asset audit](../output/implementation/ipad-wave24-current/asset-audit.json) · [Lifetime replay](../output/implementation/ipad-wave24-current/cache-audit.json) · [Tests/build](../output/implementation/ipad-wave24-current/validation.json).
