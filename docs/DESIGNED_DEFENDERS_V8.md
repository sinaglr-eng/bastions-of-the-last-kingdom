# Designed defenders, art revision 11

Delivery cache revision 12 includes Engineer's fitted ruler grip at all six ranks
and the family-specific Claire regeneration metadata guard.

Cosmetic revision of game edition 0.2.8: eight basic classes with six ranks,
37 ordinary champions and Lady Claire; 46 available families and 86 GLBs.
Lord Bernhard is temporarily hidden from recipe offers and the atelier. His
exact recipe, statistics, abilities, model and editable source remain archived.

## Native authoring

Blender 5.2 sources use connected, curved surfaces. Human forearms, wrists, palms
and five curved fingers form joined skin. Garments, hollow bracers, overlapping
armor plates, eyelids, hair and equipment have fitted separate surfaces. Claire's
staff grip and casting hand were repaired in her V3 source.

Dragons have joined anatomy, recessed eyes, shaped jaws and teeth, horn ridges,
fitted scale plates and membranes supported by wing digits. Bird wings have
layered feather rows. Mounts have saddles, reins and stirrups. Siege rigs move
their draw mechanisms, throwing arms, payloads, barrels and recoil assemblies.

Material batches share immutable geometry and packed PBR textures. Each actor
has private bones, with one Skeleton across its material batches. Editable
sources retain more topology than exports. Triangle limits: basic rank 30k,
ordinary humanoid 45k, creature 60k, engine 35k, Claire 60k, final boss 95k.
The runtime loads needed defender models through four concurrent requests.

## Animation contract

Every available defender exports Idle (2.4 seconds) and Attack (1 second), with
release at Attack fraction 0.36. Real weighted bones move the anatomy and gear.
The bone-attached `attack_muzzle` provides the effect origin. Atelier controls
play the complete action, freeze it and change preview speed.

Combat remains authoritative. Existing shot/aura events sample the release pose
and produce the existing effect; animation never schedules hits or cooldowns.
The stroke fits the effective cadence, including haste, dread and changing
targets. Preparation anticipates the existing cooldown. An immediately ready
first attack begins at its release pose, without a new startup delay. Simulation
pause freezes poses and effects. Projectile impacts and instant effects retain
their original combat timing; presentation cannot add damage.

## Wave 50

**Morvath, the Dread Sovereign** is a hooded, dark-crowned sorcerer with a magic
sword, seated on a black two-legged wyvern. His existing alternate forms become
Morvath the Ashen, Morvath the Gold-Cursed and Morvath the Bone-Crowned.

The 38-bone flight rig deforms membranes, neck, tail and robe. Rider and saddle
follow the same mount reference throughout Idle. An editable Attack flourish is
also exported, but gameplay plays flight only: the boss retains its original
advancing/suppression/leak mechanics and gains no sword hit. Existing aura,
numeric colors, archetype ID, hit points, speed, armor, immunity, resistances,
shell, rewards, leak damage and wave schedule are unchanged.

All other enemies and their portraits, sizes, movement and mechanics remain
unchanged. Data changes are limited to Bernhard's hidden flag and wave 50's
cosmetic names/appearance. Balance and recipe files are untouched.

## Reproduce and inspect

```sh
blender --background --python blender/scripts/author_defenders_v8.py -- --family soldier,worldfire,ladyclaire
blender --background --python blender/scripts/review_defender_humans_v8.py
blender --background --python blender/scripts/author_defender_creatures_v8.py -- --review-only
blender --background --python blender/scripts/final_boss_v4.py
blender --background --python blender/scripts/review_final_boss_v4.py
```

`author_army.py` defaults to the native dispatcher; `--legacy-art` explicitly
opts into historical authoring. `generate_assets.py` preserves native entries.
`author_enemies_v3.py` routes only wave 50 to the native V4 author. These guards
prevent old static generators from silently replacing current rigs.

Editable sources: `blender/scenes/*_design_v8.blend`,
`blender/scenes/ladyclaire_design_v3.blend`, `blender/scenes/final-boss-v4/`.
Exported-GLB review renders: `blender/renders/defenders-v8-humans/`,
`blender/renders/defenders-v8-creatures/`, `blender/renders/final-boss-v4/`.
They include directions, details, key attack poses and short animation previews.

Tests load production GLBs and check weights, moved vertices, private instances,
release sockets, pause/rate handling, seat contacts and exact combat parity.
Existing gameplay fingerprints are retained. Development F2 controls expose
four real defender battle groups and the actual final boss using the normal
importer/renderer, with analytics disabled.

These are stylized web-game assets, not photorealistic characters. Cloth and
finger motion is authored, not physically simulated. Macro views may reveal
decimation facets. Review does not prove collision freedom for every possible
target/support combination; judge the exported assets at atelier and game scale.
