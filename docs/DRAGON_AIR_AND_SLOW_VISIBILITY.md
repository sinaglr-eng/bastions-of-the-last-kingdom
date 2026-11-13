# Baby Fire Dragon targeting and hidden Slow visuals

The current 0.6.12 follow-up allows **Baby Fire Dragon** (`grove/el_baby_fire_dragon`) to aim its existing continuous flame cone at both ground and flying enemies. It keeps 300 Magical damage/s, 3.5-tile reach, a 45° cone, existing Burn, and the current attack cadence and immunity rules. Fire Dragon, Mother Fire Dragon and Ancient Dragon Patriarch retain ground-only primary breath. Their independent Fire Aura behavior is unchanged. Dwarf air targeting remains unchanged.

**Slow remains a gameplay condition, with no automatic battlefield visual.** Timed Slow, Slow Aura and Sky Hunt still affect eligible enemy movement and retain their immunity, boss and strongest-contribution rules. The body helix and automatic enemy Slow clock/halo are not allocated or drawn. Inspection, statistics and selected-source coverage remain available; Haste and Dread clocks and every other condition retain their own presentation.

The supported condition data still has fourteen logical channels. Thirteen have visible forms; eleven visible channels have current defender assignments, while Bleed and Petrify remain reserved. Slow is intentionally hidden, not an unassigned or missing effect.

The canonical English gallery receives current targeting and explicit hidden-visual metadata. Its Baby Fire Dragon view uses the current runtime target flags and Flame Cone text without rewriting the protected original atlas or review records. Original FR009 prompts and earlier verification remain historical design evidence; this current decision supersedes their Baby ground-only and visible Slow instructions.

Verification and the current delivery record are maintained under `output/implementation/dragon-air-and-slow-current/`. Approved artwork, models, recordings and player records are preserved. Publication updates the existing public game; the gallery remains local only.

## Verification

All **2,244 tests** pass. An independent comparison of all 258 resolved profiles finds only Baby Fire Dragon's five authorized targeting/text fields changed; all numeric parameters, Burn and the other 257 profiles remain exact. Thirty-five independent behavior checks cover ground, air, mixed targets, immunity, other dragon/Dwarf cones, live Slow movement and inspection without automatic visuals.

Actual-game native-browser checks confirm Baby Fire Dragon damages an airborne Bat Scout with its existing 300 DPS cone and separate Burn, and that the flame reaches the flying body's height. Separate Slow checks confirm 50% movement reduction without a body effect or automatic marker, with Burn/Poison still visible and pause/expiry working. Ordinary compiled-game checks cover all three factions and a 390-pixel mobile view. Browser checks use private contexts and block external writes.
