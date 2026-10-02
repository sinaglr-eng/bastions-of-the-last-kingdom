# Secret champion art V2

2 October 2026 · game edition **0.2.8**, art patch **9**, asset cache **champions-v7.9**.

This visual revision addresses the atelier review of both Secret champions. Lady Claire is sculpted independently of Kushek and the first Claire model. She has adult facial proportions, small inset green eyes, a subtle closed smile, a lower continuous blonde hairline, loose shoulder-length hair, a gold crown, an ivory/champagne gown and gold jewelry. A radiant gold staff and three independent magic orbs preserve her casting silhouette. The fitted bodice ends at the waist; the embroidered front panel follows the pleated skirt surface without intersecting it.

Bernhard's white horse has a longer equine barrel, raised withers, an arched neck, smaller ears, a tapered muzzle, fore knees and bent rear stifle/hock joints. His pelvis rests directly on the saddle cushion. The ornate closed helmet conceals the entire head; gold trim, mantle, saddle blanket and sword grip replace blue accessories. Hoof soles stand on the longitudinally extended footing. Silver plate and gold ornament use restrained material emission and polished roughness.

| Export | Triangles | Native height | Editable source |
|---|---:|---:|---|
| Lady Claire | 9,550 | 2.109 m | `blender/scenes/ladyclaire_design_v2.blend` |
| Lord Bernhard | 13,297 | 2.974 m | `blender/scenes/lordbernhard_design_v2.blend` |

`secret_claire_v2.py` and `secret_bernhard_v2.py` own the individual designs. The shared `author_secret_champions.py` driver exports only requested families, records native bounds and articulation, renders portraits and saves editable sources. The V1 scenes and renders remain historical references. Active GLB names and family IDs remain stable.

Both Secret champions use a brighter cosmetic gold aura: four rings, thirty motes and eight taller/wider light wisps, with a 1.03-tile radius and stronger ground opacity. The effect stays below 500 triangles and uses fourteen local render objects, with no added lights or global postprocessing. Each instance owns its generated resources. The 37 ordinary classification auras retain their exact previous dimensions and shader values. Reduced motion restores native poses and holds aura motion still.

The temporary loading miniatures also use the redesigned silhouettes. Native models still replace them after loading; actual imported orb/horse limb pivots animate private clones. Recipes, combat values, economy, waves and statistics remain in the 0.2.8 edition.

## Reproduction and checks

```sh
blender --background --python blender/scripts/author_secret_champions.py
blender --background --python blender/scripts/author_army.py -- --family ladyclaire --no-render
node tools/author-roster.mjs
npm test
npm run build
```

Portraits are under `public/assets/army/`. Front, back, side and paired review PNGs are under `blender/renders/secret-champions-v2/`; the editable paired source is `blender/scenes/secret_champions_review_v2.blend`.

`tests/secret-art-v2.test.mjs` loads the production GLBs and checks actual geometry: saddle/pelvis contact within 0.025 m, overlapping seated footprint, an elongated horse body, four complete legs with hoof contact, fully armored head materials without skin/eyes or blue accessories, luminous gold ornament, a crown on the scalp, low frontal hair coverage and long loose hair. Export-safe geometry groups retain `horse_body`, `saddle_seat`, `rider_seat`, `royal_crown` and `natural_hairline`.

The exports use 43 material/joint mesh batches for Claire and 47 for Bernhard; the full pack averages 32 batches. The existing native-articulation, motion and asset checks cover all 87 defender variants, both Secret orb/horse rigs, template/clone isolation, source metadata and model budgets. Aura tests verify stronger actual Secret shader/geometry values, the unchanged ordinary styles, finite animation, reduced motion and exactly-once resource disposal. Browser review checks both current GLBs in the atelier and through real Secret combinations on the development battlefield.

Validation: **311/311 Node tests passed** with no failures, skips or cancellations; the production Vite build passes. The actual single-family `author_army.py` command preserved all 106 unrelated manifest records, Bernhard’s GLB/source, both portraits and all seven review PNGs. Both Secret combinations were crafted through the normal development UI, with their native models and gold auras visible and no browser warning/error logs. Publication is verified separately from these local checks.
