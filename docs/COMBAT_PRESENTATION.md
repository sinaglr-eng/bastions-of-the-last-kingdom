# Weapon effects, persistent conditions and attack sounds

This cosmetic revision of **0.6.12** covers all **258 current native V3 faction/rank profiles**. Combat values, targeting, projectile travel, attack schedules, random decisions, recipes, the FR-008 ruleset and approved model files remain unchanged.

## Attacks

The active native weapon and authored motion choose the projectile or contact shape; damage class and element choose its accents. Bows fire arrows, guns fire bullets, artillery fires its appropriate ammunition, and melee weapons retain their actual strikes. Older inactive geometric-model metadata cannot override the current native weapon. Human Soldier uses its current spear at all six ranks.

Lightning has a bright volumetric white core, a wider cyan corona, local forks and one short release pulse. A bounded screen-size floor keeps it readable at overview zoom. Arrows and rifle tracers also retain visible thickness without changing their length or motion. Colored spell cores retain their element rather than clipping to white. Busy-wave instancing preserves each weapon's shape instead of converting it to a generic line.

## Persistent enemy conditions

Body effects follow the real native enemy envelope. Fire surrounds the silhouette with layered flames and embers; poison uses green clouds and bubbles; Slow uses a cyan helix. Freeze has an ice shell, Stun has overhead stars, and Root has binding vines. Petrification, armor reduction, bleeding, healing denial, regeneration reduction, both immunity-weakening channels and Fire Aura heat have separate shapes.

The renderer reads actual timed conditions and live aura coverage. Effects remain while those conditions apply and disappear on expiry, lost coverage, removal, death or concealment. Pausing preserves their simulation time. Reduced motion keeps a clear static form. Healing and electrical hit pulses remain separate transient feedback. Geometry, draw budgets and disposal are bounded; model materials are not modified.

## Recorded sounds

The [current attack bank](../public/assets/audio/combat-effects-current/catalogue.json) contains **30 attack recordings**: 15 preserved recordings and 15 new ElevenLabs Sound Effects recordings. All 136 character families have explicit current weapon bindings, covering all 258 faction/rank combinations. The six approved music tracks and all 272 character voice recordings remain exact.

New effects cover electrical arcs, Stormspear strikes, musket and Gatling rounds, mortar launches, cannon shots, grenade throws and explosive impacts, axes, pickaxes, war drums, tree slams, spider spit, claws and fire bursts. Artillery explosions play on impact. Fire Aura feedback requires actual positive visible damage in the current source's real radius/channel and is throttled; ordinary status frames do not create a sound storm.

The new recordings use model `eleven_text_to_sound_v2`. Four original takes per effect are retained locally. All 60 were decoded in native Edge and measured for onset, level and clipping; one original take per effect was selected. Per-clip playback gain balances those originals without editing their MP3 bytes, including the quiet war drum. These technical checks do not certify timbre by human listening.

Mute, the Sounds volume control, pause, stale-download cancellation, fixed playback speed and concurrency limits apply to the new recordings. Legacy recording constants and receipts remain separate from the current 30-effect review contract.

## Verification

Independent scheduled combat comparisons cover every profile with and without VFX, checking ordered events, HP and projectile timing. Native shaded captures cover close/overview weapons, forced overflow, all 14 condition channels, expiry, motion, pause and reduced motion. Actual-game browser checks exercise current attack recordings and the full 308-clip diagnostic review; real battlefield status checks verify fire, poison and Slow around native bodies and health bars.

Current implementation and verification evidence is maintained locally under `output/implementation/combat-effects-current/`. Public deployment identity is recorded in [the current release receipt](../output/implementation/release-current/deployment.json). The canonical design gallery remains local only.
