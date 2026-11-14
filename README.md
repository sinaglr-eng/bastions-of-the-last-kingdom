# Forged Alliances TD — 0.7.0

A browser tower-defense game: place five mystery recruits, keep one or combine exact recipe ingredients, then use the remaining foundations to shape the enemy route. The campaign has 50 waves.

**Release 0.7.0 adds FR-010:** a main menu, optional verified accounts, exact saved continuation, medal achievements, a three-slot general and seeded Endless waves beyond 50. Guest runs remain fully playable without account statistics. Start locally with `START_GAME.cmd`; account verification links use a private local mailbox during local development. [Implementation, configuration and verification](docs/FR010_IMPLEMENTATION.md).

The release retains FR-008 and the complete defender voices. Dwarf Sky Hunt applies its normal Slow multiplied by the strongest covering Physical Rune transmission against Physically immune flyers. Basic ranks have no decorative underfoot ring; champion classification auras and rank-VI glow/stars remain. Wave 38 uses the recovered Blood-Leech Troll reference alongside the Knifeman reference. The 628 scheduled-weapon regressions preserve existing ground-wave damage and regeneration. [Implementation and verification](docs/FR008_IMPLEMENTATION.md).

Every one of the 136 character families has two recorded lines. The complete voice bank contains 272 active clips, including 190 new ElevenLabs v4 recordings with the requested Scottish/British directions and gender-aware, distinct casting. [Defender voices](docs/DEFENDER_VOICES.md). Public deployment identity is recorded in [the current publication receipt](output/implementation/release-current/deployment.json).

FR009 refines attack effects around every current native weapon and damage element: material ammunition, controlled contact shapes, bright forked lightning, layered continuous fire and typed busy-wave effects. Ricochet retains the originating weapon's appearance, and actual Fire Splash procs receive a dedicated eruption. Visible conditions use procedural flames and Poison clouds, partial ice and distinct healing-denial markers; Slow remains mechanically active without an automatic body or clock effect. All factions retain the current 30-effect sound bank and score version. [Implementation and verification](docs/FR009_IMPLEMENTATION.md).

**Current follow-up:** Baby Fire Dragon, Fire Dragon, Mother Fire Dragon and Ancient Dragon Patriarch can aim their flame cones at ground and flying enemies. Automatic Slow body/clock effects remain hidden while movement slowing and inspected values remain active. [Targeting and visual policy](docs/DRAGON_AIR_AND_SLOW_VISIBILITY.md).

**FR-006 and FR-007 revision 3 remain implemented.** It includes final-boss defeat, 15% wave-49 recharge, faction score context, all defender size adjustments and the latest 16 recipe changes. Dwarf and Elf rank-I defenders have one immediate recipe choice where possible, two maximum. All 258 combat profiles, approved artwork and models remain exact. [Implementation and verification](docs/FR006_FR007_IMPLEMENTATION.md).

All battlefield defenders are now at least 20% smaller. Basic champions match ordinary draft size references, while the approved models keep their exact body and equipment proportions. [Current sizing policy and verification](docs/DEFENDER_PRESENTATION.md).

The current performance patch reduces repeated combat-stat work and V3 model draw submissions while preserving combat results and approved appearance. [Measured improvements and limits](docs/LATE_WAVE_PERFORMANCE.md).

Choose **Human**, **Dwarves** or **Elves** before each run and before its Start/Skip tutorial prompt. The selected faction owns its eight basic defender families, 38 recipes and 86 approved V3 appearances, with authored Idle and Attack animation clips. The faction stays locked for the run. Local and online results retain the played faction; earlier scores remain in Legacy records. [Implementation and verification](docs/FACTIONS_V060.md).

The game is named **Forged Alliances TD**, with a vector mark and wordmark whose TD seal is now larger. Recipes and Enemy Waves have framed touch buttons, Potential combinations stays expanded, the initial loading message has correct punctuation, and wave 49 restores 15% of missing health every four seconds. Late-wave enemy instances share identical immutable static surfaces to reduce memory use while retaining all original geometry, materials and motion. [Changes and verification](docs/RELEASE_0_6_8.md).

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

Only current local release 0.7.0 is maintained. The previously published 0.6.12 remains public until a new publication is explicitly requested. Previous game packages, offline backups, obsolete temporary copies, old release tags and backup branches are not maintained. Manual publication uses current source. [Retention policy](docs/RELEASE_RETENTION.md).

FR-006 and FR-007 revision 3 supply the recipe and final-boss rules, retaining FR-005 abilities and the FR-004 primary values and immunity auras alongside FR-008. [Current changes and verification](docs/FR006_FR007_IMPLEMENTATION.md). The single English design gallery remains local only.

Current models, artwork, animations, audio and exact original prompts/review records remain intact. Required regression data and image provenance are source dependencies, not playable older releases. Statistics and saved player results are preserved. [Backend setup](docs/STATISTICS_BACKEND.md).

A synchronous frame error now pauses the existing run and shows recoverable drawing-error details instead of silently dropping the animation loop. The original Griffin Scout desktop failure remains unreproduced; [investigation and verification limits](output/implementation/griffin-current/REPORT.md).
