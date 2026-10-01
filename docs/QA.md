# QA record — 1 October 2026

## Current revision

The approved release contains eight basic classes and 37 champions: 85 defender variants and 20 legacy assets in a 105-entry model manifest, plus the separate 51-model Ashen Host pack. The new champion art uses champion-v6; basic and enemy packs retain archer-v2, hero-v5 and ashen-host-v2. Native editable sources and rendered portraits accompany the shipped packs. Historical review notes below retain their original counts and behavior; later revisions supersede them.

## October 1 — Living Kingdoms 0.2.5

- All 212 Node tests and the production Vite build pass. Approved tower, recipe, wave, enemy and balance JSON files exactly match 0.2.4: only wave 1 retains its introductory difficulty. The build retains its existing shared Three.js chunk-size warning.
- Repeated production startup exposed an intermittent negative first-frame delta reaching the town's zero-phase CatmullRom current. Frame time now clamps to 0–0.05 seconds, and both river animations wrap their curve parameters into 0–1. A regression exercises actual Three.js curves with negative/large times and nonfinite input and verifies finite stream positions outside the board.
- Actual Three.js loading validates both new Blender GLBs and their precise world-space vertex bounds. The royal palace/town has 59,642 triangles in 28 mesh batches; the orc territory has 74,981 in 19. All settlement vertices remain outside the board. The keep's western edge is X=28.2 on dry ground, and its longer cosmetic bridge connects to the new gate road without moving the gameplay exit. The independent next-wave preview survives asynchronous camp loading.
- The royal town has 20 houses plus a watermill, 24 residents, six streets, three canal bridges, five fields, two pastures, nine sheep, six cows and a quarry. Real NPC/animal geometry, fences, the raised troll/ogre terrace and the guarded cave are inspected in native Blender renders and tested through GLB semantic markers and mesh bounds. The exported waterwheel rotates around its own axis inside the flowing town channel. Static landscape: 178,764 triangles/23 batches, 863 trees, 61 massifs plus seven connected mountain ridges, 147 rocks and 370 understory placements. Wider camera zoom accommodates the expanded surroundings.
- Recipe-tree tests cover all 37 recipes, exact ranks and all three direct ingredients, owned intermediate champions, separate placed-candidate availability, cyclic/malformed input bounds and shared allocation that cannot count one defender twice. Production-browser review confirms Kingslayer's Lionheart Champion, Knight and Frostbolt Watchmen branches and their nested basic recruits. Built counts remain zero for unretained candidates.
- Support rendering tests exercise actual aura ranges and stacking groups, simultaneous bonuses, active hostile timers, immunity/control resistance, enemy status expiry and detection, movement, reduced motion, independent resources, repeated synchronization and disposal. Actual cached Cleric GLB materials remain unchanged. Instanced box bands color platform tops/sides; separate glyphs retain simultaneous effects. The sidebar reports real values and anonymizes unrevealed hostile providers, including their count. Developer-browser review confirms +110% attack speed, +50% damage, +3 range, 100% control protection and true strike together, plus separately marked suppressed towers.
- Production-browser review confirms no warning/error logs, Construction mastery beside the five cards, the selected card's Keep action and successful double-click retention of an initially unselected Archer, with four castle walls and one map-top Start wave button. Desktop 2035×1244 and tablet 1024×768/768×1024 viewport layouts have no horizontal overflow. Physical iPad/Safari and GPU frame rates remain unverified; isolated Node CPU timing is not a device performance measurement.
- Evidence: local `artifacts/release-0.2.5-tests.log`, `release-0.2.5-build.log`, `release-0.2.5-support-effects.png`, `royal-castle-v4-review.png` and `fortified-warcamp-v4-review.png`. Palace references are the [official Neuschwanstein palace page](https://www.neuschwanstein.de/englisch/palace/index.htm) and its [history](https://www.neuschwanstein.de/englisch/palace/history.htm); shipped geometry is original.

## October 1 — Kingdoms in Motion 0.2.4

- All 187 Node tests and the production Vite build pass. Waves 2–50 and their enemy records exactly match the original campaign revision before the opening-patrol simplification (`d970ed1^`). Only wave 1 retains 9 HP, zero armor, speed 1.3 and a 2.4-second spawn interval. Waves 2 and 3 restore 61/80 HP, 1/8 armor and 0.6-second spawn intervals; counts, rewards and the rest of the campaign are unchanged.
- All 85 defender GLBs parse through Three.js with actual movable geometry, articulated limbs and matching manifest triangle counts below 10,000. The Archer, Soldier and Mage at ranks I and VI retain their pre-articulation world bounds within floating-point tolerance. Native Blender source review confirms real shoulder/elbow/wrist chains and correctly parented equipment. Actual bows draw their own string even when their projectile palette is magical; Bearking keeps its distinct paw/root presentation.
- Runtime tests exercise real limb movement and exact rest-pose restoration, staff-tip world positions, independent strings/glows on simultaneous clones, reduced motion and resource disposal without mutating cached assets. Magic waves originate at the moving staff focus. Local developer-browser review covers arrows, sword swings, roots, lightning, dragon fire, support and frost effects alongside revealed and concealed enemies. Existing physical armor, magic resistance, pure damage and concealment tests remain green.
- Local production-browser verification confirms that double-clicking an initially unselected card keeps that exact defender, leaves four barricades and presents one Start wave button at the top center of the battlefield. The Keep action is attached to the selected card. Gesture tests cover mouse/touch pairs, stale identities, mixed pointers, delays, movement, cancellation and keyboard selection. Construction mastery spans horizontally above all five cards. Desktop 2035×1244 and tablet 1024×768/768×1024 layouts have no horizontal overflow; physical iPad/Safari has not been tested.
- The expanded royal town and orc encampment load in the production browser with no warning/error logs. Tests verify exterior bounds, open board/bridge corridors, the forthcoming-wave preview anchor and finite geometry. The keep has 19,814 triangles/21 material batches and the camp 33,542/14; the static surrounding landscape has 736 trees, 62 mountain massifs, 147 rocks and 399 undergrowth placements in 22 batches. Editable Blender sources accompany both new scenery GLBs.
- Articulated pieces raise defender primitive counts to an average of 32 and maximum of 40, compared with approximately 12 previously. Idle attack rigs return immediately. An isolated CPU animation check is not a GPU performance measurement; physical tablet frame rates remain unverified. The build retains its existing large shared Three.js chunk warning.

## Earlier validation

Release 0.2.2 passed the complete suite of 145 Node tests and the production Vite build. All 85 defender GLBs parse through the real Three.js GLTFLoader with finite positions, normals and bounds and matching manifest triangle counts. Canonical world-space triangle hashes confirm 37 distinct champion geometries, independent of names and materials. Catapult's real siege_arm rig moves its loaded child geometry and restores it without modifying the cached source. Local production-browser checks confirmed exactly 37 recipe cards, Basic/Intermediate/Advanced/TOP labels, damage and base DPS, the Nature Spirit rename, aggregated pinned requirements and strong blue/green/purple/gold auras, with no broken portraits or console warning/error logs.

Coverage includes all 37 reachable three-defender fixed recipes, all 48 basic family/rank pairs, rejection of champion Ascension, recursive pinned recipe accounting, allied-magic-triggered Archangel bounces, capped Royal Ranger health recovery, bounded Greedy gold, Monk blessing groups, healing suppression, Stone Gaze and five-target forked lightning. Existing route, economy, score, touch, status and enemy-mechanic tests remain covered.

## October 1 — Champion Codex 0.2.2

- Removed generated champion Ascension recipes, crafting and numerical rank scaling. Recruit merging I–VI and paid champion upgrades remain available. An independent comparison with 0.2.1 found identical combat stats for all 196 currently reachable profiles: 48 basic ranks plus 37 champions with zero through three paid upgrades.
- Rechecked all 37 classifications against the wiki Towers table: 5 Basic / 13 Intermediate / 11 Advanced / 8 TOP. All four classes have identical aura geometry and animation strength, differentiated only by classification color. Tests cover all 37 auras, absent effects for ordinary recruits, finite animation, reduced motion and disposal.
- Grimoire tests verify readable concrete effects, all 37 classification labels, fixed three-piece recipes and damage/interval DPS without conditional bonuses. Continuous fire DPS and other effects are separate from direct attack DPS. Nature Spirit keeps its existing stable ID and model.
- Recursive recipe tests cover repeated family/rank requirements, owned component champions, surplus stock, ignored ruins, duplicate physical identities, missing recipes and cycle guards. Kingslayer expands to eleven recruits in eight rows, including two copies each of F I, S I and T I. A built Knight plus Frostbolt Watchmen covers eight of those eleven without double counting.
- Local production checks verified all four aura colors, the renamed Nature Spirit and the complete pinned Kingslayer breakdown in both its card and sidebar. Pinning opens the breakdown and keeps it in view. Browser logs contain no warnings or errors.

## September 30 — approved 37-champion release preparation

- Preserved the approved stable family IDs, champion names, numerical settings and recipe topology. Nineteen original champions have new names; Frost Colossus retains its name. Seventeen restored units bring the total to 37. All 48 basic family/rank pairs appear in at least one fixed recipe.
- Replaced the obsolete 26-unit authoring generator with a read-only authoritative JSON validator. Explicit presentation refresh changes catalog labels and model categories only; it never regenerates combat statistics, balance settings or recipes.
- Replaced four player-facing wiki-verification placeholder labels with descriptions of the implemented abilities, preserving source-verification metadata.
- Updated roster, recipe table, model counts, support caps and ability documentation to match the agreed data. All 37 models were rebuilt in Blender 5.2 with distinct silhouettes; every asset and source is included in version 0.2.0. The existing GitHub Pages workflow validates the same tests and production build before deployment.

## September 30 — original roster, opening patrols and iPad input

- Restored eight basic classes and twenty original champions. Removed the eight later formation families, their sixteen fixed recipes, eight models, eight portraits and eight Blender sources; authoring scripts now reproduce the original roster. Repeatable three-identical-champion ascension remains available.
- Basic defender labels use one unique letter followed by the Roman rank: S/A/D/M/C/R/F/T. The grimoire, recipe ingredients, draft cards, selection panel and atelier share this format. Browser review confirmed S I through S VI and the original champion list, with no warning/error logs.
- Only waves 1–3 changed: HP 9/15/21, armor zero, movement 1.3/1.45/1.6, spawn intervals 2.4/2.2/2 seconds. Counts 8/8/9 and rewards 29/36/43 remain unchanged. Eight Tier I families tested at both a checkpoint and the central crossing completed all 48 simulated wave outcomes without leaks. A defender away from the route still leaks; no health-loss exemption was added. Waves 4–50 and the mastery income schedule retain their previous values.
- One finger pans the map; short taps place or select; two fingers zoom and rotate. Tests exercise Three.js OrbitControls directly and cover jitter, dragging back to the start, both multi-touch release orders, cancellation and synthetic click suppression. No physical iPad/Safari session has been tested.
- Exact-rank ingredient analysis leaves nine basic ranks unused by champion recipes: Archer V/VI, Druid II/IV/V, Cleric IV, Runebreaker II and Stormcaller II/VI. Soldier, Mage and Frost Warden use every rank. Basic two-candidate merging through VI still works independently of champion recipes.
- Validation: `node --test tests/*.test.mjs` passed all 100 tests; production Vite build passed. A production-browser mouse click placed exactly one Cleric I and revealed C I on both card and sidebar. The atelier loaded Archer A III and showed 28 types / 68 variants without warning/error logs. Publication uses the existing GitHub Pages workflow, which runs the tests again before deploying.

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

## Release 0.2.1 — Champion Auras

- 133 automated tests pass; production build passes. Three.js parses all 85 defender GLBs with finite positions, normals, bounds and matching triangle counts; all 37 champion geometry signatures remain distinct.
- Wiki classification coverage is 5 Basic / 13 Intermediate / 11 Advanced / 8 TOP. Tests cover absent Basic effects, progressively stronger signals, stable classification across ascension, finite animation, reduced motion and resource disposal.
- Genuine Blender 5.2.2 exports and editable scenes were regenerated for Engineer I–VI, Knight, Lionheart Champion, Kingslayer, Paladin and Mother Nature. Portrait stamp metadata was removed without changing decoded pixels. Knight/Lionheart/Kingslayer/Paladin/Mother Nature use 9,002 / 9,552 / 9,238 / 9,530 / 3,338 triangles.
- Read-only comparison with release 0.2.0 confirms every numeric/combat field and all recipes, balance, enemies and waves are unchanged. Seven presentation fields changed, including Kingslayer's name and renderer category.
- The 4174 production game starts normally and the grimoire loads 74 recipe cards (37 fixed recipes plus next-rank ascensions), including the renamed Kingslayer, with no broken portraits. Atelier checks cover all six model edits and representatives of every classification; browser consoles have no errors or warnings.
- Local visual proof: `artifacts/0.2.1-rimewatch-browser.png`, `artifacts/0.2.1-runebreaker-browser.png`, `artifacts/0.2.1-roseguard-browser.png` and `artifacts/0.2.1-kingdomprotector-browser.png`.
