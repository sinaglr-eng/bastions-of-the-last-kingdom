# Audit implementation — release 0.3.28

The user authorized implementation of the active audit queue in **Master verze hry** on October 13, 2026. This release implements D002–D005. D001 remains deferred; other audit proposals retain their approval states.

## Delivered behavior

| Decision | Implementation |
| --- | --- |
| D002 | All six Moon Clan forms have the existing 25% direct-hit Evasion. Wave 29 retains its previous value. Physical, Magical and Holy share the rule, and True Strike bypasses it. Other effective enemy values and all non-Moon forms remain unchanged. |
| D003 | The audio icon opens independent Music / Sounds sliders, 0–100%, defaulting to 80% / 40%. Adjustments apply live and persist between visits, as additionally approved by the user. Background music and attack effects have separate routing; voices, UI sounds and wave celebrations retain their previous levels. Mute all remains separate. |
| D004 | Next wave appears above Peak DPS. Independent native disclosures retain their state. The compact DPS line retains the highest individual peak, labelled with its current or completed wave; before combat it shows Not measured. Completed rows keep their measured identity, and removed/transformed defenders become non-selectable historical rows. New draws cannot inherit old damage. |
| D005 | The crafting dock derives exact ingredients, legal combinations and selected result foundations from existing Game helpers. It shows Built / This round / Missing states, wall consequences and an explicit guarded Recruit champion action. Pinned goals show recursively allocated progress and highlight only eligible revealed current candidates. Retained-only legal combinations stay available before five placements. Five slots and reachable commit controls remain on compact landscape layouts. |

The guard binds a displayed craft action to its run, selected ingredient and complete physical inventory. A stale sidebar, dialog or dock action cannot craft on a different foundation. Pinning, browsing and previews remain non-committing. Existing secret-recipe rules, keep/merge semantics, approved art, model scale, abilities and scoring are preserved.

## Verification

- The complete game test suite and GitHub-base production build passed. Final counts and hashes are recorded in [validation](../output/design/audit-implementation-20261013/validation.json).
- D002 checks cover all 62 effective campaign profiles, actual spawned variants, direct-hit classes, True Strike, preview copy and seeded combat. Only five formerly non-evasive Moon forms change; wave 29 and non-Moon forms retain their values.
- D004 checks use real damage attribution, poison/armor/overkill, pause/speed, completed-wave snapshots and an actual champion creation reusing an ingredient ID. Focus returns to the disclosure summary when the corresponding historical row becomes disabled.
- Crafting tests cover the existing 38 recipes, recursive allocation, hidden/reserved/surplus exclusions, retained-only availability, current-draft placement gates, secret rules, stale actions and preserved disclosure state. Existing pointer tests retain touch, drag, multitouch and keeper guards.
- Native browser checks cover desktop, iPad landscape at 1024 × 768 and mobile landscape at 844 × 390. The seeded Elven Ranger scenario shows 1 Built / 1 This round / 1 Missing after three placements, then 1 Built / 2 This round / 0 Missing after five. Explicit recruitment produces Elven Ranger at the selected Archer foundation (player-facing tile 32, 26), with four wall cards remaining. Mobile Recruit, Keep and Unpin controls are 44 pixels high.
- A real Sandbox wave with Nature Spirit completed without leaks; the following construction phase retained **Last wave 1 · 5.4** peak DPS. Sandbox fixtures are excluded from ordinary statistics and are not campaign-completion evidence.
- Native decoding passed for all 113 approved audio clips, with a two-buffer music cache. Keyboard adjustment, 0% / 100%, reload persistence and restored 80% / 40% were checked. A browser-host timer receiver error discovered during native QA was repaired with default timer wrappers; a regression exercises actual rotation, crossfade and cleanup. No runtime errors appeared in the follow-up.

Evidence lives in [the verification directory](../output/design/audit-implementation-20261013/). Original approved images, recorded prompts, manifests, media and historical reviews were not modified.

## Limits

The viewport checks use a native Chromium browser, not physical iPad hardware. Native decoding verifies playable media and transport, not subjective listening quality. D002 increases measured late-wave pressure in bounded fixtures; a complete legal campaign and multiple obtainable winning paths are not certified. That wider D001 work remains explicitly deferred.
