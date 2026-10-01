# Dark Host V3 — 0.2.7 technical QA record

Revision: **0.2.7 · Dark Host**, 1 October 2026. The [approved design](APPROVED_ENEMY_DESIGNS.md) records the source chat; its historical statements about not changing the game belong to that earlier proposal. `data/enemy-designs.json` is the implementation mapping. All fifty names match the approved spelling and wave order exactly.

## Models and visual behavior

The active enemy manifest contains **59** `dark-host-v3` entries: fifty main warbands and nine alternate forms. Each has a Blender 5.2 `.blend` source, exported GLB and rendered portrait. Variant asset IDs select the approved ember/wraith, blood-leech and Ghorun forms without changing gameplay model enums. The retired balloon is absent. Native dimensions survive import; Ghorun's three queen wyverns have approximately 3× wave 5's bat wingspan and 1.5× wave 40's boss wingspan.

| Waves | Cosmetic aura |
|---|---|
| 1–10 | None, including the first boss |
| 11–20 | Yellow |
| 21–30 | Red |
| 31–40 | Dark violet |
| 41–50 | Black smoke with a visible violet edge |

Auras follow the lower body or wing roots and strengthen for bosses. They do not affect collision, damage, speed, defenses or concealment. Effect cues read actual combat state. Instances own their animated cue materials; death posing and disposal leave shared vertex buffers, cached templates and living clones intact. All 59 corpse forms are checked against terrain contact. The largest current enemy export is 20,074 triangles; the hard ceiling is 30,000.

## Gameplay preservation and Engineer

The regression removes only `name`, `appearance`, `visualAsset`, `designArchetype` and `auraStage` recursively before hashing enemy and wave JSON. Every remaining field retains its pre-redesign SHA-256 fingerprint:

| Data | SHA-256 |
|---|---|
| Enemies | `e380e30df148e6d6f07d52bfad14ea15ec0cc1a2d35d34c4dddf6da7c950c4ac` |
| Waves | `1aa5d616e192d31d04c50ad5cf0a5012878f1b89c6ce41055f7dc1badcfcb737` |

This preserves numerical balance, movement classes, ability timing, variant rules and spawn schedules. Only wave 1 retains introductory tuning. Engineer's six original 0.2.5 GLBs, portraits and native scene are restored byte-for-byte under stable family ID `runebreaker`. Kushek's original six-rank human design is archived separately in `public/assets/designs/kushek/` and `blender/scenes/kushek_design_v1.blend`, with checksum protection and no playable family or recipe added.

## Scenery and map markers

V6 retains historical V5 sources. The royal town exports **102,588 triangles / 37 batches**; the camp **139,117 / 25**. Seven royal wall sections reach the northern landscape edge and dry southern river bank; the bridge gate stays open. Thirteen archers and four soldiers stand on their walls. Sheep grazing expands from 28.35 to **67.99 m²**, and cattle from 51.35 to **112.64 m²**; seeded scatter varies positions and headings while retaining full-body fence clearance. The town has 88 scattered trees, and the camp has 195 mixed trees in an irregular nine-unit woodland band.

Tests inspect actual exported triangles, roofs/foundations, sampled river ribbons, pasture polygons and animal spacing. All geometry remains outside the 37 × 37 construction board; houses, fields, fences and fortifications remain dry. Native inspection renders confirm the wall endpoints, grazing layout and woodland. Map candidate numbers and recipe portraits remain stationary relative to their defenders; camera-facing sprites, full portraits and thin leaders replace rotating arrows.

## Reproduction and evidence

```sh
node tools/author-enemy-appearance.mjs
blender --background --python blender/scripts/author_enemies_v3.py
node tools/author-scenery-layout-v6.mjs
blender --background --python blender/scripts/author_scenery_v6.py
blender --background --python blender/scripts/render_scenery_v6.py
```

Focused checks are `enemy-designs`, `enemy-aura`, `economy-host`, `engineer-assets`, `kushek-assets` and `scenery-v6` tests. All **27 focused tests passed**, with the log in `artifacts/dark-host-v3-targeted-tests.log`. They cover all approved names/variants, real GLB geometry, queen-wyvern spans, cosmetic state isolation, original/archived asset checksums and scenery bounds. Full-suite and production-browser results are recorded in [QA.md](QA.md) after release verification; this record does not infer them from asset generation.

Native evidence: `blender/renders/enemies-v3/`, `blender/renders/royal-castle-v6-review.png`, `blender/renders/fortified-warcamp-v6-review.png`. Detailed local views: `artifacts/royal-frontier-wall-v6.png`, `royal-natural-pastures-v6.png`, `royal-dry-footprints-v6.png` and `warcamp-natural-woodland-v6.png`. These renders verify appearance and geometry; they are not a physical-device frame-rate measurement.
