# Forged Alliances TD — 0.5.1

## Requested changes

| Request | Result |
| --- | --- |
| Recipes and Enemy Waves should look like buttons. | Those two header controls have explicit ivory/gold surfaces, borders, bevels and hover/pressed/focus states. Their touch targets remain at least 44 pixels high. |
| Potential combinations must always remain expanded. | Replaces its outer details/summary control with a permanent heading and list. Individual recipe controls remain independent. |
| Reduce the selected 50% recovery to 25% of missing HP. | Changes wave 49 only. Its recovery remains on the existing four-second clock and healing block still prevents pulses. Waves 32 and 43 retain 50%. |
| Rename the game and design a new logo. | Forged Alliances TD uses an original gold/silver linked-forge SVG emblem, serif wordmark and matching favicon. Browser titles, the header and local server display the new name. The subsequent clarification identifies “banner” as the logo; no illustrative loading background is included. |
| Correct strange characters after the loading text. | The initial HTML now uses `Raising the banners&#8230;`, which displays a real ellipsis without a broken UTF-8 sequence. The wordmark is available before the game JavaScript starts. |
| Black enemies on iPad in waves 44 and 45. | Removes a measured source of extreme per-invader geometry duplication. Actual physical Safari black rendering has not been reproduced here; see the evidence and limits below. |

## Late-wave resource correction

The existing static batching path merged compatible original surfaces independently for each imported actor. Wave 44 has a large original model. For its actual 29 invaders, the formerly duplicated static vertex/index attribute category totals **848,641,152 bytes**. The corrected path keeps exactly **seven shared immutable geometries totaling 29,263,488 bytes**, saving **819,377,664 bytes (96.55%)** in that category. Each actor still has its own transforms and deforming buffers. This is an exact buffer inventory, not a device-memory or FPS measurement.

Sharing is scoped to one decoded template generation and requires matching source geometry, layout, material and local transforms. Borrowers retain references until the last living figure, preview or corpse releases them. Only the last release disposes the shared batch. A reloaded template has a distinct generation. Original source geometry, PNG bindings, PBR materials, motion channels, shadows, resolution and simulation remain unchanged.

Regression checks compare every posed vertex, normal, world transform and material against the previous independently batched path for waves 44 and 45. Freeze and corpse motion remain independent. Tests cover scope/material/transform isolation, multiple identical groups within one actor, repeated disposal, survivor safety and cleanup back to zero. Developer canvas diagnostics expose the shared static buffer inventory without changing combat or rendering quality.

This reduces a concrete memory amplification that can contribute to pressure on an iPad. It does **not** establish Safari's exact driver/context failure cause or certify the issue on a physical device. Previous texture-borrower and visual-alias protections remain in place.

## Identity and preservation

The [brand manifest](../public/assets/branding/forged-alliances-v1/manifest.json) identifies exact original SVG files and their authorship. The linked forge/anvil emblem is newly authored vector artwork; the wordmark is scalable text and vector geometry. It is implemented under the user's request; a separate final visual approval is not invented. A generated illustrative scene was discarded following the user's clarification and is not shipped.

Existing URLs, browser storage keys, statistics API, retained scores and version-based leaderboards remain compatible. The active wave adapter changes only wave 49's recovery fraction; archived source definitions and other enemies remain intact. No original unit image, audio file, model binary or material source is edited. The preserved 0.5.0 archives and stable tag are untouched.

The canonical design gallery remains local-only in its existing source directory. This game patch creates no additional maintained gallery, uploads no gallery updates or new 3D model binaries, and does not run historical gallery generators over newer source decisions.

<!-- V051_GATES_PENDING -->
