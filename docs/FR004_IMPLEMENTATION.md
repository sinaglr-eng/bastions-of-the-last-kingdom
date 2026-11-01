# FR-004 — implemented locally in game 0.6.7

The user requested implementation of the exact FR-004 handoff from Audit Tower Defense Game. The local candidate uses **fr004-r1-20261101**. Hosted publication was not requested; the existing public release and statistics deployment remain separate. No new release tag, branch, archived game, gallery copy or backup package was created.

All 85 native Dwarf primary fields match the target: 80 at 1.5 times the implemented 0.6.6 base and five Iron golem/Gatling champions at 2 times that base. Forge Sentinel remains exactly 1,416.8. Four continuous weapons deal 2,250 / 2,700 / 3,105 / 13,500 DPS before existing support and personal MVP. Shared Flame Cone base levels and fixed secondary effects remain exact; percentage effects inherit the changed primary base once.

All ten Physical immunity aura owners retain their levels and transmission with radii 4 / 4.5 / 5 / 5.5 / 6 / 6.5. Fresh immutable arrays prevent stale definition caches. The existing damage gate, emitter states, strongest-only matching channel, Magic aura, visibility and defenses are preserved. Human, Elves, shared Claire, all recipes, timing, attack reach, progression and media remain unchanged.

All **2,008 tests** passed. The local build transforms **226 modules**. Exact compatibility covers all **258 profiles, 570 ability occurrences and 114 recipes**. Statistics tests use an isolated in-memory database and preserve older version/ruleset attribution; no live score or hosted service was modified. The local gallery is synchronized in place after numeric validation, preserving its separate appearance, voice and model records.

Fresh frozen Diamond Spiral validation covers **72 legal current campaigns**, **24 paired Dwarf FR-003 baseline campaigns**, and **117 controlled late-wave cases**. The Dwarf mean completed waves rose from 21.13 to 24.21 in this fixed controller cohort. No legal campaign won all 50 waves. The fixed injected Dwarf army still struggles against the final boss and shows reported 0.1/0.05-second sensitivity. Exact implementation is verified; no-TOP completion and optimal-player balance are not certified. No further numerical retuning is included.

[Implementation receipt](../output/implementation/fr004-current/result.json) · [Detailed validation and action records](../output/implementation/fr004-current/REPORT.md) · [Exact original handoff](../output/implementation/fr004-current/authority/implementation-handoff.json).

The optional automatic launch of the local game server was blocked by automatic approval review without a more specific reason. `START_GAME.cmd` is ready for manual launch. The canonical local gallery is served and its current JSON responses were verified.
