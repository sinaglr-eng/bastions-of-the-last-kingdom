# The Cartographer's Table — complete requested phase study

October 16, 2026. **DIRECTION SELECTED FOR FURTHER DESIGN; SCREEN DESIGNS PROPOSED; NOT IMPLEMENTED.**

The user selected direction A and requested fuller game UI design for construction, combat, choosing a defender, choosing and browsing recipes, future waves and the current wave. This suite contains the original nine illustrated situations, each for iPad landscape and desktop: **22 selected screen studies**, including the three-combination and rank-comparison cases. Ready/defender inspection and the non-committing combination preview connect the requested views into an explicit command loop.

Open [the offline visual gallery](index.html) to switch device and phase, or use the individual image links below. This is a read-only image viewer, not a playable UI prototype. The top selector changes the displayed concept only; it never changes the game.

Current revision: [rank statistics, quantified effects and one preparation folio](reviews/20261016-comments-03/README.md), with six revised screens and an additional rank-comparison pair. The [second review](reviews/20261016-comments-02/README.md) remains preserved. The [first seven-comment review](reviews/20261016-comments-01/README.md) remains preserved. Original images and prior review records remain preserved.

## Studies

| Study | Player task | iPad landscape | Desktop |
| --- | --- | --- | --- |
| 01 Building | Place recruits without revealing hidden slots; track a pinned recipe. | [View](reviews/20261016-comments-03/01-building-ipad-r6.png) | [View](reviews/20261016-comments-03/01-building-desktop-r6.png) |
| 02 Choose keeper | Compare a candidate, keep it deliberately, or inspect an available combination. | [View](reviews/20261016-comments-03/02-choose-keeper-ipad-r6.png) | [View](reviews/20261016-comments-03/02-choose-keeper-desktop-r6.png) |
| 03 Combination preview | Show exactly what is consumed, where the champion appears, and what becomes walls. | [View](reviews/20261016-comments-02/03-combination-preview-ipad-r5.png) | [View](reviews/20261016-comments-02/03-combination-preview-desktop-r5.png) |
| 04 Ready and defender inspection | Inspect a retained defender, plan the route, then explicitly start the wave. | [View](reviews/20261016-comments-02/04-ready-defender-ipad-r4.png) | [View](reviews/20261016-comments-02/04-ready-defender-desktop-r4.png) |
| 05 Combat | Watch the battlefield while monitoring the current assault and measured DPS. | [View](reviews/20261016-comments-01/05-combat-ipad-r3.png) | [View](reviews/20261016-comments-01/05-combat-desktop-r3.png) |
| 06 Current wave and boss | Keep boss HP and counts independent, with only revealed live information. | [View](reviews/20261016-comments-01/06-current-wave-ipad-r3.png) | [View](reviews/20261016-comments-01/06-current-wave-desktop-r3.png) |
| 07 Future waves atlas | Compare alternate defenses without pretending the future mixture is predetermined. | [View](07-future-waves-ipad-r2.png) | [View](07-future-waves-desktop-r2.png) |
| 08 Recipe selection | Search and filter champions while keeping pinning separate from availability. | [View](reviews/20261016-comments-01/08-recipe-catalog-ipad-r4.png) | [View](reviews/20261016-comments-01/08-recipe-catalog-desktop-r3.png) |
| 09 Recipe detail and browsing | Browse ordered recipes and component chains without losing filters or the pinned goal. | [View](reviews/20261016-comments-01/09-recipe-navigation-ipad-r3.png) | [View](09-recipe-navigation-desktop.png) |
| 10 Three combinations | Inspect three real recipe options without overlapping details. | [View](reviews/20261016-comments-03/10-three-combinations-ipad-r7.png) | [View](reviews/20261016-comments-03/10-three-combinations-desktop-r6.png) |
| 11 Rank comparison preview | Inspect rank IV statistics while the actual Archer II and commitment action stay unchanged. | [View](reviews/20261016-comments-03/11-rank-comparison-ipad-r7.png) | [View](reviews/20261016-comments-03/11-rank-comparison-desktop-r7.png) |

## Why the layout changes

Building and Choose keeper now share one preparation folio: five recruit cards, a selected-unit detail with quantified effects, rank comparison and a four-stat grid, plus a compact pinned plan or combination list. Construction keeps its hidden slots and future odds; its unavailable commitment commands remain absent. During choosing, it exposes comparison and explicit Keep/Preview actions. The combination study connects allocated ingredients to a specific foundation and makes wall outcomes visible before commitment. Ready uses a compact Maze plans / Start wave dock and map selection to open the defender inspector; no Inspect keeper command or permanent recruitment receipt. Combat folds construction away, promotes the current assault and places Current wave above measured DPS, switching to Next wave when combat finishes.

The recipe and wave catalogs are open atlases for deliberate reading. Their list/detail pages support touch without a stack of unrelated popups. Selecting a page does not pin a recipe, craft a champion, reveal a hidden recruit or jump the actual campaign to another wave.

## Review the design, not generated statistics

The suite is based on edition 0.3.31 runtime adapters. [Runtime reference](runtime-reference.json) preserves real names, recipes, base profiles, wave data and protected-source hashes. Match examples, maps, portraits, effects, measured scores and unit positions are illustrative. These images are not saved legal runs or game testing evidence. Existing approved production art remains unchanged.

Generated raster text can drift from the supplied prompts: exact labels, numbers, rank comparisons, portraits, map markers, artwork proportions and small captions are not an implementation contract. The [current review record](reviews/20261016-comments-03/review.json) identifies the latest revisions; the [original review](review.json) is historical evidence. [Design notes](design-notes.md) and current runtime semantics take precedence. In particular: future odds never describe a fixed champion result; current draft units are not Built; a hidden slot never has a recipe allocation; unit consumption does not necessarily clear a foundation; champion portraits do not acquire basic rank progression.

The images cover the original nine situations plus three-combination and rank-comparison cases on both device classes. Seven earlier pairs retain their preceding artwork; the new global compact-DPS and icon rules take precedence over their historical raster details. Pause, results and settings have behavior notes but are not extra image pairs in this suite. iPad references use 4:3 landscape; other iPad proportions, enlarged text, safe areas, physical touch/Safari and comprehensive accessibility are not verified by these raster concepts.

## Files and provenance

- [Design notes and phase transitions](design-notes.md): working game-design decisions, semantic boundaries, device targets and later acceptance checks; final engineering handoff remains unfrozen pending screen review.
- [Current image edit prompts](reviews/20261016-comments-03/prompts.json) and [targeted refinement prompts](reviews/20261016-comments-03/refinement-prompts.json) preserve this revision. [Original generation prompts](prompts.json): shared brief, device briefs, individual scene briefs and all fully assembled prompts. Built-in **image_gen** was used; no CLI/API fallback.
- [Current review](reviews/20261016-comments-03/review.json) and [file identity](reviews/20261016-comments-03/files.json): actual saved screen files, dimensions, checksums, revision state and review limits.
- [Current artifact verification](reviews/20261016-comments-03/artifact-verification.json) and [original local viewer checks](viewer-verification.json): all 22 selected images, intended landscape proportions, final image links, English viewer copy, script syntax and unchanged protected runtime source; scoped browser device/phase navigation. These checks do not certify the illustrated game's interactions.
- [Current rank/effect profiles](reviews/20261016-comments-03/runtime-reference.json) and [extraction script](reviews/20261016-comments-03/capture-runtime.mjs) preserve the numeric basis for this revision.
- [Original runtime reference](runtime-reference.json), [capture script](capture-runtime.mjs): read-only campaign-adapter extraction. The script writes only this concept directory.
- [Gallery generator](build-gallery.mjs): regenerates the English offline image viewer. Requires no game runtime or external assets/services. Keep index.html beside its PNG files.

The initial A studies in ../ui-new-directions-20261016-v1 remain preserved; this suite develops that selected direction. Superseded original PNGs and revision siblings remain historical generation records; the gallery and selected-files.json choose their corrected siblings. No gameplay, balance, production interface or approved 3D artwork was changed. The screen studies require review before the detailed implementation plan is frozen and before separate implementation authorization.

