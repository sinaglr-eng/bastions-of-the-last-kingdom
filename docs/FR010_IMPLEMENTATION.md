# FR-010 — version 0.7.0

Implemented locally on 14 November 2026. This change does not publish the game or gallery, create release backups, or replace public deployment receipts. The maintained local build is 0.7.0; the previous publication remains unchanged.

## Player experience

The main menu provides New Game, Continue, Hall of Fame, Achievements, General, Settings, Sign In and Register. Accounts are optional. Guest runs can play the complete campaign and Endless and retain a local continuation. They do not create account statistics, achievement grants, medals or leaderboard entries. Signing in does not retroactively convert a Guest run into an account run.

Verified accounts use email/password authentication, a nickname, expiring verification/recovery links and persistent sessions. Account progress synchronizes through the same-origin `/api` service. Offline continuation remains playable; unverified command batches persist locally and retry later. Account creation, starting an account run, and spending medals require connectivity.

Basic defenders use slots A–H in every faction and ranks I–VI. Existing family IDs, champion codes, models, recipes and authored combat profiles remain unchanged. The English local gallery applies the same presentation labels without changing its original source/review records or older combat reference.

| Slot | Human | Dwarves | Elves |
|---|---|---|---|
| A | Soldier | Shieldguard | Moonblade |
| B | Archer | Musketeer | Grove Archer |
| C | Druid | Runesmith | Spark Adept |
| D | Mage | Boar Rider | Sealweaver |
| E | Cleric | Grenadier | Drow Cinder |
| F | Runebreaker | Dwarf Miner | Drow Blade |
| G | Frostwarden | Griffin Handler | Drow Acolyte |
| H | Stormcaller | Furnace Tender | Dragon Keeper |

Family IDs, rather than the display names in this explanatory table, are the stable identity in saves and achievement grants.

## Medals and achievements

Champion, boss, rank-VI, campaign, collection and flawless-wave rewards are granted once per account and faction. Shared secret champion appearances count separately in each faction and remain masked until discovered. Endless 60/75/100 rewards are once per account across factions.

| Achievement | Medals |
|---|---:|
| Forge each different champion | 1 |
| First defeat of each original boss | 2 |
| First basic rank-VI defender | 2 |
| Discover 5 / 15 / 30 different champions | 2 / 4 / 8 |
| First campaign clear, wave 50 | 5 |
| Defeat all five original bosses | 5 |
| Complete Endless wave 60 / 75 / 100 | 3 / 5 / 8 |
| Complete 10 × n consecutive flawless waves | n |

A positive keep-health loss resets the current flawless streak immediately. Healing later in the same wave does not restore it, and a damaged wave contributes zero to the next streak. The best consecutive streak and the current streak survive continuation. Threshold rewards cannot be farmed by restarting a streak or loading a save. There is no fixed final flawless threshold.

## General

Each skill has three ranks. Purchasing ranks I, II and III costs an additional 5, 10 and 20 medals respectively. A player equips at most three different unlocked skills. The loadout is fixed at run creation; profile changes and refunds affect future runs. Resetting skills refunds the medals actually spent, with transaction idempotency.

| Skill | Rank I / II / III | Activation |
|---|---|---|
| Deep Refit | 600 / 500 / 400 gold | Downgrade a current basic candidate by exactly two ranks and immediately keep it; requires rank III or above. Ordinary one-rank downgrade remains 200 gold. |
| Recruitment Focus | +4 / +8 / +12 percentage points | 1 CP, one chosen A–H slot, applies to the next not-yet-started five-candidate draft and its reroll. Rank odds stay unchanged. One pending activation; an incoming reserved defender is protected. |
| Field Logistics | +6 / +8 / +10 starting CP | Passive, once at new-run creation. |
| Quartermaster | +400 / +600 / +1,000 starting gold | Passive, once at new-run creation. |
| Morale Boost | +40% / +60% / +100% attack speed | 3 CP, 20 combat seconds. Applies to normal attacks, continuous primary fire and magazine cycles; does not accelerate unrelated ability cooldowns. |
| War Horn | −40% / −60% / −80% movement speed | 3 CP, 20 combat seconds. Every enemy, including bosses, hidden and immune enemies; does not reveal hidden enemies. Strongest slow wins. |
| Blood Wrath | +40% / +60% / +100% own damage | 3 CP, 20 combat seconds. Includes secondary hits, DOT and damaging auras, without multiplying support-aura bonuses twice. |

Combat abilities can be combined but an already-active ability cannot be refreshed. Pause freezes their timers; game speed accelerates them. New arrivals are affected. Buffs clear when a wave ends. Efficient Redeployment and Draft Discipline are absent.

Developer Console remains available for excluded Guest test runs. Account runs direct the player to a separate Guest test run, so test mutations cannot invalidate previously verified wallet rewards or enter account statistics.

## Endless

Defeating wave 50 is a campaign milestone, not the end of the run. The same army, economy and general continue to wave 51 until defeat. Escaping Lord Bernhard remains fatal, including his Endless appearances.

- Each ordinary Endless wave combines two or three distinct non-boss waves from the original 1–49 pool, with 28 enemies total and interleaved spawning.
- Every tenth wave starting at 60 contains 27 ordinary enemies and one random original boss.
- Ordinary mixtures normalize their expected total HP to the median expected non-boss wave budget from waves 41–49 before applying growth. Bosses normalize to the original wave-50 boss HP budget.
- For wave `w > 50`, HP growth is `1.08^(w−50)` and added armor is `0.5 × (w−50)`. Existing ability parameters and base movement speeds are retained.
- A separate generator derives composition from run seed and wave number. UI inspection, drafts and rerolls cannot reroll future waves.
- Very large HP uses a common logarithmic simulation scale; exact score is stored as a decimal integer string and ranked by numeric magnitude, avoiding floating-point score truncation.

The map is not expanded and no new 250-structure gameplay cap is introduced. When no path-valid recruit tile exists, the player can close the draft with zero to four placements. Unplaced draws expire without reveal or RNG consumption. Existing keep/merge/craft requirements remain, including fresh matching rank-V ingredients for rank VI. The last available candidate cannot be reserved if that would leave no keeper.

## Continuation and validation

`game/core/run-state.js` preserves the indexed combat object graph, references shared by projectiles/statuses/pulses, RNG, draft/reservation, army, economy, wave state and General timers. IndexedDB atomically stores the continuation and immutable pending replay batches. Revision checks prevent a second tab from silently overwriting a save. A divergent cloud continuation requires an explicit choice; selecting Cancel preserves the local branch.

The server creates account run seeds and loadout snapshots, then replays bounded commands through the same deterministic engine. A batch contains at most 600 fixed physics ticks and 400 commands. Client score, medal and lineup claims are not trusted. Sequence/revision guards and transactionally unique grants/ledger entries prevent duplicate rewards and competing spends. Hall of Fame has one shared current competition per faction/ruleset, including General upgrades and visible loadouts. Legacy tables and score records remain separate and preserved.

## Local operation and future hosting

Use Node.js 24 and run `START_GAME.cmd`, or `pnpm install`, `pnpm build`, then `node tools/serve.mjs --open`. The production frontend listens only at `http://127.0.0.1:4174/`, proxies `/api`, and starts the local backend at port 4180 when needed. For development, run `node backend/server.mjs` plus `pnpm dev`; Vite proxies `/api` to port 4180. `LOCAL_PLAYER_API` can select an isolated test backend.

The local backend applies additive migrations and keeps existing records. SQLite, the authentication secret, owner token and local mailbox live in ignored `artifacts/statistics/`. Local verification and recovery messages are JSON files in `artifacts/statistics/mailbox/`; they are not external emails. Open the contained verification link, then sign in. Never publish these files.

Real hosted accounts require a same-origin `/api` route, HTTPS, persistent D1/SQLite and configured server secrets. A plain static GitHub Pages upload alone cannot provide account authentication or cloud saves. Configure `AUTH_SECRET` (at least 32 characters), `AUTH_BASE_URL`, exact `GAME_ORIGINS`, `AUTH_MAIL_MODE=email`, `RESEND_API_KEY`, and a verified `AUTH_EMAIL_FROM`. These are backend settings, never public Vite variables. Local mailbox mode is restricted to loopback.

`tools/prepare-statistics-site.mjs` prepares the current backend source, shared engine, pinned dependencies and generated additive Drizzle/D1 migrations. `node tools/verify-fr010-template.mjs` tests its built bundle against those actual migrations using an isolated in-memory database. No migration or deployment was applied to the public service during this task.

## Verification

The final complete run passed **2,327 / 2,327 tests**, with zero failures and zero skipped tests, including 42 FR-010 tests. The production build and built-backend verification passed.

Evidence is in `artifacts/fr010/`: full regression log, focused FR-010 tests, production build, generated backend bundle verification, local gallery verification and browser screenshots. Browser testing covers Guest continuation, registration/verification/sign-out, General purchase/equipment, starting resource bonuses, activation cost, paused buff timers and exact battle restoration. Account browser fixtures use a separate test SQLite directory; seeded test medals are not player records.

The complete suite includes existing combat/UI/media regressions and new deterministic replay, extreme Endless, achievement, wallet concurrency, authentication, offline retry, multi-tab conflict and save-failure coverage. Responsive browser checks do not substitute for testing on a physical phone or tablet. The existing large WebGL bundle warning remains; no approved runtime models/audio were removed to suppress it.
