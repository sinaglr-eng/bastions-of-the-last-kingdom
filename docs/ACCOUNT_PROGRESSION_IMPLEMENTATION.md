# Account experience and military ranks

Approved brief: `artifacts/alliance-progression-brief/implementation-prompt.txt`. The game remains 0.7.0 with presentation revision `account-progression-20261115`. Combat rules remain `fr010-v1`, preserving current continuations and standings.

## Authoritative progression

`game/core/account-progression.js` defines all fifteen cumulative ranks, per-run boss XP, achievement XP and skill gates. Account XP is shared across factions and never spent. Ten verified completed waves earn one XP with a global remainder across runs. Each original boss type earns 2/3/4/5/8 XP once per run, including a kill before defeat in an unfinished wave. Repeated Endless copies do not pay again.

The additive local and generated D1 migrations create account progression, per-run paid prefixes, an immutable XP ledger and durable result receipts. XP/carry and wallet revision use a joined snapshot, revision guards and transactional writes. Campaign settlement is capped at wave 50 using boss first-kill wave evidence; later results pay the unpaid delta. Claims keep exact receipts independently of newer concurrent account updates.

Migration backfills trustworthy server history once, preserves medals/discoveries and permanently records already purchased skill ranks. Missing boss type evidence is diagnosed, never inferred from aggregate kills. Account deletion clears only the owner's records. Offline clients retain their saved command queue and show verification pending until confirmation. Closed offline results replay their outbox on the next session or connection recovery; a new defense cannot overwrite an unverified ended save.

## Achievements and skills

Basic champion achievements retire from catalog, eligibility and Claim validation. Their units, discovery history, paid rewards and bought skills remain intact. Collections count Intermediate+ champions: Human 33, Dwarves 30, Elves 30. Rank VI still earns two medals and no XP. Every achievement reward requires manual Claim; gameplay wave/boss XP settles automatically.

Morale Boost ranks require levels 5/9/12, War Horn 7/11/14 and Blood Wrath 9/12/15 plus sequential medal purchases. Existing ranks stay usable and repurchasable after refunds through permanent unlock entitlements. Saved defenses retain their original loadout.

## Presentation

The lion/anvil/leaves alliance logo replaces the three-tower mark in loading, menu and battle UI. Original artwork and recorded prompts remain preserved. Runtime variants include transparent WebP, actual vector SVG, compact/dark/monochrome marks and favicon. Fifteen rank badges follow the approved motifs.

Menu and General show rank, level, interval progress and the next skill milestone. Achievement cards show medal and XP rewards. Shared parchment Defeat/Victory panels show exact score, completed waves, bosses, automatic XP, prior/current badges, newly available skills and manually claimable rewards. Wave 50 Victory is an intermission: Continue Endless preserves the defense and proceeds to 51. Acknowledgement survives reload. Battlefield inspection and battle details remain available.

Confirmed receipts drive bounded animations and one promotion celebration, with event deduplication, skip and reduced-motion support. Effects never consume combat RNG. Mobile layouts preserve readable type, usable actions and no horizontal page overflow.

## Publication boundary

Only current game source, approved runtime UI assets and the account Worker are published. The gallery and source/model binaries remain local. Tests use isolated loopback/in-memory accounts; no synthetic accounts, scores or reward fixtures are written to production.
