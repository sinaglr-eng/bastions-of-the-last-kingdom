# Roll back to 0.3.31

The preserved release is **0.3.31 — Reliable Touch Controls and Clearer Battlefield**. Its source is pinned independently of ongoing 0.4 UI work. Preserve the stable tag, backup branch and offline archives below.

| Reference | Identity |
| --- | --- |
| Stable tag | `v0.3.31-stable` |
| Backup branch | `codex/backup-v0.3.31` |
| Published source / preservation commit | `c01ac5a2ab1ef62e77d2ce545f24234b80b5c847` |
| Runtime implementation commit | `6c4485db7e9a617233b4f86f6d93e81d3c31cf28` |
| Original successful Pages run | `38528660303` |
| Repository | [Bastions of the Last Kingdom](https://github.com/sinaglr-eng/bastions-of-the-last-kingdom) |

The dirty MAIN workspace has a separately labelled backup. It is not substituted for the published release source.

## One-command rollback

Run from a project checkout containing `tools/rollback-v0331.ps1`:

```powershell
pwsh -File ".\tools\rollback-v0331.ps1"
```

This default is read-only. It verifies that both local and remote stable references resolve to the exact preservation commit, checks the current `main` Pages workflow, and reports dispatch readiness. It does not change a checkout, read stored authentication credentials or dispatch a workflow. The public remote-reference check disables Git credential helpers.

When rollback publication is intended, the explicit command is:

```powershell
pwsh -File ".\tools\rollback-v0331.ps1" -Deploy
```

The deployment path uses authenticated GitHub CLI when available. Otherwise it uses the existing Windows Git Credential Manager through `git credential fill` and a GitHub REST request, so GitHub CLI installation is optional. The GitHub account must have permission to dispatch this repository's workflow. Stored credentials are read only after explicit `-Deploy` and a successful stable-reference/workflow preflight. Credential lookup runs with `GIT_TERMINAL_PROMPT=0` and `GCM_INTERACTIVE=never`; it cannot open a sign-in prompt. Credential output and the Bearer header remain in process memory and are never printed or saved. If no usable sign-in exists, the helper stops and requests sign-in before retrying. The helper dispatches `pages.yml` **from main**, passing `release_ref=v0.3.31-stable`. The workflow must expose this input and use it for checkout; the script refuses to dispatch if either check fails. This lets the current deployment workflow rebuild and publish the stable source without rewriting main history or changing the stable tag.

At document preparation on October 16, 2026, the stable remote tag passed preflight. The published main workflow had not yet gained the `release_ref` checkout. The helper also supports the existing Git Credential Manager without installing GitHub CLI; that authentication path is intentionally not accessed by default preflight. No rollback was dispatched. These are preparation observations; the helper checks current readiness each time it runs.

A workflow request is not deployment confirmation. Follow the [Pages workflow](https://github.com/sinaglr-eng/bastions-of-the-last-kingdom/actions/workflows/pages.yml), require successful tests/build/deployment, then verify the [served game](https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/?release=0.3.31) reports 0.3.31 and uses the expected compiled assets. The helper does not change statistics-service metadata, database schema, leaderboard history or saved games.

## Offline copies

The local archive directory is:

`C:/Users/sinag/Documents/ChatGPT/Tower Defense game/backups/releases/v0.3.31/`

| Archive | Bytes | SHA-256 |
| --- | ---: | --- |
| `bastions-v0.3.31-source.zip` | 814,229,203 | `2b17abc92903b3efd666e189ae11b75faee4ad2dd9916f3ef27f51da86943d17` |
| `bastions-v0.3.31-production.zip` | 471,480,153 | `a57f3ed1c5b9c759b7a54a8b54980efa4b99a1cf87f6c70d7b7255d89a70f52a` |

`source-backup-proof.json` records all 3,819 source entries, their sizes, SHA-256 hashes and Git identities. Every ZIP entry was read with CRC checking and compared byte-for-byte by hash and size to a fresh `git archive` TAR stream from the exact stable commit. The stable `.gitattributes` applies `*.cmd text eol=crlf`, so `START_GAME.cmd` intentionally differs from its raw LF Git blob while matching the stable export exactly. Binary source assets retain exact Git bytes. Total expanded source bytes: 1,147,744,583.

`production-backup-proof.json` records the independently verified production archive: 2,245 files and 697,986,724 expanded bytes. This is the preserved, deployable build; the source ZIP is the reproducible stable source. `rollback-identity.json` connects both archives to the stable tag, implementation commit and original Pages run.

To recheck the source archive without extracting or changing it, use the bundled Python runtime with:

```text
python tools/verify-v0331-source-backup.py "C:/Users/sinag/Documents/ChatGPT/Tower Defense game/backups/releases/v0.3.31/bastions-v0.3.31-source.zip" --proof "C:/Users/sinag/Documents/ChatGPT/Tower Defense game/backups/releases/v0.3.31/source-backup-proof.json"
```

Use an installed Python 3 interpreter or the project’s bundled runtime path. The verifier uses only Python’s standard library and Git.

To inspect either offline archive, extract it into a new, empty directory. Keep the original ZIPs and proof files intact. Source restoration, production hosting and backend changes are separate actions; no restoration or deployment was performed while creating these backups and instructions.


## Verified deployment rehearsal — October 16, 2026

The actual `-Deploy` command succeeded through existing Git Credential Manager authentication. [Rollback CI 38898797381](https://github.com/sinaglr-eng/bastions-of-the-last-kingdom/actions/runs/38898797381) passed tests, build and deployment. The served 0.3.31 metadata, all five compiled entries and 113 active MP3s matched the preserved production archive / stable Git source. Main history, stable references and the statistics service were not changed by this restoration.

The return to 0.4.0 also passed, followed by a CSS-only color/readability correction. The final reviewed release is `v0.4.0-final` (`993a1ee1289fa137a68b7bbdad48b81b2e18befe`), with [successful final deployment](https://github.com/sinaglr-eng/bastions-of-the-last-kingdom/actions/runs/38902615525). To return to it after a future rollback, run the main Pages workflow with `release_ref=v0.4.0-final` using the GitHub Actions Run workflow form. When authenticated GitHub CLI is available:

```powershell
gh workflow run pages.yml --repo sinaglr-eng/bastions-of-the-last-kingdom --ref main -f release_ref=v0.4.0-final
```

A workflow dispatch always runs in main's deployment context; the checked-out release is independently established by the explicit ref and served hashes. Full receipts are in `output/design/cartographer-ui-v040-20261016/release-receipt.json`. The offline archives listed above retain their original bytes and checksums.

If the public GitHub contents API is rate limited, preflight verifies the same main workflow through GitHub’s public raw-file endpoint. This fallback still reads no credentials and dispatches nothing. Five synthetic checks cover the default path, raw fallback and authenticated dispatch failure boundaries; actual read-only preflight also passed with the public API quota exhausted.
