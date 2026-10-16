# UI implementation plan and code map

Implement only after direct authorization in Master verze hry. Reuse the current Game, adapters and guarded inputs; replace presentation composition around them. Do not re-create the game in a new framework or reproduce the illustrative 3D scene. Start from the actual current checkout, preserving unrelated changes and any newer release.

## Existing code and intended boundaries

| Current location | Role | Intended UI work |
| --- | --- | --- |
| `game/main.js` | App shell, phase render, selection, dialog and action wiring | Compose stable register, shared preparation folio, active-wave note, compact docks and atlas; reuse actual handlers and preserve focus/scroll. |
| `ui/phase-ui.js`, `ui/phase-ui.css` | Inspector/phase state, persistent boss and phase commands | Adapt presentation states; remove duplicate phase banners and Inspect keeper; keep actual phases and pause/results semantics. |
| `ui/draft-cards.js`, `ui/draft-presentation.css` | Five-card roster | Share components across Building/Select; hide unavailable phase actions, not legal guarded commitments. |
| `ui/defender-panel.js`, `ui/defender-rank-preview.js`, `ui/grimoire.js` | Actual identity, rank preview, stats/abilities | Recompose the selected detail; derive numeric grid and concise effects from the same displayed profile. Preserve actual action guards and full ability semantics. |
| `ui/draft-input.js`, `ui/command-pointer-input.js`, `ui/recipe-marker-input.js`, `ui/pinned-recruit-input.js` | Guarded mouse/keyboard/touch/pen actions | Reuse, do not replace with naive click listeners. Exercise integration after moving controls. |
| `ui/crafting-dock.js`, `ui/crafting-dock.css` | Recipe preview/commit/pin | One selected recipe detail, factual allocation, compact preview confirmation. Keep guard keys and stale-state rejection. |
| `ui/catalog-recipes.js`, `ui/recipe-filters.js`, `ui/recipe-navigation.js` | Recipe atlas, filters/order/history | Paper list/detail layout, Built basics counters from actual allocator; preserve ordered/history separation and pin semantics. |
| `ui/next-wave-summary.js`, `ui/current-wave-panel.js`, `ui/selected-enemy.js`, `ui/warbands-overview.js`, `ui/wave-preview-flow.js` | Enemy notes, current inspection and future atlas | Share the wave slot by actual phase; retain current counts, variant truth, concealed-state rules and atlas independence. |
| `ui/header-combat-controls.js` | Stable Pause/Speed controls | Reuse control identity/handlers in one compact combat dock; remove duplicate header/dock instances. One speed control cycles supported 1x/2x. |
| `ui/tower-dps.js`, `ui/dps-measurement.js` | Measurement presentation and completed/live identity | New shallow collapsed strip plus existing expanded rows. Do not alter `game/core/tower-dps.js` measurement math. |
| `ui/support-guide.js`, `ui/mvp-details.js`, `ui/mastery-panel.js` | Unit support, MVP/mastery and odds | Preserve providers, values, progression and disclosure; place detail beneath the core without duplicating summaries. |
| `ui/audio-controls.js`, `game/audio/audio.js` | Independent categories and audio lifecycle | Restyle the existing controls only; preserve defaults, preferences, recorded files and lifecycle. |
| `ui/run-results.js`, `ui/leaderboard.js`, `ui/context-guidance.js`, `ui/tutorial.js` | End states and secondary flows | Keep reachable and coherent with paper language; no score/schema/tutorial-rule redesign. |
| `ui/portrait-visibility.js`, new UI portrait catalogue/manifest | Exact static source-art preview decoding | New UI-only assets from approved illustrations; update decoding matcher and identity-race handling. |
| `game/render/draft-markers.js` | Existing UI badges attached to map units | If necessary, change only picture lookup/dependency to the new UI resolver. Preserve geometry, placement, role precedence, leader/collision/input behavior. |
| `game/render/world.js::makeThumbnails`, `game/release.js`, `game/site-url.js` | Current image-map/release/base-path integration | Separate game UI pictures from old rendered-portrait URLs. Keep character loaders, camera, scene, scale and 3D tools unchanged. Prefer a UI adapter/injected image map over broad renderer edits. |
| `game/core/*`, `data/*`, `public/assets/geometric/*`, scenery/audio | Game mechanics and approved production appearance | Read as authority; no balance, model, map, animation, audio or art-source edits for this UI task. Release metadata changes only in the final authorized release step. |

A new module such as `ui/preparation-folio.js` can contain shared view-model/rendering, with one `ui/cartographer.css` entry and small component styles. Names are suggestions, not a requirement to duplicate existing state. Avoid adding another chain of legacy override files that leaves hidden old panels active. Keep a single owner for each live control and disclosure.

## Ordered implementation work

1. **Reconcile baseline and scope.** Read this package, current AGENTS instructions, current release and Git diff. Compare source hashes rather than resetting to 0.3.31. Record allowed UI files and protected game/art files. Identify currently approved reference sources if other authorized work advanced them. Do not import D001 balancing or a map redesign.
2. **Prepare UI portrait inputs.** Use PORTRAIT_SOURCES.json, preserve original bytes, author deterministic per-identity crops and provenance, visually review all 136. Implement a UI catalogue, base-path URLs and decoding/unknown-state guards. Do not modify the model-render portrait catalogue or scene. Verify no whole multi-subject board is used as one character.
3. **Build shared paper components.** Register, reconnaissance note, disclosure strip, candidate card rail, selected detail, compact command dock, inspector and atlas. Use stable DOM for held controls; update content without unnecessary replacement. Keep focus restoration and scroll positions.
4. **Build/Select/rank detail.** Same geometry, truthful reveal state, phase-specific actions, quantified effects and numeric rank grid. Preserve family count, rank-V retained merge and conditional downgrade. Test phase transitions and comparison without actual mutations before adding denser combination views.
5. **Multiple combinations and preview.** One shared expanded detail; separate actual candidate, selected recipe, pinned goal and result foundation. Revalidate confirmation against current inventory. Preserve map badge design and guarded actions with the new static images.
6. **Ready/Combat.** Compact Ready dock, map-driven inspection, no old permanent footer. Current/Next wave slot switches on actual phase. Move live boss HP to top center and remove repeated bars. One stable Pause/Speed pair; preserve speed, global/unit pause and input cancellation.
7. **Recipe and wave atlases.** Filters, navigation/history, recursive counts, full names and component exploration. Consolidate duplicated controls and retain modal pause restoration and visibility rules. Verify catalogs over Build, Ready, active and paused Combat.
8. **Secondary flows and responsive pass.** Audio, Help/tutorial, maze, results/read-only review, loading/error states, safe areas, zoom/text, keyboard and device layouts. Confirm hidden legacy controls cannot intercept pointer events or remain focusable.
9. **Run acceptance and record evidence.** Targeted meaningful tests, full current suite/build and actual browser interactions. Compare protected asset/core hashes, exact source-art mapping and project-path production build. Record unavailable physical-device tests honestly. Fix regressions before release work.
10. **Prepare a reviewable release.** Summarize changes, tests, unresolved real risks and protected-file audit. Update version/release metadata only under the implementation/release authorization in Master. Do not publish from this design/preparation chat.

## UI state and refresh rules

Keep actual phase, selected unit and actual rank in Game. Keep displayed rank in the existing rank-preview controller, selected recipe and catalog filter/history in their current owners, and pause capture in the modal lifecycle. A disclosure choice should survive routine HUD updates, selection changes and phase transitions according to the existing persistence behavior. Do not mutate Game/RNG merely to render a comparison or calculate a preview.

Build → Select preserves five revealed identities and the pin allocation. Preview → Cancel restores prior inspection without rerolling. Preview → Combine recomputes legality through existing Game commands. Ready → Combat removes preparation-only controls and uses the actual wave. Combat → preparation updates Next wave only after actual completion and keeps the completed DPS context. Won/Lost remain ended states with truthful outcome and no playable future wave.

Multiple overlays need a clear focus/close policy. A recipe or wave catalog uses the current pause capture/restore contract. Opening a different inspector does not silently close a modal and resume combat. Closing an inspector restores focus to a reachable selection/control rather than a removed Inspect keeper button. Map clicks used for placement/Move/preview retain their specific guarded mode; ordinary inspection must not steal an in-progress placement command.

## Implementation acceptance evidence

Use existing relevant suites first: command-main/pointer, phase-ui/main/touch, draft input/presentation, rank preview, crafting/recipe marker/navigation/tree/filter, retained rank-V merge, current-wave/visibility, measured DPS, portrait visibility and audio lifecycle/preferences. Add tests for actual integration boundaries introduced by the new composition rather than source-string mirrors. The current baseline report's 1,404 tests is historical; report the actual future run count.

Tests alone do not establish browser layout. Capture actual application screens for all eleven gallery situations, including two/three combinations and compared-rank effects. Inspect real target bounds, scroll reachability and focus; test from a project base path. A contact sheet of approved illustration crops verifies identity separately from unchanged model rendering. Do not treat generated concepts as runtime QA evidence.
