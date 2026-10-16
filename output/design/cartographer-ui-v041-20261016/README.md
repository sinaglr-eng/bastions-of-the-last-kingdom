# Cartographer 0.4.1 — Implementation evidence

[Open the concept/implementation gallery](index.html) to compare all eleven desktop concept states with actual local-game captures. Each pair clearly distinguishes the preserved concept reference from the implemented interface. The gallery is evidence for review, not an approval record. Its source references remain in the unchanged [original handoff](../../../docs/ui-cartographers-table-handoff-20261016/README.md).

The [implementation report](../../../docs/UI_CARTOGRAPHER_V041_20261016.md) explains the new physical book/folio treatment, maps all eleven concepts, and records behavior and preservation boundaries. Final source identity, build, full-suite, CI and public HTTP results belong to the release receipt when release verification is completed.

## Desktop concept mapping

All eleven desktop implementation captures use a **1,440 × 900** browser viewport.

| State | Actual implementation capture |
| --- | --- |
| 01 — Building | [01-building-desktop.jpg](01-building-desktop.jpg) |
| 02 — Choose keeper | [02-choose-keeper-desktop.jpg](02-choose-keeper-desktop.jpg) |
| 03 — Combination preview | [03-combination-preview-desktop.jpg](03-combination-preview-desktop.jpg) |
| 04 — Ready defender | [04-ready-defender-desktop.jpg](04-ready-defender-desktop.jpg) |
| 05 — Combat | [05-combat-desktop.jpg](05-combat-desktop.jpg) |
| 06 — Current wave | [06-current-wave-desktop.jpg](06-current-wave-desktop.jpg) |
| 07 — Future waves | [07-future-waves-desktop.jpg](07-future-waves-desktop.jpg) |
| 08 — Recipe catalog | [08-recipes-desktop.jpg](08-recipes-desktop.jpg) |
| 09 — Recipe navigation | [09-recipe-navigation-desktop.jpg](09-recipe-navigation-desktop.jpg) |
| 10 — Three combinations | [10-three-combinations-desktop.jpg](10-three-combinations-desktop.jpg) |
| 11 — Rank comparison | [11-rank-comparison-desktop.jpg](11-rank-comparison-desktop.jpg) |

The gallery reads these files directly. Later replacement of an implementation capture updates its comparison pair; original reference files are not rewritten.

## Responsive and input checks

The following checks were reported by the integrating browser reviewer. They are specific viewport/action checks, not a claim that every state was tested at every size.

| Browser viewport | Checked scope |
| --- | --- |
| 1,440 × 900 | All eleven concept states captured in the actual game. |
| 1,180 × 820 | Recipe book, combination preview, and single-click wall demolition. |
| 1,024 × 768 | Enemy-wave atlas. |
| 820 × 1,180 | Building layout. |
| 390 × 844 | Recipe book single-page layout. |
| 844 × 390 | Recipe book low-height layout; dialog remained within the viewport, and the Pin control remained fully visible. |

Recorded interaction checks include:

- Start wave 16 accepted a single click.
- Demolish wall accepted a single click at 1,180 × 820; [before](demolish-before-ipad.jpg) and [after](demolish-after-ipad.jpg) captures are retained.
- Keep Mage I accepted a single click while rank VI was being previewed; the actual kept unit remained rank I.
- The exact Lady Claire combination completed through the real Combine action.
- Pause and Current wave inspection worked in the actual game.
- Ordered recipe navigation proceeded from Kingslayer to King.

Responsive image files include [the iPad-sized recipe book](08-recipes-ipad.jpg), [combination preview](03-combination-preview-ipad.jpg), [wave atlas](07-future-waves-ipad.jpg), [phone recipe book](recipes-phone.jpg) and [low-height recipe book](recipes-low-height.jpg).

Physical iPad/Safari was **not tested**. These checks use a desktop browser at the listed viewport sizes; they do not certify mobile Safari, real touch hardware, every zoom/safe-area configuration or a complete eleven-state responsive matrix.

## Portrait and preservation evidence

- [Transparent portrait gallery](portraits/index.html), [pixel verification](portraits/pixel-verification.json), [visual review](portraits/visual-review.json) and [rebuild instructions](portraits/README.md): all 136 UI identities, real PNG alpha and exact retained RGB, with original sources/crops preserved.
- [Protected-file audit](preservation-audit.json): unchanged baseline core, renderer, data, backend, audio code, existing public assets and approved handoff; new cutouts remain separate derivatives.
- [Book/atlas code review](book-atlas-code-review.json) and [77 focused tests](book-atlas-focused-tests.txt): exact recipe/wave semantics, navigation, focus, filters, bookmark behavior and unchanged seeded state.
- `tests-initial-summary.json` and `tests-initial.log` are intermediate diagnostic evidence. A later passing checkpoint does not automatically certify subsequent source changes; use the final release receipt for authoritative validation.

The immutable `v0.3.31-stable` recovery tag, backup branch and verified offline archives remain available. See [rollback instructions](../../../docs/ROLLBACK_0.3.31.md). No browser capture in this directory changes that recovery point or the statistics database.
