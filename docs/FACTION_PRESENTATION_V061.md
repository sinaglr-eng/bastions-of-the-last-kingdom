# Faction presentation 0.6.1

The faction chooser uses three wide battle illustrations. Humans are versatile, Dwarves focus on Physical damage and Elves focus on Magical damage. These descriptions do not change combat rules.

The Dwarf battlefield presentation multiplier is 1.75, applied once to the selected faction's own actors before the existing battlefield scale. Shared Lady Claire retains her original scale. Immutable V3 models and animation data remain unchanged.

Recruit codes occupy a dedicated header row. Portraits, names and damage labels have separate rows. Mystery cards retain their existing layout.

The original scene files and the built-in ImageGen production prompt set are in [the asset manifest](../public/assets/ui/faction-scenes-v061/manifest.json). The 258 portrait bindings comprise 71 exact pre-existing gallery RGBA images and 187 profiles extracted from 66 built-in ImageGen background-removal results. AI can resample fine details; these are delivery derivatives, not new gallery approval records. The source plan, exact edit prompts, full AI outputs and output hashes are retained under output/releases/v0.6.1/. Packing performs only profile-frame extraction, transparent-margin trimming and size reduction. Historical V3 render portraits remain in source but are excluded from the published runtime.

Reference portraits remain tied to each exact gallery faction, family and rank; gallery originals, decisions and source history remain local and unchanged.

Browser verification was waived by the user. Model geometry and interaction logic are verified by automated checks.

Local validation: 1,947 tests pass; the 214-module production build succeeds. All 258 output PNGs have verified alpha, source identity and hashes. The entire faction registry excluding only portrait URLs retains SHA-256 a10426ebf0df5ae245ebf0cfec951c8b8750aec23d13606526070db929d32e92.
