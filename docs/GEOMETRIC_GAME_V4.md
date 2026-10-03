# Geometric models and battlefield 0.3.3

This edition follows the third source comparison. The user's latest comments override older drawings where they request concealed necks, a unified nonhuman Nature Spirit body, contrasting Dragonrider armor, lightning crowns and crossbows.

## Character fit

Humanoid heads, hair, hoods and helmets seat on real shoulder clothing or breastplates. Hidden fitted sockets preserve articulation without an exposed neck column. Animal neck anatomy remains visible. Engineer's hammer and its gripping hand move together away from the head. Cleric's staff rests vertically and its mitre has a real opaque roof.

Paladin and Archangel use one hollow integrated armored helmet shell with actual eye apertures. Kingslayer has separate, fitted two-handed greatsword grips and a shaped breastplate. King and Elven King have layered shaped hair locks. Royal Ranger's trim sits on the clothing. Crossbows have a forward support palm and a rear trigger palm, following the stock through recoil.

Horse heads, muzzles, ears, mane, bridle, leg joints and hooves are checked in all six original views. The dragon riders and Griffin rider sit with their legs forward of the wing roots; dragon wings are larger. Nature Spirit uses one living wood and leaf body with its face integrated into that body, branched antlers, wood arms and intertwined roots.

## Battlefield and routes

Every battlefield defender and enemy is another 20% smaller: the private runtime scale changes from 0.88 to 0.704. Editable native scenes and the Atelier retain their authored size. Wall deck height follows the actual second-wave goblin's head and ears at that scale, excluding its spear. The first masonry course stays broad; courses above it are 20% narrower. Retained defenders stand on chamfered capstones supported by dressed masonry and corbels.

Checkpoint markers are 15% larger. The current ground route is continuous gold with direction arrows; the current flying route is cyan and follows the checkpoint segments. The completed blueprint's ground route uses purple dashes. A map legend controls the two routes separately from the suggested wall cells. When they coincide after construction, only one route is drawn. A blocked final blueprint shows no fictitious route. Existing structures outside the blueprint are included in its final route calculation.

## Verification and editables

The motion audit uses every actual production defender GLB and its real weapon or spell dispatch. Enemy checks cover the actual walking, flight, active abilities, variants and auras used by the campaign. It distinguishes those systems from optional synthetic enemy attack previews. Checks cover preparation, release, recovery, restored pose, paused time, reduced motion, contact, cached-clone isolation, finite effects and disposal. Source/model visual inspection and actual triangle contacts remain separate acceptance criteria.

Changed scenes receive fresh six-view source/model comparisons. Inherited visual review is accepted only when native, GLB, source, portrait and six render bytes are unchanged. Native reopening checks packed sources and geometry against the exported assets. Reports bind the inspected assets and tested runtime to SHA256 hashes; sampled checks do not certify every possible silhouette or pose.

Final validation passed 436 automated tests, 10,628 production animation/effect checks on all 136 models, 5,258 runtime checks, 9,460 actual triangle contact interfaces and 25,443 protected head-cover rays. All 136 native scenes were independently reopened. The 124 changed models received 744 fresh source/model view comparisons; 12 unchanged models inherit 72 byte-verified earlier comparisons. An independent priority review opened another 84 pairs for 14 models.

The enemy sorcerer in `host_50` has corrected rider head/chest fit, but its retained wyvern head, neck armor and tail are simplified relative to the original source. That existing source-detail limitation is recorded in both author and independent reports; this release does not certify its complete silhouette/detail agreement. Original source links in the Atelier now use the manifest, including Lady Claire's distinct source directory, and all 136 source images are delivered unchanged.

The separate `output/design/geometric-game-v4-complete.zip` includes all 136 editable native scenes, GLB exports, portraits, source sheets, six-view renders, builders, the tested game and review evidence. All three previous complete archives remain unchanged. The frozen validation results are recorded in `output/design/geometric-game-v4/release-validation.json`.
