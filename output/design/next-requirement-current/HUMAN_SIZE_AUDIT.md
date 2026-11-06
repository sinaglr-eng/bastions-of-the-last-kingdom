# Current Human defender size audit

Read-only measurements for the proposed implementation requirement, 6 November 2026. No game, gallery, model, prompt or approval record was changed.

All 86 current approved V3 Human profiles were decoded from their exact packed GLBs and checked against approved packed and decoded SHA-256 values. The actual Idle clip was sampled at time zero. Measured skinned-mesh bounds include the current classification multiplier, family presentation multiplier and common battlefield factor 0.704. The anatomical proxy excludes held weapons, shields, magic effects and appendages, while retaining clothing and headwear. Full silhouette bounds are recorded separately. This proxy requires manual review before coefficients are selected.

| Classification | Profiles | Minimum body height | Median body height | Maximum body height |
| --- | ---: | ---: | ---: | ---: |
| Draft basic ranks I–VI | 48 | 1.1264 | 1.1940 | 1.3245 |
| Basic champion | 5 | 0.7308 | 0.7913 | 3.2060 |
| Intermediate | 13 | 0.6020 | 1.3099 | 1.7388 |
| Advanced | 11 | 0.8229 | 1.1415 | 1.8829 |
| TOP | 8 | 1.0880 | 1.6132 | 2.0915 |
| Shared Secret Lady Claire | 1 | 1.0513 | 1.0513 | 1.0513 |

The current code uses the same class factor of 1 for draft basics and Basic champions. Higher champion classes use 1.1, 1.21, 1.331 and 1.4641 for Secret. These factors multiply unequal native models, so they do not enforce increasing visible size.

The legacy presentation overrides for `embercrown`, `worldfire`, `thunderheart` and `phoenix` still apply 2.3, 1.25, 1.2 and 1.15 respectively. Their current V3 Human appearances are Cinder Adept, Inferno Magister, Stormfire Sorcerer and Grand Pyromancer. For example, the Cinder Adept source is a humanoid with a red coat and brazier, although the scaling code still describes this family as a Baby Fire Dragon.

Concrete discrepancies include:

- Basic Cinder Adept body height 3.2060 is 4.39 times Basic Frostsword Watchmen at 0.7308.
- Cinder Adept becomes smaller on its Intermediate upgrade: Inferno Magister measures 1.7388.
- Draft Archer VI body height 1.3245 exceeds TOP Mother Nature at 1.0880 and TOP Archbishop at 1.0917.
- Shared Secret Lady Claire measures 1.0513, below the current draft-basic minimum. She is a shared cross-faction identity and should be listed separately from a Human-only normalization scope.

## Working normalization targets

For humanoids, a defensible working reference is the largest correctly approved draft body, currently `H = 1.324534`. Keeping draft-rank growth intact, use Basic champion 1.10H = 1.4570, Intermediate 1.21H = 1.6027, Advanced 1.331H = 1.7630 and TOP 1.4641H = 1.9393. A proposed ±2% body-height tolerance leaves strict gaps between adjacent classifications. These are review targets derived from the semantic proxy, not approved final coefficients.

Apply a uniform XYZ presentation factor to private runtime actors. Preserve source geometry, proportions, authored appearance, animation timing, attachments and original model bytes. Verify the same factor through idle and attack animations, after cloning and repeated sync, and in previews using the same camera scale. Tall weapons, magical effects and wings must not determine humanoid body normalization.

Artillery and constructs require explicit apparent-size and footprint review. Ballista is a low engine measuring W 0.9765 × H 0.6020 × D 1.1964 in current battlefield space. Forcing its height to 1.6027 with a uniform factor would create W 2.60 × D 3.19, an excessive footprint. Its class presence should be assessed from the chassis mass and a shared camera, rather than by applying a humanoid standing-height target. Cannon, Royal Battery and Golem likewise need recorded form-specific review. Never compensate by stretching the vertical axis or rescaling a weapon independently.

Keep shared Secret Lady Claire unchanged in every faction for this Human-only requirement. Any later Secret-size adjustment must be specified consistently across all three factions. Ordinary Human normalization covers the remaining 85 profiles.

Before implementation, review a contact sheet of every Human defender under one camera and tile reference. Confirm correct body/chassis reference bounds, set any explicit form exceptions, then record each final presentation factor with its classification and approved reference identity. Existing portrait crops do not measure battlefield size.

Sources: [all measurements](human-size-audit.json), [comparison CSV](human-size-audit.csv), and [reproducible read-only audit](audit-human-scale.mjs). Runtime authority is `game/render/defender-classification-scale.js`, `game/render/champion-classification.js`, `game/render/battlefield-scale.js`, and the approved current V3 manifest `public/assets/factions/v060/manifest.json`.
