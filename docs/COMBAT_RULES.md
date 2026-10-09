# Current campaign combat rules

The 0.3.24 campaign applies explicit combat overrides in `game/core/campaign-roster.js`. Approved source definitions in `data/towers.json`, original recipe ingredients, artwork and recordings remain unchanged. Stable family IDs keep their existing identity mappings.

## Ranger attacks against flying targets

Ranger (`wyvernhunter`) and every recipe descendant—Master Ranger (`royalranger`), Dark Ranger (`kingsrangerguard`) and Ranger Oathbreaker (`elvenking`)—have `antiAirBypassesDefenses: true`.

Against flying targets, their damage ignores armor, reactive armor, magical resistance, wards, physical and magical immunity, hit shields, evasion and Kraken Shell. The rule also follows their poison and secondary damage. Bypassed shields are not consumed. Existing physical evasion rolls remain in the seeded sequence, but their result cannot block these flying-target hits.

Ground targets retain ordinary defenses. The flag does not affect other defenders, grant visibility through stealth, extend attack range or change target eligibility. Readiness uses the same flying-only rule, including shield, shell, evasion and immunity behavior, and only claims it when it applies to every relevant possible variant.

## Poison strength and ownership

| Live champion | Stable family ID | Damage per hit | Attack interval | Direct base DPS | Poison DPS |
|---|---|---:|---:|---:|---:|
| Nature Spirit | `rangermentor` | 150 | 0.5 s | 300 | 96 |
| Mother Nature | `mothernature` | 9,492 | 0.5 s | 18,984 | 1,898.4 |

Nature Spirit poison is 32% of its direct base DPS. Mother Nature poison is 20% of its damage per hit, equivalent to 10% of its direct base DPS. Their attack intervals, range and support abilities retain existing values. Druid VI remains a specialist with 384 poison DPS.

Poison does not stack its damage. Every source has its own application and remaining duration; the strongest active application deals damage and owns its hit events and kill credit. Equal-strength applications use the most recently refreshed source. A same-source refresh retains its stronger active value and refreshes that source's own duration.

A weaker defender cannot refresh another defender's stronger application. Once the stronger application expires, a still-active weaker application takes over for its own remaining duration. Combat splits a tick at expiry boundaries, so this attribution also holds when a tick crosses the transition. The aggregate `statuses.poison.time` represents the remaining duration of the poison condition; each entry in `applications` retains its independent expiry.

The DPS tracker counts actual health removed from `hit.source` and `hit.effectiveDamage`, including direct attacks, poison, damage auras and secondary procs. Poison retains its real source; the tracker does not infer ownership from current target selection. Shielded or immune damage and overkill beyond remaining health do not increase recorded DPS.

## Critical-hit feedback

Combat emits `critical-hit` only when the existing impact crit roll succeeds and the resulting attack or crit-multiplied cleave actually deals positive damage. Ordinary secondary procs, chains and poison ticks do not inherit a critical announcement. Evasion, shield absorption, immunity, shell absorption and dead or ineligible targets cannot create a false critical-hit event.

The event occurs after `hit` and before `death`, with:

```js
{enemy, source, type, amount, effectiveDamage, multiplier, directHit, visible}
```

`amount` is damage after defenses, matching `hit.damage`. `effectiveDamage` is the health actually removed, capped at remaining health. Presentation uses `visible && effectiveDamage > 0`. The announcement adds no random rolls; combat keeps the existing one crit roll per impact and existing landed-proc rolls.

Focused regression tests cover the actual campaign Ranger recipe tree and wave-35 immunity variants, flying versus ground defenses, secondary damage ownership, readiness, poison expiry transitions, effective DPS, critical-hit boundaries, blocked hits, overkill and pure cleave.
