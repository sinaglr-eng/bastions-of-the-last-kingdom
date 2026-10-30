# Forged Alliances TD — 0.6.1

A browser tower-defense game: place five mystery recruits, keep one or combine exact recipe ingredients, then use the remaining foundations to shape the enemy route. The campaign has 50 waves.

**0.6.1 is the current version.** [Play the game](https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/)

Choose **Human**, **Dwarves** or **Elves** before each run and before its Start/Skip tutorial prompt. The selected faction owns its eight basic defender families, 38 recipes and 86 approved V3 appearances, with authored Idle and Attack animation clips. The faction stays locked for the run. Local and online results retain the played faction; earlier scores remain in Legacy records. [Implementation and verification](docs/FACTIONS_V060.md).

The game is named **Forged Alliances TD**, with a vector mark and wordmark whose TD seal is now larger. Recipes and Enemy Waves have framed touch buttons, Potential combinations stays expanded, the initial loading message has correct punctuation, and wave 49 restores 10% of missing health every four seconds. Late-wave enemy instances share identical immutable static surfaces to reduce memory use while retaining all original geometry, materials and motion. [Changes and verification](docs/FORGED_ALLIANCES_V052.md).

The tutorial now introduces **Choose your maze shape** as its second step, before placing recruits. Open the ordinary Maze plans picker and choose a plan to continue. A previously saved plan can be selected again; simply opening or closing the picker does not complete the step. Each new run still offers Start tutorial or Skip tutorial.

The faction chooser now shows large battle illustrations and clear faction specialties. All 258 defender portraits use gallery reference artwork with transparent backgrounds, including recipe and map badges. Dwarf battlefield figures have a larger presentation scale. Combat rules and V3 model/animation bytes remain unchanged. [Presentation update](docs/FACTION_PRESENTATION_V061.md).

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

## Archive and development

The verified previous 0.5.2 source and production rollback pair is retained locally in `backups/releases/v0.5.2/`. Older offline rollback pairs can be retired after the 0.6 deployment is verified. Historical design evidence and the local-only canonical gallery are preserved. Current production packaging excludes retired review deliveries and uses lossless gzip model transport; decoded bytes match the approved originals. The older public atelier entry returns to the current game.

The older offline 0.5.0 pair is retired after verifying this release. Its immutable `v0.5.0-stable` Git reference and historical verification records remain available. [Historical archive evidence](docs/RELEASE_0.5.md).

Current approved original models, images, audio, prompts, reference galleries and editable V3 Blender sources remain intact. Older asset namespace names identify preserved historical evidence or approved enemy/scenery revisions still used by the current game. Current faction-gallery work is separate. The game uses a separate statistics service; scores, player saves and service data are retained. See [backend setup](docs/STATISTICS_BACKEND.md) and the [change history](CHANGELOG.md).
