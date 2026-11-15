# Account progression artwork

The approved alliance identity combines the Human lion, Dwarven anvil and Elven leaves within one forged crest. The original approved logo is retained byte for byte as `alliance-logo-original.png`. Its WebP counterpart changes delivery format only. SVG variants provide optically simplified, resolution-independent small, monochrome and dark-background presentations. They contain actual vector geometry, never an embedded PNG.

The fifteen rank badges reproduce the approved concept's motif order: wheat, pitchfork, single chevron, helmet, crossed pikes, star, three chevrons, silver star, two silver stars, three golden stars, eagle, fortress, three golden stars on gold, crossed marshal batons, and royal crown. Rank names and levels must be rendered in HTML, not baked into the badge. The default runtime images are now separately generated painterly transparent WebP badges, visually reviewed against the approved board. They preserve its sculpted metallic materials, wood grain and cloth detail; the vector versions remain optional fallbacks.

Sources and asset paths are recorded in `manifest.json`. No new champion illustrations or outcome scene replacements were generated. Existing faction-specific result scenes remain the approved source. Original prompts remain preserved at `artifacts/alliance-progression-brief/art-prompts.json`.

Use `alliance-logo-original.webp` as the main horizontal presentation on parchment. Use the light vector wordmark on dark backgrounds and the compact crest for the HUD/mobile. Keep a clear area around the mark; full SVG variants include approximately 12% of the crest height as safe area. Monochrome SVG is gold by default and supports recoloring when embedded inline via currentColor.

The runtime WebP badges are 512×512 with genuine transparency, suitable for 48px display, 112px account panels and 160px promotion presentation at high pixel density. Exact 1280×1280 generated PNG originals remain local at `artifacts/alliance-progression-brief/rank-originals/` and are outside the public runtime. Exact prompts, provenance, original SHA-256 identities and verification results are recorded in the manifests. The optional SVG fallback badges use a 256×240 viewBox. Motifs and silhouettes differ, including for users who cannot distinguish the palette. All fifteen are common to the three factions.

