# QA record — 30 September 2026

## Current revision

87 Node tests pass in the latest full run (`artifacts/final-tests.log`). Production builds successfully. The current model manifest has 96 entries: 76 playable defender variants and 20 legacy assets. The separate enemy pack contains 51 articulated Blender GLBs. Runtime selects archer-v2, hero-v5, champion-v5 and ashen-host-v2. Editable sources and rendered portraits accompany the playable packs. Historical review notes below retain their original counts and behavior; later revisions supersede them.

Coverage includes the clean 37 × 37 board, five inset checkpoints, ordered loop traversal, life loss only at the keep, path rejection, five-draw selection, basic exact-rank merging through VI, all 36 fixed recipes, every basic-rank continuation and repeatable champion ascension. Tests require exactly three distinct consumed ingredients, increasing result ranks and stable result anchors. Existing projectile, melee/air, poison, pure cleave, tiered blessing, aura, multi-target and accelerated-timing tests remain covered. Random tests cover 800,000 quality rolls and 100,000 family draws.

## Campaign smoke simulations — earlier balance revision

- Seed 42: lost, wave 42, 0 health, 565 kills.
- Seed 123: lost, wave 20, 0 health, 204 kills.
- Seed 807: lost, wave 23, 0 health, 250 kills.

The bot favors route coverage and direct/area damage without optimizing a maze. These results use the 50-wave campaign, blind recruitment and real enemy abilities. All three greedy policies reached defeat normally; there were no simulation stalls. No claim of a human-balanced full-campaign win is made from this bot. Separate tests exercise every authored wave/variant and wave-50 victory semantics. This does not establish difficulty for every human strategy, and no balance changes were made to compensate for the simple bot.

## Browser verification — earlier campaign milestone

- Clean map, fifth-tile checkpoints, numbered 1–5 loop and exterior keep render in the production browser. Snowy peaks, forested slopes, an animated waterfall, curved river and wooden bridge frame the board. All scenery vertices are checked outside the playable area.
- All eight original character portraits render in the grimoire; expanded Runebreaker displays six rows through VI with armor reduction 2/4/8/16/32/64.
- Grimoire lists twenty recipes and distinguishes basic-rank ingredients from completed advanced units. Griffin/wolf riders, duelists, siege engines and spellcasters render as original miniatures. Automated bounds/signature checks cover all twenty models.
- The rebuilt Maze Lab compares five worker-searched variants, including two preserved spiral topologies. An empty 50-wave board measures 1,086 / 722 / 504 steps; extended search measures 1,132 / 722 / 504. The central layout exposes 440 of 722 steps to the marked six-tile firing circles, using 197 positions. Redundant exterior pieces are pruned without changing the exact path. Every segment is independently checked against gameplay BFS. Tests also cover budget exhaustion, existing barricades, incremental legal building, non-mutation and retaining earlier best results. See MAZE_COMPARISON.md and artifacts/maze-comparison.json.
- Blind-placement tests prove that unbuilt slots have no family/rank and use no RNG; rejected tiles and changing the active slot cannot fish for a different recruit. Current-round quality odds remain frozen after mastery changes.
- Ability tests cover magical/physical immunity, evasion, refraction refresh and DoT bypass, shell, reactive armor, stealth detection, disarm, attack suppression, recharge, theft and checkpoint-preserving blink.
- Browser placement verification: the first click revealed a Cleric while the other four cards stayed hidden. Four more clicks revealed Cleric, Druid, Mage and Runebreaker. Keeping the Mage made the other four barricades. Wave 1 completed at triple speed with 29/30 health and its 29-gold reward; beginning round 2 produced five hidden cards again. The final fresh production tab has no warning/error logs.
- The Warbands guide renders original portraits and lists all 50 waves through Ghorun, including movement, boss status, HP/armor, counters and alternative immunities. A reserved GLSL identifier found during browser verification was fixed; the continuous meadow now renders correctly without its old rectangular border.
- Keyboard shortcuts and focused button activation work. The in-app automation surface intermittently offsets pointer coordinates for toolbar buttons; no workaround was added to the game. Temporary viewport override was reset.
- Current screenshots: artifacts/warbands-maze.png and artifacts/fifty-warbands.png. Previous milestone screenshots: artifacts/valley-maze.png and artifacts/advanced-champions.png. Earlier screenshots remain as historical iteration records.

## Limits

Long-session GPU profiling, Safari/Firefox coverage, real touch devices, human campaign balance and final sound quality remain unverified. Refresh begins a new run; profile discoveries, preferences and custom maze blueprints persist.

## September 30 — cohesive characters, continuations and combat feedback

- Blender authoring joins and reshapes skin/tailored surfaces, smooths their normals and preserves crisp equipment edges. Eight new champion families bring the roster to eight basic classes and 28 champions: 76 defender variants in total. Active style tags are archer-v2, hero-v5, champion-v5 and ashen-host-v2.
- All 48 basic family/rank combinations have a fixed lineage route. The 16 added recipes use I/II/III or IV/V/VI from one family and retain the 20 original branches. Every recipe consumes exactly three defenders. Three same-family, same-rank champions can ascend at any rank; offensive damage/DoT values multiply by 1.85 per rank. Tests cover continuation beyond VI, atomic rejection with too few ingredients and selected-position retention.
- The five bosses stand about 3.1–3.4 units tall (precise exported vertex heights 3.144–3.391); normal enemies remain about 1.82–1.98. Clan-colored auras, reinforced silhouettes and enlarged ritual details distinguish warlords. Enemy corpses collapse onto the ground; airborne bodies descend and fold wings. Shared geometry remains valid for later spawns. Corpses persist through the round and clear at the next construction phase.
- Exported `siege_arm` pivots animate catapult release/recovery. Continuous aura attacks emit a paced animation event, so the Ember Catapult moves while dealing damage. Animation tests cover motion, restoration and finite ground poses.
- Combat panels report the actual seeded warband's armor, resistances and mechanics, with live boss HP. Selected-defender counts use retained exact family/rank; grimoire cards count built champion results. Original class codes replace gemstones. Score tests cover regular kills (10 × wave), boss kills (500 × wave), survival (100 × wave) and boss-round survival bonuses (200 × wave), without duplicate awards. Best score is saved locally.
- Environment browser review on an isolated dev tab confirmed branched trees, ridged snowy mountains, moving curved river highlights/foam, waterfall sheets/spray/rings and intermittent distant clouds, with no warning/error logs. Seven environment/maze checks pass, including scenery/moving-water exclusion from every build tile and hiding clouds close to the board. Proof: `artifacts/environment-flow-wide.png`.
- Final verification after Blender regeneration: 87 tests passed, 0 failed; production build passed; the 4174 server returned HTTP 200 with 76 defender and 51 enemy entries. Browser review confirmed the smoother Dawn Seraph face/clothing, fully settled corpse poses, visible orange boss aura and changing boss health (4,133/4,226 HP in the reviewed frame). Proof: `artifacts/atelier-cohesive-final.png`, `artifacts/game-cohesive-final.png`, `artifacts/corpses-and-defenders.png`, `artifacts/boss-aura-health.png`. Earlier browser evidence below remains historical.


## Archer / castle walls / spiral review

- Blender 5.2.2 authored and exported all six archer ranks. Manifest validation remains 88 active GLBs; each archer is below the 10,000-triangle ceiling. Editable source and six transparent portraits are included.
- Interactive `/archer.html` renders the actual Blender GLB and switches ranks. VI has a visible soft halo and orbiting light motes. Model review is independent of game state; the pre-existing wave-10 tab was not reloaded.
- Rank colors are consistent in basic cloth, foundation indicators, cards, mastery probabilities and grimoire rank rows. Unplaced draws still reveal neither type nor rank. Other character body models are unchanged.
- Stone walls use cardinal neighbor masks. Rejected draft cards display the wall portrait and no stale defender rank. Their blocking cells, removal price and gameplay behavior remain the same.
- Spiral crossfire: 456 actual BFS steps, 212 placements, 277 steps (61%) within central firing reach. Grand spiral: 646 steps, 230 placements, 294 steps (46%) within reach. Their six leg counts and step-by-step paths match GridManager exactly. They are alternatives to the longer non-spiral candidates, not claims of global optimality.
- All 51 Node tests pass, including construction budget exhaustion, existing occupied cells and five-variant route validation. Production multi-page Vite build succeeds.

- Actual archer GLBs also parse successfully through Three.js GLTFLoader: 13 material meshes per rank, 14 for VI. Browser screenshots confirm the blue archer, gold mythic aura, six rank portraits and connected masonry. Saved review screenshot: `artifacts/archer-atelier.png`.


## Approved army / red-line spiral / round clarity

- Blender 5.2.2 authored 42 new basic variants and 20 advanced units in the approved archer style. All 68 defender GLBs parse using the real Three.js GLTFLoader; bounds are finite, largest visual width is 3.0 units, and each file stays below 10,000 triangles. All 28 families retain native editable `.blend` sources and all 68 variants have rendered PNG portraits. Roster counts and recipes are unchanged.
- Commander's spiral is traced from the supplied red wall strokes with tight corners widened for cardinal movement. Its 136 cells can be built at every prefix without sealing a checkpoint. Actual GridManager route equals the preview: 578 steps, legs 86/96/122/94/64/116, central reach 319 steps (55%). All six maze variants pass independent navigation checks. Screenshot: artifacts/commander-maze.png.
- Browser verified five blind placements revealing new Blender models. Numbered arrows identify each candidate and disappear on keeping. Automated lifecycle checks also cover draft-consuming merges/recipes and a fresh round.
- Browser verified Delete rejection before keeper selection, Backspace removing the retained defender for 8 gold (90 → 82), and Delete removing a wall for 8 gold (82 → 74). Cleared cards stay disabled and show no stale portrait. Automated checks cover combat/end-state guards, insufficient gold, atomic route updates and spent-draw protection.
- Royal atelier switches basic family, rank and advanced models. Browser screenshots verify the purple rank-III Mage and Griffin Rider; developer logs were free of warnings/errors. Production has no testing/debug interface.
- During browser verification, the ready panel was corrected to retain a Send wave action after demolition clears selection; floating badge scale now compensates for camera distance. Final screenshots record the corrected revision.


## Fixed blueprints / permanent defenders / map feedback — prior milestone

This revision supersedes the earlier demolition and live-search behavior above.

- Commander’s spiral now has a solid 3 × 3 battery: 136 cells, 590 steps, six legs 88/98/124/96/66/118. Its nine central positions cover 265 route steps in six-tile range. All six shipped presets independently match gameplay BFS. Prepared layouts remain fixed; new placements only update progress/conflicts/budget warnings.
- Browser verified that selecting a layout closes the panel and M reopens it. Drawing, undo, redo and erasing preserve gold and hidden recruits. The saved “Moje spirála” copy survives reload with 136 cells and 590 steps. Pure tests reject sealed checkpoints and malformed/out-of-bounds plans, protect all seven markers, and cover storage failure.
- Browser verified Delete rejection on a retained Cleric with no gold loss. Advanced Thorn Huntress preview marks the old Cleric result tile, old Druid and new Archer ingredients, and four discarded candidates. Retained units have no rotating arrow. Crafting preserves the selected old position; the consumed Archer can then be removed with Backspace for exactly 8 gold.
- Browser verified wave completion immediately moves into construction with five hidden slots and the correct single reward. Pure tests also cover final victory, duplicate completion and cross-round merge rejection. Matching current candidates still expose their rank merge; retained ingredients do not.
- Browser verified mouse-edge panning moves the map. Compass-bearing tests cover rotated camera quadrants. All 50 authored enemy silhouettes pass size checks: normal units about 2.1–2.6 world units, every boss 3.85. Browser checks include an enlarged Mogrok.
- Cardinal cross junctions and reciprocal diagonal masonry links are checked without changing occupied path cells. Existing combat, 50-wave, model, recipe and blind-draw tests remain covered.
- Current screenshots: artifacts/fixed-spiral.png, artifacts/recipe-map-final.png, artifacts/recipe-map-preview.png, artifacts/enemy-scale-review.png. Production build succeeds; Three.js remains the large vendor chunk.
# September 30 — enemy pack, battlements and economy

- 76 automated tests pass; production build succeeds. The existing Three.js bundle size warning remains.
- Parsed all 51 enemy GLBs with Three.js, checked finite grounded bounds (regular 1.82–1.98, bosses 2.28–2.30), triangle budgets, editable Blender sources, PNG portraits, separate mirror-shield parts and shared-geometry lifetime.
- Perfect-income simulation includes Kingdom gates: 15 mastery upgrades cost 6,500; first affordable maximum is after wave 30. Downgrade tests cover successful one-tier reduction, the 200-gold atomic charge, immediate retention, four walls, and invalid phases/ranks/funds. Lost lives cannot be restored.
- Browser checked on isolated dev tab: Soldier III lists Rose Duelist only, downgrade changes III to II and 1,119 to 919 gold, retained units stand on connected masonry, aiming does not rotate the walls, automatic round transition works, and Warbands uses the new models/HP/armor. No browser errors or warnings observed.
- Blueprint UI reports 250 cells total. A tested 250-cell layout plus nine off-plan buildings reports 259/250 and warns about the remaining draw budget. Chosen geometry remains unchanged.
- Three greedy campaign simulations lose on waves 16, 23 and 14; this verifies increased pressure against unplanned play, not optimal human balance. Human playtesting remains the next tuning input.
- Proof: `artifacts/defenders-on-walls.png`, `artifacts/enemies-in-battle.png`, `artifacts/ashen-host-blender.png`; reproducible economy report: `docs/ECONOMY_BALANCE.md`.
## Two imported Suggested maze layouts

- Added Diamond spiral (128 occupied cells, 19 gold firing positions, 718 steps) and Chevron bastion (153 cells, 21 gold positions, 504 steps) to the fixed catalog, now eight shipped layouts. Existing saved custom layouts and selected plans still load.
- Diamond reference's 36 × 36 grid was aligned to the game's checkpoints with one inserted row and column plus four connecting wall cells. Chevron preserves black and orange wall strokes with a single open gate east of checkpoint 4. See MAZE_COMPARISON.md for coordinates and six-leg counts.
- All 88 tests pass, including construction of every new foundation through the actual gameplay placement checks, exact BFS route/segment agreement, central firing coverage, budget accounting and saved selection. Production build passes.
- Both previews were selected and visually checked on the development origin. The served 4174 build displays both new choices without changing the user's existing selection. Browser console has no warnings or errors. Proof: artifacts/suggested-mazes-added.png and artifacts/chevron-bastion-preview.png.
## GitHub Pages publication

- Prepared a public repository with the game, exported assets, editable Blender sources, generators, documentation and tests. Backup scenes, local dependencies, logs and review artifacts are excluded.
- Removed PNG metadata containing personal local file paths without changing decoded pixels, compressed image data or color metadata.
- Runtime model, manifest, portrait and page URLs use Vite's deployment base. Both the game and Royal atelier load successfully under `/bastions-of-the-last-kingdom/`; local root-path builds remain supported.
- All 90 tests pass. Local and project-path production builds pass. GitHub Actions installs from the frozen pnpm lockfile, runs the tests and deploys the built website on pushes to `main`.
