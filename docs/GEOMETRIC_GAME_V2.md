# Geometric Army 0.3.1

This edition addresses the 21 appearance comments after 0.3.0 and adds the hostile roster to the Royal Atelier. The accepted changes are recorded in [the appearance review checklist](ATELIER_REVIEW_0_3_1.md).

The Atelier offers all 86 defender variants and all 50 enemy models in campaign wave order. Its URL preserves the defender family and rank, or the exact enemy wave, for subsequent comments. Six camera views, defender attacks, enemy walking or flight, rest poses, pause, speed, optional auras and model/portrait downloads share the game's actual exported models and motion code.

Battlefield actors use a private 0.88 scale. Original model dimensions and Atelier scale are retained, and tower platforms keep their height. Movement converts world distance into the actor's scaled stride; attack effects originate at the physical weapon or mouth. Fallen enemies keep the same scaled model and remain grounded and opaque until the entire wave ends.

## Native changes

Archer bows and the four champion bows use a vertical forward plane with matching string and grip motion. Hats and caps sit on the actual skull roof, boots connect to segmented shins, and head coverings share the head pivot. Soldier and champion helmets use faceted shells, visor recesses and gorgets. Ivory hood bands follow the actual hood opening. Frost Warden I also has the requested white collar. Stormcaller uses separate curved hair locks and a connected neck rather than a cylindrical hair mass.

Knight and Lionheart Champion have modeled equine necks, elongated heads, knees, hocks, fetlocks and hooves, with fitted armor and caparisons. Dragon models have segmented limbs and feet, shaped snouts, horns and curved tails; riders sit on saddles with separate hips and thighs. Thunderbird has overlapping flight feathers, a hooked beak and curled talons. Kingslayer has a shaped greatsword and actual helmet visor. King's Ranger Guard carries the shield on his back, leaving the crossbow and hands clear. Lady Claire's approved outer sculpture is retained; any added concealed leg structure is checked separately from the visible silhouette.

## Verification and delivery

Actual triangle surfaces are checked for head/cover seating, head/neck contact and boot/shin contact through rest, attack preparation/release/recovery, idle/gait and battlefield scale. Hat seating uses five head-local upward rays; a touching front brim cannot conceal a floating rear crown. Protected top/rear/side coverage is checked separately from legitimate face openings. Native files are reopened to verify packed reference bytes and native/export geometry.

Changed models receive fresh six-camera renders and explicit source comparisons. Review records carry current model, source and render hashes. Technical checks and render counts alone do not constitute appearance approval. Source raster sheets provide no physical dimensions, so absolute 1% accuracy and silhouette IoU 0.97 are not certified.

Current review evidence and browser proofs live in `output/design/geometric-game-v2/`. The native files retain their workspace paths under `blender/scenes/geometric-game-v1/`; the corrected exported models are under `public/assets/geometric/`, with cache key `geometric-game-v2`. The new portable archive is `output/design/geometric-game-v2-complete.zip`. The original 0.3.0 archive is preserved.

The archive packager requires current source-inspection records, six-view provenance, native reopening, runtime checks and surface-contact results. It verifies file hashes and ZIP integrity before delivery. Publication is checked against all 136 model files, 136 portraits, four manifests and both entry pages.

Final validation passed 398 game tests, 5,258 runtime checks, 10,175 actual surface interfaces and 25,443 protected head rays. All 136 packed native scenes were reopened, and all 816 current source/model view pairs have explicit inspection records. The production Atelier loaded all 50 enemy models through its visible controls without browser console errors. These finite checks establish the inspected poses and delivered files; they do not certify every possible pose or dimensions absent from the source drawings.
