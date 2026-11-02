# Late-wave performance — 0.6.8

The performance patch retains FR-005 revision 2, the score cohort and all combat rules. It shares derived base defender statistics only within a synchronous frame or simulation step. Live support, positions, MVP, control effects, target selection and RNG continue to run normally. The public `towerStats` helper still returns a fresh mutable object.

Compatible skeletal surfaces are merged once per cached V3 template using the existing material batching path. Cloned actors share those immutable buffers while retaining private bones. Named original surfaces remain available for animation and weapon anchors. Geometry, indices, materials, skin weights, bind transforms, motion clips and approved source files are preserved. Resources are retired by their owning asset, never by an individual actor.

On the measured PC, twelve controlled late battles across all three factions and waves 35, 46, 49 and 50 took 18.65 seconds of CPU work before and 4.71 seconds after (3.96× faster). Every ordered damage event, spawn, death, leak, final result and next RNG sample matched the original implementation exactly. These are injected armies, not legal acquisition or full-campaign claims.

In the same loaded Chromium scene with 19 Dwarf defenders and 128 foundations, median frame time fell from 61.1 ms to 28.8 ms and p95 from 63.3 ms to 30.7 ms. Draw submissions fell from 18,453 to 4,931 (73% fewer); geometry buffers fell from 4,762 to 1,127. This paired sample is wave 46 before combat, with the same camera and empty load queues.

Validation includes 2,063 passing tests, a production build, exact native surface and six-pose checks for all 258 V3 profiles (1,548 poses), private-skeleton/shared-buffer disposal checks and a completed real browser wave at 5× without console errors or a lost graphics context. Passive Sky Hunt remains visible in batched enemy markers when its defender's attacks are paused.

Limits: no physical iPad is attached, so Safari speed is not certified. These are scene-specific measurements, not a universal 60 FPS promise. A separate unpaired active 5× sample containing seven living enemies and 23 corpses still measured 72.3 ms median; heavy enemy rendering remains a cost.

[Measurements and exact-match proof](../output/implementation/late-wave-current/performance.json) · [Native model proof](../output/implementation/late-wave-current/native-batching.json) · [Current publication receipt](../output/releases/v0.6.8/release.json)
