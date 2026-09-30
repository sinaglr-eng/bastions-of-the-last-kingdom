# Development record

## Current milestone

Browser-first playable campaign, through milestone 9's initial content target. This is an original stylized prototype with a tested complete game loop, not a production-finished art or balance release. Godot was replaced by browser technology at the user's direction before any Godot files were created.

The repository was initially empty apart from `.git`. The implementation sequence was: pure rules and four-family / ten-wave slice; live 3D map and drafting/combat integration; rules and browser verification; expansion to a thirty-wave campaign; then the user-requested open map, character defenders, six explicit ranks and twenty reference-inspired recipe branches.

## Completed systems

- Open 37 × 37 strategic grid, no terrain obstacles, five intermediate checkpoints on the fifth tile from the edge, spawn and keep exit.
- Continuous detailed meadow without a board frame, terraced snowy peaks, branched forested banks, curve-aligned flowing water, waterfall sheets/spray/ripples and exterior bridge. Scenery bounds exclude the whole construction area; distant camera views add occasional drifting clouds.
- M-key chooser with eight fixed measured blueprints, persistent selection, progress/conflict reporting and a draw/erase/undo/redo custom editor. Local saved plans survive reload. Offline tools retain search and independent BFS benchmarking. No global-optimality claim.
- Dynamic four-neighbor shortest routes checked across every checkpoint segment before committing a placement. Rejected placements leave occupancy and the route unchanged.
- Five sealed slots per round; independent family/rank roll only after valid placement; keep one, conversion to four blocking barricades and paid removal. Round-start mastery odds are frozen; invalid placement consumes no random roll.
- Six basic tier qualities (VI is merge-only), 15 gradual mastery upgrades costing 6,500 gold, equal family weighting, Kingdom XP / gold and mastery gates. Perfect-income maximum remains first affordable after wave 30.
- Current-five-only basic family/tier merging, 37 approved exact three-defender recipes across retained ingredients and repeatable three-identical-champion ascension at any rank. The eight later formation champions remain removed; the agreed renamed and restored roster contains 37 champions. Every basic family/rank pair appears in a fixed recipe. Recipe eligibility uses the selected defender's exact family/rank; result location follows the selected ingredient. Consumed foundations stay occupied.
- Physical, piercing, arcane, fire, frost, poison and holy damage; armor, resistance, penetration, splash, chain, slow, freeze, poison, burn, bleed, auras and bonus damage tags.
- Visible traveling projectiles, articulated catapult throwing arms, unit motion/recoil, impact rings, combine pulses and heavy-hit feedback. Boss auras reinforce enlarged silhouettes. Fallen enemies descend/collapse and remain as corpses through the round; next construction clears them.
- Fifty authored orc waves follow the source movement/trait order, with five bosses and seeded alternatives. The opening three waves use lower HP, zero armor, slower movement and wider spawn intervals while retaining enemy counts and rewards. Veil, evasion, disarm, refraction, immunities, theft, dread, rush, reactive armor, recharge, blink, shell and war drums have real counters. Legacy archetypes remain for development fixtures.
- Six targeting priorities, timed spawning, wave completion, rewards, victory/defeat, pause and 1× / 2× / 3× speed.
- Camera pan/rotate/zoom, range and route overlays, numbered checkpoints, next-wave previews, grimoire, pinning, exact-rank owned counts, actual current-wave traits/resistances and live boss HP. Basic labels combine one family letter with a Roman rank, such as `S III`. Touch input supports one-finger panning, short taps to build/select, pinch zoom and two-finger drag rotation; drag and multi-touch gestures cannot also place a defender.
- Kill/wave score and browser-local profile for recipe discoveries, audio setting, best score, best wave and wins. No online account or permanent power progression.
- Audio manager with replaceable category hooks and synthesized placeholder attack/UI/result cues.
- Developer controls guarded by the development-build flag and `?debug`: gold, mastery, forced next draft, enemy spawn, kill, wave skip, recipe unlock.
- Reproducible Blender authoring: 85 playable defender/champion GLBs plus 20 legacy prop/enemy assets in the 105-entry model manifest; a separate 51-model Ashen Host pack. All playable families and warbands have editable `.blend` sources and rendered portraits. Cohesive skin/clothing geometry and smooth normals retain useful articulation pivots.

The approved `data/towers.json`, `data/recipes.json` and `data/balance.json` files are the source of truth for numerical balance and recipe topology. `node tools/author-roster.mjs` validates them without modifying files. Its explicit `--refresh-presentation` mode changes only catalog names, descriptions, model categories and unit kind, preserving all agreed combat values and recipes. Blender regeneration reads the current JSON; it must never restore the obsolete 26-unit reference generator.

## Architecture

```text
data/                     balance, towers, recipes, enemies, waves (JSON)
game/core/                pure JavaScript, no browser or Three.js dependency
  game.js                 round-state orchestration and player commands
  grid.js                 terrain, occupancy, checkpoint BFS paths
  maze-search.js          topology search, BFS counters and core firing exposure
  blueprints.js           validation, fixed-plan progress, editor history and local library
  maze-worker.js          optional search tooling; not used by the live planner
  maze-seeds.js           prepared legal candidates, always revalidated
  draft.js                sealed slots and on-placement random reveal
  recipes.js              exact multiset matching, champion ascension and merges
  progression.js          atomic spending, XP and mastery
  combat.js               spawning, targeting, damage/status/aura components
  warband-info.js          actual seeded wave traits, boss HP and retained counts
  math.js                 seeded RNG, probabilities, defenses, tier stats
  save.js                 versioned local profile storage
game/render/              Three.js scene, camera, model factories, VFX
game/audio/               Web Audio categories and placeholder cues
game/main.js              UI wiring and frame orchestration
ui/                       fantasy HUD, layout, icons, responsive styling
blender/scripts/          reproducible Python asset generator
blender/scenes/           representative authoring sources
public/assets/models/     shipped GLBs and generated manifest
public/assets/enemies/    active warband GLBs, portraits and separate manifest
tests/                    Node test runner, pure-system and GLB validation
tools/                    local static server, balance and content authoring
docs/                     additional engineering notes and QA record
```

Core dependencies flow into `Game`; the rendering/UI layers observe events (`change`, `shot`, `impact`, `death`, `combine`, `wave`, `reward`, `won`, `lost`). State updates never depend on animation completion. Static scenery is merged by material; tower templates share geometries/materials. GLB towers replace complete procedural fallbacks after asynchronous loading.

Movement is deterministic in grid coordinates; rendered world coordinates offset the grid to center it at the origin. Ground enemies follow a route snapshot because construction is closed during combat. Flying enemies interpolate the checkpoint list directly. Barricade removal happens between combats, so active enemies never inherit stale navigation.

The frame loop clamps its elapsed step to avoid hidden-tab jumps. Game speed multiplies simulation time. Browser blur/visibility changes pause combat; closing a modal restores the previous pause state.

## Validation

- `pnpm test`: includes 800,000 seeded quality rolls and 100,000 family draws. Coverage includes approved 37-champion recipe matching and complete basic-rank ingredient coverage, champion ascension, exact three-unit consumption, score awards, counts, actual wave traits, boss health, corpse posing, siege pivots, moving-water bounds and distant-cloud visibility. Opening-wave tests run all eight basic families at rank I through three waves at checkpoint and central-crossing placements; touch tests exercise tap/drag separation, multi-touch suppression and actual OrbitControls panning. The latest full-suite result is recorded in `docs/QA.md`.
- Three complete seed-driven campaign simulations use the actual combat and progression code. Latest outcomes are recorded in docs/QA.md. Reports are in `artifacts/campaign-simulation.json` after running the tool.
- `pnpm build`: production bundle succeeds; the graphics-engine chunk is approximately 628 KB before gzip. No CDN dependencies.
- Blender 5.2.2 authors the current cohesive pack. Runtime loads archer-v2, hero-v5, champion-v6 and ashen-host-v2. The 105-entry defender/legacy library and 51 active enemy exports are covered by GLB parsing, mesh-budget and finite-bounds checks.
- Browser checks and remaining limitations are recorded in `docs/QA.md`.

## Controls

See README.md and the in-game Help dialog for the complete keyboard, pointer and touch controls.

## Known limitations

- Graphics are original stylized models with smoother connected character surfaces. The battlefield favors readability; final skinned animation, texture work and production art remain open.
- Defenders and all 50 warbands use original Blender GLBs. Enemy legs and wings animate through exported pivots; these are rigid articulated miniatures, not skinned motion-captured characters. Procedural characters remain a fallback if an asset cannot load.
- Audio is synthesized placeholder feedback; no final music, ambience recordings or voice performances.
- Save/load covers local profile data and custom maze blueprints, not an in-progress battlefield. Refreshing begins a new run. Browser storage can be unavailable or cleared; the game handles that without failing.
- Sappers scorch nearby barricades to apply a temporary local tower-rate penalty. They do not remove walls or require midcombat path rebuilding.
- The approved roster has 37 fixed champion recipes and unlimited champion-rank ascension. All 48 basic family/rank pairs have a recipe route; matching-pair merges remain available for current draft candidates below rank VI. Achievements and other campaigns remain future work.
- Balance is provisional. Full campaigns have automated smoke coverage; manual playtesting across many random drafts is still needed.
- A WebGL-capable browser is required. Mobile layout and one-finger map panning are present, with tap selection and two-finger zoom/rotation. Automated touch tests do not replace physical iPad playtesting.

## Next priorities

1. Collect human playtest data for late-wave health, keep choices, recipe reachability, and mastery timing.
2. Add skinned rigs, refine effects and author audio/ambience.
3. Add versioned in-progress save/load and further recipes without diluting the five-draw rule.
4. Add spatial partitioning / instanced units if future waves exceed the current campaign sizes.
