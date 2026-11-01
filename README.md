# Forged Alliances TD — 0.6.7 local implementation

A browser tower-defense game: place five mystery recruits, keep one or combine exact recipe ingredients, then use the remaining foundations to shape the enemy route. The campaign has 50 waves.

**0.6.7 implements FR-004 locally. The sole published release remains 0.6.6 until hosted distribution is requested.** [Play the game](https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/)

Choose **Human**, **Dwarves** or **Elves** before each run and before its Start/Skip tutorial prompt. The selected faction owns its eight basic defender families, 38 recipes and 86 approved V3 appearances, with authored Idle and Attack animation clips. The faction stays locked for the run. Local and online results retain the played faction; earlier scores remain in Legacy records. [Implementation and verification](docs/FACTIONS_V060.md).

The game is named **Forged Alliances TD**, with a vector mark and wordmark whose TD seal is now larger. Recipes and Enemy Waves have framed touch buttons, Potential combinations stays expanded, the initial loading message has correct punctuation, and wave 49 restores 10% of missing health every four seconds. Late-wave enemy instances share identical immutable static surfaces to reduce memory use while retaining all original geometry, materials and motion. [Changes and verification](docs/RELEASE_0_6_6.md).

The tutorial now introduces **Choose your maze shape** as its second step, before placing recruits. Open the ordinary Maze plans picker and choose a plan to continue. A previously saved plan can be selected again; simply opening or closing the picker does not complete the step. Each new run still offers Start tutorial or Skip tutorial.

The faction chooser now shows large battle illustrations and clear faction specialties. All 258 defender portraits use gallery reference artwork with transparent backgrounds, including recipe and map badges. Dwarf battlefield figures have a larger presentation scale. Combat rules and V3 model/animation bytes remain unchanged. [Presentation update](design/portrait-sources/README.md).

FR-004 raises all 85 native Dwarf primary profiles by 50%, with 100% for five golem/Gatling champions, and adds 1.5 tiles to the existing Physical immunity aura. Shared ability bases, fixed secondary damage, other factions and recipes remain exact. [Implementation and verification](docs/FR004_IMPLEMENTATION.md).

## Run locally

Use Node.js 22.15+ and pnpm:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
node tools/serve.mjs
```

Open http://127.0.0.1:4174/. On Windows, `START_GAME.cmd` serves the current production build. Keep its terminal open. For development, use `pnpm dev` at http://127.0.0.1:5173/. Browser modules require HTTP; opening index.html as a file will not work.

## Controls

| Action | Mouse / keyboard | Touch |
| --- | --- | --- |
| Place or select | Click a tile or unit | Tap |
| Move camera | WASD / arrows | One-finger drag |
| Rotate / zoom | Q / E, mouse wheel | Two-finger drag / pinch |
| Choose a maze plan | Map tools → Maze plans, or M | Map tools → Maze plans |
| Start / pause / resume | Main control, or Space | Main control |
| Change speed | Speed control: 1×, 2×, 3×, 5× | Same control |
| Recipes / enemy waves | Header controls, C / V | Header controls |

The maze is a construction guide; selecting it does not build walls or spend resources. Keep the route through all five checkpoints open. Exact champion ingredients, rank previews, pinned plans and custom maze editing remain available.

## Current release and development

Only release 0.6.6 is maintained. Previous game packages, offline backups, obsolete temporary copies, old release tags and backup branches have been removed. Manual publication uses current source. [Retention policy](docs/RELEASE_RETENTION.md).

FR-003 revision 2 supplies continuous immunity auras and the approved champion statistics. [Current changes and verification](docs/RELEASE_0_6_6.md). The single English design gallery remains local only.

Current models, artwork, animations, audio and exact original prompts/review records remain intact. Required regression data and image provenance are source dependencies, not playable older releases. Statistics and saved player results are preserved. [Backend setup](docs/STATISTICS_BACKEND.md).
