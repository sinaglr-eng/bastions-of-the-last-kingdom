# Dragon air targeting and hidden Slow visuals

All four current Elf dragons can aim their existing continuous flame cones at both ground and flying enemies: **Baby Fire Dragon**, **Fire Dragon**, **Mother Fire Dragon** and **Ancient Dragon Patriarch**. Damage, reach, cone angles, Burn, attack cadence and immunity rules remain unchanged. Fire Aura and Spark remain independent abilities with their existing values. Dwarf air targeting remains unchanged.

Ancient Dragon Patriarch's existing Spark shares its eligible target list, so it can also select a flyer after this targeting change. Its 4,000 Magical damage, 5-second interval and one-target limit remain unchanged. Primary-cone verification measures cone packets separately from Fire Aura and Spark.

**Slow remains a gameplay condition, with no automatic battlefield visual.** Timed Slow, Slow Aura and Sky Hunt still affect eligible enemy movement and retain their immunity, boss and strongest-contribution rules. The body helix and automatic enemy Slow clock/halo are not allocated or drawn. Inspection, statistics and selected-source coverage remain available; Haste and Dread clocks and every other condition retain their own presentation.

The supported condition data still has fourteen logical channels. Thirteen have visible forms; eleven visible channels have current defender assignments, while Bleed and Petrify remain reserved. Slow is intentionally hidden, not an unassigned or missing effect.

The canonical English gallery receives current targeting and explicit hidden-visual metadata. All four dragon views use current runtime target flags and Flame Cone text without rewriting the protected original atlas or review records. Original FR009 prompts and earlier verification remain historical design evidence; this current decision supersedes their ground-only dragon and visible Slow instructions.

Verification of the latest three-dragon extension is maintained under `output/implementation/all-dragons-air-current/`. Earlier Baby and hidden-Slow checks remain under `output/implementation/dragon-air-and-slow-current/`. Approved artwork, models, recordings and player records are preserved. Publication updates the existing public game; the gallery remains local only.

## Verification

The current extension compares all 258 resolved profiles with the already published Baby/hidden-Slow baseline. Only the other three dragons' targeting flags and matching ability descriptions change. All numeric parameters and non-cone ability records remain exact. The other 255 profiles, including Baby Fire Dragon, are unchanged. Scheduled combat checks separate direct cone damage from aura/Spark damage and cover air, ground, mixed targets, immunity and unchanged cone boundaries.

The latest full suite passes **2,285 tests**. Independent review passes 69 behavior checks, including 48 four-dragon air/ground/mixed immunity scenarios. Native actual-game browser checks separately verify all three newly enabled dragons damage a real flying Bat Scout with their primary breath, excluding Fire Aura and Spark contributions, with correct airborne endpoints and pause behavior.

Actual-game native-browser checks confirm Baby Fire Dragon damages an airborne Bat Scout with its existing 300 DPS cone and separate Burn, and that the flame reaches the flying body's height. Separate Slow checks confirm 50% movement reduction without a body effect or automatic marker, with Burn/Poison still visible and pause/expiry working. Ordinary compiled-game checks cover all three factions and a 390-pixel mobile view. Browser checks use private contexts and block external writes.
