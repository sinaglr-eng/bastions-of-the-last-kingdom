# Approved War Table interface and manual achievement claims

Implemented against the four approved concepts in `artifacts/ux-concepts-20261114/`. All data in the production interface comes from the actual profile, continuation and verified run records. The game remains 0.7.0 with presentation revision `war-table-approved-20261114`; the deterministic ruleset remains `fr010-v1` so existing continuations stay compatible.

## Presentation

The shared parchment interface includes a three-bastion logo, blue-ribbon medal, Play/Hall/Achievements/General navigation, responsive faction scenes, continuation card, collection album and master/detail General planning. Champion cards use the faction's exact approved portrait mapping. Secret identities stay concealed until verified discovery, independently of payment. The seven skill illustrations are shared by the planning page, battle commands and leaderboard loadouts. Exact generation prompts, source references and font licenses live with the new artwork in `public/assets/ui/war-table/`.

## Eligibility and payment

`fr010_eligible` stores server-verified achievement eligibility independently of `fr010_grants`, which continues to represent paid rewards. Command replay records eligibility without changing the medal balance. The authenticated `/api/player/achievements/claim` operation atomically writes a unique grant and ledger entry and increments the wallet revision. The client supplies the achievement identity, never its reward. A repeated request or a second device cannot pay the same achievement twice. Collection goals and secret discoveries depend on verified eligibility, not claim order.

Migration 0002 is additive. Existing paid grants are imported as eligible with their original dates, remaining claimed without another payment or balance adjustment. Eligibility is persistent across defeat, replacement and General refunds. Local SQLite and generated D1 migrations implement the same model. Account removal clears eligibility only for the removed account.

## Notifications

Verified discoveries display queued, nonblocking congratulation cards with the actual portrait, manual Claim and View achievements actions. Unverified offline milestones explicitly await verification. Successful Claim alone adds medals and displays a short confirmation. The queue deduplicates identities, persists announced identities per account, groups bursts and respects reduced motion. Opening the collection from a battle pauses and saves that defense; Return to defense uses the existing continuation flow.

## Validation

Account, wallet and migration fixtures use isolated databases. Coverage includes real command replay, manual payment, idempotency, simultaneous claims and purchases, ownership, migrated rewards, collection dependencies, exact-score all-faction standings and built Worker compatibility. Browser QA covers the four screens, Claim, General purchases and equipment, responsive layouts and signed-out access. The design gallery and its local models are outside this change and remain local only.
