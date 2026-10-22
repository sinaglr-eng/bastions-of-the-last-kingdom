# Approved defeat scenes — 0.4.9 — October 22, 2026

The user approved all ten previously delivered scene candidates with the statement **“Schvaluji sceny”**. This is the original Czech approval evidence; current gallery copy remains English. The [dated approval record](../output/design/approved-defeat-v049-20261022/approval.json) and [approved runtime manifest](../public/assets/ui/results/v049/manifest.json) identify each accepted file and its original provenance.

## Runtime behavior

All ten defeat scenes approved by the user on October 22 are now included. The defeat pool contains thirteen images: the three previous approved scenes plus the ten new compositions. Every scene appears once before another cycle, with no immediate repeat at the cycle boundary; reopening the same ended run keeps its image. Victory scenes and seeded gameplay remain unchanged. Only the selected outcome image loads when results open.

The selector algorithm remains the 0.4.8 implementation. This release extends only its defeat scene data and current presentation revision. No simulation, damage, timing, targeting, progression, statistics, audio, unit models or PBR material source is edited. New scenes load through the existing single result-image element; the game does not eagerly download the full pool.

## Approval and source preservation

Ten PNGs totaling **23,356,698 bytes**, each **1,672 × 941**, are copied without pixel edits to the new `public/assets/ui/results/v049/` namespace. Each SHA-256 matches its corresponding approved candidate. All original prompts, character reference hashes, source generation paths and technical review strings are retained verbatim. The manifest labels the old pending review as historical and records the later human approval separately.

The original [0.4.8 candidate manifest](../output/design/followup-v048-20261021/art-review/manifest.json), PNGs, gallery and review records remain byte-identical historical evidence. The new English [approved gallery](../output/design/approved-defeat-v049-20261022/index.html) shows current approval and integration status. The original three defeat scenes and three victory scenes remain exact original assets.

## Verification and publication

The [local validation](../output/design/approved-defeat-v049-20261022/local-validation-final.json) passes **1,772 of 1,772 tests** and the **213-module** production build, with all **534 source files** and **12 metadata files** stable. The actual built distribution passes all **276 injected GET/hash fixture checks**; this local smoke is separate from public deployment verification. A [native browser check](../output/design/approved-defeat-v049-20261022/local-browser-qa.json) reaches a genuine Sandbox defeat, loads a newly approved 1,672 × 941 image and retains it after Inspect battlefield → Results. The Developer run is excluded from statistics; its local statistics-endpoint warning is recorded without claiming endpoint availability.

Published [0.4.9](https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/?release=0.4.9) from [`58630419d3fe9e8a90d0b6be91f99c250dc2c3d7`](https://github.com/sinaglr-eng/bastions-of-the-last-kingdom/commit/58630419d3fe9e8a90d0b6be91f99c250dc2c3d7) through successful [Pages CI](https://github.com/sinaglr-eng/bastions-of-the-last-kingdom/actions/runs/39723343919). All **1,772 tests**, the **213-module** build and **276 public GET/hash checks** pass, including all ten exact approved PNGs, the approval manifest, five compiled entries and all 54 unchanged enemy GLBs. Native public browser review confirms the result screen. Release tag: `v0.4.9`.
