# Campaign economy and difficulty

Construction Mastery now has 15 upgrades, costing 6,500 gold in total. With every enemy killed, all wave rewards collected, no theft, and all available gold devoted to mastery, it first reaches the maximum after wave 30. Kingdom-level gates are included in this calculation. The fifth tier remains uncommon; tier VI still requires merging two tier V candidates in the same round. Current-round odds never change after buying mastery.

Downgrade costs 200 gold, lowers a basic current candidate by exactly one tier, and immediately keeps it. The other four become walls. It cannot affect Tier I, retained defenders or champions. Demolition and champion improvements also delay mastery. Keep health cannot be purchased.

Every 50-wave campaign grants 250 placements, including kept defenders and walls. Demolished positions remain spent. The planner counts the union of the fixed plan and all existing occupied cells, and compares its missing cells against the remaining draws.

## Perfect-income milestones

| After wave | Total gold earned including initial 90 | Mastery | Unspent gold |
|---:|---:|---:|---:|
| 0 | 90 | 1/15 | 25 |
| 5 | 443 | 3/15 | 163 |
| 10 | 1119 | 5/15 | 449 |
| 15 | 2020 | 8/15 | 330 |
| 20 | 3294 | 11/15 | 34 |
| 25 | 4831 | 13/15 | 141 |
| 29 | 6177 | 14/15 | 637 |
| 30 | 6599 | 15/15 | 99 |
| 35 | 8761 | 15/15 | 2261 |
| 50 | 17649 | 15/15 | 11149 |

## Enemy pressure

Campaign HP multiplies the original curve by `1.15 + min(1.85, wave × 0.055)`. Armor grows with wave and role: plated brutes and shields require armor reduction or magic; light scouts and beasts retain lower armor; ritual casters have 12–24% magic resistance. Existing immunities, regeneration, evasion, reactive armor, mirror shields, disarm and flying routes remain active. Gold and XP rewards are unchanged. Beast-specific bonuses now apply to the mounted warbands.

Reproduce with `node tools/author-economy.mjs`, `node tools/author-campaign.mjs`, `node tools/economy-report.mjs` and `node tools/balance.mjs --campaign`. The campaign bot is a simple greedy player, not a proof of optimal play or final balance.
