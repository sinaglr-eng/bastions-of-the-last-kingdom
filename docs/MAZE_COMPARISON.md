# Fixed central-fire blueprints

The library contains the three requested reference layouts and three curated central-fire variants. The earlier automatic suggestions have been removed. Custom saved blueprints remain available. Existing geometry in Commander's spiral, Diamond spiral and Chevron bastion is unchanged, including Chevron's 153 cells. Each new curated plan occupies at most 150 cells.

| Layout | Cells | Route steps | Steps in core fire | Core coverage | Continuous firing passes | Seconds in range at 2 cells/s | Combined position-seconds |
|---|---:|---:|---:|---:|---:|---:|---:|
| Commander's spiral | 136 | 590 | 265 | 44.9% | 7 | 132.5 | 908.5 |
| Diamond spiral | 128 | 718 | 479 | 66.7% | 6 | 239.5 | 2921.5 |
| Chevron bastion | 153 | 504 | 108 | 21.4% | 4 | 54 | 729.5 |
| Compact crossfire | 134 | 772 | 535 | 69.3% | 8 | 267.5 | 1443 |
| Core gauntlet | 143 | 820 | 594 | 72.4% | 8 | 297 | 1516 |
| Crown crossfire | 148 | 864 | 616 | 71.3% | 14 | 308 | 1549 |

Core fire is the union of six-cell circles around the plan's gold firing positions. A firing pass is a continuous in-range run on the full ordered route; leaving and returning starts another pass. Route visits, including repeated steps through the same tile, count separately. Seconds use a comparison speed of two cells per second without slows. Combined position-seconds sum exposure to every gold position; they represent simultaneous firing opportunities, not a combat damage prediction. Defenders have different ranges, damage, targeting and effects, so actual battle time and damage vary.

The new Compact crossfire, Core gauntlet and Crown crossfire plans all revisit central tiles more than three times on average and bring every ordered checkpoint leg through the central battery. They extend the user's diamond topology with different gate and turn arrangements. Compact needs fewer placements; Core increases concentrated exposure; Crown extends total time in central fire.

All six legs are independently measured with gameplay GridManager BFS and its east/south/west/north tie-breaking. Every build prefix is checked for reachability. This is a comparison of bounded search results, without a claim of global optimality. Flying units ignore walls and take their checkpoint route.

Reproduce current metrics with `node tools/benchmark-curated-mazes.mjs`. Fixed presets live in `data/maze-blueprints.json`; the commander geometry is in `game/core/commander-maze.js`. Search was performed offline with a 150-cell maximum, and never moves a selected plan while playing.
