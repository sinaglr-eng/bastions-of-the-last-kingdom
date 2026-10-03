# Rebuilding the 0.3.4 character assets

Work in a separate extracted copy of the release project. Authoring writes the
current GLB/portrait files and new `geometric-game-v5` outputs in that copy.
Never run a clean rebuild against historical V1–V4 output directories or the
working checkout used to archive those releases.

The archived baseline inputs are the three exact V4 manifests under
`output/design/geometric-game-v5/baseline-v4-manifests/`, every native `.blend`
they reference, and the immutable original six-view PNGs. The common author
imports `blender/scripts/geometric_game_common.py` and
`blender/scripts/geometric_character_proportions_v5.py`. Blender 5.2 is required.
The original raster files are reference evidence; they are never edited.
`baseline-v4-manifests/native-dependencies.json` enumerates all 136 exact native
paths and incoming SHA values. The individual champion stage additionally imports
`geometric_champion_creature_fit_v4.py` and `geometric_roster_builder.py`; retain
these scripts alongside `geometric_champion_shapes_v5.py` in the extracted copy.

From the extracted project root, first restore the three baseline manifests
into its writable `public/assets/geometric` directory. This PowerShell loop
copies files without modifying the archived inputs:

```powershell
foreach ($category in 'defenders','champions','enemies') {
  Copy-Item -LiteralPath "output/design/geometric-game-v5/baseline-v4-manifests/geometric-$category.json" -Destination "public/assets/geometric/geometric-$category.json"
}
$v5Blender = 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe'
```

Build all 48 basics from the immutable incoming manifest. `--baseline-manifest`
is read-only and its SHA is verified again after authoring. Output is written
to the current manifest unless `--output-manifest` selects a separate writable
path. Using the same input and output path with this option is rejected.

```powershell
& $v5Blender --background --python blender/scripts/author_geometric_proportions_v5.py -- --category defenders --baseline-manifest output/design/geometric-game-v5/baseline-v4-manifests/geometric-defenders.json --size 300
```

The nine individual champion changes must precede the shared head/cloak pass.
The first command reads the immutable baseline champion manifest and writes
the writable current champion manifest. The second reads that completed stage, preserving the new helmets,
shield, rider body connections, Nature body/eyes, closed mitre, gold sword
Archangel and complete Claire staff:

```powershell
& $v5Blender --background --python blender/scripts/geometric_champion_shapes_v5.py -- --baseline-manifest output/design/geometric-game-v5/baseline-v4-manifests/geometric-champions.json
& $v5Blender --background --python blender/scripts/author_geometric_proportions_v5.py -- --category champions --size 300
& $v5Blender --background --python blender/scripts/geometric_champion_shapes_v5.py -- --repair-bindings --only frostblade highking archangel
& $v5Blender --background --python blender/scripts/author_geometric_proportions_v5.py -- --category enemies --baseline-manifest output/design/geometric-game-v5/baseline-v4-manifests/geometric-enemies.json --size 300
```

Each normal rerun recognizes the native root's
`geometricProportionsV5Completed` flag and skips an already completed model.
The head and cloth operations also retain their own completed records, so a
normal rerun cannot shrink a head twice. Enemy and animal heads are excluded.
The two missed enemy garments are selected explicitly by their actual native
parts, including the Frost troll rear mane and phantom upper-chest bearing.

`--ids archer-1,mage-6` restricts a run. `--cloth-only` rebuilds only the selected
cloth while preserving the head pass. `--force` is reserved for basic defenders:
it reloads `blender/scenes/geometric-game-v1/defenders/{id}.blend`, the retained
V4 baseline scenes, and recomputes the whole basic pass. Do not use `--force`
as a blanket champion/enemy reset; use the immutable baseline manifest and
required champion stage order instead. `--mage-yoke-fit` is a targeted repair
option, not part of the clean rebuild sequence.

The geometry exports are checked by a Blender GLB roundtrip. Independent mesh
checks and deliberately corrupted geometry regressions run with:

```powershell
node tools/audit-geometric-proportions-v5.mjs
node --test tests/geometric-proportions-v5.test.mjs
```

`tools/compose_geometric_v5_reviews.py` creates paired six-view sheets from
the original PNG and manifest-resolved actual renders. It does not approve
images. Run it with Python and Pillow after all authoring stages:

```powershell
python tools/compose_geometric_v5_reviews.py --categories defenders,champions,enemies
```

A new rebuild needs a new actual visual inspection before writing new
source review records or packaging. `record_basic_six_review_v5.py` binds the
inspection performed for this archived release; it must not be treated as an
automatic approval tool for changed geometry. Blender timestamps may change
native file SHA values on a new run; geometry/render/source verification must
use newly computed bindings, without reusing old review hashes.
