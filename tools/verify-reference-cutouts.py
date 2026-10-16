"""Independent read-only proof: transparency, original RGB, probes and source bytes."""
import hashlib
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
manifest_file = ROOT / "public/assets/ui/reference-cutouts/manifest.json"
manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
original = json.loads((ROOT / "public/assets/ui/reference-portraits/manifest.json").read_text(encoding="utf-8"))
settings = json.loads((ROOT / "tools/reference-cutout-masks.json").read_text(encoding="utf-8"))
originals = {row["id"]: row for row in original["identities"]}
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
assert len(manifest["identities"]) == len(originals) == 136
assert {row["id"] for row in manifest["identities"]} == originals.keys()
checked_sources, checked_probes, total_bytes = set(), 0, 0
for row in manifest["identities"]:
    before = originals[row["id"]]
    source, output = ROOT / row["sourceCrop"], ROOT / row["output"]
    assert sha(source) == row["sourceCropSha256"] == before["sha256"], row["id"]
    assert sha(output) == row["sha256"], row["id"]
    source_pixels = np.array(Image.open(source).convert("RGB"))
    image = Image.open(output)
    assert image.mode == "RGBA" and list(image.size) == row["dimensions"], row["id"]
    pixels = np.array(image)
    left, top, right, bottom = row["sourceCropBounds"]
    assert 0 <= left < right <= source_pixels.shape[1] and 0 <= top < bottom <= source_pixels.shape[0], row["id"]
    assert np.array_equal(pixels[:, :, :3], source_pixels[top:bottom, left:right]), row["id"]
    alpha = pixels[:, :, 3]
    assert int((alpha == 0).sum()) == row["transparentPixels"] > alpha.size * .05, row["id"]
    assert int((alpha == 255).sum()) == row["opaquePixels"] > alpha.size * .15, row["id"]
    assert int(((alpha > 0) & (alpha < 255)).sum()) == row["edgePixels"] > 0, row["id"]
    for x, y in settings["opaqueProbes"].get(row["id"], []):
        assert int(alpha[y - top, x - left]) == 255, f"Pale subject erased: {row['id']} at {(x, y)}"
        checked_probes += 1
    if before["sourceSha256"] not in checked_sources:
        assert sha(ROOT / before["sourceFile"]) == before["sourceSha256"], row["id"]
        checked_sources.add(before["sourceSha256"])
    total_bytes += output.stat().st_size
assert len(checked_sources) == 107
proof = {"status": "passed", "identities": 136, "immutableOriginalCrops": 136, "immutableOriginalSources": 107,
         "realPngAlpha": True, "retainedRgbByteExact": True, "resampledRuntimeImages": False,
         "paleArmorAndClothProbes": checked_probes, "outputBytes": total_bytes, "manifestSha256": sha(manifest_file)}
destination = ROOT / "output/design/cartographer-ui-v041-20261016/portraits/pixel-verification.json"
destination.write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
print(json.dumps(proof))
