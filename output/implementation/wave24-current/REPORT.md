# Current 0.6.9 rendering patch

The patch reduces repeated model/render work, reduces only the largest enemy presentations by 25%, and warms at most two likely craft results. Rules, RNG, HP, attack ranges, damage, routes, score eligibility and approved source asset bytes remain unchanged.

## Paired browser measurements

Same PC, actual Chromium/WebGL, 1280 × 720 canvas, same camera, 128 walls, fixed 19-defender Dwarf army and 30 enemies. Each warmed window contains 120 frames with all seven actual defender assets ready and no pending model loads.

| Scene | Before median (ms) | After median (ms) | Less time | Draw calls before → after |
|---|---:|---:|---:|---:|
| Wave 24, 30 living, frozen simulation | 63.6 | 29.2 | 54.1% | 14,860 → 3,306 |
| Wave 24, 10 living + 20 completed corpses | 63.9 | 23.9 | 62.6% | 14,700 → 3,146 |
| Wave 46, 30 living, frozen simulation | 55.2 | 38.5 | 30.3% | 11,563 → 7,723 |
| Wave 46, 10 living + 20 completed corpses | 55.2 | 37.8 | 31.5% | 11,403 → 7,563 |
| Wave 24, 30 living, moving native animation on fixed layout | 107.5 | 61.0 | 43.3% | 14,860 → 3,305 |

All frozen paired scenes submit the same number of triangles. The moving samples differ by two submitted triangles out of 11 million at different animation clocks; source topology is checked independently. Wave 46 additionally includes the requested 25% presentation reduction; all wave 24 sizes remain the same. Frozen cases isolate the renderer and exclude simulation. The moving case runs real approved gait with fixed map positions and no attacks; it is distinct from the separate active 5× combat smoke. Final screenshots show the actual canvas with production overlay styles. Earlier offscreen fixture captures were replaced before this handoff. These timings do not establish a physical iPad frame rate or a 60 FPS guarantee.

## Correctness and loading

- 2,090 regression tests passed; production build transformed 238 modules.
- All 258 faction profiles passed 1,548 actual clip poses, preserving source topology, bind/skin/world transforms, material parameters and linear RGB palette values.
- All 54 enemy profiles passed 486 gait/fall poses against independently evaluated controls with the new optimizations disabled. Private deformed attributes remain exact; submitted transformed positions allow 2e-5 floating-point tolerance. Cached GLB source arrays and resource retirement remain exact.
- Fifteen actual-engine comparisons across all three factions and waves 24, 35, 46, 49 and 50 retained identical ordered hit/spawn/death/leak digests, outcomes, scores, RNG and operation counts. These fixed armies are rendering/combat regression fixtures, not legal acquisition evidence.
- Prepared Griffin Scout, Heavy Sniper and Gatling Golem craft checks record a ready model in the same synchronous craft callback. Cold or offline downloads still depend on the network and decoding.
- World selection and occlusion still use the original per-tile wall surfaces. Shared submitted enemy poses use copy-on-write so living actors and completed corpses cannot overwrite one another.

Detailed observations are in the neighboring JSON files. Public deployment and source/mirror receipts are recorded separately when complete. No gallery is published and no test score is submitted.

## Public deployment

The current 0.6.9 patch is published at https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/ from commit 3b4722ecf5a725226b3cb089a8ec37d479b2c1c9. Both CI build and deployment passed: https://github.com/sinaglr-eng/bastions-of-the-last-kingdom/actions/runs/41548549855. The public compiled entry and current media identities were verified separately from the actual public browser smoke check. Existing statistics storage and score rules are unchanged.
