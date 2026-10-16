# UI portrait sources and unchanged game appearance

The user explicitly limits this release to UI. The battlefield's defender and enemy models, map/scenery, equipment, proportions, material colors, camera presentation, movement, attacks, auras and combat effects retain their current approved appearance. Generated UI concepts are layout references and may not supply replacement art.

## Required portrait medium

All in-game defender/enemy preview pictures must use the **original approved geometric illustration pixels used as model-authoring references**. Do not use Blender renders, GLB/WebGL screenshots, live model canvases, the existing model-render portrait PNGs, or newly generated character images. This changes the source of 2D UI previews only; it does not authorize remodeling the subject or regenerating a gallery.

The same per-identity source applies across draft cards, selected-unit inspector, displayed-rank preview, recipe rows and ingredients, pinned plans, combination result pictures, UI map portrait badges, current/next wave notes, boss portraits, enemy inspection and wave atlas entries. Existing wall imagery and non-character icons can remain. A separately accessed 3D Royal atelier/model inspection tool is outside this game-UI redesign and must not be rewritten to manufacture the new portraits.

## Exact source mapping

[PORTRAIT_SOURCES.json](PORTRAIT_SOURCES.json) has 136 records with stable ID, family/rank, English name, verified source path, copied raster path, source hash, current authoring provenance and proposed destination. There are 107 distinct original PNGs: multiple V8 champions share a multi-subject concept board. Do not display that whole board as a portrait or assume every champion source is a six-view sheet.

Source evidence comes from `public/assets/geometric/source-manifest.json`, the current defender/champion reconstruction metadata and `public/assets/geometric/geometric-enemies.json`. The copied `reference-art/<sha256>.png` files are byte-identical original references. Hash identity, rather than an obsolete absolute worktree path, establishes which file is used.

Ninety-four current-model source hashes match the latest `public/geometric-modeling-references-v2/approved/` alias. Forty-two do not: all 38 V8 champion authoring concepts and host_03, host_28, host_45, host_50. Their current source artwork is still present and verified. The champion references are published under `public/assets/geometric/reconstruction-references/champions/`; the four enemy references resolve to their earlier approved geometric turnarounds. The mapping preserves the later gallery alias for comparison and explicitly records the mismatch. Do not choose by folder recency, copy a historical absolute path blindly or change a model to resolve this difference.

If another chat legitimately updates an approved model/reference before implementation, compare the new current model's source metadata and reconcile only that identity. Never silently fall back to another character, rank, model render or unrelated old artwork.

## Future crop preparation

The originals are supplied unmodified; portrait crops are an implementation deliverable after authorization. A deterministic crop or direct clipped display of original pixels is allowed. Generative repainting, mirroring, altered anatomy, color replacement or model rendering is not.

For a six-view sheet prefer its labelled FRONT or 3/4 FRONT panel, choosing a readable complete silhouette. Remove sheet headings/other panels through a crop, not by redrawing. Keep face, equipment, mounts, wings and identifying details; use contain fitting and a consistent paper background without stretching. The source frame may need a non-square aspect to preserve long equipment. For a multi-champion board select only the exact named subject. Lady Claire and other exceptional sheet layouts need their own manually inspected frame. Do not apply a universal 3-by-2 crop to a concept board.

Each final UI image requires a recorded crop entry: stable identity; source SHA-256; pixel rectangle inside that source; chosen view/panel; output path/dimensions/hash; reviewer notes that the identity and complete silhouette are correct. Crop all 136 mappings, check duplicate-sheet subjects separately, and include a contact sheet or English review gallery for visual QA. Existing originals stay unchanged. A missing/failed image shows a neutral labelled unavailable/loading state and retry if appropriate, never another identity.

Suggested new runtime namespace: `public/assets/ui/reference-portraits/`. The planned path in the mapping is a specification, not a file produced by this handoff. Deduplicate immutable source inputs at build time but export per-identity crops so Elven Ranger and Elven King cannot resolve to the same whole board. Do not overwrite `public/assets/geometric/portraits/` or modify the approved GLB/source/gallery files. A new UI manifest maps game keys to the derived UI images and provenance.

## Resolver integration contract

Create a UI-only portrait catalogue/resolver when implementing, keeping stable family IDs and exact basic ranks. Use `siteUrl`/the established base-path helper so both `/` and a GitHub project path load correctly. Version the new UI images independently; do not bump model/scenery/audio art revisions. Fixed champions have one identity; all six basic ranks have their own identity. Enemy variants use the current authored enemy ID unless separate approved variant artwork actually exists.

Candidate cards, commitment actions and map badges always show the actual identity. A detail panel may show a compared rank's illustration if it is explicitly labelled as that preview; its candidate card and Keep action stay at the real rank. Loading/decoding must bind to identity, exact current URL and request generation. A late image for A must never flash while B or a different rank is selected. Hidden slots must not request their concealed image or reveal names through alt/ARIA/preload URLs. Generic unknown artwork is permitted.

Adapt the existing `ui/portrait-visibility.js` discipline to the new URL namespace. Its current matcher specifically targets old geometric portrait URLs and excludes enemy portraits; merely replacing `src` without adapting identity-safe visibility is incomplete. Cover rank/selection races for both defenders and enemies. Changing the audio or model loader is not necessary for decoding a static UI picture.

`game/render/world.js::makeThumbnails` currently fills unit image URLs from `game/release.js`; only its wall thumbnail is rendered in that function. The new game UI image map must stop consuming the old model-render portrait URLs without changing the battlefield renderer or character loaders. Map badges currently call `defenderPortrait` directly; route their picture lookup to the new UI source while preserving the existing badges, role symbols, collision placement and input code. Avoid globally replacing a helper used by unrelated 3D tools.

## Preservation and acceptance

The future UI change may add new derived image files and its own manifest. It may not alter approved `.glb`, `.blend`, source illustration bytes, model/scenery manifests, scales, rigs, animation or material/effect logic. Use the captured source baseline and a scoped diff to prove that. Preserve existing artwork galleries, review records and English language policy. Crop verification and UI URL wiring are distinct from validating the unchanged 3D scene.

No new production images, crop implementation or resolver is created in this preparation. All exact source inputs are saved so Master verze hry can perform those tasks after authorization.
