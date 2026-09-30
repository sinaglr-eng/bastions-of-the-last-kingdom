# Original asset guide

The working style is readable medieval fantasy: smooth connected character anatomy, tailored clothing, crisp armor edges, warm timber, pale stone, dull iron, gold heraldry, subdued green/brown orcs and red hide tents. Scenery retains stylized faceted ridges. No borrowed game assets or external textures are used. Original fantasy siege machines include a dragonfire cannon.

## Scale and origins

- One grid cell = one world meter. A normal tower foundation fits a 0.94 × 0.94 meter square.
- Normal towers reach roughly 1.5–2.2 meters; advanced defenders use distinct hero, creature or siege silhouettes. Scenery keeps may be larger because they are outside the buildable grid.
- Blender uses Z up; GLB export converts to Y up for Three.js. Origins of static material groups are at the grid center, ground level. Object scales are applied.
- Runtime placement offsets grid coordinates by 18 to center the map. Visual scale never changes the strategic footprint.

## Naming and assets

- `human_<family>_t1.glb` through `t6.glb`: 48 character rank variants.
- `advanced_<family>.glb`: 28 champion and siege models (champion-v5), shared by continuing ascension ranks.
- `barricade.glb`, `pine_tree.glb`, `deciduous_tree.glb`, `rock.glb`, `castle_wall.glb`, `human_keep.glb`, `medieval_house.glb`, `barrel.glb`, `crate.glb`, `human_banner.glb`, `campfire.glb`, `wooden_fence.glb`, `cliff_module.glb`, `orc_warcamp.glb`.
- `orc_<archetype>.glb`: six original character blockouts, plus simple root/spine armature scaffolds in their source construction.
- `public/assets/models/manifest.json` lists 96 exports: 76 defender variants (48 basic ranks and 28 champions), plus 20 legacy prop/enemy assets. Entries include family/rank identities, style and triangle counts.
- `public/assets/enemies/manifest.json` separately lists 51 active Ashen Host models and their portraits (ashen-host-v2).

`game/render/models.js` defines the original defender fallback meshes. `tools/export-defender-meshes.mjs` supplies these to the legacy stage of the full generator. Native Blender authoring scripts then overwrite defender GLBs with the approved archer-style roster; the fallback meshes are retained for immediate rendering while GLBs load. The manifest is authoritative; legacy unreferenced GLBs are not loaded. Representative Royal Archer and Orc Grunt `.blend` scenes are retained under `blender/scenes/`.

## Geometry and materials

Aim for 200–2,500 triangles for normal structures and props. Current automated validation enforces a 10,000-triangle ceiling per exported file. Static pieces are joined by material to reduce draw calls while preserving useful material groups. The cohesive Blender pass joins and reshapes skin and clothing surfaces and smooths their normals, keeping armor and equipment edges crisp. Articulation parents remain separate where runtime movement requires them. `blender/scripts/cohesive.py` centralizes this treatment and mesh budgeting.

Materials use semantic names such as `MAT_stone`, `MAT_wood`, `MAT_iron`, `MAT_blue` and `MAT_gold`. Magic focus materials have subtle emissive color. PBR base color and roughness are embedded in GLB; there are no runtime image-texture dependencies. Final art can add UV-mapped atlases while retaining these slots.

## Export and regeneration

```sh
node tools/export-defender-meshes.mjs
blender --background --python blender/scripts/generate_assets.py -- --output public/assets/models
```

The script was executed and verified with Blender 5.2.2; it is written against Blender 4.x/5.x APIs. Export is binary glTF 2.0, Y up, transforms applied, no cameras/lights and no final animation clips. Blender must be installed only to regenerate models, not to play.

The browser loads all 76 playable defender GLBs and the separate 51-model enemy pack, with complete procedural fallbacks while loading. Current style tags are archer-v2, hero-v5, champion-v5 and ashen-host-v2. All 76 defender portraits are rendered directly by Blender and shared by draft cards, the grimoire and the Royal atelier. The champion catalog contains 25 characters/creatures and three siege machines. Stable family IDs preserve existing recipes and discoveries. Ground scenery remains procedural Three.js geometry in `game/render/environment.js`, merged by material where static; legacy prop GLBs are retained as references.

## Animation and VFX

Browser enemy limbs use exported pivots for walk cycles, bobbing, heading and hit reactions. On death, the same model falls into a ground pose; flying enemies descend and fold their wings. Corpses remain through combat and clear when construction begins. Bosses have clan-colored rings and orbiting aura effects. Defenders breathe, sway, aim and spring on attack. Catapult `siege_arm` pivots drive the throwing stroke and recovery, including continuous ember-aura attacks. Mythic equipment adds floating ornaments; Soldier attacks show a short sword slash. Projectiles travel visibly, and impacts/combinations emit short rings. These remain rigid articulated miniatures, rather than skinned characters with authored animation clips. Final particles, texture atlases and production audio remain future art work.

The river uses curve-aligned procedural shading and traveling foam streaks. The waterfall has flowing sheets, descending spray and expanding splash rings. Detailed branched trees and terraced peaks remain outside every build tile. Soft procedural cloud sprites drift and fade in with camera distance; close views hide them.


## Archer design V1 — historical review milestone

`blender/scripts/author_archer.py` authors the archer directly in Blender: open hood, shaped pleated cape, leather jerkin, boots, bracers, drawn recurve bow, arrow, quiver and individual face features. This does not use the previous procedural archer meshes. Native editable source: `blender/scenes/archer_design_v1.blend`. Collections separate ranks I–VI and parts retain semantic names. Temporary copies are joined by material for glTF export; the source retains editable parts.

Run `blender --background --python blender/scripts/author_archer.py` to regenerate six GLBs, six transparent portraits and the lineup under `public/assets/archer/`. The full asset generator calls this authoring module without re-rendering portraits, so rebuilding the pack cannot replace the approved candidate with an older archer. At the V1 review milestone, GLBs were tagged archer-v1 and the roster contained 68 defender variants. The current cohesive pass exports archer-v2, 42 hero-v5 and 28 champion-v5 entries. The stone footing stays within one cell; the drawn bow overhangs visually without blocking an adjacent cell.

Rank cloth is I blue (#3989ed), II green (#3eac63), III purple (#9555d8), IV white (#eee9db), V gold (#e7b43f), VI radiant gold (#ffd969). Runtime VI adds a soft additive halo and orbiting motes. The archer style is approved and is now shared by all other basic and advanced defenders, authored by `blender/scripts/author_army.py`. Advanced recipes keep their individual identities.

`game/render/walls.js` renders the current castle barricades with dressed stone courses, mortar seams, capping stones, lichen and crenellations. Cardinal neighboring barricades join into continuous straight, corner, T and cross walls. Removal updates neighboring connections. Legacy prop GLBs remain reference assets; they are not loaded for player-built walls.

`archer.html` is the Royal atelier: all 36 defender types, all six basic ranks, orbit/zoom, automatic rotation and a connected-wall preview. It never reads or changes a live game. These are posed meshes with runtime aim/sway; skeletal shooting clips are not part of this milestone.


## Approved roster — Blender army V1 and cohesive revision

`blender/scripts/author_army.py` reuses the approved archer's proportions, layered clothing, bevels and PBR palette. It authors all 42 non-archer basic rank variants and 28 champions directly in Blender. The cohesive revision smooths faces, joins skin and tailored forms and retains useful articulation pivots. Runtime accepts hero-v5 and champion-v5; archer is archer-v2. All 76 defender assets remain under the 10,000-triangle ceiling. Decorative wings/weapons overhang the one-cell gameplay footprint.

- Soldier: crested helmet, steel plate, sword and kite shield.
- Druid: antlers, leaf mantle, oak staff and beard.
- Mage: bent pointed hat, long robe, crystal staff and spellbook.
- Cleric: mitre, halo, sun staff and devotional book.
- Runebreaker: compact armored silhouette, braided beard and runic warhammer.
- Frost Warden: fur mantle, crystal staff and ice shield.
- Stormcaller: swept hair, brass circlet, lightning and hand orbs.
- Advanced roster includes griffin, wolf, dragon and phoenix riders; treant and ice colossus; distinct champions and spellcasters; three wheeled siege machines with matching miniature crews.
- New lineage silhouettes: Banner Warden, Gale Hunter, Oak Herald, Arcane Seer, Sun Hierophant, Ironrune Marshal, Winter Regent and Tempest Herald. The same family model serves higher ascension ranks, with runtime adornments indicating rank.

Regenerate all new models and portraits with `blender --background --python blender/scripts/author_army.py`. Use `-- --family mage` for one family or `-- --no-render` to skip portraits. Editable semantic parts and materials are saved for every family at `blender/scenes/<family>_design_v1.blend`; the six basic color variants are generated by the script. Portraits are in `public/assets/army/`. The full pack generator calls both native authoring scripts after the older fallback/prop export so it cannot silently regress the approved character style.

The floating current-round arrows are runtime overlays in `game/render/draft-markers.js`, independent of model aiming/recoil. Numbers map to keyboard slots 1–5. Their minimum screen size adjusts with zoom, and reduced-motion mode retains static markers.

## Ashen Host Blender pack

`blender/scripts/author_enemies.py` builds 51 original articulated enemy GLBs and transparent portraits in `public/assets/enemies/`; `manifest.json` maps every warband and the first flying balloon variant. Editable per-warband sources are in `blender/scenes/enemies/`. Rebuild with Blender 5.2 in background mode, passing `--python blender/scripts/author_enemies.py`; append `-- --only host_01` for one warband. The current ashen-host-v2 pack applies cohesive skin/clothing treatment, colored materials without texture downloads, independently animated legs/wings and three separate mirror-shield pieces. Mesh budgets remain below 10,000 triangles.

Equipment includes sculpted faces, tusks, clan braids, hooked cleavers, iron shields, ritual skull staffs, spellbooks, mushroom growths, explosive barrels, copper goggles, wolf cavalry, flying beasts and patched balloon gondolas. The five clans use separate palettes. Bosses carry more pronounced armor, trophies and ritual details; runtime aura effects reinforce their identities. Actual exported vertex heights are approximately 1.82–1.98 units for regular units and 3.1–3.4 for bosses (precise boss bounds: 3.144–3.391).

`enemy-assets.js` clones shared geometry safely; death cleanup does not dispose assets still used by later spawns. Runtime models and the Warbands guide use this same pack. Kept defenders receive runtime castle platforms; this does not alter their authored character models or strategic footprint.
