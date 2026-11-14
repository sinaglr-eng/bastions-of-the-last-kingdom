# Current release

## 0.7.0 — FR-010 progression and Endless — 14 November 2026

- Added the main menu, Guest play, optional verified accounts, password recovery and exact local/cloud continuation.
- Added once-only achievement medals, consecutive flawless-wave milestones and the seven General skills with three equipment slots, 5/10/20-medal upgrades and refunds.
- Unified basic defender codes A–H and ranks I–VI across all factions; preserved approved combat profiles and artwork.
- Continued the campaign beyond wave 50 with deterministic mixed waves, +8% compounded HP and +0.5 armor per wave, periodic bosses and exact integer scores.
- Added validated command replay, atomic wallet transactions and offline synchronization. Guest and Developer test runs do not write account scores.
- Published 0.7.0 with a same-origin account backend. Added a responsive login dialog matching the supplied reference, Google/Apple/Facebook connection support and email registration/recovery. Configured real Google credentials on the hosted server; the operator confirmed its first successful real browser sign-in. Apple is deferred, and Facebook/email await configuration. Unavailable methods are explicitly disabled.
- Replaced the basic menu with a responsive war table, bundled Cinzel display font, an integrated faction picker, Guest-locked progression, top-bar account actions and a styled replacement dialog. Removed the main Settings entry, version suffix and footer slogan; player account controls remain accessible through the signed-in nickname.

## 0.6.12 — FR009 combat effect art direction — 13 November 2026

- Allows all four Elf dragons' existing flame cones to hit ground and flying targets, preserving DPS, cone angles, reach, Burn, Fire Aura and Spark.
- Hides automatic Slow body and enemy clock/halo effects across all factions while preserving actual movement slowing, inspection and selected coverage. [Current follow-up](docs/DRAGON_AIR_AND_SLOW_VISIBILITY.md).
- Refines all 258 native defender/rank attack effects with weapon-shaped ammunition and contacts, material detail, layered continuous fire and bright local electrical discharge.
- Gives Ricochet its originating weapon's appearance and actual Fire Splash procs a dedicated fire eruption.
- Uses procedural body flames and Poison volumes, open Slow wind, partial ice, woody bindings and distinct concurrent condition markers for all fourteen supported channels.
- Retains the current 30 weapon recordings, six music tracks and 272 character voice clips. Combat, score rules, approved models and artwork stay unchanged. [Implementation and verification](docs/FR009_IMPLEMENTATION.md).

## 0.6.9 — Dwarf ground-and-air primary attacks — 2 November 2026

- All Dwarf defenders can attack flying enemies, including 35 formerly ground-only profiles and four continuous Flame Cone weapons.
- Preserves primary damage, DPS, timing, range, recipes, canonical abilities, other factions and approved media. Separate Heat pulses retain their ground-only scope.
- Updates the single English local gallery and keeps 0.6.8 score identities separate. Published and verified as the current public game, with its statistics service updated on the same database. [Details](docs/DWARF_AIR_TARGETING.md).

## 0.6.8 — FR-005 revision 2 — 2 November 2026

- Optimizes repeated base-stat work and batches compatible V3 skeletal surfaces without changing combat or approved models. Controlled CPU work is 3.96× faster; the measured loaded scene renders in 28.8 ms instead of 61.1 ms. Passes 2,063 tests. [Measurements and limits](docs/LATE_WAVE_PERFORMANCE.md).
- Adds the continuous flying-only Sky Hunt Slow aura at 25/50/75% within 3/4/5 tiles, independently of attack contact and without lingering or extra detection.
- Gives the five Dwarf machine champions classified Multishot and Ricochet, Heavy Sniper canonical Execution I, and Siege Cannon Freeze I.
- Replaces Golem Stone Gaze with Stun I while retaining Freeze I; increases shared Splash reach; removes exactly 21 selected Visibility assignments.
- Revises one Boar Lancer ingredient while preserving all primary DPS, attack timing, targeting, other recipes, approved models, art and player records.
- Passes 2,042 tests, 72 matched legal no-TOP campaigns and 234 controlled late battles. No legal 50-wave win is certified by the tested policies.
- Published and verified as the default public game. The existing statistics service accepts 0.6.8 on the same database, with separate version/faction standings. The single English gallery remains local only. No backup package or release tag is created.

[Implementation and limits](docs/FR005_IMPLEMENTATION.md) · [Publication receipt](output/releases/v0.6.8/release.json).
