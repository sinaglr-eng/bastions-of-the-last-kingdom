# FR-011 revision 4 — Current artifact rules

The current game is **0.8.2**. New defenses use combat effects **fr011-v4**, catalog revision **5**, with **106 artifacts and 17 sets**. All 92 prior artifact IDs, ownership, Dust, chest receipts, pity progress, XP, medals and scores remain valid. No database reset or schema migration is part of this release.

## Set structure

| Set rarity | Required pieces | Sets |
| --- | ---: | --- |
| Common | 2 | Militia Oath; Watchman’s Vigil; Quicksilver Drill; Farwatch; Hearthwarden |
| Uncommon | 4 | Scout’s Trail; Steward’s Kit; Battle Cadence; Crimson Covenant |
| Rare | 6 | Winter Court; Venom Covenant; Royal Architect |
| Epic | 8 | Iron Legion; Stormwing Vanguard; Ashen Dragon |
| Legendary | 10 | Celestial Ascendancy; Necromancer’s Dominion |

Set rarity and individual-item rarity are separate properties. The fourteen new items are QD-01/02, FW-01/02, HW-01/02, BC-01–04 and CC-01–04. Set thresholds remain cumulative. Existing saved v1/v2/v3 defenses retain their original pieces, modifiers, completion rules and caps.

## Complete-set effects

| Set | Complete effects, before additional equipment in empty slots |
| --- | --- |
| Iron Legion | +40% own damage; +15% damage against bosses |
| Stormwing Vanguard | +31% attack speed; +1.5 attack range tiles; 8% matching-immunity damage passage |
| Winter Court | +3 attack range tiles; +5% damage against slowed/frozen targets; 12% Slow for 2s; 10% Freeze chance for 0.8s |
| Venom Covenant | +2% own damage; +7% damage against poisoned targets; 20% artifact Poison budget over 3s; 40% less healing while any allowed Poison is active |
| Ashen Dragon | +2% own damage; +10% damage against burning targets; +1.5 attack range tiles; 20% artifact Burn budget over 2s; Ember Transfer |
| Royal Architect | +600 starting gold; +6 starting CP; +8 starting/current/max keep health; 10% matching-immunity damage passage; one useful boss-death heal of up to 6 health |
| Celestial Ascendancy | +50% own damage; +35% attack speed; +2.5 attack range tiles |
| Necromancer’s Dominion | 30% damage through Physical/Magical immunity; 25% Slow for 2s; 20 armor reduction for 2s |
| Militia Oath | +5% own damage |
| Scout’s Trail | +5% attack speed; +1.25 attack range tiles |
| Steward’s Kit | +400 starting gold; +4 starting CP; +2 starting/max keep health |
| Watchman’s Vigil | +2 starting/max keep health; 5% matching-immunity damage passage |
| Quicksilver Drill | +8% attack speed |
| Farwatch | +1 attack range tile |
| Hearthwarden | +100 starting gold; +2 starting/max keep health |
| Battle Cadence | +15% attack speed |
| Crimson Covenant | +3% own damage; +4 starting/max keep health; restore 1 missing keep health after each successful wave |

## Range and aggregation

All positive artifact-item and cumulative set range is capped at **+3 tiles**, then signed equipment penalties are subtracted. The existing -2 artifact floor and 0.5 final attack-range floor remain. Current own-damage and armor-reduction caps are 50% and 20; historical v3 keeps 45% and 8. Range affects primary targeting and continuous-cone length; independent aura/splash/bounce/transfer footprints and target permissions are unchanged. Commander Extended Range is separate.

Poison and Burn use the strongest equipped base, followed by summed artifact power. Artifact Slow and armor reduction use the strongest base plus cumulative set contributions; set Slow can supply its own base without a hidden dependency on another set name. Native and artifact Slow, armor reduction, healing reduction and immunity passage use the strongest active effect instead of adding their final strengths. Source strengths and expiries remain independent, including across save/restore.

Own-damage, boss-damage and applicable conditional artifact bonuses add inside their damage multiplier. Attack speed affects normal releases, applicable reload/spin-up clocks and continuous primary fire; fixed native aura and ability clocks remain unchanged. Negative tradeoffs remain effective and are shown explicitly.

## Hit effects and conditions

Artifact hit effects require a successful main damaging hit against a surviving eligible target. Secondary splash, chains, secondary multishot/cone victims, passive auras, DOT ticks and Commander strikes do not establish more artifact hit effects. Each qualifying hit contributes its finite post-defense HP-based Poison/Burn budget, then that Magical DOT resolves the target’s defenses. Power does not amplify native Poison/Burn. Original source ownership and Dread reactions remain; no repeated damage multiplier or enemy-max-HP basis is introduced.

Blightweave Armor works while either native or artifact Poison is active, respecting Poison/heal-block permissions. Stronger native antiheal takes precedence. Mirror of Winter checks actual allowed Slow from statuses, Slow Aura, Sky Hunt or War Horn, or active Freeze; Root/Stun/Petrify alone do not qualify.

Artifact Freeze retains one attempt per source/target/second and a shared six-second successful target cooldown. Boss duration is halved. Artifact Freeze does not create native control recovery, overwrite stronger native control or prevent a later longer native Freeze. Native recovery protections remain.

Ember Transfer divides only unspent artifact Burn among up to three eligible visible targets within 1.5 tiles. Transfer does not multiply the budget or recursively cause another transfer. Royal Architect preserves its heal while the keep is full, spends it on the first useful boss death, and never exceeds max health. Final-boss escape still removes every remaining life.

## Saved games and server authority

The current client declares artifact capability 4. Cached capability-3/2/1 clients start explicit fr011-v3/v2/v1 defenses. Minimal versioned effect maps and behavior branches preserve saved rules and cumulative thresholds; they are replay dependencies, not maintained previous game releases. Cached clients cannot start a defense with unknown new artifacts and receive a reload message without abandoning their active game.

Equipment is frozen at the start. Loading, saving and wave transitions cannot repay starting resources or heal charges. Crimson Covenant heals one missing health, capped at the existing maximum, after each successful wave, including survived nonfatal leaks. It never heals a lost run, increases maximum health, stores unused healing or pays twice for the same wave. Both the authenticated Worker and browser run the same core rules. Server-derived rewards and chest/crafting revision checks stay authoritative; no production account data is modified by verification.

## Presentation and verification

Commander shows all five set rarity filters, variable completion counts, item/set/penalty/final contributions, caps, inactive powers and conditional effects. Every set has a distinct chronicle and plain-language complete-set explanation. Poison/Burn power stays visible in aggregate summaries; the final HP-based DOT budget already includes that power and resolves Magical defenses again. Active defender inspection shows actual own-damage/range and native attack-cycle effects, including artifact-disabled Developer Mode. The local English gallery contains all current items and exact original artwork identities. New generated assets have agent review; separate human appearance approval is not implied.

Manual Claim All snapshots eligible rewards across factions and calls existing authoritative individual claims sequentially; repeat clicks share one in-flight action. Relic Dust opens a searchable crafting dialog that uses the existing confirmed crafting mutation, tier/ownership/price checks and revision protection. Medals open Commander Skills. Neither navigation action spends currency.

Functional, API, saved-run compatibility and independent inspection tests accompany the implementation. Diamond Spiral simulations use native combat and progressive legal campaigns across all three factions; prepared-army, paired-version and campaign phases are recorded separately under output/implementation/commander-feedback-current/simulations. Earlier analysis reports are unchanged.
