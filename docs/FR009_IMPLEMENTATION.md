# FR009 Attack and persistent effect implementation

Implementation and public deployment were authorized on 13 November 2026 after the effect art-direction requirement was prepared. The complete brief and per-profile prompts remain in the local design package. This is a cosmetic update to the maintained **0.6.12** release; the FR-008 combat rules and score version stay unchanged.

**Current follow-up:** [All four dragons' air targeting and hidden Slow visuals](DRAGON_AIR_AND_SLOW_VISIBILITY.md) supersede the original ground-only dragon and visible Slow directions below. Earlier FR009 comparison counts describe the original revision; current follow-up checks and deployment are recorded separately.

## Implemented effects

All 27 current primary kinds retain their actual native weapon and emission point. Arrows, heavy bolts, bullets, cannonballs, mortar shells, bombs and unfused Catapult stones have distinct material silhouettes. Sword, axe, pick, spear, hammer, fist, claw, branch and drum contacts follow their existing gesture and actual attack phase. Rune, nature, frost, lunar, Holy and Arcane casts remain distinct; Lady Claire retains her shared Secret gold identity.

Continuous fire uses procedural layered material, a hot inner stream, broken outer tongues and sparse cooling embers. Heavy Flamethrower's two streams originate at its existing nozzles. Dwarf cones retain Physical ground-and-air delivery; dragon cones retain Magical ground-only delivery and separate Fire Aura. Cinder Adept and Inferno Magister remain aura-only, with no directed projectile. Electricity retains a bright local white core, cyan corona and short forks without a screen-wide flash.

Ricochet follows the original ammunition or blunt contact identity. Fire Splash uses the actual successful proc, current source radius and emitted victims. A primary enemy killed by the arrow does not suppress the eruption or feedback on surviving victims. Known-impact geometry does not follow a corpse. Concealed, removed and ineligible victims do not retain markers. A bounded typed fallback preserves the event when detailed-effect capacity is exhausted.

Persistent effects follow the actual native body and flying height. Burn uses layered body flames; live Fire Aura uses a low exposure accent, with independent lifetimes. Poison has soft darker volumes and lime bubble rims that remain visible on green enemies. Slow uses an open wind helix, Freeze a partial faceted shell, Stun overhead stars and Root woody bindings. Armor loss, immunity transmission and both healing-denial channels remain distinct. Concurrent healing symbols occupy separate slots. Bleed and Petrify are reserved renderer forms with no new defender assignments.

Pause and reduced motion use the authoritative simulation clock. Expiry, aura loss, concealment, death and removal clear the appropriate effects. Owned materials and geometry are disposed without changing approved model surfaces. Dense status rendering retains the existing shared limit of 256 instances and simplifies decoration before target identity.

## Verification

- **2,227 tests passed**, with no failures. Historical audit fixtures now positively assert that aura-only units have no synthetic projectile; model-surface, byte, normal, motion and ordinary projectile checks remain intact. The impact-clock test checks actual elapsed life and pause rather than an obsolete cosmetic duration.
- **1,032 scheduled renderer cases across all 258 profiles** match the no-VFX baseline exactly for ordered events, every-step HP/status/projectile/resource state, seeded RNG, resolved stats, original weapons and primary kinds. Cases cover ground, air, mixed defenses, reduced motion and forced overflow. All 27 primary kinds and twelve currently assigned body channels occur; two reserved channels use explicit fixtures.
- Native visual review covers **63 weapon/element/delivery variations** at close and overview views, all fourteen condition forms, typed overflow, pause, motion, expiry and reduced motion. Actual-game Burn, Poison and Slow checks use real timers and native enemy bodies. Shader linkage, bounded dense instancing, stable resources and disposal are checked separately.
- Ordinary compiled-production browser checks use legal five-recruit placement, keeper selection, real damage and pause/resume for all three factions and a 390-pixel mobile view. They use private contexts without runtime injection; telemetry writes are blocked before dispatch.
- The preservation audit keeps **2,583 core/data/public-asset/audio-binding files**, **1,083 protected gallery assets and records**, and the statistics clients exact. The current 30 weapon recordings, six music tracks and 272 voice clips are unchanged. No new artwork, models, recordings, combat rules or score version are introduced.

Current detailed verification is maintained locally under `output/implementation/fr009-current/`. These bounded checks establish presentation correctness and combat equivalence; they do not establish full-campaign balance or full-game frame rates on every device.

## Delivery

The maintained release remains **0.6.12**, with attack revision `fr009-weapon-materials-and-secondary-events-20261113` and status revision `fr009-layered-body-status-20261113`. The [current release receipt](../output/implementation/release-current/deployment.json) records the exact publicly verified source commit and deployment checks for the [public game](https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/).

The single canonical English gallery remains local only. Its current attack metadata describes the implemented effects, including weapon-consistent Ricochet and dedicated Fire Splash; its eight protected source datasets, original art, prompts and approval records remain unchanged. The complete FR009 requirement and per-profile production prompts remain local. Publication uses only the reviewed game, tests, audit helpers and implementation documentation, without uploading gallery files or new model/audio binaries.
