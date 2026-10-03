# Dark Host source reconstruction 0.3.5

This edition follows the completed defender and battlefield changes in 0.3.4 with a fresh inspection of all fifty campaign enemies. Each enemy is compared with its original front, back, left, right and two three-quarter designs. The original concept PNGs, the eighty-six delivered defender/champion assets and all five completed archives are preserved.

## Enemy geometry

The initial comparison records source-specific deficiencies for each enemy. Repairs use new editable scenes under `blender/scenes/geometric-game-v6/enemies/`; the frozen 0.3.4 inputs remain available. Humanoid equipment and creature anatomy are authored separately, including fitted helmets, pointed ears, armor, attached packs, shields, complete held weapons and the distinct features of individual warbands.

Open features use physical geometry. Bell cracks and hollow undersides, eye sockets, skeletal cages, hollow armor and the Deep Maw troll's second mouth are checked against actual exported triangles. Equipment belongs to its corresponding body or weapon assembly. Material changes alone cannot establish an opening or a connected weapon.

Mounted figures retain their own animal anatomy and fitted rider equipment. The final wyvern uses its source's two hind legs and wings as forelimbs. Production flight, grounding, pause, control effects, reduced motion and death handling support that rig. The same runtime continues to support the existing four-legged flying mounts.

The five bosses retain the previous 1.5× battlefield multiplier. Their new authored physical heights are checked against the actual 0.3.4 GLBs so that a source correction cannot silently undo the requested increase. Combat statistics, recipes, rewards and wave schedules remain authoritative in the existing game data.

## Inspection and verification

Evidence is saved under `output/design/geometric-game-v6`. The initial fifty-enemy comparison and the final resolution records bind every finding to its source, native scene and delivered GLB hashes. Fresh six-view inspection records include the actual render hashes and the reviewer's scoped outcome. The unchanged eighty-six towers inherit their eligible prior inspections after exact asset and manifest equality checks.

The numerical audits import the delivered assets. They measure physical contacts, protected head surfaces, native/export geometry agreement, complete weapon assemblies, required source openings and boss dimensions. Production enemy poses also receive contact and covering checks. Negative controls move or seal actual geometry while retaining its metadata, verifying that a descriptive flag cannot manufacture a pass.

Replacement garments identify their actual current cloth surfaces explicitly. They retain the existing physical depth, drape-height, vertex and closed-volume criteria. Separate negative controls remove the named surfaces or flatten the actual replacement cloth, proving that an inspection label cannot substitute for its geometry. Grounded models also retain the existing terrain-bearing check.

The masonry deck height is calibrated to the corrected wave-two goblin's actual head and ears, excluding its spear. Protected head coverage tests cast rays against the current imported surfaces as well as checking any retained native audit records.

`tools/enemy-review-v6.html` displays all fifty actual runtime enemies in five pages. It supports six views, selected production phases, native walking or flight, pause, freezing, petrification, reduced motion, grounded death and optional effects. Every figure checks the SHA-256 of its loaded GLB against the current manifest and displays a short hash with the full value in its tooltip. This supplements the native six-view source comparison.

Finite pose, ray and dimension checks establish the interfaces actually sampled. Raster concepts have no common calibrated ruler; they do not establish exact physical dimensions or certify every possible animation frame.

## Complete archive and rebuild

`output/design/geometric-game-v6-complete.zip` contains the tested game, current native scenes, original source images, inspection evidence, authoring tools and regression suite. Exact 0.3.3 and 0.3.4 native inputs and manifests allow the authoring changes to be replayed. Historical archives are preserved separately.

The package inventory binds included files with SHA-256. An independent fresh extraction checks each entry, runs the full test suite and builds both production pages with the GitHub Pages base path. The original public assets and completed archive are checked again after that rebuild.

For a checkout, use `pnpm install --frozen-lockfile`, `pnpm test` and `pnpm build`. On Windows, `START_GAME.cmd` serves the built game locally. Publication verification checks the deployed commit and the actual public model, portrait, original source, manifest and entry-page bytes.

The prior head, cloak, champion, staff, recommended-portrait, route and camp work remains documented in [Geometric models and battlefield 0.3.4](GEOMETRIC_GAME_V5.md).
