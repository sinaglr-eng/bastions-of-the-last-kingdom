"""Read-only independent check of exact cropped pixels and approved inputs."""
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
manifest = json.loads((ROOT / "public/assets/ui/reference-portraits/manifest.json").read_text())
sources = json.loads((ROOT / "docs/ui-cartographers-table-handoff-20261016/PORTRAIT_SOURCES.json").read_text())
approved = {row["id"]: row for row in sources["rows"]}
assert len(manifest["identities"]) == len(approved) == 136
assert {row["id"] for row in manifest["identities"]} == approved.keys()
checked = set()
for row in manifest["identities"]:
    source = ROOT / row["sourceFile"]
    target = ROOT / row["output"]
    expected = approved[row["id"]]
    assert hashlib.sha256(source.read_bytes()).hexdigest() == expected["sha256"] == row["sourceSha256"], row["id"]
    assert hashlib.sha256(target.read_bytes()).hexdigest() == row["sha256"], row["id"]
    x, y, width, height = row["rectangle"]
    original = Image.open(source)
    crop = Image.open(target)
    assert crop.size == (width, height) and crop.mode == original.mode, row["id"]
    assert crop.tobytes() == original.crop((x, y, x + width, y + height)).tobytes(), row["id"]
    checked.add(row["sourceSha256"])
assert len(checked) == 107
print(json.dumps({"status": "passed", "exactIdentityCrops": 136, "verifiedOriginalRasters": 107, "exactOriginalCropPixels": True, "runtimeResamplingOrRepainting": False}))
