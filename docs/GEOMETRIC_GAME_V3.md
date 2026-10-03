# Geometric models 0.3.2

This edition responds to the second source comparison and the requested wall height. It preserves all 50 enemy models, Lady Claire and gameplay statistics. The Royal Atelier keeps both armies and adds a direct link to each original six-view PNG so appearance comments can refer to the source and the selected model.

## Model changes

Twenty-three basic defender forms have their actual complete skull, cap and hair centered above the torso. Engineer, Mage, Stormcaller and Cleric II–VI shared the same forward displacement. A shallow visible face inside a hood is distinguished from a full skull. Engineer III–V also regain their source orange nape hair.

Stormcaller has low fitted natural hair and a recognizable continuous lightning focus. Its six fitted crown ranks differ by physical tooth count, height, material and focus. II–III use gold lightning prongs on a darker silver band so they remain distinguishable from gray hair. These hair and crown changes explicitly follow the user's new request rather than the old quiff drawings.

Twelve champions are revised. Knight and Lionheart have fitted visors, wider horse cheeks, short muzzles, articulated muscle/fetlock/hoof transitions and shaped caparisons. The four dragons have broad wedge heads, short muzzles, fitted throat and belly plates, swept wing membranes, crouched segmented legs and curved tails. Baby Dragon has a cream underside and an elongated flame. Dragonrider's seated rider wears contrasting navy, steel, ivory and gold armor. Griffin's swept layered feather fans, eagle head, hooked beak, dense ruff and stocky dwarf follow the source. BearKing has a broad bear head, visible eyes above a short cream muzzle, wide dark nose and fitted green/gold equipment.

Rimewatch and Royal Ranger use a crossbow with distinct front support and rear trigger grips; both hands follow the stock through recoil. Greenheart's leaf and forks connect to its staff. Nature Spirit has a hollow leaf mask with luminous eyes instead of human skin. Royal Ranger's crossbow, the spirit's face and Dragonrider's contrasting armor are explicit requested overrides of the original PNG designs.

## Wall height

The fighting deck is 1.232575588 m above the board: the real second-wave goblin's 1.400654078 m head/ear extent multiplied by the existing 0.88 battlefield scale. Its tall spear is excluded from character height. Additional masonry courses raise the same tile-sized wall rather than stretching the bricks. Retained defenders stand on the fighting deck; diagonal platform stonework stays below their feet. Ordinary parapet merlons extend another 0.07 m above the deck.

## Verification and editables

Changed models require actual six-view comparisons. Technical checks independently use imported GLB vertices, whole-skull centers, low-hair bounds, physical crown teeth, concave lightning geometry, actual rider material colors, crossbow hand targets and source-first proportions for Baby Dragon, Griffin and BearKing. Regression tests deliberately restore displaced heads, missing crown geometry, a tall rear hair lock, a diamond-shaped bolt, an undersized dragon head and purple rider armor to demonstrate that these failures are caught.

Proportion ranges are derived from manually read original raster landmarks with recorded pixel uncertainty, before the creature export. Generated views have inconsistent perspective and no physical dimensions. These checks catch specified large deviations; they do not certify 1% precision, 0.97 IoU or the whole appearance. Surface contacts, protected head rays and runtime animation remain separate checks.

Unchanged scenes inherit their prior visual review only after GLB, native, portrait, source and six-render bytes are verified. Fresh source/model sheets, actual changed-model inspection records, native packed-reference audits, animation and contact reports are stored in `output/design/geometric-game-v3/`. Their current file hashes are verified before packaging.

The separate archive is `output/design/geometric-game-v3-complete.zip`. It contains all 136 current editable Blender scenes, GLB exports, portraits, source sheets, six-view renders, builders and review evidence. Both older complete archives remain unchanged. Publication verification checks all 136 models, 136 portraits, four manifests and both entry pages against the isolated release checkout.

Final isolated-release verification: 410/410 regression tests, 136/136 reopened native scenes, 5,258/5,258 runtime checks, 10,208 actual surface interfaces and 25,443 protected rays without failures. The 35 changed models have 210 newly compared source/model views; the 101 unchanged models retain explicitly inherited review after byte verification. The Pages-base production build passed. These counts apply to the frozen file hashes in `release-validation.json`.
