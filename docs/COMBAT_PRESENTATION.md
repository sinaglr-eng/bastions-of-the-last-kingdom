# Weapon effects, persistent conditions and attack sounds

The FR009 presentation revision of **0.6.12** covers all **258 current native V3 faction/rank profiles**. The [current follow-up](DRAGON_AIR_AND_SLOW_VISIBILITY.md) allows Baby Fire Dragon's existing cone to attack flyers and hides automatic Slow visuals. Other combat values, targeting, projectile travel, attack schedules, recipes and approved model files remain unchanged. The original art-direction prompts are maintained in the local design package; [implementation evidence](FR009_IMPLEMENTATION.md) records the original revision and its current follow-up.

## Attacks

The active native weapon and authored motion choose the projectile or contact shape; damage class and element choose its accents. Bows fire arrows, guns fire bullets, artillery fires its appropriate ammunition, and melee weapons retain their actual strikes. Older inactive geometric-model metadata cannot override the current native weapon. Human Soldier uses its current spear at all six ranks.

Lightning has a bright volumetric white core, a wider cyan corona, local forks and one short release pulse. A bounded screen-size floor keeps it readable at overview zoom. Arrows and rifle tracers also retain visible thickness without changing their length or motion. Colored spell cores retain their element rather than clipping to white. Busy-wave instancing preserves each weapon's shape instead of converting it to a generic line. Material silhouettes distinguish arrows and heavy bolts, solid cannonballs, unfused Catapult stones, mortar shells, bombs and hot metal fragments. Native blade, spear, hammer, fist, claw, wood and percussion contacts retain their authored gestures.

Ricochet uses the originating weapon's visual grammar at its real secondary endpoints. Fire Splash has a dedicated fire eruption only when the actual proc succeeds; it does not create timed Burn. Dwarf fire machines retain Physical ground-and-air cones, including both existing Heavy Flamethrower nozzles. Baby Fire Dragon has a Magical ground-and-air cone; the other three dragons retain ground-only breath and their independent Fire Aura. Cinder Adept and Inferno Magister remain aura-only, without invented targeted projectiles.

## Persistent enemy conditions

Body effects follow the real native enemy envelope. Procedural flames use rising tongues, pale hot centers and cooling edges; Poison uses softly moving translucent green volumes and bubbles. Slow has no automatic body effect or enemy marker; its movement and inspection data remain active. Freeze has partial faceted ice, Stun has overhead stars, and Root has woody bindings. Armor loss, healing denial, regeneration reduction, both immunity-weakening channels and Fire Aura contact heat have separate shapes. Bleed and Petrify remain reserved renderer forms without new defender assignments. Concurrent timed Burn retains its taller flames while live Fire Aura uses a low contact accent. Healing blocked and healing reduced occupy separate overhead slots when both are active.

The renderer reads actual timed conditions and live aura coverage. Effects remain while those conditions apply and disappear on expiry, lost coverage, removal, death or concealment. Pausing preserves their simulation time. Reduced motion keeps a clear static form. Healing and electrical hit pulses remain separate transient feedback. Geometry, draw budgets and disposal are bounded; model materials are not modified.

## Recorded sounds

The [current attack bank](../public/assets/audio/combat-effects-current/catalogue.json) contains **30 attack recordings**: 15 preserved recordings and 15 new ElevenLabs Sound Effects recordings. All 136 character families have explicit current weapon bindings, covering all 258 faction/rank combinations. The six approved music tracks and all 272 character voice recordings remain exact.

New effects cover electrical arcs, Stormspear strikes, musket and Gatling rounds, mortar launches, cannon shots, grenade throws and explosive impacts, axes, pickaxes, war drums, tree slams, spider spit, claws and fire bursts. Artillery explosions play on impact. Fire Aura feedback requires actual positive visible damage in the current source's real radius/channel and is throttled; ordinary status frames do not create a sound storm.

The new recordings use model `eleven_text_to_sound_v2`. Four original takes per effect are retained locally. All 60 were decoded in native Edge and measured for onset, level and clipping; one original take per effect was selected. Per-clip playback gain balances those originals without editing their MP3 bytes, including the quiet war drum. These technical checks do not certify timbre by human listening.

Mute, the Sounds volume control, pause, stale-download cancellation, fixed playback speed and concurrency limits apply to the new recordings. Legacy recording constants and receipts remain separate from the current 30-effect review contract.

## Verification

Independent scheduled combat comparisons cover every profile with and without VFX, checking ordered events, HP and projectile timing. Native shaded captures cover close/overview weapons, forced overflow, all 14 condition channels, expiry, motion, pause and reduced motion. Actual-game browser checks exercise current attack recordings and the full 308-clip diagnostic review; real battlefield status checks verify fire, poison and Slow around native bodies and health bars.

Current FR009 implementation and verification evidence is maintained locally under `output/implementation/fr009-current/`. The preserved audio-selection evidence remains under `output/implementation/combat-effects-current/`. Public deployment identity is recorded in [the current release receipt](../output/implementation/release-current/deployment.json). The canonical design gallery remains local only.
