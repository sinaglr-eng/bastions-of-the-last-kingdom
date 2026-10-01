# Campaign economy and difficulty

Construction mastery follows Kingdom level automatically: mastery = min(Kingdom level − 1, 15). Each 90 XP advances Kingdom. Kills award XP and score; completed waves award 15 XP. Current-round draw odds are frozen at its start. Reaching a Kingdom level during combat changes the next round's draw odds, without a purchase.

Normal waves award 50 gold on completion; boss waves award 200 gold. These completion payouts happen once, including the finale. Kills and champion attacks award no gold. Starting gold remains 90. In a full campaign with no theft, total gold is 3,340. Enemy theft remains an enemy ability.

Gold is spent only on the 200-gold candidate downgrade. It lowers one basic current candidate by exactly one rank and immediately keeps it; the other four become walls. Castle-wall demolition is free and does not refund a construction draw. Paid mastery and champion enhancements are unavailable. Keep health cannot be bought.

With every enemy killed, maximum mastery first applies after wave 22. This timing depends on XP, not on gold spending or theft. Tier VI requires merging two Tier V candidates in the same round.

Every 50-wave campaign grants 250 placements. The three new curated plans use no more than 150 occupied cells; user-provided layouts keep their original geometry. The planner counts the union of planned and existing walls and defenders.

| After wave | Kingdom | Mastery | XP | Total gold before downgrades or theft |
|---:|---:|---:|---:|---:|
| 0 | 1 | 0/15 | 0 | 90 |
| 3 | 2 | 1/15 | 120 | 240 |
| 5 | 3 | 2/15 | 204 | 340 |
| 10 | 6 | 5/15 | 471 | 740 |
| 15 | 9 | 8/15 | 806 | 990 |
| 20 | 14 | 13/15 | 1197 | 1390 |
| 25 | 19 | 15/15 | 1707 | 1640 |
| 30 | 24 | 15/15 | 2147 | 2040 |
| 35 | 32 | 15/15 | 2810 | 2290 |
| 50 | 59 | 15/15 | 5296 | 3340 |

Only the first patrol is introductory, with 9 HP, speed 1.3, zero armor and 2.4-second spawn intervals. Waves 2–50 retain their existing normal combat tuning, movement classes and abilities. Reproduce with `node tools/author-economy.mjs`, `node tools/author-campaign.mjs` and `node tools/economy-report.mjs`.
