# Forged Alliances TD 0.6.8

The current performance patch preserves this ruleset and score cohort. Controlled late-battle CPU work is 3.96× faster, and a loaded 19-defender scene improves from 61.1 ms to 28.8 ms median frame time. It passes 2,063 tests and exact native batching checks for all 258 profiles. [Method and limits](LATE_WAVE_PERFORMANCE.md).

FR-005 revision 2 is implemented locally: Sky Hunt flying-only Slow aura, classified machine Multishot and Ricochet, Heavy Sniper Execution I, Siege Cannon Freeze I, Golem Stun I, shared Splash radii, 21 exact Visibility removals and the revised Boar Lancer recipe. All primary damage, sustained single-target DPS, timing, target modes, approved art, models and player records are preserved.

Validation: 2,042 tests, a 233-module build, all 258 native model profiles, 72 matched legal no-TOP campaigns and 234 equal-material controlled late battles. Actual local Chromium testing confirmed the new ability text, source-attributed attack speed, paused Sky Hunt projection and a 5x wave without a graphics error. No iPad-specific result or legal 50-wave win is certified.

Version 0.6.8 is now the default public game at https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/. The existing public statistics service uses the same D1 binding, preserving player records and separate version/faction cohorts without migrations. GitHub passed all 2042 tests, the production build, upload and deployment. Public metadata and compiled entries match the exact runtime commit; immutable media proof is reused only by exact content or decoded-model hash. [Publication receipt](../output/releases/v0.6.8/release.json) · [CI](https://github.com/sinaglr-eng/bastions-of-the-last-kingdom/actions/runs/41453941546).

[Implementation and detailed limits](FR005_IMPLEMENTATION.md). [Current retention policy](RELEASE_RETENTION.md).
