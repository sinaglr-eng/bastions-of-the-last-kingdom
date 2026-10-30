# Forged Alliances TD — 0.6.0

Release date: 30 October 2026. The October 28 faction specification and October 30 human approval of all 258 V3 appearances and Idle/Attack clips define this release. The canonical design gallery remains local only and unchanged.

## Run setup and content

Human ('crown'), Dwarves ('forge') and Elves ('grove') appear before Game, draft, RNG, tracker or new-run clock construction. Cards require explicit confirmation. Preparing a replacement pauses the old simulation; cancellation or failed preparation preserves it. Opening skins are fetched, decoded and checked before staging a replacement world. Double submits and aborted callbacks cannot commit another run.

Each selected package contains eight equal-weight basic families, 48 basic ranks, 37 ordinary champions and Lady Claire, 38 recipes and 86 model/portrait bindings. Human retains the current 0.5.2 combat and recipes, including the approved wave-49 10% missing-health recharge. Dwarves and Elves use their independent V14 ability profiles with current V24 names. Lady Claire has only the selected faction's exact current-draft rank-V recipe. New games clear prior faction selections and catalogue history. Discoveries are partitioned without deleting older progress. Unmapped character voices are silent.

The Start/Skip tutorial invitation remains per run. Choose your maze shape remains step two. No new global faction bonus or economy change is introduced.

## Models and transport

All 258 model and portrait copies were matched to the immutable V3 approval lock before import. The original modeling delivery is read only. Production GLBs use gzip transport: 1,520,147,544 original bytes become 546,449,696 transport bytes. Every decoded SHA-256 matches its approved original. Vertex, skin, texture, material and animation samples are unchanged. A native asynchronous decoder has a portable gzip fallback.

Only the selected faction's required models load during play. Actual V3 clips use private mixers and skeletons; source clips and peer instances stay unchanged. Combat events trigger visual attacks; visual animation does not cause damage. Current enemy models retain their original decoded hashes and memory-sharing fixes. Production excludes retired modeling review media and the prior atelier, which returns to the current game. Historical source assets remain available locally and in the 0.5.2 backup.

## Results and compatibility

Trackers capture faction, ruleset 'three-factions-v060-20261030' and content manifest 'approved-faction-models-v3-20261030' at creation. Local bests are keyed by version, campaign and faction. Offline entries upload their own captured identity even during another faction's run. The backend checks immutable creation/checkpoint identities and selected-faction unit membership. Developer exclusions and the no-draw submission rule remain.

The existing SQLite schema is retained; backward-compatible attribution is stored in the run summary. Old rows remain unattributed and visible in Legacy records, with their original version lists. Faction standings never include them. The existing public statistics Site was updated, with its database and audience preserved. See 'backend/SITES_DEPLOYMENT.json' and the sanitized deployment receipt.

## Verification and practical limits

Evidence is in 'output/releases/v0.6.0/': full regression and build inventories; exact import and transport receipts; 22 actual skinned runtime animation cases covering each faction/body/mode combination and the real casting-hand origins for Stormcaller and Elven Archmage; transactional chooser, offline migration and combat tests; public deployment checks; and guarded workspace handoff receipts.

Nine campaigns used real seeded draws, legal placements, keeps, merges and recipes. The simple greedy policy lost between waves 6 and 14; this is not a claim of optimized play or equal faction win rates. All 258 appearance profiles also ran against six actual wave kits, including late waves 34, 44, 49 and 50: 1,548 controlled endurance skirmishes completed with finite combat state. No balance tuning was inferred from those bot losses.

The user explicitly waived browser QA. Node tests validate actual model structures and PNG bindings, not shaded GPU pixels. Physical iPad/Safari rendering, touch layout and the previous black-texture report require device confirmation. Historical Blender masters retired by the owner are explicitly marked unavailable by the older audit; retained original reference images and GLB export hashes still verify against exact stored bytes.

## Verified activation

The exact runtime commit [e059fec8](https://github.com/sinaglr-eng/bastions-of-the-last-kingdom/commit/e059fec8f30fef363c9eeee8893bbcd836728429) is published as the default game and pinned by tag 'v0.6.0'. All **1,941 tests**, the 213-module production build and **934 public file checks** pass, including 258 V3 defender models and all 54 unchanged enemy models. Public decoded model SHA-256 hashes match the approved originals. The [Pages workflow](https://github.com/sinaglr-eng/bastions-of-the-last-kingdom/actions/runs/41070451552) succeeded after retrying one transient GitHub HTTP 500 during deployment; its successful build was reused.

The previous 0.5.2 archive hashes were checked again after publication. The older 0.5.0 offline pair was moved to the Windows Recycle Bin. Current generated runtime files replaced exact older generated bytes; approved source evidence and the main Git index remain preserved.

## Rollback

The verified prior 0.5.2 source and production ZIPs are under 'backups/releases/v0.5.2/' in the primary workspace. Their CRCs, file inventories and SHA-256 hashes were checked against commit '5ed559bc29237b96dc64ec447e9945722e8b1a0a' before implementation. Keep the faction-capable statistics backend if rolling the client back: new attribution and historical rows must remain intact. Git tags and approved original evidence are preserved.
