# Releases

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
