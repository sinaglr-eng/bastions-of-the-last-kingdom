# UI acceptance scenarios

These are requirements for the future implementation, not results of this preparation. Use real Game state and actual handlers for semantics; use a browser for layout and asset decoding. Preserve existing passing tests. Run focused checks during implementation, then the full current test suite and production build once the change is integrated. Repeat broad runs after meaningful later changes or failures.

## Preparation and defender inspection

| ID | Exercise | Required result |
| --- | --- | --- |
| A01 | Inspect Build with three of five placed, then finish placements and enter Select. | Same five-card/detail components and geometry; only legal phase content/actions change. Exactly two slots stay hidden before placement. No Keep/Reroll/Reserve in Build, no extra empty action rail. |
| A02 | Pin a recipe while hidden slots exist; inspect revealed recruits and compare ranks. | No hidden family/rank/name leaks in pictures, URLs, preload, attributes, ARIA or pin allocation. Inspection does not block normal legal placement or consume RNG. |
| A03 | Check odds in Build, Choose keeper, combination preview and Ready. | Build has one truthful future-draw row. No Not this draft caption, Choose keeper Future rank odds, preview odds or Ready odds. Existing odds calculation stays unchanged. |
| A04 | Select actual Archer II; compare all ranks, including IV. | II shows 12 hit / 48 base direct DPS / 4 tiles / 0.25 s. IV shows 48 / 192 / 4 / 0.25 at baseline. Both say one target and no additional status. Actual card, Keep and current craft guards stay II. I–VI buttons have correct labels and focus. |
| A05 | Inspect Mage I, Frost Warden V and VI, a poison/support unit, fixed champions and a unit with no additional effect. | Numeric grid/effects derive from one displayed-rank profile. Mage I splash is 30%, 3.6 Magical damage, radius 3. Frost Warden V is Physical with 36%/3 s slow. VI uses actual 55%/3 s and 0.5-tile effect area. No invented damage class, duration, ability, champion rank progression or ordinary defender HP. |
| A06 | Switch selected units during rank preview; inspect a built family with active, attack-paused, draft, reserved and ruined copies. | Preview resets per actual identity. Active family count includes attack-paused units, excludes draft/reserve/ruin and is independent of exact recipe-rank eligibility. Support/MVP/targeting/unit-pause remain reachable and truthful. |
| A07 | Keep, legal Reroll/Reserve, insufficient CP/gold, downgrade and ordinary/current/retained rank-V merges. | Actual costs/eligibility/reasons stay authoritative. Downgrade and Keep is not lost. Candidate and retained-only rules remain intact; one accepted command executes once. |

## Combinations and pinned recipes

| ID | Exercise | Required result |
| --- | --- | --- |
| A08 | Select Archer II with two potential recipes and Frost Warden V with three. Open every row and alternate repeatedly. | Full names/statuses remain visible. At most one ingredient detail expands; no competing trees/overlap. Missing recipes inspect but cannot craft. Keep stays reachable on iPad. |
| A09 | Preview Elven Ranger from retained Cleric I and current Druid I/Archer I; Cancel, then Confirm from an eligible anchor. | Exact allocator, result foundation, consumed and discarded/wall outcomes are shown. No mutation before confirmation. Cancel preserves selection/draft/RNG. Confirm revalidates actual state once. |
| A10 | Change phase, inventory, selected identity/anchor, Move state, pause/speed or DOM target while a commitment gesture is held. | Existing stale-state/drag/multitouch/cancel/capture-loss guards reject invalid action; no double Keep/Start/Merge/Combine or ghost click. Mouse/keyboard still work; accepted ordinary touch/pen commands do not depend on compatibility click. |
| A11 | Inspect map badges for result, consumed, discarded, merge and pinned overlap. | Same rounded portrait badges, numbers, role symbols, colors, leaders, collision handling and action priority. Picture comes from original geometric reference art. Comparing a rank does not relabel an actual map action. |
| A12 | Select Kingslayer without pinning; pin explicitly; use duplicate requirements, an intermediate component, draft/hidden/reserved units. | Selection does not repin or craft. Built/This round/Missing are truthful; each identity allocates once. Built basics excludes draftCount and covered branches do not double-count. Preserved sample inventory yields Kingslayer 2/11 and King 2/13; built Frost Knight probe gives Kingslayer 5/11. |

## Ready and combat

| ID | Exercise | Required result |
| --- | --- | --- |
| A13 | Commit a keeper, inspect another map defender, close the pane, use Maze plans and start the actual wave. | No permanent recruitment receipt, Ready odds or Inspect keeper control. Small Ready dock contains Maze plans and Start wave. Map selection opens detail; normal legal Move/maze tools remain accessible. Focus returns to a real remaining control. |
| A14 | Run Build/Select/Ready → Combat → paused Combat → completion → preparation; also Won/Lost. | One wave slot changes Next ↔ Current by actual state, with DPS directly below. No simultaneous Next card or second compact Current banner. No Next wave 51, invented completion or premature phase change. |
| A15 | Pause/resume, cycle Speed, inspect units/enemies and refresh HUD while holding controls. | One stable Pause/Resume control and one speed control support current 1x/2x only. Global pause is independent of attack pause; no duplicated header/dock controls or replaced held target. |
| A16 | Check live and completed DPS, archived identities, a crafted/reused tower ID, MVP award and zero-damage/support rows. | Actual independent peaks, measurement label, sum, ordering and MVP metadata retain meaning. Completed score never migrates to a new rank/family. Expanded list usable; collapsed strip shallow and accessible; saved disclosures preserved. Base direct DPS is never substituted for measured score. |
| A17 | One visible boss, multiple visible bosses, one concealed/queued boss, reveal/death/escape and ended battle. | Top-center HP sums revealed living bosses only. No hidden HP in DOM/ARIA or leaked position. Status/counts remain independent. Side inspector has no duplicate live aggregate bar. Do not call an escaped boss defeated. |

## Atlases and preserved flows

| ID | Exercise | Required result |
| --- | --- | --- |
| A18 | Combine search, damage, ability, against-defense and All/Available/In progress filters; try zero/one/many matches. | Filters remain available and truthful. List/detail scroll independently where needed; names, selection, pin and primary navigation stay reachable without overlap. |
| A19 | Ordered recipe navigation Kingslayer → King, endpoints, out-of-filter component exploration, Back/Forward history and return. | Current filtered order, no wrap, explicit unavailable position; exploration history distinct. Filters and pin remain intact. Row ingredient progress is independent of navigation page index. |
| A20 | Explore future wave 31 and mechanically identical variant pairs; inspect current-wave counts and revealed enemies. | Shared facts shown once; Physical/Magical immunity and other abilities come from current adapter. Possibilities are not guaranteed splits; no invented elemental resistance or arbitrary variant redesign. Individual live effects/HP obey visibility. |
| A21 | Open/close recipe and wave catalogs during running/paused combat and switch selected catalog wave. | Restore exactly prior paused state; never auto-resume an already paused game. Catalog selection never changes actual campaign round or triggers Start. |
| A22 | Exercise Music/Sounds, saved preferences, mute, audio unlock, final choice voice, pause/speed and modal opening. | Defaults 80%/40% for a fresh profile; separate actual categories and stored values remain. Inspection/rank comparison stays silent; final choice speech and wave-start continuity follow current behavior. No audio/model source bytes change. |
| A23 | Help/tutorial, maze editing, targeted attacks/Move, results, read-only review, Retry and statistics/leaderboard. | Existing paths, legal states, saves and statistics remain reachable and unchanged. No new backend schema, fabricated outcome or accidental developer UI exposure. |

## Portrait and visual preservation

| ID | Exercise | Required result |
| --- | --- | --- |
| A24 | Resolve every 48 basic rank, 38 champion and 50 enemy portrait; review full crop contact sheet. | 136 exact identities derive from approved original raster hashes. Multi-character sources crop only the correct named subject; no whole boards, model renders, mirroring, redraws, clipped identifying equipment or wrong rank fallback. Record every source rectangle/output hash. |
| A25 | Rapid A → B → A and rank changes with deferred decode, errors and retries; unknown drafts and enemy panels. | No stale/wrong image flash; identity and current request govern visibility. Hidden slots never request hidden identity. Neutral unavailable/loading fallback only. No character WebGL renderer is used for UI previews. |
| A26 | Compare protected production model, scenery, map, animation/effect, audio and gameplay hashes/diff. | Only authorized UI integration/new image outputs and later release metadata change. Existing models, art sources, map, balance, RNG, recipe legality, saves, measurement and MVP mechanics stay unchanged. Gallery originals and recorded prompts/reviews stay intact. |

## Responsive accessibility and release evidence

| ID | Exercise | Required result |
| --- | --- | --- |
| A27 | All eleven screen situations at target desktop/iPad dimensions, short/portrait/mobile fallbacks, safe areas and enlarged text/zoom. | Primary task reachable, legible labels, no clipped action or focusable hidden legacy panel, map center usable. Bounded internal scroll reaches every option. Touch sizes, focus, color contrast and keyboard order verified with actual pixels/DOM. |
| A28 | Root and GitHub project base-path production builds; reload, loading failure and new UI cache revision. | Every UI asset resolves under both bases with proper MIME/decode and cache identity. Existing model/audio/scenery versions do not change. Run actual current full suite/build and retain logs; physical Safari result stated honestly. |
| A29 | Final authorized release preparation and publication. | Current version reconciled, release metadata consistent, protected-file audit and screenshots saved. No main push/merge until publication is authorized because current CI deploys main. Verify served compiled/image hashes and release after authorized deployment; preserve leaderboard history and rollback plan. |

## Required future evidence bundle

Save actual changed-file scope and source baseline comparison, focused/full test logs, production build log, crop mapping/contact sheet and per-ID checksums, browser state/geometry and screenshots for eleven situations, narrow-screen/zoom/focus evidence, source-image decoding checks and release/publication receipts if authorized. Report unperformed physical iPad/Safari checks explicitly. Do not reuse the design package's artifact checks or historical 1,404-test result as evidence that the new implementation passes.
