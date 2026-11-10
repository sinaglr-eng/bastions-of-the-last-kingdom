# FR-008 implementation — 0.6.12

Implemented locally on 6 November 2026 following the user's explicit instruction to implement FR-008. The subsequent 10 November publication includes the complete defender voice bank; actual public deployment identity is recorded in [the current publication receipt](../output/implementation/release-current/deployment.json). The canonical gallery remains local only.

## Sky Hunt and Rune coverage

The implementation uses the multiplicative transmission formula proposed by FR-008: normal Sky Hunt Slow × strongest covering Cancel Physical Immunity Aura transmission. Thus 75% × 65% = 48.75%, or 24.375% on a boss with the existing 0.5 boss modifier. The original draft's formula-clarification flag is preserved as historical evidence; the formula is an explicit implementation assumption, not a fabricated separate approval.

Only Dwarf Sky Hunt receives this exception against Physically immune flyers. Inclusive, independently measured Sky Hunt and Rune areas must both cover the enemy. Rune sources do not add or multiply together. Movement, live state, removal and overlapping sources are evaluated continuously without a lingering status timer. Paused attacks and disarm do not disable these passives. Reserved, ruined and inactive providers do not supply them. Coverage needs no attack, hit, reveal or damage event, and it never reveals a hidden target. Existing legacy timed Physical breach still allows normal full Slow.

Ordinary Slow, Slow Aura, Freeze, Stun and Root keep their existing immunity gates. Slow sources compete by maximum strength before the boss modifier is applied once. Movement speed, overhead effect markers, enemy inspection and control attribution use the same helper.

## Presentation

All 144 basic defender ranks omit the old decorative underfoot RingGeometry. The 114 faction champion/Secret identities retain their classification auras; rank VI retains its separate sprite glow and eight orbiting stars. Selection, range, support indicators, rank labels, model scale, native model bytes and animation channels are unchanged. Existing resource-ownership checks cover repeated rebuild/removal and shared texture/geometry safety.

The Blood-Leech Troll portrait uses the recovered current V6 model-authoring reference from worktree `4a36`, not a newly invented picture or substitute model. Both exact source files have been restored alongside the implementation. The parent image was historically recorded as an inferred variant reference; no new appearance approval is claimed. The cutout excludes the detached FRONT caption and changes alpha only: every retained RGB pixel is independently checked against the original, without resampling. See `output/implementation/fr008-current/portrait-provenance.json`.

The frozen approved native-model manifest remains exact. Current UI delivery overrides the explicit `host_38-wraith` portrait identity in `ui/reference-portraits.js`; native model delivery authority and current presentation references remain distinct. Wave 38's overview names and illustrates both forms. Configured, live/queued, selected and preview models retain the visual identity, and unknown explicit identities never silently borrow the Knifeman portrait.

## Verification

- 2,189 automated tests pass, including 40 dedicated live Sky Hunt tests and the independent pixel/provenance checks.
- Actual scheduled weapons run in all 628 wave-38 cases: 258 profiles against each form, 86 Dwarf profiles with paused Rune Mage, 20 Rune coverage cases and six regeneration controls. Detailed results match the retained 0.6.11 audit exactly.
- Blood-Leech Troll remains a ground enemy with 31,369 HP, 15 armor and 25% maximum HP regeneration per simulation second (7,842.25 HP/s). Positive applied damage, restored healing and net HP loss are recorded separately. These stationary single-attacker cases do not certify a legal campaign victory or rebalance the wave.
- Production build succeeds. Desktop, iPad-size portrait and short landscape browser checks verify both loaded reference images, readable panels and no horizontal overflow or console errors. These are viewport checks on the development PC, not physical Safari-device certification.

Combat numbers, recipes, player records, original artwork/review records and native model files are preserved. The canonical local gallery is outside FR-008's requested change scope and remains untouched.
