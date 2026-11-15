# Account progression artwork

The approved alliance identity combines the Human lion, Dwarven anvil and Elven leaves within one forged crest. The original approved logo is retained byte for byte as `alliance-logo-original.png`. Its WebP counterpart changes delivery format only. SVG variants provide optically simplified, resolution-independent small, monochrome and dark-background presentations. They contain actual vector geometry, never an embedded PNG.

The fifteen rank badges reproduce the approved concept's motif order: wheat, pitchfork, single chevron, helmet, crossed pikes, star, three chevrons, silver star, two silver stars, three golden stars, eagle, fortress, three golden stars on gold, crossed marshal batons, and royal crown. Rank names and levels must be rendered in HTML, not baked into the badge.

Sources and asset paths are recorded in `manifest.json`. No new champion illustrations or outcome scene replacements were generated. Existing faction-specific result scenes remain the approved source. Original prompts remain preserved at `artifacts/alliance-progression-brief/art-prompts.json`.

Use `alliance-logo-original.webp` as the main horizontal presentation on parchment. Use the light vector wordmark on dark backgrounds and the compact crest for the HUD/mobile. Keep a clear area around the mark; full SVG variants include approximately 12% of the crest height as safe area. Monochrome SVG is gold by default and supports recoloring when embedded inline via currentColor.

Badges have a transparent 256×240 viewBox and support 48px display and 160px promotion presentation. Their motifs and silhouettes differ, including for users who cannot distinguish the palette. All fifteen are common to the three factions.

