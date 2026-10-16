# Transparent reference portraits

This gallery contains the 136 original geometric character identities used by the game. The portraits now have real PNG transparency, so the parchment and colored portrait frames remain visible around each character. Original pedestals, equipment, floating crystals and detached flying figures are retained.

The user authorized deterministic background removal by script. These are separate derivatives in `public/assets/ui/reference-cutouts/`; all 136 original opaque crops and all 107 approved source images remain byte-for-byte unchanged. The original recorded prompts and review records remain unchanged as well.

Only alpha and empty canvas margins change. Every RGB channel in each output is byte-identical to the corresponding integer rectangle of its original crop. There is no recoloring, generated replacement art or runtime image resampling. The review contact sheets resize images for inspection only.

## Review evidence

- `index.html`: all 136 identities on a checkerboard background, with English names.
- `contact-paper-01.jpg` through `contact-paper-06.jpg`: all identities on parchment.
- `contact-dark-01.jpg` through `contact-dark-06.jpg`: all identities on a contrasting dark background.
- `pixel-verification.json`: independent PNG alpha, source hash and exact RGB checks.
- `visual-review.json`: agent inspection record for the delivered contact sheets.
- `targeted-tests.txt`: runtime mapping, image decode, stale-image race and PNG pixel test results.

Pale hoods, white cloth and silver armor were inspected separately. Protected foreground seeds preserve the ambiguous ivory regions, including Archer IV, Druid IV/VI, Frost Warden IV, Cleric V/VI, Angel, Lady Claire and Archbishop. Bow and staff openings remain transparent. The source miniatures' stone pedestals remain part of the artwork.

## Rebuild and verify

From the repository root, install `tools/portrait-cutout-requirements.txt` in an isolated Python environment, then run:

```text
python tools/build-reference-cutouts.py
python tools/verify-reference-cutouts.py
node --test tests/reference-portraits.test.mjs tests/portrait-visibility.test.mjs tests/reference-cutouts.test.mjs
```

The builder accepts `--module-dir <isolated-package-directory>` and `--review-only`. The segmentation is deterministic and uses the foreground seeds in `tools/reference-cutout-masks.json`. Its manifest records source hashes, integer crop bounds, output hashes and actual alpha pixel counts for every identity.

Runtime URLs and the native image-decode guard accept the new `reference-cutouts` namespace. Revision `reference-cutouts-20261016-v1` is recorded in the runtime map and release metadata. This portrait review does not claim physical iPad testing; integrated device interaction checks belong to the game release verification.
