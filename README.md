# Forged Alliances TD — 0.6.9

A browser tower-defense game: place five mystery recruits, keep one or combine exact recipe ingredients, then use the remaining foundations to shape the enemy route. The campaign has 50 waves.

**Version 0.6.9 gives every Dwarf defender ground-and-air primary attacks.** [Targeting change and validation](docs/DWARF_AIR_TARGETING.md). [Play the game](https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/)

The current performance patch reduces repeated combat-stat work and V3 model draw submissions while preserving combat results and approved appearance. [Measured improvements and limits](docs/LATE_WAVE_PERFORMANCE.md).

Choose **Human**, **Dwarves** or **Elves** before each run and before its Start/Skip tutorial prompt. The selected faction owns its eight basic defender families, 38 recipes and 86 approved V3 appearances, with authored Idle and Attack animation clips. The faction stays locked for the run. Local and online results retain the played faction; earlier scores remain in Legacy records. [Implementation and verification](docs/FACTIONS_V060.md).

The game is named **Forged Alliances TD**, with a vector mark and wordmark whose TD seal is now larger. Recipes and Enemy Waves have framed touch buttons, Potential combinations stays expanded, the initial loading message has correct punctuation, and wave 49 restores 10% of missing health every four seconds. Late-wave enemy instances share identical immutable static surfaces to reduce memory use while retaining all original geometry, materials and motion. [Changes and verification](docs/RELEASE_0_6_8.md).

The tutorial now introduces **Choose your maze shape** as its second step, before placing recruits. Open the ordinary Maze plans picker and choose a plan to continue. A previously saved plan can be selected again; simply opening or closing the picker does not complete the step. Each new run still offers Start tutorial or Skip tutorial.

The faction chooser now shows large battle illustrations and clear faction specialties. All 258 defender portraits use gallery reference artwork with transparent backgrounds, including recipe and map badges. Dwarf battlefield figures have a larger presentation scale. Combat rules and V3 model/animation bytes remain unchanged. [Presentation update](design/portrait-sources/README.md).

FR-004 raises all 85 native Dwarf primary profiles by 50%, with 100% for five golem/Gatling champions, and adds 1.5 tiles to the existing Physical immunity aura. Shared ability bases, fixed secondary damage, other factions and recipes remain exact. [Implementation and verification](docs/FR004_IMPLEMENTATION.md).

Version 0.6.7 also bounds native model memory and pauses safely during graphics-context interruption. [iPad wave-24 repair and verification limits](docs/IPAD_WAVE24_FIX.md).

FR-005 adds the flying-only Sky Hunt slow aura, classified machine Multishot and Ricochet, Heavy Sniper Execution, Siege Cannon Freeze, Golem Stun, shared Splash reach and the exact selected detection removals. Only one Boar Lancer ingredient changes. [Implementation, campaign results and limits](docs/FR005_IMPLEMENTATION.md).

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

Only current local release 0.6.9 is maintained. Previous game packages, offline backups, obsolete temporary copies, old release tags and backup branches have been removed. Manual publication uses current source. [Retention policy](docs/RELEASE_RETENTION.md).

FR-005 revision 2 supplies the current recipe and ability refinements while retaining the implemented FR-004 primary values and immunity auras. [Current changes and verification](docs/RELEASE_0_6_8.md). The single English design gallery remains local only.

Current models, artwork, animations, audio and exact original prompts/review records remain intact. Required regression data and image provenance are source dependencies, not playable older releases. Statistics and saved player results are preserved. [Backend setup](docs/STATISTICS_BACKEND.md).

A synchronous frame error now pauses the existing run and shows recoverable drawing-error details instead of silently dropping the animation loop. The original Griffin Scout desktop failure remains unreproduced; [investigation and verification limits](output/implementation/griffin-current/REPORT.md).
