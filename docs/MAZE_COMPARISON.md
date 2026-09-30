# Measured maze variants

Open field: 120 steps. Previous 140-wall recommendation: 392 steps. Current campaign allows 250 total placements over 50 rounds. Counts sum the actual cardinal shortest path across all six ordered checkpoint segments, including repeated visits. These are best-found layouts, not proven global optima. Flying enemies ignore the walls.

| Search | Variant | Steps | Walls | Steps in central range | Central coverage | Six legs |
|---|---|---:|---:|---:|---:|---|
| Initial | Longest found | 1086 | 243 | 371 | 34% | 18 + 312 + 16 + 342 + 60 + 338 |
| Initial | Central stronghold | 722 | 197 | 440 | 61% | 196 + 78 + 228 + 16 + 186 + 18 |
| Initial | Lean crossfire | 504 | 105 | 116 | 23% | 54 + 144 + 14 + 86 + 72 + 134 |
| Initial | Spiral crossfire | 456 | 212 | 277 | 61% | 18 + 108 + 102 + 14 + 108 + 106 |
| Initial | Grand spiral | 646 | 230 | 294 | 46% | 18 + 220 + 14 + 14 + 168 + 212 |
| Initial | Commander's spiral | 590 | 136 | 265 | 45% | 88 + 98 + 124 + 96 + 66 + 118 |
| Extended | Longest found | 1132 | 250 | 386 | 34% | 26 + 334 + 16 + 348 + 60 + 348 |
| Extended | Central stronghold | 1060 | 173 | 711 | 67% | 162 + 206 + 204 + 160 + 134 + 194 |
| Extended | Lean crossfire | 504 | 105 | 116 | 23% | 54 + 144 + 14 + 86 + 72 + 134 |
| Extended | Spiral crossfire | 456 | 212 | 277 | 61% | 18 + 108 + 102 + 14 + 108 + 106 |
| Extended | Grand spiral | 646 | 230 | 294 | 46% | 18 + 220 + 14 + 14 + 168 + 212 |
| Extended | Commander's spiral | 590 | 136 | 265 | 45% | 88 + 98 + 124 + 96 + 66 + 118 |

Central coverage is the union of 6-tile firing circles around gold positions near the field centre. Commander’s spiral uses its solid 3 x 3 battery; the two imported diagrams retain their 19- and 21-cell batteries. Searched layouts use up to ten positions. It counts route steps, not cumulative damage. The central search rewards repeat exposure near the middle; the lean option prioritizes route length per foundation. Every final count is independently verified with GridManager.findRoute. Blueprint previews never place units or reveal hidden recruits.

## Shipped fixed catalog

The live planner uses a frozen catalog, independent of later offline search runs. Selecting never starts a new search. Only progress and conflict warnings change during construction.

| Variant | Steps | Cells | Core steps |
|---|---:|---:|---:|
| Commander's spiral | 590 | 136 | 265 |
| Longest found | 1132 | 250 | 386 |
| Central stronghold | 1044 | 168 | 681 |
| Lean crossfire | 506 | 105 | 118 |
| Spiral crossfire | 456 | 212 | 277 |
| Grand spiral | 646 | 230 | 294 |
| Diamond spiral | 718 | 128 | 479 |
| Chevron bastion | 504 | 153 | 108 |

The two reference diagrams are additional choices; previous layouts keep their geometry and route counts. All central gold cells are occupied foundations included in the cell budget.

Diamond spiral preserves the first diagram's 105 red cells and 19 blue central cells. The reference grid is 36 × 36. Inserting a row before reference z=7 and a column before x=27 aligns all numbered checkpoints with the game's 37 × 37 board. Four connector cells, (28,7), (27,8), (27,20), and (33,7), keep the stretched walls connected. Its six legs measure 130 + 142 + 118 + 88 + 98 + 142 steps.

Chevron bastion follows both black and orange wall strokes in the second diagram and preserves the outlined 21-cell battery. The gray corner areas are background. One opening at (19,4), immediately east of checkpoint 4, makes every ordered checkpoint reachable. Its six legs measure 66 + 144 + 116 + 16 + 38 + 124 steps. Both layouts stay below 250 placements and can be constructed one foundation at a time without sealing the route.
