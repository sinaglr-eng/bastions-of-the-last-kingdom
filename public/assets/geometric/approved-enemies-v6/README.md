# Approved enemy V6 runtime assets

The active enemy model authority is `../geometric-enemies.json`: 54 approved V6 models, comprising 50 campaign appearances and four structural variants. Every GLB in this directory is an exact byte copy of the approved source delivery. `provenance.json` records the source path, size, SHA-256 and explicit user approval receipt for each identity.

`../source-manifest.json` remains the preserved inventory of the original 136 concept images and their historical provenance. It is an artwork reference inventory, not the active model count or animation inventory. Original concepts, recorded prompts, older runtime GLBs and approved basic V7/champion V8 assets remain unchanged.

All 140 current unit appearances use the separate private-instance `approved-motion-v1` runtime integration: 48 basic ranks, 38 champions and these 54 enemies. Enemy V6 source files contain static geometry with no embedded skins or animation clips. Runtime motion follows the approved motion analysis and model-specific working previews. Geometry needed for deformation is cloned for each actor; authored materials and textures retain their original values. The animation integration does not change damage, navigation, attack cadence or random outcomes.
