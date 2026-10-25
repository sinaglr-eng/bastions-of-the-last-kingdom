# Bastions of the Last Kingdom — 0.5

A browser tower-defense game: place five mystery recruits, keep one or combine exact recipe ingredients, then use the remaining foundations to shape the enemy route. The campaign has 50 waves.

**0.5.0 is the default version.** [Play the game](https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/) · [Royal atelier](https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/archer.html)

The tutorial now introduces **Choose your maze shape** as its second step, before placing recruits. Open the ordinary Maze plans picker and choose a plan to continue. A previously saved plan can be selected again; simply opening or closing the picker does not complete the step. Each new run still offers Start tutorial or Skip tutorial.

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

The current offline source and production archives are in `backups/releases/v0.5.0/` in the primary workspace. Their manifest records exact release and file hashes. The new `v0.5.0-stable` reference replaces the previous offline 0.3.31 baseline. [Archive verification, release evidence and cleanup scope](docs/RELEASE_0.5.md).

Original approved models, images, audio, prompts, reference galleries and editable Blender sources remain intact. Older asset namespace names identify approved source revisions still used by the current game. Current faction-gallery work is separate. The game uses a separate statistics service; scores, player saves and service data are retained. See [backend setup](docs/STATISTICS_BACKEND.md) and the [change history](CHANGELOG.md).
