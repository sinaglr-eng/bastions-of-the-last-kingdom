# Current battlefield defender sizing

Current game **0.6.11**, presentation revision **defender-size-feedback-20261106**. This visual adjustment follows the user's review of the running game on 6 November 2026. The sizing adjustment itself changes no combat rules. Release 0.6.11 separately includes FR-007 revision 3 and uses its own score cohort.

All **258 approved V3 defender profiles** use an additional uniform **0.8** battlefield multiplier, making them at least 20% smaller than the preceding local presentation. This includes draft ranks, champions, all three factions and shared Lady Claire. It does not affect enemies, walls, combat ranges, grid occupancy or UI portraits.

All **21 Basic-class champions** are limited to the ordinary draft size reference of their own faction. The reference is the median body height across its 48 draft profiles, before the common 20% reduction. Human Basic champions now begin at that ordinary reference rather than above the tallest draft rank. The Human Intermediate, Advanced and TOP references keep the established 10% steps. Smaller authored figures keep their relative size; broad constructs and low spider/dragon silhouettes use explicit footprint rules instead of being stretched into humanoid height.

| Faction | Draft reference before reduction | Draft reference on the battlefield |
| --- | ---: | ---: |
| Human | 1.1940 tiles | 0.9552 tiles |
| Dwarves | 1.2821 tiles | 1.0257 tiles |
| Elves | 1.3418 tiles | 1.0735 tiles |

Every change is uniform in X, Y and Z on a private runtime actor. The original body, head, mount, equipment and weapon proportions remain exact, as do authored Idle/Attack animations, grip ownership and ground contact. Source GLBs, approved images, original prompts and review records are unchanged. The existing Baby Fire Dragon / Fire Dragon relationship is preserved, with both receiving the common reduction.

The canonical gallery's model viewer reports native bounds and frames each selected model independently. Its portrait sizes therefore do not define cross-character battlefield height. The preserved historical classification policy specifies 10% class factors relative to each authored model, rather than a universal anatomical ratio. Current gallery metadata documents the battlefield reduction separately from original model dimensions and appearance approval. The gallery remains local only and in English.

The current scale map is `data/defender-presentation-v3.json`, bound to exact approved model hashes. It replaces the former Human-only runtime map. The global factor applies only to real V3 defender actors, so a consumed defender's wall, an enemy or a loading dial cannot accidentally inherit it. Repeated synchronization is idempotent.

Verification records in `output/implementation/defender-size-current/` include exact measurements before the adjustment, native checks for all 258 models at Idle and three Attack phases, uniform dimension and ground-contact comparisons, and fixed-camera visual review. Required baseline measurements are regression data, not an older playable release. The user's in-progress local match is left running; the updated presentation applies on the next page load.
