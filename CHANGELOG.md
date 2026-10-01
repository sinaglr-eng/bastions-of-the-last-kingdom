# Releases

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
