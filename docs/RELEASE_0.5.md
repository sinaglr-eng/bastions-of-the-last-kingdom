# 0.5 — Maze-first field guide and default baseline

Version **0.5.0** is the default playable release. The public game opens at the normal repository URL; no release query parameter is required. Version numbers stored with scores retain the three-part form required by the existing statistics service.

## Tutorial

The second step, after camera controls and before placing recruits, asks the player to choose a maze shape. **Open maze plans** opens the existing picker. A real choice, including choosing the previously saved plan again, advances the guide. Opening or closing the picker and a previously stored selection alone do not count. The selected plan remains an ordinary visual construction guide: it does not place defenders, walls, or spend resources automatically. Custom blueprint editing remains available.

Every new ordinary run retains the Start tutorial / Skip tutorial invitation. Touch controls, Pause, Speed, recipes, game rules, approved art, audio, scores and stored player data use the existing implementations.

## Default and offline archive

The immutable release reference is `v0.5.0-stable`. The normal Pages deployment is the default online game. The primary workspace contains one current offline release directory:

`backups/releases/v0.5.0/`

It contains a source ZIP from the exact release commit, a production ZIP built with URL base `/`, and `manifest.json` with every entry's size and SHA-256 plus both ZIP hashes. The source archive includes the original approved media and provenance required by the source and its tests. The production archive contains the playable build. It has no dependency on previous release archives.

Extract the production ZIP into a new empty directory and serve it over HTTP, or use the workspace's `START_GAME.cmd` with its current `dist/`. A file URL cannot run browser modules. The source ZIP can be rebuilt with Node.js 22.15+ and pnpm:

```sh
pnpm install --frozen-lockfile
pnpm test
pnpm build
node tools/serve.mjs
```

To verify an existing archive without extracting or modifying it, use Python 3:

```sh
python tools/archive-release.py verify --outputdir backups/releases/v0.5.0
```

Source entries are independently compared with a fresh Git TAR export from the recorded commit, including its export attributes. ZIP members are streamed through CRC, size and SHA-256 checks. Production entries must match the recorded inventory exactly; creation also checks the supplied build bytes and release metadata.

## Cleanup scope

The old offline 0.3.31 release pair and its obsolete rollback tools are retired. Old generated builds and archive extraction copies are removed only after the new archive is verified. Approved originals, reference galleries, editable Blender sources, current faction-gallery work, persistent scores, the statistics service and Git development history remain available. Some active assets retain older namespace names; those names identify exact approved bytes and are not unused release copies.

## Validation

All **1,833 tests** and the **213-module** root-base production build pass. All **532 source/configuration files** remain stable across tests and build. Native browser checks at **390 × 844** and **1,024 × 768** confirm the picker stays outside the tutorial card, Close does not advance, choosing a plan advances to recruit placement, and reselecting a stored plan works. These are responsive Chromium checks, not physical iPad/Safari certification. Local preview statistics requests cannot reach the configured endpoint; their queued-sync warning is recorded without claiming endpoint availability.

The initial complete run found one historical test that still expected the former nine-step order; it was updated to require the new ten-step order and the complete rerun passed. The original failure log remains in the release evidence.

Publication and exact archive receipts will be recorded after deployment and independent rebuild verification.
