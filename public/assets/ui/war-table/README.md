# War Table interface artwork

Prepared for the approved Main Menu, Hall of Fame, Achievements, and General visual direction on 14 November 2026.

All fifteen WebP images were generated with the built-in image generation tool, then format-converted and downsampled without content editing. Exact generation prompts, reference paths, original output paths, dimensions, and delivered sizes are recorded in `generated-assets.json`. Original generation outputs remain untouched at their recorded paths.

## Assets

- `hall-backdrop.webp` is a 1800 × 600 panorama with empty podium fronts. Render all player data and crests as HTML. Podium centers are approximately 28.5%, 50%, and 71.5% of width. Do not crop this image independently of the overlaid data.
- `saved-defense.webp` is a 1000 × 667 map illustration with a quiet ivory left third for a live saved-game label. It contains no game state.
- The seven named skill images are 640 × 640 illustrations. Use the same files for catalog thumbnails, selected skill details, in-game controls, and leaderboard loadout symbols.
- `collection`, `mastery`, `campaign`, `streak`, `endless`, and `secret` are 640 × 640 milestone illustrations. The mastery shield intentionally has no baked rank text; the secret folio does not depict or reveal a secret champion.
- `medal.svg` has a 48 × 64 viewBox and matches the blue-ribbon, gold-star medal in the approved references.

Champion portraits must come from the current faction's explicit defender asset mapping, not these generated illustrations. Preserve the approved existing faction scenes at `assets/ui/faction-scenes-v062/crown-march.png`, `forge-march.png`, and `grove-march.png`.

The related scalable brand assets live at `assets/branding/forged-alliances-war-table/`. The combined wordmark includes the three-bastion emblem, title, and descriptor in a 640 × 160 viewBox. The standalone emblem is 220 × 160; favicon is 64 × 64.

## Typography

`fonts/fonts.css` declares locally hosted Source Sans 3 variable font weights 200–900, with Latin and Latin Extended character coverage. Source: Google Fonts distribution of Adobe Source Sans 3. License: SIL Open Font License 1.1, copied unchanged to `fonts/OFL.txt`. No external font requests are needed at runtime.

Raster assets have been visually inspected for correct subjects, absence of baked UI text, distinct skill identities, and consistency with the approved style.
