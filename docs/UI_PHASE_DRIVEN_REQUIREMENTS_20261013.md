# Complete phase-driven UI requirements

**D006 · IMPLEMENTED — scoped verification passed in 0.3.29**

Recorded on October 13, 2026. The user requests all ten areas in the supplied UI analysis as implementation requirements and reports that the delivered changes did not cover the full dynamic panel design.

## Scope and delivery boundary

D006 extends the earlier D005 crafting/pinning scope to the full phase-driven interface described in the user's attachment. The release 0.3.28 report records D002–D005 as delivered within their earlier scope; that report does not certify all ten areas below. Preserve completed behavior and verify it rather than rebuilding it unnecessarily.

The user explicitly authorized implementation in Master verze hry. All ten areas are implemented in 0.3.29; the [implementation report](PHASE_UI_D006_IMPLEMENTATION_20261013.md) and structured register record passing scoped browser and production-module checks, including repeated phases and 150% text enlargement. Physical iPad/Safari testing remains uncertified. D001 analysis has resumed separately; numerical/mechanical implementation remains unapproved and outside D006. No campaign balancing, enemy redesign, recipe changes or production-art replacement is authorized by D006.

The [original supplied text](evidence/ui-phase-request-20261013-v1/original-request.txt) is historical source material preserved byte-for-byte, including its old proposed/not-approved labels and Czech wording. Its [evidence manifest](evidence/ui-phase-request-20261013-v1/manifest.json) records SHA-256 e7c06f5a2cf34d1686b372f0074b144a572adb47fb1d6d89e150d24b0466c759. The present D006 record is the current approval, not a rewrite of that source.

Related references: [original UI audit](UI_DESIGN_AUDIT_20261013.md), [D005 crafting specification](UI_DYNAMIC_CRAFTING_APPROVED_20261013.md), [0.3.28 delivery report](AUDIT_IMPLEMENTATION_20261013.md), and the [nine responsive concept boards](../output/design/ui-concepts-responsive-20261013-v1/README.md). Earlier raster studies support visual discussion; actual runtime rules and the requirements below take precedence over generated copy, fixture values and approximate proportions.

## Mandatory phase transitions

The layout must respond to game phase, not only viewport width or selected recipe. CSS size adjustments or a crafting dock alone do not complete D006.

| State | Main task and bottom panel | Context detail | Always accessible |
| --- | --- | --- | --- |
| Building | Place recruits n/5; restore the complete five-slot construction draft for a new round. | Compact placement guidance, CP/gold, selected unit or pinned goal only as relevant. | Keep health, wave, Next wave with DPS beneath it, menu/help. |
| Choosing keeper | Five revealed candidates and separate legal Keep / Merge / Recruit champion actions. | Name, actual rank/state, immediate action and core stats before optional detail. | Result/consumption preview, all five candidate slots, Next wave and DPS. |
| Ready | Clear Ready / Start wave; finished draft becomes a concise history/selection summary. | Retained-unit stats, legal Move/targeting/attack-pause actions; no repeated first-run introduction. | Wave/health, Start wave, Next wave and DPS. |
| Combat | Automatically replace the large draft and probability panel with a thin combat strip. History/cards/odds remain available by expansion. | Optional compact inspection drawer; a closed drawer must not consume a permanent large column. | Wave/health, global Pause/Speed, on-field/queued counts and boss health when relevant; DPS beneath Next wave. |
| Globally paused | Keep the compact combat layout and show a clear Paused state. | Inspection stays available; individual attack pause is distinguished from global pause. | Resume, wave/health and persistent combat/boss summary. |
| Run ended | Result summary and primary Play again before optional online scores. | Last threat/leak facts and completed versus defeated wave. | Local result and retry remain available without leaderboard connectivity. |
| Battlefield review after end | Read-only ended-run summary. | Inspect final defenders/enemies as available. | Run ended indication and return/retry; no placement tutorial or active build actions. |

Opening a detail must not force every secondary panel open. Keep independent disclosure choices through selection and normal data refreshes. Automatic draft expansion applies when returning to a new construction round; it must not turn unrelated manually collapsed panels back into large overlays.

## Ten required areas

### R01 — Small and low-height displays

Implement a dedicated low-height layout. At mobile landscape 844 × 390, the battlefield must gain substantial usable space from the original 115-pixel map / 209-pixel draft arrangement. Those measurements are historical baseline evidence, not fresh measurements of release 0.3.28.

In combat, collapse the large bottom draft and optional inspector. Keep health, wave, pause and speed readable and reachable. Open defender detail as a compact drawer instead of consuming the whole remaining height. Recognize limited height even when the screen is wide.

Acceptance: show before/after viewport evidence and interact with all essential actions. No header overlap or compulsory page scroll away from the map to resume, inspect or commit a legal choice.

### R02 — Combat bottom strip and return to construction

When combat begins, large keeper/wall cards, completed draft history and expanded draw odds automatically become a thin strip. Preserve access to that information through expansion and to selecting the retained keeper.

When the next construction round starts, restore the five draft slots and the placement task. Preserve pending choices correctly; collapsing the UI must not select a keeper, reroll, reserve or discard a candidate.

Acceptance: demonstrate Building → Choosing keeper → Ready → Combat → Paused → next Building, including repeated rounds, without a permanent large combat draft or missing construction cards.

### R03 — Defender detail hierarchy

Required order: name + actual rank/state; relevant legal main action; damage class, range and concise ability/performance; active bonuses, targeting and attack pause; then expandable rank comparison, recipes and detailed MVP.

Reduce portrait display size where height is limited, using existing approved portrait assets. Keep target priority and relevant legal actions above optional catalog sections. Rank preview must remain clearly separate from actual unit rank.

Acceptance: inspect a candidate and a retained/champion defender. Relevant actions and targeting must be reachable without scrolling past a large portrait, comparison table or MVP explanation. Hidden phase-specific actions must retain concise reasons where needed.

### R04 — Mobile inspection close to selection

After a candidate selection, show a compact nearby bottom sheet or landscape drawer with the useful detail and Keep/Merge/craft actions together. Avoid moving the user to a panel far below the map.

All five draft slots must remain discoverable. If horizontal scrolling is required, show the continuation and bring the active slot into view. Do not layer several large panes over the map at once.

Acceptance: test portrait 390 × 844 as well as landscape 844 × 390. Select the fifth card and perform a legal action without a long down-and-back page-scroll sequence.

### R05 — Map overlays with visible DPS

Prioritize a concise Next wave summary during building; reveal exact variants/abilities through its detail entry. Keep the measured DPS entry immediately below it, per D004, in both building and combat.

Before first combat, the default DPS presentation can be a compact Not measured line rather than a list of zero-performing candidates. After combat, compact mode retains an actual measured score and completed-wave label. Expanded mode retains the measured list. Never interpret the older source's collapse suggestion as permission to remove DPS entirely.

Respect the player's independent collapse choices. Do not force expansion when inspecting a defender, pinning a recipe or refreshing values.

Acceptance: first building, post-wave building, combat and recipe inspection all preserve Next wave → DPS order and visible compact score/context without excessive map obstruction.

### R06 — Phase-specific HUD, touch controls and advanced Developer entry

Prioritize Keep health and wave on every screen. During construction, CP and gold have clear prominence; during combat, Pause and Speed have prominence. Score and Time remain accessible with secondary visual weight. Do not hide the wave on narrow screens.

Increase small touch hit areas to roughly 44 pixels where practical, while preventing overlap and maintaining a usable map. Existing keyboard/focus operation must remain usable.

Move Developer out of the primary player toolbar into an advanced menu entry. Before activation, explain that the current run is permanently excluded from scores/statistics, with a reachable cancel option. This warning belongs to activation, not every gameplay click.

Integrate the already delivered D003 Music/Sounds controls and its subsequently approved persistence/Mute behavior; preserve working routing and stored values.

Acceptance: verify all phase priorities, wave visibility, hit areas, actual touch/focus actions and Developer activation/cancellation. Do not certify accessibility merely because labels exist.

### R07 — Recipes for quick decisions

Provide a compact champion list with detail on opening, name search and expandable general explanation. Separate the basic-defender guide from champion recipes. Keep existing Damage type / Ability / Against defense filters, recipe pinning and ingredient trees.

Above-the-fold content on mobile must expose useful recipe entries instead of only long filter instructions. Continue to distinguish Built / This round / Missing using authoritative inventory allocation.

Correct stale display descriptions using current runtime values: Mage uses Magical cleave where applicable, not an obsolete pure-splash claim. Aura-only damage dealers must prominently display their actual aura output rather than misleading Base DPS 0. Direct DPS, poison and multi-target effects stay separate rather than being added into a fictional universal effective DPS.

Acceptance: find a named champion, filter it, inspect its exact ingredients, pin/unpin it and return to building on each screen class. Check basic Mage and an aura-only champion against current runtime output.

### R08 — Enemy navigation, variant comparison and persistent combat status

Use compact wave rows showing number, movement, count and key threats. Open detail on request and support a quick jump to a wave or boss. Keep lore secondary.

For alternative forms, show common statistics once and side-by-side defense/ability differences. Preserve independent per-enemy variant selection; do not imply one guaranteed wave-wide composition. Use runtime information only. If two forms still have identical mechanics, show that honestly; adding new distinctions belongs to D001's separately reviewed proposals, not this UI requirement.

During combat, on-field and queued enemy counts and boss health must remain available even while a defender or enemy is inspected. Distinguish global Paused from unit Attacks paused; preserve support/existing-DOT semantics.

Acceptance: navigate to a distant normal wave and a boss, compare forms, then inspect a defender during a boss fight without losing the persistent boss/count display. Verify displayed states against actual spawned enemies.

### R09 — Maze plan comparison

Give each existing plan a small top-down thumbnail and one prominent meaningful metric. Other route/exposure details remain expandable. Keep the warning that flying enemies ignore the maze near the selection.

Use actual plan data and its assumptions. A geometric preview is not a globally optimal solution, damage prediction or campaign win probability. Preserve current placement/path legality and map tools.

Acceptance: compare at least two plans, reveal detail and identify the flying limitation on desktop and touch layouts. Verify legible thumbnails and accessible selection/close actions.

### R10 — Contextual guidance and factual results

Replace obsolete claims about XP unlocking recipes with current progression rules. Explain CP and MVP with short optional guidance at the first relevant event, instead of a repeated large construction introduction or mandatory chain of popups.

At run end, prioritize Play again ahead of optional online leaderboard/score submission. Separate completed waves from the wave of defeat. Show factual leak/last-threat information supported by game events; do not invent a causal explanation such as a mandatory army recommendation.

Local results and retry must work if the leaderboard is unavailable. After Inspect battlefield, show an ended read-only state rather than Build your defense or placement instructions. Keep a clear route back to result/retry.

Acceptance: check first-run guidance, a later construction round, a loss with recorded leaks, online-score unavailability and ended battlefield inspection. Rich new analytics or external telemetry are outside this requirement; use truthful available facts and identify unavailable detail.

## Coverage and completion register

Every row is part of the approved D006 request. An overlap with previous implementation is not evidence that the broader row is complete. The implementer must record actual coverage and verify remaining work.

The [structured acceptance register](UI_PHASE_DRIVEN_ACCEPTANCE_20261013.json) records all ten requirement IDs, implemented states, source and verification evidence, five viewport checks and required transitions. See the implementation report for test boundaries.

| Requirement | Related audit areas | Required delivery evidence | Current D006 verification |
| --- | --- | --- | --- |
| R01 | UI01, UI03, UI07, UI16 | Low-height layout, readable HUD, playable map, interaction evidence | Passed — report and register linked above |
| R02 | UI02, UI08, UI09 | Full repeated phase-transition sequence and expanded/collapsed draft states | Passed — report and register linked above |
| R03 | UI06, UI08 | Candidate/retained/champion detail ordering and reachable actions | Passed — report and register linked above |
| R04 | UI07, UI16 | Portrait/landscape fifth-card selection and nearby detail | Passed — report and register linked above |
| R05 | UI05, UI12; D004 | Independent Next wave/DPS states before and after combat | Passed; scoped D004 behavior preserved |
| R06 | UI03, UI04, UI16; D003 | Phase HUD, touch/focus, advanced Developer warning, preserved audio | Passed; scoped D003 behavior preserved |
| R07 | UI10; D005 | Search, guide separation, compact catalog, runtime damage copy | Passed; scoped pinning behavior preserved |
| R08 | UI11, UI12 | Compact navigation, exact variants, independent boss/count summary | Passed — report and register linked above |
| R09 | UI13 | Existing plan thumbnails, primary metric, expanded detail and flight limitation | Passed — report and register linked above |
| R10 | UI14, UI15 | Contextual CP/MVP, corrected progression copy, factual result/retry/review flow | Passed — report and register linked above |

Viewport checks: representative desktop 1366 × 900; iPad landscape 1024 × 768 and tablet portrait 768 × 1024; mobile landscape 844 × 390 and portrait 390 × 844. Include real touch ergonomics and larger text, not only screenshots or emulated dimensions.

Completion must be demonstrated across complete state transitions and catalogs/results, not only a single Elven Ranger crafting fixture. Use appropriate existing gameplay/UI tests and actual browser interaction. Record what was already present, what changed, which checks passed and any remaining limitations. Do not label D006 implemented until its whole scoped checklist is covered.

## Handoff

Current delivery: **D006 R01–R10 implemented in 0.3.29**, with scoped verification recorded in the implementation report. D002–D005 retain their documented release 0.3.28 delivery state. D001 analysis has resumed separately; numerical/mechanical implementation remains unapproved and outside D006. The support/poison/MVP balance proposals remain outside this approved UI request.

Original supplied text, approved image assets, generation prompts and historical verification reports stay unchanged. The initial approval step recorded requirements without code changes; the separately authorized implementation is documented in the 0.3.29 report.
