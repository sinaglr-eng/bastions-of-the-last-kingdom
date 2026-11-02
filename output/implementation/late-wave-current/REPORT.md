# Late-wave performance patch

Version remains 0.6.8; ruleset remains FR-005 revision 2. No new score cohort, art revision, backup or gallery publication is created.

- Share derived base stats within one synchronous simulation/render pass. Live modifiers and random decisions remain live.
- Batch compatible V3 skeletal surfaces once per decoded template, retaining exact geometry/materials and private actor skeletons.
- Skip neighbor-list allocation for units without formation abilities.
- Preserve passive Sky Hunt enemy markers when unit attacks are paused.

[Method, results and practical limits](../../../docs/LATE_WAVE_PERFORMANCE.md). Raw paired CPU and browser records, all-profile native checks, source hashes and the complete validation log are stored beside this report. The paired browser images show the same loaded ready scene before and after; they are not active-combat performance claims.
