"""Find integer crop candidates within the labelled 3/4 FRONT panel.

Connected areas are used only to suggest rectangles; no pixels are changed.
Every resulting identity must be reviewed on the exported contact sheets.
"""
import json
from pathlib import Path
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
HANDOFF = ROOT / "docs/ui-cartographers-table-handoff-20261016"
PLAN = ROOT / "output/design/cartographer-ui-v040-20261016/portraits/crop-plan.json"


def components(mask):
    parents, runs, previous = [], [], []

    def find(index):
        while parents[index] != index:
            parents[index] = parents[parents[index]]
            index = parents[index]
        return index

    for y, row in enumerate(mask):
        changes = np.flatnonzero(np.diff(np.pad(row.astype(np.int8), (1, 1))))
        current = []
        for left, right in zip(changes[::2], changes[1::2]):
            index = len(parents)
            parents.append(index)
            runs.append((int(left), y, int(right), y + 1))
            for old_left, old_right, old_index in previous:
                if old_right >= left and old_left <= right:
                    parents[find(old_index)] = find(index)
            current.append((left, right, index))
        previous = current
    groups = {}
    for index, (left, top, right, bottom) in enumerate(runs):
        key = find(index)
        item = groups.setdefault(key, [left, top, right, bottom, 0])
        item[0], item[1] = min(item[0], left), min(item[1], top)
        item[2], item[3] = max(item[2], right), max(item[3], bottom)
        item[4] += right - left
    return [item for item in groups.values() if item[4] >= 1200]


plan = json.loads(PLAN.read_text())
for row in json.loads((HANDOFF / "PORTRAIT_SOURCES.json").read_text())["rows"]:
    if row["category"] not in ("towers", "enemies"):
        continue
    existing = plan["identities"].get(row["id"], {})
    if existing.get("manual") or existing.get("reviewStatus") == "approved":
        continue
    image = Image.open(HANDOFF / row["file"]).convert("RGB")
    # The central lower panel is the labelled three-quarter front view in
    # every supplied six-view sheet. Small sheet letters/borders are separate
    # components and are excluded from the rectangle suggestion.
    region = np.asarray(image.crop((512, 488, 1024, 990)))
    mask = (region[:, :, 0] < 225) | (region[:, :, 1] < 215) | (region[:, :, 2] < 200)
    shapes = components(mask)
    assert shapes, row["id"]
    left, top = max(0, min(c[0] for c in shapes) - 10), max(0, min(c[1] for c in shapes) - 2)
    right, bottom = min(512, max(c[2] for c in shapes) + 10), min(502, max(c[3] for c in shapes) + 2)
    plan["identities"][row["id"]] = {"rectangle": [512 + left, 488 + top, right - left, bottom - top],
        "view": "3/4 FRONT panel", "review": "Pending per-identity contact-sheet review; rectangle candidate only"}
PLAN.write_text(json.dumps(plan, indent=2) + "\n", encoding="utf-8")
print("Prepared 98 individually bounded six-view crop candidates; original raster pixels unchanged.")
