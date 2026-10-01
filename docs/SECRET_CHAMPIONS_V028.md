# Secret Champions — 0.2.8 QA and reproduction

Revision: **0.2.8 · Secret Champions**, 1 October 2026. The roster has **39 fixed champion recipes** (37 ordinary and two Secret), **47 defender types**, **87 defender variants** and **107 model-manifest entries**, including 20 legacy assets. The active enemy pack still contains 59 native Dark Host V3 models. Source-derived ability values and deliberate adaptations are recorded in [SECRET_CHAMPION_RULES.md](SECRET_CHAMPION_RULES.md).

## Secret selection and combat

| Champion | Exact current-round ingredients | Native presentation |
|---|---|---|
| Lady Claire | Mage V + Druid V + Frost Warden V | Kushek-inspired face, green eyes, loose blonde hair below the shoulders, no bangs, smile, dress, staff, three orbiting orbs |
| Lord Bernhard | Soldier V + Soldier IV + Soldier III | Radiant armored knight, raised sword, white horse with four articulated legs |

Both are fixed rank-I **Secret** champions with gold classification auras. All five draws must be placed before the combination can appear; its three ingredients must be distinct current-round draw IDs and the selected result anchor must be one of them. Previously retained units and stale drafts do not count. Crafting preserves all five occupied foundations, transfers ingredient kills, records normal discovery/combine events and spends no gold. All 37 ordinary recipes retain their existing ingredient rules and remain craftable from each valid anchor.

`tests/secret-towers.test.mjs` covers real placement and all three anchors, invalid rounds/selections, atomic rejection and result/wall outcomes. Combat tests exercise Claire's independent chain/fork rolls, distinct chain hops, fork bounds and exact five-combat-second Melancholy deadline under haste and accelerated time. Bernhard's tests verify a single projectile per attack, five-second poison, the exact three-tile aura boundary, range acquisition and allies ignoring evasion. **Poison 5 is an ability grade, not five targets.**

The moon platform glyph and selection-panel countdown read Claire's actual remaining Melancholy. `effects.melancholyTriggers` records starts; `effects.melancholy` records inactive combat seconds without assigning enemy-control credit. Backend regression tests craft both champions through the game, serialize their draws/combination/performance and round-trip those checkpoints through the API. Unknown families remain rejected. Current and older editions retain separate rankings without a schema reset.

## Native models, motion and regeneration

Both models were authored and exported by Blender **5.2.2**, with editable individual scenes and a paired review scene. Lady Claire has **9,904 triangles** and three independent imported orb pivots. Lord Bernhard has **13,365 triangles** with a specific 13,500-triangle budget; his raised sword gives a 3.053-meter height, within the explicit 3.1-meter ceiling. Other defender budgets remain unchanged. Portraits and front/back/pair review renders accompany the exports.

`secret-render`, `native-motion`, `champion-assets` and `defender-articulation` checks load real GLBs through Three.js. They verify actual moving orb/horse child geometry, preserved Y-up orb heights, authored diagonal horse gait phases, gold Secret auras and exact reduced-motion restoration. Cached templates and simultaneous clones retain their poses and materials. Runtime fallback models have distinct Secret silhouettes while their corresponding GLBs load.

The actual command `author_army.py -- --family ladyclaire --no-render` regenerated Claire successfully. Comparison preserved unrelated manifest records, Bernhard's model/source, both portraits and all five review PNGs. Generator-dispatch regressions ensure the legacy stage skips Secret assets and the full native stage uses their dedicated author rather than generic human finalization.

```sh
node tools/author-roster.mjs
blender --background --python blender/scripts/author_secret_champions.py
blender --background --python blender/scripts/author_army.py -- --family ladyclaire --no-render
```

Native evidence: `blender/scenes/ladyclaire_design_v1.blend`, `lordbernhard_design_v1.blend`, `secret_champions_review_v1.blend` and `blender/renders/secret-champions-v1/`. The archived Kushek sources/variants and active original Engineer remain preserved.

## English host and living enemies

All fifty warband names, alternate names and appearance descriptions are English in the canonical design data, runtime enemies/waves and portrait manifest. Historical [APPROVED_ENEMY_DESIGNS.md](APPROVED_ENEMY_DESIGNS.md) keeps the original source proposal. Enemy and wave gameplay fingerprints still match the prior release when only the five presentation fields are excluded; health, armor, resistances, abilities, movement classes and spawn timing remain unchanged.

`enemy-motion` and `native-motion` tests exercise actual bat, wolf-rider, manta and queen-wyvern rigs. Wings rotate about their imported hinges; bats use broad rapid flaps and heavier flying mounts use slower cycles. Grounded legs move with a restrained body breath/sway. Live combat uses the paused simulation clock; the camp preview breathes/flaps without walking. Reduced motion restores authored poses. Movement changes cloned transforms only, preserving source geometry, other instances and native species scale. Existing death grounding and concealment rules remain intact.

```sh
node tools/author-enemy-appearance.mjs
```

The translation itself needs no enemy mesh regeneration; future `author_enemies_v3.py` exports read the English canonical names.

## Royal outer defenses

Scenery V7 adds **133 angled wooden stakes** and **22 thorn bushes** between the western royal wall and river. They remain on dry land with at least 0.28 units of water clearance and a **seven-unit bridge opening**. Their geometry stays outside the entire construction board. The castle export has **109,570 triangles in 41 batches**; the camp continues using its unchanged V6 export.

`scenery-v7` tests inspect the real GLB vertices, water clearance, bridge corridor and semantic role counts. They also confirm that every original V6 vertex, index and metadata record is preserved. Stakes and thorns are cosmetic; they do not change pathfinding or combat.

```sh
node tools/author-scenery-layout-v7.mjs
blender --background --python blender/scripts/author_scenery_v7.py
blender --background --python blender/scripts/render_scenery_v7.py
```

Native evidence: `blender/scenes/royal-castle-v7.blend` and `blender/renders/royal-castle-v7-review.png`. Local detailed views are `artifacts/royal-outer-defenses-v7.png` and `artifacts/royal-bridge-clearance-v7.png`.

## Browser reproduction

Run `pnpm dev`, open `http://127.0.0.1:5173/?debug` and press **F2** with the battlefield focused. **Review Lady Claire draft** and **Review Lord Bernhard draft** create valid five-candidate selection fixtures through normal placement. Confirm the exact recipe in the sidebar, craft it using the normal combination button, and inspect the native model, gold aura, four discarded walls and closed selection. These fixtures exist only in development; debug sessions do not upload online statistics.

The actual development UI successfully crafted both champions and loaded their GLBs. Browser proofs are `artifacts/lady-claire-game-v028.png` and `artifacts/lord-bernhard-game-v028.png`, with no warning/error logs. The flying lineup's fixed positions and different wing poses are recorded in `artifacts/enemy-flight-v028-a.png` and `enemy-flight-v028-b.png`; the fixture holds speed at zero while the real animation clock runs. The Royal atelier provides independent family selection, full portraits, orbiting orbs and native mounted-knight inspection.

## Final release verification

- **306 / 306 Node tests passed**, with zero failures, skipped tests or cancellations. Full log: `artifacts/secret-champions-final-tests.log`.
- The production Vite build passes. Log: `artifacts/secret-champions-final-build.log`. The existing shared Three.js chunk-size warning remains.
- The statistics Site was updated in place with source `80de8afd91b3d316bd0130093761353685a101bf`; deployment `appgdep_6abeb7c7ed7c81918ce386a7b4697abf` succeeded. The D1 binding, migration and stored data remain in place. Read-only API evidence is `artifacts/statistics/secret-champions-live-verification.json`.
- GitHub Pages workflow and published-asset verification are recorded separately in `artifacts/secret-champions-public-verification.json`, alongside final public browser screenshots. Local tests alone do not establish deployment.
- Automated geometry and browser checks do not measure physical iPad/Safari performance or establish human campaign balance.
