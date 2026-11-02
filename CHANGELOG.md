# Current release

## 0.6.7 — FR-004 and iPad graphics repair — 2 November 2026

- Raises 80 Dwarf-native primary profiles by 50% and five machine champions by 100%.
- Extends all ten Physical immunity aura owners by 1.5 tiles, retaining their levels and damage fractions.
- Preserves fixed secondary damage, shared Flame Cone bases, Human/Elf/Claire combat, recipes, timing, models, original artwork, animations and player records.
- Repairs unbounded native model caching, overlapping decode spikes, private landmark texture cleanup and blind progress during graphics-context loss. The latest graphics repair passes 2,023 tests and a 229-module local build. [Details](docs/IPAD_WAVE24_FIX.md).
- FR-004 acceptance passes 2,008 tests and a 226-module local build, with 96 legal campaigns and 117 controlled cases recorded separately from numeric acceptance.
- Published and verified on 2 November 2026. Activation receipts are recorded under `output/releases/v0.6.7/`. This version replaces 0.6.6; no release tag, hosted gallery or backup is created.

- Adds guarded animation callbacks, paused drawing-error probes and bounded local error details. The reported Griffin Scout desktop freeze is not yet reproduced; direct placement, real crafting and wave-5 combat at 1x/5x passed in Chromium. All 2,028 regressions and 258 native profiles passed.

[Implementation and limitations](docs/FR004_IMPLEMENTATION.md).
