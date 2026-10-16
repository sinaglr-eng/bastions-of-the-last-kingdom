"""Create alpha-only UI derivatives; never overwrite approved source illustrations.

Install tools/portrait-cutout-requirements.txt in a task-local Python environment.
The optional --module-dir points to such an isolated package directory. No model,
network service, generated painting, RGB modification, or resampling is used.
"""
import argparse
import hashlib
import html
import json
from pathlib import Path
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--module-dir", type=Path)
parser.add_argument("--review-only", action="store_true", help="Rebuild review sheets from verified existing cutouts")
args = parser.parse_args()
if args.module_dir:
    sys.path.insert(0, str(args.module_dir.resolve()))
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "public/assets/ui/reference-portraits/manifest.json"
OUTPUT = ROOT / "public/assets/ui/reference-cutouts"
EVIDENCE = ROOT / "output/design/cartographer-ui-v041-20261016/portraits"
MASK_FILE = ROOT / "tools/reference-cutout-masks.json"
SETTINGS = json.loads(MASK_FILE.read_text(encoding="utf-8"))
REVISION = SETTINGS["revision"]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def paint_polygons(mask, polygons, value):
    for polygon in polygons:
        cv2.fillPoly(mask, [np.array(polygon, np.int32)], value)


def cutout(rgb, setting):
    """Border-calibrated color segmentation changes only an independent mask."""
    height, width = rgb.shape[:2]
    values = rgb.astype(np.float64)
    yy, xx = np.mgrid[:height, :width]
    features = np.stack([np.ones((height, width)), xx / width, yy / height,
                         xx * yy / (width * height)], axis=2)
    rim = np.zeros((height, width), bool)
    rim[:3] = rim[-3:] = True
    rim[:, :3] = rim[:, -3:] = True
    samples, colors = features[rim], values[rim]
    good = np.linalg.norm(colors - np.median(colors, axis=0), axis=1) < 25
    # Fit the cream paper's gentle lighting gradient. Reject weapons/labels that
    # touch a crop edge rather than declaring every boundary pixel background.
    for _ in range(3):
        coefficient = np.linalg.lstsq(samples[good], colors[good], rcond=None)[0]
        good = np.linalg.norm(colors - samples @ coefficient, axis=1) < 8
    background = features @ coefficient
    delta = values - background
    distance, chroma = np.linalg.norm(delta, axis=2), np.ptp(delta, axis=2)
    mask = np.where((distance < 22) | ((chroma < 10) & (values.min(axis=2) > 170)),
                    cv2.GC_PR_BGD, cv2.GC_PR_FGD).astype(np.uint8)
    shadow = (yy > height * .73) & (xx < width * .55) & (chroma < 20) & (values.min(axis=2) > 150)
    mask[(distance > 45) & ~shadow] = cv2.GC_FGD
    border = np.zeros((height, width), bool)
    border[:2] = border[-2:] = True
    border[:, :2] = border[:, -2:] = True
    mask[border & (distance < 55)] = cv2.GC_BGD
    paint_polygons(mask, setting.get("keepPolygons", []), cv2.GC_FGD)
    cv2.setRNGSeed(0)
    cv2.setNumThreads(1)
    cv2.grabCut(rgb, mask, None, np.zeros((1, 65), np.float64),
                np.zeros((1, 65), np.float64), 4, cv2.GC_INIT_WITH_MASK)
    foreground = (mask == cv2.GC_PR_FGD) | (mask == cv2.GC_FGD)
    # Enclosed light facets belong to robes/armor. Explicit bow/staff exclusions
    # retain genuine holes; hand-authored pale-part seeds cover ambiguous cases.
    if setting.get("fillEnclosedFacets", True):
        count, labels, stats, _ = cv2.connectedComponentsWithStats((~foreground).astype(np.uint8), 8)
        sums = np.bincount(labels.ravel(), weights=distance.ravel())
        for index in range(1, count):
            left, top, span_x, span_y, area = stats[index]
            if left > 0 and top > 0 and left + span_x < width and top + span_y < height * .76 and sums[index] / area > 14:
                foreground[labels == index] = True
    # Remove isolated caption fragments and board rules, not separate flying
    # bodies, pedestals, gems, bows, auras or character equipment.
    count, labels, stats, _ = cv2.connectedComponentsWithStats(foreground.astype(np.uint8), 8)
    for index in range(1, count):
        left, top, span_x, span_y, area = stats[index]
        if (area < 16 or (span_x < 3 and span_y > 25 and (left < 3 or left + span_x > width - 3))
                or (span_y < 9 and top < 12) or (span_y < 12 and span_x > 8 and top < height * .12)):
            foreground[labels == index] = False
    alpha = np.where(foreground, 255, 0).astype(np.uint8)
    if setting.get("silhouettePolygons"):
        allowed = np.zeros_like(alpha)
        paint_polygons(allowed, setting["silhouettePolygons"], 255)
        alpha = np.minimum(alpha, allowed)
    paint_polygons(alpha, setting.get("removePolygons", []), 0)
    # A one-pixel inward alpha transition softens a cut edge without importing
    # new pale background pixels or touching the original RGB channels.
    inside_distance = cv2.distanceTransform((alpha > 0).astype(np.uint8), cv2.DIST_L2, 5)
    alpha[(alpha > 0) & (inside_distance < 1.1)] = 220
    result = Image.fromarray(np.dstack([rgb, alpha]))
    bounds = result.getchannel("A").getbbox()
    assert bounds, "The segmentation must retain the actual subject"
    left, top, right, bottom = bounds
    # Integer trimming of fully transparent margins improves uniform framing.
    bounds = (max(0, left - 2), max(0, top - 2), min(width, right + 2), min(height, bottom + 2))
    return result.crop(bounds), list(bounds)


def review_gallery(rows):
    font_path = Path("C:/Windows/Fonts/arial.ttf")
    font = ImageFont.truetype(str(font_path), 15) if font_path.exists() else ImageFont.load_default()
    for background_name, background, ink in [("paper", "#F5EBD4", "#29251F"), ("dark", "#365459", "#FFFBF0")]:
        for start in range(0, len(rows), 24):
            sheet = Image.new("RGB", (1440, 1320), background)
            draw = ImageDraw.Draw(sheet)
            for index, row in enumerate(rows[start:start + 24]):
                x, y = index % 6 * 240, index // 6 * 330
                preview = ImageOps.contain(Image.open(ROOT / row["output"]), (228, 282))
                sheet.paste(preview, (x + (240 - preview.width) // 2, y + 4 + (282 - preview.height) // 2), preview)
                draw.text((x + 6, y + 288), row["id"], font=font, fill=ink)
                name = row["name"]
                while draw.textlength(name, font=font) > 228:
                    name = name[:-2] + "\u2026"
                draw.text((x + 6, y + 310), name, font=font, fill=ink)
            sheet.save(EVIDENCE / f"contact-{background_name}-{start // 24 + 1:02}.jpg", quality=95)
    cards = "\n".join(f'<figure><div class="portrait"><img loading="lazy" src="../../../../{html.escape(row["output"])}" alt="{html.escape(row["name"])}"></div><figcaption>{html.escape(row["name"])}</figcaption><small>{html.escape(row["id"])} | {row["dimensions"][0]} x {row["dimensions"][1]}</small></figure>' for row in rows)
    (EVIDENCE / "index.html").write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Transparent reference portraits</title><style>body{background:#F5EBD4;color:#29251F;font:16px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}figure{margin:0;padding:12px;border:1px solid #C4B18B;background:#FFFBF0}.portrait{background:repeating-conic-gradient(#365459 0 25%,#436268 0 50%) 50%/24px 24px}img{width:100%;height:300px;object-fit:contain}figcaption{font-weight:700;margin-top:8px}</style><h1>Transparent reference portraits</h1><p>136 original identities, with transparent backgrounds. Original RGB pixels are preserved. Integer trimming changes only empty margins. No model renders, recoloring or generated replacement art.</p><main>' + cards + '</main></html>\n', encoding="utf-8")


def main():
    original = json.loads(INPUT.read_text(encoding="utf-8"))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    rows = []
    for index, source_row in enumerate(original["identities"]):
        source = ROOT / source_row["output"]
        assert sha(source) == source_row["sha256"], f"Immutable crop changed: {source_row['id']}"
        rgb = np.array(Image.open(source).convert("RGB"))
        image, bounds = cutout(rgb, SETTINGS["identities"].get(source_row["id"], {}))
        left, top, right, bottom = bounds
        assert np.array_equal(np.array(image)[:, :, :3], rgb[top:bottom, left:right]), source_row["id"]
        output = OUTPUT / f"{source_row['id']}.png"
        image.save(output, optimize=True)
        alpha = np.array(image)[:, :, 3]
        rows.append({"id": source_row["id"], "name": source_row["name"], "category": source_row["category"],
                     "sourceCrop": source_row["output"], "sourceCropSha256": source_row["sha256"],
                     "originalSourceSha256": source_row["sourceSha256"], "sourceDimensions": source_row["dimensions"],
                     "sourceCropBounds": bounds, "output": output.relative_to(ROOT).as_posix(), "dimensions": list(image.size),
                     "sha256": sha(output), "transparentPixels": int((alpha == 0).sum()), "opaquePixels": int((alpha == 255).sum()),
                     "edgePixels": int(((alpha > 0) & (alpha < 255)).sum()),
                     "operation": "Alpha-only segmentation and integer transparent-margin trim; retained RGB pixels unchanged"})
        if index % 24 == 0:
            print(f"Prepared {index + 1}/136 transparent portraits", flush=True)
    manifest = {"revision": REVISION, "sourceRevision": original["revision"], "maskSha256": sha(MASK_FILE),
                "algorithm": "Deterministic border-calibrated GrabCut; protected pale facets; alpha-only edges; transparent-margin trim",
                "opencvVersion": cv2.__version__, "numpyVersion": np.__version__, "identities": rows}
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    review_gallery(rows)
    print(json.dumps({"identities": len(rows), "manifestSha256": sha(OUTPUT / "manifest.json"), "retainedRgbUnchanged": True,
                      "originalCropsUnchanged": True, "status": "Built; independent alpha/RGB and visual review required"}))


if __name__ == "__main__":
    if args.review_only:
        existing = json.loads((OUTPUT / "manifest.json").read_text(encoding="utf-8"))
        for row in existing["identities"]:
            assert sha(ROOT / row["output"]) == row["sha256"], row["id"]
        review_gallery(existing["identities"])
        print("Rebuilt all paper/dark review sheets from 136 verified cutouts.")
    else:
        main()
