# Secret champion art V3

2 October 2026 · game **0.2.8** · art patch **10** · cache **champions-v7.10**.

Only Lady Claire and Lord Bernhard are rebuilt. Names, recipes, combat data, progression, statistics service and the other 85 defender variants are preserved. The previous V1/V2 sources remain as historical files. The active sources are `blender/scenes/ladyclaire_design_v3.blend` and `lordbernhard_design_v3.blend`; the paired editable scene is `secret_champions_review_v3.blend`.

| Model | Triangles | Deform bones | Materials | Exported clips |
| --- | ---: | ---: | ---: | --- |
| Lady Claire | 54,842 | 31 | 12 | Idle 2.4 s; Attack 1 s |
| Lord Bernhard | 59,638 | 29 | 11 | Idle 2.4 s; Attack 1 s |

Claire is freshly authored without importing earlier Claire or Kushek geometry. A continuous adult facial surface integrates cheek, jaw, nose and eye sockets. Her individually shaped, opposed fingers are sculpted into each palm while retaining separate finger skin weights. The right hand encloses the actual staff. The gown has a fitted bodice, deeper vertical and diagonal folds, thickness and a packed satin weave normal map. Long, layered blonde hair starts at the curved forehead and temple hairline, with a continuous rear curtain beneath the separate locks. The gold crown, jewelry, staff focus and three independent amber orbs retain her Secret silhouette.

Bernhard has an enclosed sculpted visor and layered silver/gold plate shells with overlapping joint lames. His cream cloth, gold trim, white horse and chestnut tack contain no blue equipment. The horse uses a fused anatomical surface with weighted neck, head and leg regions. The rider's pelvis rests in the physical saddle; boots rest on modeled stirrup treads. Curved gauntlet digits hold the raised sword and reins. Fine material roughness maps are UV mapped and packed into the GLB. The pose is a mounted ranged magical gesture; it does not suggest the blade physically reaches a distant enemy.

The source files retain editable surfaces, materials, UVs, packed textures, armatures and both actions. Production copies are joined by material and attachment while preserving the original source parts and named skin weights. Claire has 12 skin batches plus six separate orb surfaces; Bernhard has 11 skin batches. Geometry, textures and immutable animation clips are cached and shared; each battlefield instance owns one independent skeleton and bone texture. Higher detail is reserved for these two Secret champions rather than regenerating the ordinary roster.

## Animation and combat timing

Both native Attack clips contain preparation, release at normalized **0.36**, follow-through and recovery. Claire's torso, casting hand and staff arm articulate together; her hair and gown have restrained secondary bone motion. Bernhard's shoulder, elbow and wrist carry his sword while the horse subtly shifts its weight and neck. Rider and saddle contacts remain coupled throughout the motion. `staff_tip` and `sword_tip` are real bone-following effect sockets.

The renderer never schedules damage or consumes gameplay RNG. At the existing combat shot event it aims the actor, samples the exact release pose, updates bone/world matrices and captures the socket for a gold projectile. The existing projectile flight and impact callback retain their original timing and damage, including poison and Claire's chain/fork effects. Subsequent preparation anticipates the existing cooldown. The animation fits inside the effective attack interval and responds to haste, dread, disarm, Melancholy, target changes, pause and simulation speed.

An immediately ready first attack or a newly available target may start at the release pose because delaying that shot would change the existing mechanics. At high haste and 3× simulation speed some poses occur between displayed frames. These limits do not add, remove or delay gameplay hits. The atelier exposes the full one-second native clip, pause and playback speed so all phases remain inspectable.

## Verification and reproduction

Generate only these assets and manifest rows:

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe' -b --python blender/scripts/author_secret_champions.py -- --no-render
```

Use `--family ladyclaire` or `--family lordbernhard` for an isolated regeneration. `--gallery-only` creates the paired native scene. Dedicated review modules reimport the actual GLBs for detail and animation renders; they do not substitute a separately posed display model.

Front, back, both sides, face/helmet, hands, saddle and attack key poses are in `blender/renders/secret-champions-v3/`. `ladyclaire-attack-glb.gif` and `lordbernhard-attack-glb.gif` show the exported skeleton/actions after a fresh Blender GLB import. These native clips show the gesture; the web atelier adds the runtime gold aura and socket-released projectile.

Native and imported audits check the entire clips. Claire's staff/gown and hand/gown triangle intersection checks found zero overlaps across all 31 authored attack frames. Bernhard's seat contact remains within 8.1 mm and both sole/tread contacts within 2.1 mm across all 51 authored attack frames. Production Node tests also check these contacts across both exported clips and check contact markers against real weighted triangle surfaces. These measurements supplement the rendered inspection; they do not prove every possible surface pair is intersection-free.

Tests load both production GLBs, verify real weighted deformation, moving effect sockets, private skeleton isolation, shared-resource disposal and simulation-clock pause. A deterministic combat comparison covers both champions through haste, dread, poison, lightning procs, Melancholy, pause and varying simulation speed: shot/impact events, HP, statuses, cooldowns, lives and score match a run without the presentation controller. A hash audit preserves 412 unrelated/gameplay asset files and 105 unrelated manifest rows.

The models remain stylized web-game figures, with groomed mesh hair and restrained authored cloth/horse motion rather than physical hair/cloth simulation. Claire's forearm and palm/wrist transition retain slight faceting in extreme macro views. Bernhard's mane, tail and cape use restrained authored shapes rather than simulation. These limits should remain visible in the evidence rather than be hidden by glow.

After the assets were frozen, all **321 Node tests passed** and the production Vite build succeeded. The existing large shared Three.js chunk warning remains. Actual browser atelier recordings are `ladyclaire-attack-atelier.gif` and `lordbernhard-attack-atelier.gif`; these show the production GLB clips together with runtime gold aura and socket-released effects, using the visible half-speed control.

Both champions were also crafted through the real game's normal Create action after loading their existing ingredient drafts with the F2 review panel. In wave 16, each performed a native bone gesture and a moving-socket gold projectile; a compatible Goblin Runner was killed and the normal sidebar reported **1 kill**. The wave's magic-immune enemies retained their immunity and leaked normally. Names, recipes, displayed stats, rewards and combat behavior were unchanged. These were local browser QA sessions, not submitted leaderboard results. The actual game evidence includes `ladyclaire-game.png`, `ladyclaire-game-result.png`, `lordbernhard-game.png` and `lordbernhard-attack-game.gif`.

The visible atelier controls were exercised at half speed, normal speed and 3×. Pausing each atelier produced identical pixels after the paused state settled, freezing bones, orbs, aura and the spell. Game Pause and simulation-speed controls were exercised separately. Browser warning/error logs were empty in the inspected atelier and gameplay sessions. The automated timing tests cover target changes and effective haste as well as the manual recordings.

A CPU-only benchmark on Node 24 and an Intel i5-13600KF measured 0.338 ms median / 0.372 ms p95 to animate a mixed group of 20 Secret defenders, and 0.726 / 0.787 ms for 40. Each instance uses one private skeleton shared among its material batches. This excludes WebGL skinning, draw calls, shadows and aura effects; it is not a browser FPS or mobile-device performance result.
