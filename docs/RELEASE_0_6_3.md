# Forged Alliances TD 0.6.3

Champion classifications are normalized to the existing Human presentation classes: Basic blue, Intermediate green, Advanced violet, TOP gold and Secret gold. This fixes upper-case Dwarf and Elf source classifications producing white auras and a missing class scale. The established Human Archangel ivory/gold exception is retained. Dwarf body enlargement is compensated in its aura so the class signal matches Human. Support glyphs and segmented halos sit outside the class rings; the selected support guide continues to identify the actual providers and strongest applicable bonuses.

Weapon effects now distinguish Dwarf rifles, Gatlings, cannonballs, mortar shells, grenades, axes, picks, drums, rune hammers, forge attacks and continuous nozzles, and Elf bows, storm spears, lunar spells, fangs, claws, living-tree strikes and dragon breath. The actual native weapon or mouth surface is sampled once per loaded template and follows its owning animated bone. The private actor reads those cached surface offsets during playback. Paired flamethrowers have two distinct native nozzle origins. Human palm lightning remains attached to its animated hand.

The renderer uses the current runtime cadence and magazine values, retiming only visual poses to the original V3 firing/reload segments. Haste affects the firing segment, while reload and spin-up retain their actual durations. The immutable V3 player, clips, GLBs and gallery sources are unchanged. Spark and Heat now expose their already-resolved ability activations through cosmetic events. No new damage, ammunition use, target selection or RNG call is introduced.

Continuous streams are coalesced by source, so one defender no longer repeatedly fills the detailed-effect budget. Extra actual channels receive bounded lightweight paths; effects respect simulation pause and visibility. Support and attack effects remain bounded for tablet rendering.

## Outcome art

There are 30 newly generated illustrations from the built-in image_gen tool, with exact prompts and original PNGs saved under output/releases/v0.6.3. Native-size WebP delivery copies preserve the complete composition. The public manifest is public/assets/ui/results/v063/manifest.json. Separate human approval of these new illustrations was not requested or recorded.

- Human: five new defeats and five new victories.
- Dwarves: five new defeats and five new victories.
- Elves: five new defeats and five new victories.

Historical default scenes remain preserved; each selected faction uses its own new illustrations. Each faction and outcome owns its own random bag. All scenes in a bag appear before repetition, and cycle boundaries avoid an immediate repeat. Reviewing an ended run keeps its existing scene. This presentation choice never reads the simulation RNG.

## Validation

All 258 exact approved native profiles are loaded and checked through real skins and animation samples by tools/verify-faction-rendering.mjs. The report includes model hashes, emitting joints, local surface offsets and posed world points. Regression tests check every champion class/color, every profile's support values against the actual support rules, visible support batches, every actual attacking profile's finite effect geometry, current reload/haste remapping, bounded continuous effects, faction-specific outcome selection and original/delivery hashes.

The complete test/build and public-deployment results are recorded under output/releases/v0.6.3. Browser and physical iPad checks remain explicitly waived by the user. Combat parameters, recipes and approved model bytes retain the 0.6.2 FR-001 baseline.
