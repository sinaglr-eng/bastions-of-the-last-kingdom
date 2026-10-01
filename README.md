# Bastions of the Last Kingdom

A single-player 3D fantasy tower-defense game for the browser. Build five mystery defenders, discover each on placement, retain one or combine matching ingredients, and use the rejected foundations to shape an enemy maze.

Current release: **0.2.5 · Living Kingdoms** — [release notes](CHANGELOG.md).

## Play

[Play the public game](https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/) · [Royal atelier](https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/archer.html)

Node.js 22.12+ and pnpm are required for a local checkout. Run `pnpm install --frozen-lockfile` and `pnpm build` first. On Windows, double-click **START_GAME.cmd** to serve the production build at **http://127.0.0.1:4174/**. Keep its terminal open while playing. The launcher also recognizes the bundled Codex Node runtime when available.

For development:

```sh
pnpm install
pnpm dev
```

Open http://127.0.0.1:5173/. For a fresh production build: `pnpm build`, then `node tools/serve.mjs`. Do not open index.html directly with a file URL; browser modules and model loading need the local server. The game has no account, backend service, runtime CDN, or external asset requests.

The current board is an open 37 × 37 grid with five ordered checkpoints. Eight original defender classes each have six ranks; 37 exact three-defender recipes lead to 37 champions, including a catapult, cannon and ballista. Champions have one fixed form with optional paid enhancements. Their large cosmetic auras identify classification: Basic blue, Intermediate green, Advanced purple and TOP gold. A snowy valley, branched forests, flowing waterfall and winding river surround the unobstructed field; occasional clouds drift through the wide camera view. Checkpoints sit on the fifth tile from each edge. A continuous textured meadow blends the field into its surroundings without a frame. The campaign contains 50 orc warbands and five bosses; the Warbands guide lists their traits and counters. Only wave 1 has introductory health, armor, movement and spawn spacing. Waves 2 and 3 use their original normal difficulty: 61/80 HP, 1/8 armor, 2.21/2.37 movement speed and 0.6-second spawn intervals. Enemy counts and rewards remain unchanged.

The **Royal atelier** link opens `/archer.html`: all 45 defender types in the approved Blender style, with smoother connected anatomy, tailored clothing, six color-coded ranks per basic class and 37 individually designed champion models. All 85 defender variants also have portraits rendered by Blender. Rejected foundations form connected castle stone walls. **Commander's spiral** follows the red-line reference drawing: 136 wall cells, 590 counted steps and a solid 3 × 3 central battery. Suggested maze now offers eight fixed layouts, including **Diamond spiral** (128 cells, 718 steps, 19 central firing positions) and **Chevron bastion** (153 cells, 504 steps, 21 central firing positions), traced from the two supplied diagrams. Choose once with M: the panel closes and the selected cells stay fixed. M reopens it. Create or edit a blueprint by drawing/erasing on the map, then save it locally for future games.

Seven connected mountain ridges, dense woodland and rock outcrops surround the open field. The royal palace takes inspiration from Neuschwanstein and stands entirely on the dry eastern bank. Its town has streets, residents, farms, sheep and cattle pastures, a stone quarry and a flowing river branch with an animated watermill. The orc territory has tents, fires, seated orcs, guards, wolf pens and cages, a guarded cave and a mountain camp for trolls and ogres; one upcoming invader still waits behind the fortified gate. Both landmarks have editable Blender 5.2 scenes. Combat uses roots growing beneath enemies, dragon flame, lightning, spectral slashes, shaped spells and siege projectiles, with corresponding attack motions and sounds. Articulated arms draw bows, swing blades and lift glowing staffs; spell waves originate at their moving focus. Unrevealed cloaked enemies disappear completely; active nearby defenders, checkpoint beacons and detection towers reveal them for both the player and other defenders. Physical/piercing damage uses armor; magic uses general and elemental resistance; pure damage bypasses both.

Construction mastery occupies its own panel beside the compact five-draw strip. The selected candidate has its own Keep button; double-clicking or double-tapping its image also keeps it after all five draws have been placed. The next-wave button appears at the top center of the map when defenses are ready. The sidebar can browse all champion recipes with arrows, open a potential combination directly and return to the pinned recipe. Three ingredient branches show the intermediate champions and their nested recipes down to exact basic ranks. Ingredient progress marks retained defenders in green and available placed candidates separately in blue; unrevealed draws remain unknown.

Allied support effects mark the affected defenders' platforms with distinct colored symbols. Speed, damage, extended range, true strike and resistance to control remain separately readable when combined, and the selection panel explains the current bonuses. Markers use actual aura ranges and stacking rules rather than champion classification colors. Hostile suppression and enemy status markers follow real combat state and never reveal concealed invaders.

Golden rotating arrows identify only this round's placed candidates. When an advanced recipe is possible, portraits show the result unit above the ingredients, including older defenders. A star marks the result tile, a minus marks consumed ingredients, and a wall marks discarded candidates. Thin leaders connect crowded portraits to their units. Older ingredients have no rotating arrow.

Rank merges require two matching units among the current five candidates. Retained defenders are permanent and can only transform through advanced recipes. Only castle walls can be demolished with **Delete / Backspace** between waves for 8 gold. Clearing a position never grants another draw. A survived wave immediately begins the next construction round.

## Controls

| Input | Action |
|---|---|
| Left click / tap | Place a draw or inspect a structure |
| 1–5 | Select one of the five draws |
| WASD / arrows / right drag / cursor at field edges | Pan the camera |
| Q / E / middle drag | Rotate |
| Mouse wheel | Zoom |
| One-finger drag | Pan the map on iPad and other touch screens |
| Double tap a selected current-round candidate | Keep it after all five defenders have been placed |
| Double click / double tap a draw card image | Select and keep that placed candidate during keeper selection |
| Pinch / two-finger drag | Zoom / rotate on touch screens |
| Home | Reset the camera |
| Space | Keep / send wave / pause, by phase |
| P / G / R | Route / construction grid / all tower ranges |
| M | Choose a fixed blueprint or draw/edit/save your own maze |
| Delete / Backspace | Demolish a selected castle wall between waves · 8 gold |
| C / V / H | Grimoire / warbands / help |

Choose the 10-wave border skirmish or 50-wave campaign before the first placement. The Help button also offers a new run. Sound begins only after interaction; the speaker button mutes it. Switching away pauses combat automatically.

## Validation and authoring

```sh
pnpm test
pnpm balance
node tools/balance.mjs --campaign
node tools/benchmark-mazes.mjs
node tools/author-roster.mjs
node tools/export-defender-meshes.mjs
blender --background --python blender/scripts/generate_assets.py -- --output public/assets/models
```

The balance tool writes CSV and probability reports into `artifacts/`. Its optional campaign bot uses the real gameplay simulation with a simple placement/keep policy. It is a balance smoke test, not proof of fairness for every strategy or seed.

The approved settings in `data/towers.json`, `data/recipes.json` and `data/balance.json` are the source of truth. `node tools/author-roster.mjs` validates the 37-champion roster without rewriting statistics or recipes. All 48 basic family/rank pairs appear in a champion recipe. The optional `--refresh-presentation` flag refreshes catalog names, descriptions and model categories only.

`?debug=1&seed=42` on the **development server** enables F2 developer tools. Production excludes this interface.

See [DEVELOPMENT.md](DEVELOPMENT.md), [GAME_DESIGN.md](GAME_DESIGN.md), and [ASSET_GUIDE.md](ASSET_GUIDE.md) for architecture, rules, verification, and the reproducible asset pipeline.

## Host, battlements and progression

The 50-wave roster uses 51 original Blender enemy models (including the balloon alternative), with native `.blend` sources and portraits. Regular units stand about 1.82–1.98 units tall; the five warlords reach about 3.1–3.4 and carry distinct auras. Fallen enemies collapse, fold their wings where applicable, and remain on the field until the next construction round. Kept defenders stand on stone wall platforms connected to nearby masonry. Catapults articulate their throwing arm while firing.

The sidebar shows the current warband's actual traits and resistances, live boss health, and how many retained defenders match a selected family and rank. The grimoire also counts built champions. Basic defenders use one letter followed by their Roman rank: Soldier S, Archer A, Druid D, Mage M, Cleric C, Engineer R, Frost Warden F and Stormcaller T; for example, `S III` identifies a Veteran Soldier. The HUD tracks score, with a best score saved locally: a regular kill earns 10 × wave, a boss kill 500 × wave, and surviving a wave 100 × wave plus another 200 × wave for boss rounds.

There are 15 mastery upgrades for 6,500 gold total: with perfect kill income and no optional spending, the maximum is affordable after wave 30. Lost lives cannot be bought back; Royal Ranger has an approved 1% on-hit recovery ability capped at starting health. A current basic candidate above Tier I can be downgraded one rank and immediately kept for 200 gold. The planner counts all walls and defenders against 250 placements, including off-plan structures and spent demolished draws.

`node tools/economy-report.mjs` reproduces the income calculation. See [economy and difficulty](docs/ECONOMY_BALANCE.md) and [asset guide](ASSET_GUIDE.md).

## Publish on GitHub Pages

The `.github/workflows/pages.yml` workflow tests and builds the game on every push to `main`, then publishes `dist/` to GitHub Pages. Set **Settings → Pages → Source** to **GitHub Actions** before the first deployment. The workflow derives the deployment path from the repository name; both the game and Royal atelier load their models, portraits and links from that path. Local builds continue to use `/`.

To check a project deployment locally, set `VITE_BASE_PATH=/your-repository-name/` for `pnpm build`. The editable Blender sources and exported game assets are included in the repository; Blender backup files, dependencies, local logs and review artifacts are excluded. Progress, maze selections and records are stored in each player’s browser.
