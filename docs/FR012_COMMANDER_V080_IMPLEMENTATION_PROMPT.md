# FR-012 — Commander armory, version 0.8.0

## Approved scope and reference identity

Implement the four approved mockups in `output/design/commander-geometric/01-equipment.png`, `02-skills.png`, `03-chests.png`, and `04-sets.png` as working HTML interfaces. Use `05-artifact-style.png` as the visual reference for all 84 artifact illustrations. Preserve the exact source images and recorded prompts. The flat `06-icon-system` proposal was rejected: never use it in the game. Extend the existing beveled gold, green and painted utility icon family in `public/assets/ui/ornate/` instead.

Publish the game as 0.8.0. Update the one local English gallery, without publishing that gallery. Preserve authentication configuration, accounts, historical scores, achievements, XP, medals, skill purchases, artifact ownership, Dust, chest counters, and saved defenses. This request does not authorize a player progression reset or balance changes.

## Shared visual system

- Use the existing dark teal background, warm ivory parchment, antique gold double rules, decorated corners, existing display serif and readable UI typeface. Do not introduce a new theme or unrelated stock illustrations.
- Keep the global logo, navigation, account rank and wallet. Make the Commander page compact: centered Commander heading, four equally legible subnavigation buttons, and generous but controlled spacing. Selected tabs use dark teal, ivory text and a gold edge; inactive tabs remain parchment. Include a readable ready-chest count.
- Use real buttons, selects, inputs, progress indicators and text. Do not flatten an entire mockup into a background image. Reuse the current ornamented button and dropdown styling, with visible keyboard focus and a minimum 44 px touch target.
- Every panel must use `min-width: 0`, predictable padding, wrapping text and image containment. Never clip names, numeric bonuses or purchase requirements. Use responsive grids, not a fixed screenshot coordinate system.
- Use material-rich raster utility icons matching the current commander helmet, shield, medal and crown. Small navigation chevrons may remain code-drawn. Empty equipment positions use recognizable matching equipment-type images, visibly muted and labeled; do not use abstract diamonds or unrelated landscapes.
- Preserve rarity as both a text label and a clearly colored image field: Common neutral, Uncommon green, Rare blue, Epic purple, Legendary gold. Missing items remain distinguishable from owned ones, without hiding their rarity.

## Equipment

At iPad landscape and desktop widths, use three panels: anatomical equipment, backpack, selected-item inspector. The left panel contains a featureless dark teal faceted human silhouette. It must remain a silhouette even with a complete set; remove realistic faces, dressed-character portraits and full-set portrait swaps. Place ten functional frames anatomically: head, neck, chest, cloak, gloves, weapon, offhand, feet, left ring, right ring. Every frame is independently selectable, labeled and shows its current item. Both rings can contain distinct items; duplicate use of one artifact is forbidden. Frames must not overlap each other or hide their labels.

The backpack displays 12 artifact cells per page, with search, ownership/missing selection, slot, rarity, set and sort controls. Do not render 84 image cards at once. Preserve filters and selected item across mutations. Make empty, no-results, guest, offline, loading and error states explicit. Do not invent ownership or fill empty slots with example items. Search must retain input focus and caret.

The inspector shows a large item image, name, rarity, equipment slot, every effect (including negative tradeoffs), set membership, and comparison with the actual replaced equipment. Owned artifacts can be equipped or removed; missing items can be crafted only when the server confirms the unlock tier and sufficient Dust. Show the exact price and resulting balance before confirming a craft. Ring replacement must be explicit. Preview does not change live ownership or saved equipment until the server acknowledges the mutation.

Show the current army bonuses and meaningful comparison changes below the equipment area. Range remains additive tiles for the current rules. Explain that changes affect the next new defense; an existing saved defense retains its frozen equipment and legacy effect version.

At narrower tablet widths, retain the silhouette and backpack as two columns and move the inspector below as a full-width panel. On small screens stack panels. Keep all ten slots readable and touchable without horizontal page overflow.

## Skills

Keep a compact three-slot equipped-loadout band and an explicit Save Loadout action. Retain the existing maximum of three skills, permanent purchases, rank gates, medal prices, and per-run frozen skill loadout. Selecting a skill is separate from purchasing or equipping it.

Show a two-column paginated catalog and an adjacent selected-skill detail. Support All, Available and Equipped filters. Sort currently purchasable skills first, then owned, then medal-shortfall, then level-locked. Each card includes its matching meaningful icon, a concise current effect, owned I/II/III pips and equipped state. Level-locked cards use muted art and a prominent exact `Unlock at Level N` label, without redundant `Rank locked` badges.

The selected detail shows the actual effect, activation CP/duration separately from purchase cost, all three permanent ranks, owned/current-next/future-locked states, exact required military levels, price and balance, and clear upgrade and equip actions. A future rank must never appear purchasable before the preceding rank or level requirement is met. All 11 current skills remain available through filters/pagination.

## Chests

Use a five-tier vertical selector with a geometric chest icon, tier name, ready count and after-battle count. Show one large selected chest in the center. Show Open Chest and Open 5, disabled according to verified count, online state and pending mutation. Do not open a chest by selecting its tier.

The right panel displays the selected tier's actual rarity weights, draw count, base Dust and current guarantee counter at all times. Distinguish the base chance from the guarantee. Use the current rules, including tier II Rare every 3 and tier III Epic every 7; do not silently change pity counters. Show possible rewards as examples, not promised drops. Explain duplicate conversion and the new-item preference accurately.

Generate all five closed and five open chest images, with increasing quality and a consistent geometric style. Rewards show one clearly labeled card per actual receipt item, rarity, new/duplicate state, Dust, and set completion. Provide a skip animation action and reduced-motion support. Reopening the last receipt must not grant rewards again. Offline and unverified battle rewards remain visible without enabling invalid actions.

## Sets

Use a compact sidebar listing all 11 sets grouped or filtered by Rare, Epic and Legendary. The detail area shows one selected set, not eleven long stacked banners. Include rarity, description, separate collected and equipped counts, and every constituent item with owned/missing/equipped state. Use the new item illustrations as meaningful set emblems.

Show the exact threshold track for the selected set: 2 for a two-piece set; 2/4 for four pieces; 2/4/6 for six; 2/4/6/8/10 for Legendary sets. Explain the next inactive threshold and show full cumulative effects including all individual pieces. Ownership alone does not activate set bonuses.

Allow `Equip N owned pieces` after previewing which existing pieces are replaced and which thresholds change. Validate ownership on the backend, preserve non-conflicting equipment, handle both ring positions deterministically, and keep the existing complete-set operation compatible. If nothing is owned the action is disabled. A View Missing action opens the backpack with that set and missing ownership filter. Never fabricate missing pieces or delete displaced artifacts.

## Artwork and source records

Generate each artifact as a separate transparent PNG, then derive a compact 512 px WebP runtime copy. Reuse the ten individually approved geometric samples. Match the defenders: chunky low-poly geometry, broad flat facets, matte materials, clear silhouette, restrained highlights, no painterly microtexture or intricate filigree. Keep appearance recognition consistent across slots, backpack, inspector, receipts and gallery.

Create one transparent featureless faceted silhouette. Preserve originals, exact generation prompts, hashes and source mapping locally. Record generated assets as agent-reviewed proposals used under the approved style direction; do not falsely claim separate human approval for every image. Keep the rejected icon proposal only as a rejected design record, never a runtime dependency.

## Loading, cleanup and release

Use explicit runtime asset reachability instead of copying every historic UI folder. Remove obsolete runtime artifact pictures, old complete-set portraits and replaced skill landscapes once all live references are migrated. Preserve source artwork, approved originals, recorded prompts/reviews, local 3D models, regression fixtures, runtime dependencies and player records. Do not rewrite ordinary Git history.

Only the current 0.8.0 runtime release is maintained. Remove obsolete local release packages and previous-version UI controls after verifying their absolute paths and live dependencies. Do not upload gallery source, original artwork packages or local model binaries. Report any hosting history that cannot be deleted through available hosting capabilities instead of claiming it was removed.

Use lazy images, explicit dimensions, a 12-card backpack page and single selected-set rendering. Measure runtime package bytes before/after and verify actual initial and Commander image requests separately. Do not claim that deleting an unused local file alone speeds first-page loading.

## Required verification and acceptance

1. Unit/integration checks for search/filter/page boundaries, all 84 IDs, all 11 sets, empty/offline states, distinct rings, partial-set replacement, server ownership enforcement, idempotent chest receipts, unchanged pity and legacy saved-run effects.
2. Browser inspection at 1366×1024 landscape and 1024×1366 portrait, with representative long names, all rarities, full Legendary equipment, empty account, low-level locks and higher-level purchased skills. No horizontal page overflow, clipped buttons, overlapping frames or invisible modal actions.
3. Check keyboard focus, escape/close behavior, input caret preservation, reduced motion and 44 px touch targets. Selected tabs, rarity, ownership and locks must be conveyed by text as well as color.
4. Verify every runtime image exists and decodes, gallery remains English and loopback-only, and no gallery or original PNG package enters production.
5. Run the relevant regression suite and production build; publish 0.8.0 only after checks pass. Preserve Google sign-in environment and database migrations. Confirm the public deployed release metadata and game bundle agree.
