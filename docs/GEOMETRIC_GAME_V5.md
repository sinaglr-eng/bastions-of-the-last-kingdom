# Geometric models and battlefield 0.3.4

This edition implements the nineteen browser comments and additional boss-size request received on 3 October 2026. The current roster remains 48 basic rank models, 38 champions and 50 enemies. Original six-view source images and completed 0.3.0–0.3.3 archives are preserved.

## Requested behavior

| Comments | Delivered change |
|---|---|
| 1, 5 | Complete humanoid defender head assemblies shrink slightly around their seated base. Faces, hair, hoods, crowns, eyes and attachments use the same transformation. Mount and animal anatomy stays source specific. |
| 2, 3 | Six Mage ranks share a canonical body size and one family camera frame. Folded robes, attached mantles, hats and rank equipment follow the original six-view designs. |
| 4, 6 | Knight has a narrower, taller helmet. Kingslayer has one connected helmet shell with actual open eye slits, seated on the chest. |
| 7, 9 | Cloaks use closed folded cloth volumes with several vertical drape stations and pleats, fitted at the shoulders. This also applies to cloaked enemies. |
| 8 | King's shield is enlarged at the actual hand attachment. |
| 10, 11 | Dragonrider and Phoenix rider spines and pelvis move forward to connect with the existing thigh placement. The corrected legs remain ahead of the wing roots. |
| 12 | Nature Spirit retains one living wood and leaf body with an integrated face; luminous almond eyes sit recessed against it. |
| 13 | Archbishop's mitre has a solid roof across its central opening. |
| 14 | Archangel has taller gold and ivory anatomy, a divine sword and high gold aura. The spear and hand orb are removed. Its Advanced classification, frost attacks and slow effects are preserved. |
| 15 | Claire's physical staff shaft, foot, socket, open crown and cast endpoint all belong to the weapon rig. The complete staff moves through its attack. |
| 16 | A first click previews a recommended recipe. A second nearby click or tap on the same valid result portrait forges the champion at its marked site. Changing inventory, round, phase, pointer type or result site invalidates the pair. |
| 17, 18 | Current route chevrons move in the real travel direction and turn along actual path segments. The future route is a quieter grey dashed guide. Pause, hidden guides and reduced motion stop animation. |
| 19 | Existing walking lanes remain clear of tent fabric, stakes and ropes. Eight trees, three covered firewood stores, two weapon racks and a supply cart enrich the camp. |
| Additional boss request | All bosses have a 1.5× multiplier over their existing battlefield size. The entire figure, equipment and attached effects scale together. |

## Authoring and evidence

The final manifests bind public GLBs to their source SHA, native scene path, native geometry digest and export metrics. New scenes use `blender/scenes/geometric-game-v5`; unchanged scenes retain their exact previous path and bytes. The camp uses its separate `fortified-warcamp-v8.blend` source. Earlier scenes and archives are not overwritten.

`blender/scripts/geometric_character_proportions_v5.py` performs shared physical head and cloth changes. `geometric_champion_shapes_v5.py` builds the targeted champion assemblies. Native regressions check real shell topology, eye apertures, mitre roof rays, rider limb seams, shield dimensions and Claire's physical weapon hierarchy.

Current evidence is saved under `output/design/geometric-game-v5`. Source comparisons distinguish freshly opened six-view pairs from byte-identical subjects inheriting an eligible previous visual inspection. A render count alone is never treated as visual approval.

The numerical audits import the actual delivered GLBs. They check native geometry round trips, real contact surfaces and protected skin rays, runtime ownership and cleanup, production attack poses for 86 defenders and 50 enemy gait/ability models, and established source-specific shape regressions. Separate tests exercise the complete physical Claire staff through ten attack phases, the Archangel sword tip and cut, and Mage V/VI physical and projected body sizes. Historical strict contact and opacity thresholds are retained.

The camp's requested additions increase the mesh from 139,117 to 146,123 triangles. Its explicit v8 limit is 150,000 triangles and 36 material batches; historical v6 budgets remain unchanged. Route arrows use a preallocated instanced mesh rather than creating resources every frame.

## Rebuild and publication

The complete v5 archive contains the tested game, native scenes, original source images, comparison evidence, authoring tools and regression suite. `PACKAGE_INVENTORY.json` records every included file's SHA-256. Packaging validates review and audit bindings and preserves all four historical archive hashes. An independent extraction must pass the full test suite and production build before the archive is treated as complete.

The ordinary local commands are `pnpm install --frozen-lockfile`, `pnpm test` and `pnpm build`. `START_GAME.cmd` opens the local game. GitHub Pages uses the repository base path. Publication is verified against the deployed commit and actual public model, portrait, source and manifest bytes, separately from the push.

## Scope of verification

Concept PNGs have no calibrated ruler or common camera. Finite pose, ray and dimensional checks establish the tested interfaces, not every possible pose or pixel-perfect silhouette identity. This edition deliberately changes the Archangel design and defender head proportions according to the user's comments. The earlier wave-50 Wyvern Queen retains its documented simplified source silhouette; this edition does not claim a new redesign of that creature.
