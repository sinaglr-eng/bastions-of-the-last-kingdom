# Controlled RNG and Command Points

Command Points (CP) are a run-local tactical resource. A new run starts with **3 CP**. Each boss killed in combat earns **5 CP**, once per boss; a boss reaching the keep earns none. CP persist between waves and reset with a new run. They cannot be negative. The top bar shows the current amount during construction, battle and Move selection.

The normal draft still has **exactly five choices**. A new random defender is revealed only after a valid placement. Invalid placements consume no random draw. A returning reserved defender occupies Slot 1 at its original fixed tile and counts as one already placed choice; only the other four need new placements.

## Reroll

After placing all five choices, **Reroll costs 1 CP** and can be used once per draft. It regenerates the random choices at their existing foundations with the same family weights and rank probabilities as normal placement. A defender carried from the previous draft stays unchanged in Slot 1. The once-per-draft restriction resets with the next draft. Reroll must happen before paying for Reserve; a committed Reserve disables further reroll for that draft.

## Reserve

Select one current draft candidate and choose **Reserve · 1 CP**. That defender stays on the map at its exact current tile as an inactive path blocker. It keeps its identity and rank but cannot attack, detect enemies, provide buffs, satisfy a recipe, move or be demolished. The tile remains occupied and blocks enemy movement like a wall. Its card shows **Reserved for next draft · Inactive · blocks path**. Only one Reserve may be confirmed per draft. Keep, merge or combine the remaining eligible choices as before. With an ordinary keeper, the result is one active defender, one inactive reserved blocker and three walls.

The same defender returns as **Slot 1**, already placed at the same fixed tile with the same identity and rank, in the next draft. There are four new random choices and five total. The returning card is marked **Reserved from previous draft · Fixed position** and protected from reroll. It can be selected for inspection while placing the other four choices. Once all five are placed, keep it to activate it there, use it in a valid combination, pay another 1 CP to reserve it again at that tile, or let it become an ordinary wall. Reserving a different candidate replaces the previous carry; the old one becomes an ordinary candidate at its existing tile. Reserve ends with the run and does not persist to another game.

## Move

Between waves, choose **Move · 2 CP**. Eligible retained defenders are highlighted. Select one, then select a highlighted existing castle wall. The defender and wall exchange positions. The old defender position remains blocked by that wall, so occupied cells and the exact enemy route remain unchanged. Defender identity, rank, kills and damage records remain intact. A wall's own disruption state stays with that wall.

Move cannot target a defender, an inactive reserved blocker, a draft candidate, an empty tile, a checkpoint, invalid terrain or an enemy route tile. It is unavailable during combat and while editing a maze blueprint. CP are charged only after a valid exchange. **Cancel Move** or **Escape** exits without spending. Starting combat also clears Move selection without a charge.

## Configuration

The existing `data/balance.json` owns all amounts:

```json
"commandPoints": {
  "starting": 3,
  "bossReward": 5,
  "costs": {"reroll": 1, "reserve": 1, "move": 2},
  "maxReserveCount": 1,
  "maxRerollsPerDraft": 1
}
```

Amounts must be nonnegative integers. This version intentionally supports one reserved defender and one reroll per draft. The UI reads prices and boss rewards from these settings.

The run does not support saving and resuming battlefield state. Existing saved profile preferences, discoveries and maze blueprints retain their behavior; no new mid-draft save system is introduced.

The core modules are `game/core/command-points.js`, `game/core/draft.js` and `game/core/command-move.js`. `game/core/game.js` owns the phase checks and authoritative decisions. The draft and command UI use those actions directly. Automated tests cover costs, insufficient CP, reserve inactivity and wall counts, carried identity and reroll protection, renewal and replacement, recipe compatibility, wall-only movement, cancellation, boss rewards and run reset.
