# Bastions of the Last Kingdom

A single-player 3D fantasy tower-defense game for the browser. Build five mystery defenders, discover each on placement, retain one or combine matching ingredients, and use the rejected foundations to shape an enemy maze.

Current release: **0.3.7 · Active defenses and battlefield signals** — [release notes](CHANGELOG.md) · [enemy model and animation verification](docs/GEOMETRIC_GAME_V6.md).

## Play

[Play the public game](https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/) · [Royal atelier](https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/archer.html)

Node.js 22.15+ and pnpm are required for a local checkout. Run `pnpm install --frozen-lockfile` and `pnpm build` first. On Windows, double-click **START_GAME.cmd** to serve the production build at **http://127.0.0.1:4174/**. Keep its terminal open while playing. The launcher also recognizes the bundled Codex Node runtime when available.

For development:

```sh
pnpm install
pnpm dev
```

Open http://127.0.0.1:5173/. For a fresh production build: `pnpm build`, then `node tools/serve.mjs`. Do not open index.html directly with a file URL; browser modules and model loading need the local server. Models and portraits are bundled locally. The game needs no player account; a separate statistics service stores anonymous run data and optionally named scores. See [backend setup and reports](docs/STATISTICS_BACKEND.md).

The current board is an open 37 × 37 grid with five ordered checkpoints. Eight original defender classes each have six ranks; 38 exact three-defender recipes lead to 38 champions: the 37 ordinary forms, including a catapult, cannon and ballista, plus Secret champion Lady Claire. Lord Bernhard appears as the hostile sorcerer on a wyvern in wave 50. Champions have fixed forms and combat statistics. Their large cosmetic auras identify classification: Basic blue, Intermediate green, Advanced purple, TOP gold and Secret gold. A snowy valley, branched forests, flowing waterfall and winding river surround the unobstructed field; occasional clouds drift through the wide camera view. Checkpoints sit on the fifth tile from each edge. A continuous textured meadow blends the field into its surroundings without a frame. The campaign contains 50 orc warbands and five bosses; the Warbands guide lists their traits and counters. Only wave 1 has introductory health, armor, movement and spawn spacing. Waves 2 and 3 use their original normal difficulty: 61/80 HP, 1/8 armor, 2.21/2.37 movement speed and 0.6-second spawn intervals.

The **Royal atelier** link opens `/archer.html`: all 46 defender types (48 basic ranks and 38 champions) and all 50 campaign enemies. The army switch offers six camera views, defender attacks, enemy walking or flight, rest, pause, speed and optional effects. Selection URLs preserve the precise enemy or defender rank for appearance comments. Basic equipment advances from novice to master rather than changing color alone. Soldier progresses from a bare-headed recruit with a wooden spear through a helmet, sword, wooden shield and breastplate to a fully armored knight. All eight classes keep the existing blue, green, purple, ivory, gold and pale-gold cloth colors; every rank has its matching base ring, and only VI adds the golden body halo and orbiting motes. All 86 defender variants have portraits rendered by Blender. Engineer remains a short dwarf carpenter with a copper beard, work cap, apron, hammer and graduated ruler; goggles appear from rank III. His stable `runebreaker` family ID and `R` code retain the same abilities and recipes. The geometric manifests identify each of the 136 editable character scenes and its packed original six-view reference. The fifty current enemy scenes use `blender/scenes/geometric-game-v6/enemies/`; unchanged defenders and champions retain their exact 0.3.4 scene paths. Kushek's blonde human craftswoman design remains outside the playable roster in `public/assets/designs/kushek/`, with its editable `blender/scenes/kushek_design_v1.blend`. Each defender refreshes as soon as its own imported model finishes loading.

Rejected foundations form connected castle stone walls. Suggested maze offers the three supplied references — **Commander's spiral**, **Diamond spiral** and **Chevron bastion** — plus **Compact crossfire** (134 wall cells), **Core gauntlet** (143) and **Crown crossfire** (148). The new routes repeatedly cross the central battery; the planner reports path length, central passes and estimated time under central fire. These are full-layout measurements, not a guarantee for a partially built maze. Choose once with M: the panel closes and the selected cells stay fixed. M reopens it. Create or edit a blueprint by drawing/erasing on the map, then save it locally for future games. See [maze comparison](docs/MAZE_COMPARISON.md).

Seven connected mountain ridges, dense woodland and rock outcrops surround the open field. The royal palace takes inspiration from Neuschwanstein and stands entirely on the dry eastern bank. Scenery V7 extends the western defenses to the northern edge and southern river bank: seven connected wall sections, two frontier towers, thirteen archers and four soldiers. A dry defensive band in front of the western walls adds 133 angled wooden stakes and 22 thorn bushes, with a seven-meter opening for the bridge. These decorations leave gameplay unchanged. The town retains streets, residents, seven enlarged farm fields and a stone quarry; nine sheep and six cattle scatter naturally across larger irregular grazing areas. A separate narrow stream flows from the mountains through the watermill and joins the main river farther south. House foundations and roof edges stay clear of water. Mixed woodland fills gaps with varied tree sizes and headings: the town has 88 trees, and the camp perimeter 195 trees plus 49 rocks. The orc territory has a complete outer wooden palisade, tents, fires, seated orcs, guards, wolf pens and cages, a guarded cave and a mountain camp for trolls and ogres; one upcoming invader still waits behind the fortified gate. Both landmarks have editable Blender 5.2 scenes. The castle town exports 109,570 triangles in 41 mesh batches; the current camp exports 146,123 in 32. Its 22 complete tent assemblies and ropes sit off the ten walking lanes; eight additional trees, three covered firewood stores, two weapon racks and a supply cart enrich the original camp. Combat uses roots growing beneath enemies, dragon flame, lightning, spectral slashes, shaped spells and siege projectiles, with corresponding attack motions and sounds. Articulated arms draw bows, swing blades and lift glowing staffs; spell waves originate at their moving focus. Unrevealed cloaked enemies disappear completely; active nearby defenders, checkpoint beacons and detection towers reveal them for both the player and other defenders. Physical/piercing damage uses armor; magic uses general and elemental resistance; pure damage bypasses both.

Construction mastery occupies its own panel beside the compact five-draw strip. The selected candidate has its own Keep button; double-clicking or double-tapping its image also keeps it after all five draws have been placed. The next-wave button appears at the top center of the map when defenses are ready. The sidebar can browse all champion recipes with arrows, open a potential combination directly and return to the pinned recipe. Three ingredient branches show the intermediate champions and their nested recipes down to exact basic ranks. Ingredient progress marks retained defenders in green and available placed candidates separately in blue; unrevealed draws remain unknown.

Allied support effects mark the affected defenders' platforms with distinct colored symbols. Speed, damage, extended range, true strike and resistance to control remain separately readable when combined, and the selection panel explains the current bonuses. Markers use actual aura ranges and stacking rules rather than champion classification colors. Hostile suppression and enemy status markers follow real combat state and never reveal concealed invaders.

Stable numbered markers identify this round's placed candidates with keyboard slots 1–5; they stay readable as the camera moves and have no rotating arrows. When an advanced recipe is possible, portraits show the result unit above the ingredients, including older defenders. A star marks the result tile, a minus marks consumed ingredients, and a wall marks discarded candidates. Thin leaders connect crowded portraits to their units. Older ingredients retain the recipe portrait without a current-round number.

On first opening, choose whether to start the seven-step tutorial. It highlights building, keeper selection, maze plans, automatic mastery, recipes, defender details and starting a wave. The highlighted controls remain usable; Help can replay the guide later.

**Secret champion Lady Claire** requires **Mage V + Druid V + Frost Warden V** among the same round's five newly placed candidates. Place all five, select one of those three ingredients, then choose the offered combination. Retained defenders from earlier rounds cannot supply this Secret recipe. Claire wears an ivory and gold gown and crown, has loose blonde hair and carries a staff with three orbiting orbs and an enhanced gold aura. Her current geometric Blender model has articulated attack movement. Lord Bernhard is exclusively the hostile final boss in wave 50; his former friendly unit and recipe remain archived. The prior visual revision and abilities are preserved in [the historical art notes](docs/SECRET_CHAMPION_ART_V3.md) and [Secret champion rules](docs/SECRET_CHAMPION_RULES.md).

Rank merges require two matching units among the current five candidates. Retained defenders are permanent and can only transform through advanced recipes. Only castle walls can be demolished with **Delete / Backspace** between waves, for free. Clearing a position never grants another draw. A survived wave immediately begins the next construction round.

## Controls

| Input | Action |
|---|---|
| Left click / tap | Place a draw or inspect a structure |
| 1–5 | Select one of the five draws |
| WASD / arrows / right drag / cursor at field edges | Pan the camera |
| Q / E / middle drag | Rotate |
| Mouse wheel | Zoom |
| One-finger drag | Pan the map on iPad and other touch screens |
| Double click / double tap a current-round candidate on the map | Select and keep it after all five defenders have been placed |
| Double click / double tap a draw card image | Select and keep that placed candidate during keeper selection |
| Double click / double tap a recommended result portrait | Forge that valid champion at the marked result foundation |
| Pinch / two-finger drag | Zoom / rotate on touch screens |
| Home | Reset the camera |
| Space | Keep / send wave / pause, by phase |
| P / G / R | Route / construction grid / all tower ranges |
| M | Choose a fixed blueprint or draw/edit/save your own maze |
| Delete / Backspace | Demolish a selected castle wall between waves · free |
| C / V / H | Grimoire / warbands / help |

Choose the 10-wave border skirmish or 50-wave campaign before the first placement. The Help button also offers a new run. Sound begins only after interaction; the speaker button mutes it. Switching away pauses combat automatically.

## Validation and authoring

```sh
pnpm test
pnpm balance
node tools/balance.mjs --campaign
node tools/benchmark-mazes.mjs
node tools/benchmark-curated-mazes.mjs
node tools/author-roster.mjs
node tools/export-defender-meshes.mjs
blender --background --python blender/scripts/author_defender_ranks_v2.py
blender --background --python blender/scripts/generate_assets.py -- --output public/assets/models
```

The balance tool writes CSV and probability reports into `artifacts/`. Its optional campaign bot uses the real gameplay simulation with a simple placement/keep policy. It is a balance smoke test, not proof of fairness for every strategy or seed.

Combat settings in `data/towers.json`, `data/recipes.json` and `data/balance.json` remain authoritative; `game/core/campaign-roster.js` selects the current 38-champion roster and hostile Bernhard identity without changing combat statistics. `node tools/author-roster.mjs` validates the archived 39-champion definitions. The current edition is checked by the geometric integration tests. The optional `--refresh-presentation` flag refreshes catalog names, descriptions and model categories only.

`?debug=1&seed=42` on the **development server** enables F2 developer tools. Production excludes this interface.

See [DEVELOPMENT.md](DEVELOPMENT.md), [GAME_DESIGN.md](GAME_DESIGN.md), and [ASSET_GUIDE.md](ASSET_GUIDE.md) for architecture, rules, verification, and the reproducible asset pipeline.

## Host, battlements and progression

The active 50-wave Dark Host roster uses fifty geometric Blender enemy models, each with its own portrait and editable scene. All fifty receive a fresh six-view source inspection and source-specific geometry repairs in 0.3.5; the legacy alternate forms remain archived. Goblins, orcs, trolls, ogres, wolf riders and flying mounts retain their native proportions; imports no longer normalize them to a common height. All fifty names, alternate names and appearance descriptions are now in English, following the approved [Dark Host design](docs/APPROVED_ENEMY_DESIGNS.md), while movement, combat abilities, health, rewards and spawn schedules remain unchanged. Enemy auras require real special resistances or abilities; ordinary armor has no shield symbol or aura. Eligible late-wave auras use yellow, red, dark violet and black with a violet edge. All five bosses use a complete 1.875× battlefield scale, another 25% over 0.3.5. Ghorun's three queen-wyvern forms have roughly three times the ordinary bat scout's wingspan and one-and-a-half times the wave-40 boss's. Explicit variant asset IDs preserve different immunity and boss silhouettes; the retired balloon is not in the active pack. Living bats flap their wings, broad wyverns and mantas use slower wing cycles, and ground troops move their legs and breathe. Actual combat pauses freeze these motions; reduced motion restores their authored poses. Fallen enemies collapse, fold their wings where applicable, and rest on the actual terrain until the next construction round. Kept defenders stand on stone wall platforms connected to nearby masonry. Catapults articulate their throwing arm while firing.

The sidebar shows the current warband's actual traits and resistances, live boss health, and how many retained defenders match a selected family and rank. Basic defender rank buttons compare all six portraits, stats and abilities; On field identifies the actual unit used by merge, downgrade and keep commands. The grimoire also counts built champions. Basic defenders use one letter followed by their Roman rank: Soldier S, Archer A, Druid D, Mage M, Cleric C, Engineer R, Frost Warden F and Stormcaller T; for example, `S III` identifies a Veteran Soldier. The HUD tracks score, with a best score saved locally: a regular kill earns 10 × wave, a boss kill 500 × wave, and surviving a wave 100 × wave plus another 200 × wave for boss rounds. After victory or defeat, choose a name to save your score and see the Top 10 plus your own position. Campaign lengths and game editions have separate rankings; HTML and control characters are rejected in names.

Construction mastery rises automatically to `min(Kingdom level − 1, 15)` and changes the next round's draw odds. There is no mastery purchase or paid champion enhancement. A completed regular wave awards 50 gold and a completed boss wave awards 200; kills award Kingdom XP and score. Gold pays only for lowering a current basic candidate above Tier I by one rank and immediately keeping it, for 200 gold. Lost lives cannot be bought back; Royal Ranger has an approved 1% on-hit recovery ability capped at starting health. The planner counts all walls and defenders against 250 placements, including off-plan structures and spent demolished draws.

`node tools/economy-report.mjs` reproduces the income calculation. See [economy and difficulty](docs/ECONOMY_BALANCE.md) and [asset guide](ASSET_GUIDE.md).

## Publish on GitHub Pages

The `.github/workflows/pages.yml` workflow tests and builds the game on every push to `main`, then publishes `dist/` to GitHub Pages. Set **Settings → Pages → Source** to **GitHub Actions** before the first deployment. The workflow derives the deployment path from the repository name; both the game and Royal atelier load their models, portraits and links from that path. Local builds continue to use `/`.

To check a project deployment locally, set `VITE_BASE_PATH=/your-repository-name/` for `pnpm build`. Exported game assets are included in the repository. The frozen 0.3.5 native authoring snapshot, its tested game, original Blender scenes, previous authoring inputs and inspection evidence are delivered in `output/design/geometric-game-v6-complete.zip`. All five earlier complete archives and their source scenes are preserved. The ZIP includes the recorded validation logs and inspection evidence; Blender backup files and installed dependencies are excluded. Native scenes, complete ZIPs and local review evidence stay outside the published GitHub site. Discoveries, preferences, custom mazes and local best scores stay in each player's browser. The statistics service stores run checkpoints and the optional named leaderboard; the owner's protected report covers draws, keeper choices, wave survival, leaks, route length and defender performance, including Secret combinations and Lady Claire's Melancholy trigger count and inactive combat seconds. Local debugging uses Node.js 24 with `node backend/server.mjs`. See [statistics documentation](docs/STATISTICS_BACKEND.md) for configuration, reports and the limits of client-reported data.
