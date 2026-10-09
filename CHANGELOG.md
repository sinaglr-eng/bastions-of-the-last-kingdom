# Releases

## 0.3.25 — Boss Health and Touch Selection — 9 October 2026

- Moves Pause / Resume and speed immediately to the left of Enemy Waves.
- Repairs draft-card selection through accepted touch releases and a safe native-click fallback, retaining drag, multitouch, stale-card and keeper guards.
- Replaces boss-wave remaining-count headlines with a live HP bar and current / maximum health; approaching and concealed bosses remain separate.
- Preserves ordinary wave counts, existing scores, approved models, portraits, auras and audio.

## 0.3.24 — Combat Clarity and Recipe Filters — 9 October 2026

- Lowers the draft strip and keeps separate, usable Keep and Merge actions on mobile.
- Enlarges Pause / Resume and speed, placing them beside Enemy Waves.
- Shows current live and queued enemies, statistics, resistances and abilities in the unselected battle panel.
- Moves paid draft downgrade immediately beneath the portrait.
- Enlarges Baby Fire Dragon to ordinary character height and grows its three descendants, preserving classification auras and approved model bytes.
- Makes the Ranger recipe chain bypass every damage defense of flying enemies; ground and concealment rules remain.
- Corrects independent poison expiry and source attribution; all damaging abilities continue to feed actual peak DPS.
- Raises Nature Spirit poison to 96/s and Mother Nature poison to 1,898.4/s.
- Displays small red Crit! labels only when real critical damage lands.
- Adds combined damage, ability and resistance filters to Recipes, including basic rank rows and secondary damage.
- Records original score versions and preserves old online and local scores through updates.

See [Combat Clarity implementation rules](docs/COMBAT_CLARITY.md).

## 0.3.23 — Battlefield Interface Polish — 9 October 2026

- Removes the route tile count from the draft strip.
- Enlarges Future draw odds and removes the Construction mastery title and numeric mastery counter, preserving progression and probabilities.
- Expands each defender portrait to fill its draft card.
- Shows effective HP per enemy in the next-wave summary, qualifying differing possible profiles without inventing variant counts.
- Places the wave number directly in the bold Next wave N heading, with only the invader count below.
- Moves Potential combinations immediately after Compare ranks.
- Places global Pause / Resume and game speed controls beside TIME, removing duplicates from the sidebar, enemy inspection and draft area.
- Removes the Royal atelier link from the game header; the separate gallery remains available.
- Renames Warbands to Enemy Waves.
- Renames Grimoire to Recipes.
- Removes the projected completed-blueprint route from gameplay and the maze editor, preserving the actual enemy path, direction arrows and blueprint validation.

## 0.3.22 — Compact Battlefield Overviews — 8 October 2026

- Moves full enemy statistics, variants, army readiness, forecasts and current combat details into Warbands; completed waves are hidden with original wave numbering and campaign limits preserved.
- Adds a concise next-wave count, resistance and ability summary below peak DPS. Both map panels independently collapse into slim lines and keep their disclosure state through gameplay updates.
- Places Demolish wall immediately below the selected wall’s title, while preserving individual enemy inspection, draft controls, approved media and game rules.

## 0.3.21 — Approved Defender Display — 7 October 2026

- Uses only the exact approved V7 basic rank or V8 champion on the battlefield. Neutral loading markers replace temporary procedural characters; bounded recovery and an explicit Retry control recover failed appearances.
- Clears previous Atelier models immediately and displays defender portraits only after their current source decodes, preventing stale model or miniature flashes.
- Preserves final-choice voice lines when a wave begins, including pending downloads and playback at accelerated combat speed. Original assets, classification sizes and auras, and gameplay rules remain unchanged.

## 0.3.20 — Final Defender Selection Voices — 7 October 2026

- Plays one allied voice line only after a successful final keep, downgrade-and-keep, rank merge or champion recipe, using the resulting defender identity.
- Keeps candidate placement, inspections, previews, rerolls, moves and inactive reservations silent. Duplicate confirmations cannot restart a committed line.
- Preserves original recordings, synthesized build and combat sounds, classification size and auras, and gameplay rules.

## 0.3.19 — Champion Classification Scale — 7 October 2026

- Adds a uniform 10% size increase between champion classifications: Basic 1.0×, Intermediate 1.1×, Advanced 1.21×, TOP 1.331× and Secret 1.4641× over each model's existing presentation size.
- Preserves classification aura colors, the enhanced Secret and divine effects, and ordinary rank signals. Auras follow the scaled actors in the battlefield and Royal atelier.
- Keeps approved source models, native relative proportions, ordinary defender rank sizes, enemies, audio and combat statistics unchanged.

## 0.3.18 — Reconstructed Defenders and Allied Voices — 7 October 2026

- Integrates the approved 48 basic defender models from V7 and 38 champion models from V8, with matching portraits and independent art cache revisions.
- Adapts native skeletons and static champion assemblies to gameplay presentation while preserving the exported source models and combat rules.
- Adds 92 existing ElevenLabs v4 recordings: two English lines per allied identity, chosen randomly on selection or champion creation, with mute and overlap control.

## 0.3.17 — Direct Defender Draft — 5 October 2026

- Shows the five defender slots immediately at the start of each construction round, removing the bottom wave-preview section and its opening step.
- Keeps next-wave intelligence in the sidebar, with unchanged placement-first reveals, fixed-position Reserve and Command Point actions.

## 0.3.16 — Wave Preview and Enemy Intelligence — 5 October 2026

- Adds a preview before every defender draft, with actual enemy quantities, portraits, deduplicated primary threats and optional detailed stats. Intelligence remains accessible while drafting, keeping, merging, crafting and preparing.
- Provides partial information for the following wave and progressively reveals an approaching boss: marker, identity, key traits, then full immediate preview.
- Evaluates active army responses using real rank stats, targeting, damage types and abilities, including immunities and random variant possibilities. WEAK, FAIR, GOOD and STRONG describe available capabilities without predicting victory or choosing a defender.
- Caches enemy analyses and composition readiness, preserving seeded enemy rolls, fixed-position Reserve, Command Point actions, combat balance, art and gallery content. Preview and readiness settings use the central balance configuration.

## 0.3.15 — Controlled RNG and Command Points — 5 October 2026

- Adds run-local Command Points: 3 at the start and 5 for each killed boss, with immediate HUD updates and duplicate-death protection.
- Allows one 1-CP reroll after all five placements, using the existing generator and preserving a returning reserved defender. Reserve costs 1 CP and leaves one defender inactive on its fixed tile, blocking the ground route without attacks or support. It returns already placed as Slot 1 among the next five choices, with four new placements, and must be paid for again to continue.
- Adds a 2-CP Move between waves: choose a highlighted retained defender, then an existing castle wall. Their positions exchange while the maze, identity and damage records remain intact; invalid choices and cancellation spend nothing.
- Preserves existing rank probabilities, gold, recipes, enemy abilities and art. Costs and rewards use the central balance configuration.

## 0.3.14 — Elapsed time and wave mastery — 5 October 2026

- Adds a total real-time clock from the start of each run, including construction and pauses. Combat speed does not change it; victory or defeat freezes it, and run statistics, owner reports and exports retain the same duration.
- Advances Construction mastery with wave progression, reaching its maximum before construction for wave 25. Existing draw weights, the 20% Royal V cap and merge-only Mythic VI are preserved; Kingdom XP continues to unlock champion recipes.
- Removes the Kingdom level and XP from the top bar. Separates the enemy armor-reduction symbol used by Engineer hits and armor auras from friendly barricade disruption, with accurate legend descriptions.

## 0.3.13 — Peak tower DPS and enemy inspection — 5 October 2026

- Retains each defender’s highest actual five-game-second DPS window throughout the current wave and between waves, recording peaks at each hit and sorting by them. Peaks reset only when the next assault begins or a new game starts.
- Makes visible live invaders selectable with a click or tap on their model, including airborne figures above walls. A following selection ring identifies the inspected enemy, and the command panel shows individual remaining health, modified stats, defenses and active effects.
- Refreshes inspected health and effects during combat while keeping pause and speed controls available. Closing inspection, selecting a defender, death, departure or concealment returns the panel to normal commands.

## 0.3.12 — Live tower damage ranking — 5 October 2026

- Replaces the map title and selected-maze chip with a compact ranking of individual built defenders by actual damage per second over the last five game seconds. Direct damage, damage over time, auras and triggered attacks count after defenses and remaining-health caps; support-only defenders retain zero rows.
- Pausing freezes DPS; accelerated combat uses game time, so speed changes cannot inflate the meter. The completed wave keeps its final window until the next assault resets it, and each row selects its actual defender.
- Reduces Blood rush in wave 42 to twice normal speed, retaining its two-second burst and six-second cycle. All ability durations continue to use scaled combat time; the other Blood rush warbands retain five times speed.

## 0.3.11 — Mixed warbands and revised abilities — 4 October 2026

- Rank comparisons update Potential Combinations for the previewed tier while retaining actual owned/candidate ingredient progress and field commands.
- Raises rank V draw odds to 20% at maximum construction mastery with a gradual late-mastery curve; rank VI remains available through merging.
- Sets all regeneration to 5% maximum health per second, all disarms to five seconds, theft to 50 gold per escaped thief, blood rush to five times normal speed, and reactive armor to eight armor per hit up to fifteen stacks.
- Changes periodic soul recharge to restore 12% missing health every five seconds, including correct healing-block timing and health caps.
- Rolls variants independently for every invader, shows the actual mixed wave composition and remaining counts, gives Moon Clan Scrapwings cloak instead of reactive armor, and removes Zaruun's second active variant. Numerical descriptions follow the same combat rules.

## 0.3.10 — Textured earth and ruined watchtower — 4 October 2026

- Replaces translucent checkpoint ground with opaque, textured soil: varied earth grain, compacted scuffs, small stone flecks and irregular eroded edges, seated flush with the meadow.
- Completes checkpoint V as a broken watchtower with three connected stone sides, varied fractured crowns and scattered masonry, preserving its flag and walking passage.
- Enlarges the construction mastery odds label, colored distribution bar and rank percentages to use the space released by the removed notices, with layouts for smaller screens.

## 0.3.9 — Grounded checkpoints and clearer warbands — 4 October 2026

- Removes checkpoint slabs in favor of worn earth, retaining the five Roman flags and themed props. Crates stack in several tiers, the forward ruin reaches its flag, and the campfire flickers with rising embers. Two small guard towers replace the final bridge flag and platform.
- Adds staggered, physically raised limestone courses on both sides of the royal curtain walls, preserving the original editable castle scene and settlement geometry in a separate V9 scene.
- Gives moving route arrows opaque, slightly larger solid geometry. Makes Merge badges clickable on draw cards and above eligible units; stale or invalid actions cannot consume defenders.
- Increases every regeneration definition and variant by 50%, sets enemy disarm to three seconds, and shows numerical strength, range and timing for all abilities and variants in current/upcoming panels and the Warbands guide.
- Adds a body-covering magical shield aura with one sector per remaining blocked hit; its final sector shatters after the third hit, and the real eight-second refresh restores it.
- Keeps wave 1 unchanged and lowers wave 2/3 health from 61/80 to 52/68, preserving movement, counts, armor and spawn spacing. Removes the automatic mastery notice and next-odds XP line.

## 0.3.8 — Checkpoint stories and floating magic — 4 October 2026

- Gives checkpoint I–V distinct small scenes: a fallen soldier against a rock, stacked powder barrels, a semicircle of crates, a campfire and campsite, and a ruined forward wall. Roman flags and playable route positions remain intact; the route legend is removed.
- Replaces large backed enemy icons with small colored symbols and matching particles that orbit and change height. Simultaneous resistance layers remain separately visible, including magic immunity plus magic resistance. Cosmetic effects continue during pause while combat timing stays frozen.
- Adds hover and keyboard focus descriptions for every support symbol, including the actual 15% attack penalty from each nearby disrupted barricade.
- Enlarges concealment smoke to cover the last publicly visible whole body without following a hidden enemy.
- Refits Goblin Dust Dancers’ actual leg surfaces and joints to a narrower stance, preserving their hips, grounded soles, height, movement speed, and immutable V6 native source. The editable correction is saved separately in `blender/scenes/geometric-game-v7/enemies/host_09.blend`.

## 0.3.7 — Active defenses and battlefield signals — 4 October 2026

- Stronger moving route arrows sit above a quieter guide line. Stone and brass checkpoint markers carry physical Roman I–V on both sides of their flags.
- Special defenses use distinct, separated orbiting symbols, with the same shapes and colors in current and upcoming wave descriptions and the Warbands guide. Ordinary armor retains no defense aura.
- Every remaining direct-hit shield is visible from spawn, including native models with their own crystals. Consumed charges disappear and return only with the actual eight-second refresh. Resistance, reactive armor and healing symbols follow actual combat suppression and recovery.
- A short smoke cloud marks concealment at the last visible position, without following or exposing hidden invaders. Disarmed defenders carry a red broken sword and aura only during the active effect.
- More visible champion classification rings preserve Basic blue, Intermediate green, Advanced purple, TOP and Secret gold, and Archangel’s existing divine gold treatment.
- Preserves all 136 native character models, existing movement speeds, boss scale, combat balance and rank comparison controls.

## 0.3.6 — Readable battlefield and defender rank comparison — 4 October 2026

- Quieter route guides with smaller moving direction markers, and stone slab structure on defender platforms.
- Ordinary enemy armor no longer shows unexplained white shield symbols. Auras require actual special resistances or abilities, including the selected spawned variant.
- Slower, readable alternating ground steps while enemy travel speed and combat statistics stay unchanged.
- All five bosses are another 25% larger than their 0.3.5 presentation: 1.875× the original battlefield multiplier.
- Six rank previews in the selected basic defender's command panel compare portraits, stats and abilities. Actual keep, merge, downgrade, targeting and support still use the selected field unit.
- Preserves all 136 character models and original Blender scenes from 0.3.5.

## 0.3.5 — Dark Host source reconstruction — 3 October 2026

- Fresh comparisons of all fifty campaign enemies against their original six-view designs, with source-specific anatomy, fitted equipment and complete physical assemblies in new native scenes.
- Real openings for bell cracks, hollow undersides, masks, skeletal cages, armor recesses and the Deep Maw troll. Exported triangles are measured independently of authoring flags.
- Mounted riders, animal joints, wing anatomy and source equipment receive separate checks. The final wyvern uses two actual hind legs, with production flight, grounded gait and control-state regressions.
- Preserves all eighty-six 0.3.4 defender/champion assets, original concept images, all five completed archives and the previous route, camp and recommended-portrait behavior.
- Retains the 50% boss battlefield enlargement and checks each new boss's actual authored height against its 0.3.4 model.

Details: [Dark Host source reconstruction 0.3.5](docs/GEOMETRIC_GAME_V6.md).

## 0.3.4 — Draped characters and living battlefield — 3 October 2026

- Slightly smaller complete humanoid head assemblies for defenders, fitted folded cloaks, and a Mage redesign with consistent body proportions and a shared camera across all six ranks.
- Narrower and taller Knight helmet, one connected Kingslayer helmet, larger King shield, connected Dragonrider/Phoenix rider hips, recessed Nature Spirit eyes, and a closed Archbishop mitre.
- Taller gold and ivory Archangel with a divine sword and gold aura. Lady Claire moves her complete staff, including its upper ring, through preparation, release and return.
- Double-click or double-tap a valid recommended result portrait to forge the champion at that location. Moving gold route chevrons show travel direction; the planned route uses subdued grey dashes.
- Camp trees, covered firewood stores, weapon racks and a supply cart. Tent assemblies and guy ropes sit off the existing walking lanes.
- All bosses appear 50% larger than their previous battlefield presentation, including their complete physical equipment and attached effects.

Details: [Geometric models and battlefield 0.3.4](docs/GEOMETRIC_GAME_V5.md).

## 0.3.3 — Fitted characters and clear routes — 3 October 2026

- Conceals humanoid necks, separates Engineer's hammer from the head, straightens Cleric's staff and closes its mitre. Refines mounted animals, rider and wing placement, shaped hair, crossbow grips, Kingslayer's hands and integrated Paladin/Archangel helmets. Nature Spirit's face is part of its living wood and leaf body.
- Reduces battlefield defenders and enemies by another 20%, narrows masonry above the first course, and adds dressed corbelled fighting platforms. Wall height remains tied to the real second-wave enemy.
- Enlarges checkpoints by 15%. Distinguishes the current solid gold/cyan route from the completed blueprint's purple dashed ground route with independent controls. Final plans include off-plan structures and blocked plans show no invalid route.
- Adds actual-asset fit and production motion checks, source/model comparisons and a separate native archive. Preserves all three earlier archives and campaign statistics.

Details: [Geometric models and battlefield 0.3.3](docs/GEOMETRIC_GAME_V4.md).

## 0.3.2 — Source proportions and raised walls — 3 October 2026

- Centers 23 basic defenders' complete heads above their actual torsos, restores Engineer III–V's orange nape hair and gives Stormcaller natural fitted hair, six distinct lightning crowns and continuous lightning focuses.
- Reworks 12 champions against all six source views, especially broad dragon anatomy, swept wings, Griffin feathers and dwarf, BearKing's head, fitted horse muzzles/legs and seated riders. Dragonrider wears contrasting navy and steel armor.
- Gives Rimewatch and Royal Ranger separate front/rear crossbow grips that remain connected through recoil, connects Greenheart's staff and replaces Nature Spirit's human face with a luminous leaf mask.
- Raises the wall fighting deck to the real second-wave goblin's scaled head height; retained defenders stand above enemies. Tile width and brick proportions remain consistent.
- Adds the selected six-view source link to the Atelier and actual-vertex appearance regression checks, including deliberate failures. Keeps the older native archives and delivers current editables separately.
- Preserves all 50 enemy models, Lady Claire, statistics, abilities, auras and wave rules.

Details: [Geometric models 0.3.2](docs/GEOMETRIC_GAME_V3.md).

## 0.3.1 — Atelier and fitted models — 3 October 2026

- Adds all 50 campaign enemies to the Royal Atelier, with six camera views, actual walking/flight, rest, pause, speed, optional effects and GLB/portrait downloads. Selection URLs preserve the precise enemy or defender rank for appearance comments.
- Corrects bow orientation and grip motion, fitted hats/caps/hood trim, connected necks, gorgets and boots; adds Frost Warden I's white collar and reshapes Stormcaller hair and clothing.
- Reworks mounted horses, segmented dragon anatomy and seated riders, Thunderbird feathers and talons, Kingslayer's helmet and sword, and King's Ranger Guard's back-mounted shield.
- Reduces private battlefield unit scale to 88%, with scale-aware stride and grounded corpses. Combat stats, abilities, recipes and wave rules are retained.
- Adds actual surface-contact checks and fresh source comparisons; preserves the 0.3.0 native archive and delivers the corrected editables separately.

Details: [Geometric models 0.3.1](docs/GEOMETRIC_GAME_V2.md).

## 0.3.0 — Geometric Army — 3 October 2026

- Replaces all active unit visuals with 136 articulated geometric Blender models: 48 basic ranks, 38 champions and 50 enemies, with matching portraits and six review views per model.
- Repairs Soldier VI's closed helmet and removes concealed skin that protruded at the neck. Head coverings and the covered face share their motion pivot.
- Adds weapon-specific attacks, distance-based walking, flight and mounted motion. Fallen enemies remain grounded and opaque until the entire wave ends, including wave 50.
- Shows actual resistances, immunities, refraction, regeneration and both ends of real teleports. Existing friendly, hostile and support auras remain active; hidden enemies remain concealed.
- Lord Bernhard now appears as the hostile sorcerer on a wyvern in wave 50. His former friendly unit and recipe are excluded from current play. Other combat statistics and recipe behavior remain unchanged.
- Adds six selectable camera views and attack inspection to the Royal Atelier. Model geometry, imports, animation and combat events have separate verification; physical 1% precision and IoU 0.97 are not certified from unmeasured raster concepts.

Details: [Geometric game models and verification](docs/GEOMETRIC_GAME_V1.md).

## 0.2.8 · Art patch 9 — Royal Secret models — 2 October 2026

- Rebuilds Lady Claire with an original adult face, a subtle closed smile, a natural blonde hairline, a gold crown and an ivory/champagne gown. Her staff and three orbiting orbs retain their native articulation.
- Corrects Bernhard’s saddle contact and white horse proportions. The rider has a lavish fully closed helmet, silver/gold plate and gold accessories throughout.
- Strengthens only Secret champions’ cosmetic gold auras. Native V2 sources, front/back/side renders, portraits and loading fallbacks accompany the exports. Recipes, combat, game edition and stored statistics retain 0.2.8 behavior.

Reproduction and geometric checks: [Secret champion art V2](docs/SECRET_CHAMPION_ART_V2.md).

## 0.2.8 — Secret Champions — 1 October 2026

- Adds Lady Claire and Lord Bernhard as fixed Secret champions with gold auras, leaving the 37 ordinary champions intact. Claire requires Mage V + Druid V + Frost Warden V; Bernhard uses the requested Soldier V + Soldier IV + Soldier III. All three ingredients must be actual candidates from the same current round, after all five placements. Old retained units cannot complete these recipes.
- Authors both new characters in Blender 5.2 with editable scenes and rendered portraits. Claire has loose blonde hair below her shoulders, an open forehead, a smile, a dress, a staff and three orbiting orbs. Bernhard rides a white horse in radiant armor with his sword raised; the horse has four articulated legs. The roster now has 47 types, 87 defender variants and 39 fixed champion recipes.
- Implements Fantastic Miss Shrimp-inspired chain/fork attacks and five-combat-second Melancholy for Claire, plus Diamond Cullinan-inspired single-target poison, nearby range support and true strike for Bernhard. Source precedence, range conversion and the adapted fork shape are explicit in [Secret champion rules](docs/SECRET_CHAMPION_RULES.md). A moon symbol and countdown show Claire's active Melancholy; analytics record triggers and inactive combat time.
- Translates all fifty warband names, alternate names and descriptions into English. Enemy and wave combat fields retain their prior fingerprints. Living native models now move their actual wings and legs: bats flap strongly, heavier flying mounts use slower cycles, and grounded actors breathe and sway. Pause and reduced-motion settings preserve the expected rest behavior without changing shared templates.
- Adds scenery V7's 133 angled stakes and 22 thorn bushes in front of the western royal walls. The seven-meter bridge entrance, dry ground clearance and construction board remain clear, and all original V6 geometry is preserved. The camp keeps its V6 export.
- Makes full and family-only asset generation dispatch Secret models through their dedicated native authoring module, preserving unrelated manifest entries and avoiding generic human finalization. The statistics service recognizes the new champion families and edition without a schema reset.

Technical evidence and reproduction: [Secret Champions QA record](docs/SECRET_CHAMPIONS_V028.md).

## 0.2.7 — Dark Host — 1 October 2026

- Applies the exact fifty approved Czech warband names and appearance descriptions from the Dark Host design. Fifty main forms and nine alternate forms have new Blender 5.2 models, portraits and editable source scenes, including recognizable goblin, orc, troll, ogre, wolf-rider and flying-mount silhouettes.
- Preserves all enemy and wave gameplay fields beyond the five presentation fields. Health, armor, movement, abilities, variant rules, rewards and spawn timings retain their previous fingerprints; only wave 1 keeps its introductory difficulty.
- Adds five cosmetic enemy aura stages: none for waves 1–10, yellow for 11–20, red for 21–30, dark violet for 31–40, and black smoke with a visible violet edge for 41–50. Boss auras are stronger. Actual combat states drive shield, immunity, regeneration and reactive-armor cues without adding abilities or revealing concealed enemies.
- Retains each imported species' native proportions. Ghorun's three queen-wyvern forms span approximately three ordinary bat scouts or one-and-a-half wave-40 bosses. Explicit appearance IDs select the approved alternate silhouettes; the old balloon is retired. Fallen models rest on the terrain without modifying shared living instances.
- Restores Engineer's original name, six dwarf carpenter models, portraits and native source exactly. The six-rank human Kushek design remains preserved separately for future use, outside the playable roster and recipes.
- Extends scenery V6's western royal wall to the northern edge and southern river bank, keeping the bridge gate open and adding staffed frontier towers. Sheep and cattle scatter across larger irregular dry pastures; mixed woodland replaces repeated tree rows and fills landscape gaps. Actual geometry checks keep roofs, fields, fences and fortifications clear of water and the entire construction board.
- Removes rotating map arrows. Stable candidate numbers and complete camera-facing recipe portraits remain readable, with leaders connecting crowded portraits to their defenders.

Technical evidence and reproduction: [Dark Host V3 QA record](docs/DARK_HOST_V3.md).

## 0.2.6 — Guided Kingdoms — 1 October 2026

- Offers a seven-step tutorial on first opening, with a choice to skip and a replay button in Help. The guide highlights the live building controls, keeper selection, maze plans, mastery, recipes, defender details and wave button.
- Adds a separate persistent statistics backend with per-run and per-wave checkpoints, draft and keeper counts, enemy leaks, route length, damage, kills and sampled control/support time. Owner-only reports export JSON and CSV; failed uploads keep a bounded browser retry queue.
- Offers a named score submission after victory or defeat, a Top 10 and the current player's rank even outside it. Separate campaign/version rankings, server validation, bound SQL parameters and text-only rendering protect names and stored results from HTML injection. Statistics remain client-reported rather than verified competitive scores.
- Replaces Engineer with Kushek, a blonde human woman with a ponytail, green eyes, black bib overalls, rubber boots, a hammer and a ruler. Six T-shirt colors distinguish the basic ranks; existing recipes and discoveries retain their stable family ID.
- Refreshes already placed defenders as soon as their own GLB arrives, including the approved Master Druid. Map selection resolves the visible figure, and mouse/touch double activation keeps an eligible candidate after all five placements.
- Retains Commander's spiral, Diamond spiral and Chevron bastion; replaces the five earlier automatic layouts with Compact crossfire, Core gauntlet and Crown crossfire. Each new layout uses at most 150 wall cells and repeatedly routes enemies through central firing coverage. The planner reports measurable exposure and route statistics.
- Ties construction mastery automatically to Kingdom level, capped at 15, for future draws. Completed waves pay 50 gold, or 200 for a boss. Gold now pays only for a 200-gold candidate downgrade; wall demolition is free and paid champion enhancements are removed.
- Closes gaps in the royal town's western walls and places soldiers and archers on their walkways. An independent mountain stream powers the watermill and joins the main river farther south. Enlarged fields surround houses with foundations and roofs checked clear of water.
- Encloses the expanded orc camp with a complete wooden palisade and fills the adjoining landscape with trees and rocks. Both V5 settlements retain editable Blender scenes and leave the playable board unobstructed.

## 0.2.5 — Living Kingdoms — 1 October 2026

- Extends the royal settlement with connected streets, inhabitants, farmsteads, livestock pastures, a stone quarry and a river-fed watermill. The pale palace and slender spires take inspiration from Neuschwanstein; the castle now stands on the dry eastern bank, connected by a longer decorative bridge.
- Expands the orc territory with additional tents, wolf pens and cages, guarded caves and an elevated troll/ogre camp. Closely overlapping mountain ridges fill the surrounding valley gaps without occupying the build field.
- Returns construction mastery to a coordinated panel alongside the five recruit cards while retaining each candidate's Keep button and double-click/double-tap confirmation.
- Displays recipe dependencies as three ingredient branches with their nested champion recipes and exact basic recruits. Built and provisional stock share one allocation, so the same defender cannot satisfy several branches.
- Marks real allied haste, damage, range, true-strike and control-resistance effects on recipient platforms with separate colors and symbols. Enemy suppression and status markers follow current combat state, concealment and cleanup rules; approved gameplay values remain unchanged.
- Keeps river animation inside valid curve parameters and clamps frame time against negative startup deltas, preventing intermittent freezes during loading.

## 0.2.4 — Kingdoms in Motion — 1 October 2026

- Restores waves 2 and 3 to their original normal campaign difficulty, including HP, armor, movement and spawn spacing. Only wave 1 retains its introductory tuning; counts, rewards and waves 4–50 remain unchanged.
- Lets players keep a placed draft candidate by double-clicking or double-tapping its card. A separate Keep button stays directly beneath the selected card. Validation prevents stale cards, unrevealed draws, drags or multi-touch navigation from retaining a different defender.
- Places construction mastery in a horizontal bar above all five draw cards and moves the next-wave button to the top center of the map, visible only when defenses are ready.
- Rebuilds defender exports with real articulated limbs and equipment. Archers draw their bowstring, soldiers swing their sword or hammer, and casters raise glowing focuses and release magic waves from the weapon. Runtime joints animate cloned mesh hierarchies without changing shared source geometry or combat statistics.
- Expands the royal castle into a larger citadel and surrounding town with houses, workshops and farms. The orc settlement gains an outer encampment, campfires, seated inhabitants and guards. Denser woodland, rocks and layered terrain fill the surrounding landscape while leaving the playable field clear.

## 0.2.3 — Living Battlefield — 1 October 2026

- Surrounds the open board with layered hills, mountains, woodland and rock outcrops. Adds an original fortified orc settlement and a multi-towered royal castle, with editable Blender 5.2 source scenes. One decorative upcoming invader stands behind the camp gate; it never participates in combat or consumes random draws.
- Gives attacks distinct presentations: poisonous roots erupt beneath targets, dragons breathe flame, storm units cast lightning, warriors sweep spectral blades, siege weapons launch bolts or arcing charges, and casters release holy, frost and arcane spells. Defenders lean into their casts and releases; authored weapon pivots animate when present. Cosmetic effects have resource limits, cleanup and reduced-motion handling.
- Replaces generic bleeps with layered WebAudio sounds for different attacks, impacts, construction and deaths. Voices and event rates are bounded, sound unlocks only on interaction, and muting stops current voices.
- Makes unrevealed cloaked enemies fully invisible, including health bars and effects. Close active defenders, checkpoint beacons and detection towers share reveal coverage with the renderer; reacquired cloak rejects incoming hits and secondary target selection. Existing damage-over-time may continue without disclosing a hidden enemy's position.
- Compacts the five-draw strip, places construction mastery alongside it, adds a Keep button there and accepts a double tap on a selected eligible candidate. Dragging and multi-touch gestures cannot confirm a keeper.
- Adds previous/next recipe browsing and a return arrow to the pinned recipe. Potential-combination buttons show their breakdown directly in the sidebar. Recipes describe the champion and distinguish retained ingredients from candidates available this round; hidden draws are never counted or disclosed. Removes the requested sidebar explanation text.
- Verifies that physical and piercing attacks use armor, magical attacks use general and element-specific resistance, and pure damage bypasses both. Approved defender statistics and recipe definitions remain unchanged.

## 0.2.2 — Champion Codex — 1 October 2026

- Gives all 37 champions the same large animated classification aura: Basic blue, Intermediate green, Advanced purple and TOP gold. Ordinary basic defenders retain their rank appearance.
- Removes champion Ascension recipes and scaling. The game and Grimoire contain exactly the approved 37 fixed champion recipes; current-round basic merges and paid champion enhancements remain available.
- Uses Basic, Intermediate, Advanced and TOP consistently in recipe classifications, matching the wiki Towers table. Renames Mother Nature to Nature Spirit while preserving its stable ID, model and combat settings.
- Replaces opaque ability codes with readable descriptions and concrete effects. Champion cards show direct attack damage, attack DPS, attack interval and range, with continuous fire DPS separate from direct attacks.
- Pinned recipes recursively expand crafted ingredients into basic defender families and ranks, combine repeated requirements and account for already-owned component champions without counting the same stock twice.

## 0.2.1 — Champion Auras — 30 September 2026

- Uses the verified Gem TD Towers classifications for all 37 champions: Basic has no added aura; Intermediate, Advanced and TOP have progressively stronger animated visual auras in both the battlefield and the atelier. Combat abilities, numerical settings and recipes are unchanged.
- Engineer is now a stout dwarf with round spectacles, a small carpenter's hammer and a graduated measuring ruler, across all six ranks.
- Knight and Lionheart Champion have newly modeled closed helmets and more complete plate armor. Kingslayer replaces Kingslayer Arbalest with an original black-armored knight model. Paladin carries a warhammer; Mother Nature is a floating spirit with living foliage and luminous wisps.
- Updates the editable Blender 5.2 sources, GLBs and portraits, and versions the art URLs so returning players receive the revised models.

## 0.2.0 — Champion Edition — 30 September 2026

- Ships the approved eight basic classes and 37 champions, with the agreed English names and exact three-defender recipes. Engineer replaces the Runebreaker display name; stable family IDs preserve discoveries.
- Rebuilds all 37 champions in Blender 5.2: individually sculpted human and elven heroes, elemental casters, nature and holy characters, dragons and riders, royal beasts, golems and siege engines. Includes 37 editable Blender scenes, game GLBs and freshly rendered portraits. Organic anatomy uses fused smooth surfaces; meaningful equipment stays separate.
- Applies the approved champion mechanics and settings, including effect-spreading attacks, independent forked lightning, golem control and healing suppression, grouped blessings and Archangel's 25% response to nearby allied magical hits. All 48 basic family/rank pairs now appear in a recipe.
- Keeps every combination at three ingredients and preserves repeatable champion ascension. The 50-wave enemy settings are unchanged by this release.
- Updates the Royal atelier to 45 types / 85 variants, adds direct champion links, and versions model and portrait URLs to replace cached assets.
- Replaces the obsolete roster generator with validation of the approved JSON data, protecting agreed statistics and recipe topology.

Validation: 124 automated tests passed, including real Three.js loading of all 37 champion GLBs, 37 distinct geometric designs and the loaded catapult's articulated animation. Production build and local game/atelier browser checks passed. No physical iPad test was performed for this release.
