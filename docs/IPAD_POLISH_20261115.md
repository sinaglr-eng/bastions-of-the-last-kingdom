# iPad interface polish — 0.7.0

Current UI revision: `ipad-polish-20261115`.

- Achievement claims are available only in the Achievements collection. Gameplay displays a dismissible 4.5-second unlocked notification; pending and verified events share one notification identity. Claiming still uses the authenticated, idempotent server transaction.
- TOP champion discoveries award 3 medals. The server canonicalizes unclaimed legacy eligibility to the current catalog reward. Existing claimed rewards remain their exact historical amount. No account, run, score, XP, equipment or progression reset is part of this update.
- Every Commander catalog tile and field skill includes a rank-specific summary. Recruitment Focus options retain command codes A–H and show the current faction's defender names.
- Achievement categories use collection/crown/warlord/banner icons; the decorative sidebar landscape is removed. Goal frames grow with text, and achievement filters retain native keyboard/touch selection inside a brass control.
- Eight new transparent 256px WebP assets support mystery recruits, the wall inspector and enemy atlas statistics. Their manifest records source hashes and alpha verification. Exact generation prompts and originals remain in the local `artifacts/ipad-polish/` directory.
- Body-attached combat status effects and transient heal/impact pulses share fixed world-space dimensions. Their attachment anchors continue to follow the target. Enemy stats, hitboxes, ability timers, native shields, damage, RNG and the hidden Slow policy are unchanged.
- The first-MVP popup is removed; MVP awards and explicit help remain available.

Validation: 2,418 tests passed. Real Worker tests cover stale TOP eligibility, exactly-once claims and preservation of historical payouts. Renderer tests compare every status and transient pulse at 1× and 5× target scale and different camera distances. UI tests preserve hidden recruit privacy and RNG. Browser QA uses 1376×1032 and 1032×1376 viewports for Home, Hall of Fame, Achievements, Commander, build/combat, field skills, wall inspection and both books. This is viewport validation in the desktop browser, not a physical iPad/Safari test. Gallery and 3D model binaries remain local.
