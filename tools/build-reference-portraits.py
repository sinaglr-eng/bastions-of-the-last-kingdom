"""Crop immutable approved illustration pixels into exact-identity UI pictures.

No rendering, generation, color change, mirroring, or resampling is performed.
Run from the checkout root with the bundled Pillow runtime.
"""
import hashlib
import html
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
HANDOFF = ROOT / "docs/ui-cartographers-table-handoff-20261016"
EVIDENCE = ROOT / "output/design/cartographer-ui-v040-20261016/portraits"
OUTPUT = ROOT / "public/assets/ui/reference-portraits"
REVISION = "original-reference-20261016-v1"


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main():
    source_manifest = json.loads((HANDOFF / "PORTRAIT_SOURCES.json").read_text())
    plan = json.loads((EVIDENCE / "crop-plan.json").read_text())
    OUTPUT.mkdir(parents=True, exist_ok=True)
    rows = []
    for identity in source_manifest["rows"]:
        key = identity["id"]
        source = HANDOFF / identity["file"]
        assert sha(source) == identity["sha256"], f"Original source changed: {key}"
        setting = plan["identities"].get(key, plan["sixViewDefault"] if identity["category"] in ("towers", "enemies") else None)
        assert setting, f"Missing subject-specific crop: {key}"
        image = Image.open(source)
        x, y, width, height = setting["rectangle"]
        assert x >= 0 and y >= 0 and width > 0 and height > 0 and x + width <= image.width and y + height <= image.height
        cropped = image.crop((x, y, x + width, y + height))
        output = OUTPUT / f"{key}.png"
        if not output.exists() or Image.open(output).size != cropped.size or Image.open(output).tobytes() != cropped.tobytes():
            cropped.save(output, optimize=True)
        assert Image.open(output).tobytes() == cropped.tobytes(), f"Changed crop pixels: {key}"
        rows.append({"id": key, "name": identity["name"], "category": identity["category"],
                     "source": identity["source"], "sourceFile": str(source.relative_to(ROOT)).replace("\\", "/"),
                     "sourceSha256": identity["sha256"], "sourceDimensions": list(image.size),
                     "rectangle": [x, y, width, height], "view": setting["view"],
                     "output": str(output.relative_to(ROOT)).replace("\\", "/"), "dimensions": list(cropped.size),
                     "sha256": sha(output), "operation": "Exact original pixels; integer rectangle crop only",
                     "reviewStatus": setting.get("reviewStatus", "pending"),
                     "review": setting.get("review", "Pending contact-sheet review")})
    manifest = {"revision": REVISION, "date": "2026-10-16", "identities": rows}
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    EVIDENCE.mkdir(parents=True, exist_ok=True)
    font_path = Path("C:/Windows/Fonts/arial.ttf")
    font = ImageFont.truetype(str(font_path), 15) if font_path.exists() else ImageFont.load_default()
    pages = []
    for start in range(0, len(rows), 24):
        subset = rows[start:start + 24]
        sheet = Image.new("RGB", (1440, 1320), "#F5EBD4")
        draw = ImageDraw.Draw(sheet)
        for index, row in enumerate(subset):
            x, y = (index % 6) * 240, (index // 6) * 330
            preview = ImageOps.contain(Image.open(ROOT / row["output"]).convert("RGB"), (228, 282))
            sheet.paste(preview, (x + (240 - preview.width) // 2, y + 4 + (282 - preview.height) // 2))
            draw.text((x + 6, y + 288), row["id"], font=font, fill="#29251F")
            name = row["name"]
            while draw.textlength(name, font=font) > 228:
                name = name[:-2] + "…"
            draw.text((x + 6, y + 310), name, font=font, fill="#29251F")
        page = f"contact-sheet-{start // 24 + 1:02}.jpg"
        sheet.save(EVIDENCE / page, quality=94)
        pages.append(page)
    cards = "\n".join(f'<figure><img loading="lazy" src="../../../../{html.escape(row["output"])}" alt="{html.escape(row["name"])}"><figcaption>{html.escape(row["name"])} · {html.escape(row["id"])}</figcaption><p>{html.escape(row["view"])} · {row["dimensions"][0]} × {row["dimensions"][1]}</p></figure>' for row in rows)
    gallery = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Original-reference portrait review</title><style>body{background:#F5EBD4;color:#29251F;font:16px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px}figure{margin:0;padding:12px;border:1px solid #C4B18B;background:#FFFBF0}img{width:100%;height:300px;object-fit:contain}figcaption{font-weight:700}p{font-size:13px}</style><h1>Original-reference portrait review</h1><p>136 exact identities. Integer crops of approved model-authoring illustrations. Original pixels are preserved; no model renders or generated art.</p><main>' + cards + '</main></html>\n'
    (EVIDENCE / "index.html").write_text(gallery, encoding="utf-8")
    reviewed = sum(row["reviewStatus"] == "approved" for row in rows)
    proof = {"status": "CROPPED AND VISUALLY REVIEWED" if reviewed == len(rows) else "CROPPED; VISUAL REVIEW PENDING", "identities": len(rows), "visuallyReviewedIdentities": reviewed, "reviewScope": "Agent inspection of all six labelled contact sheets plus original shared champion boards and exceptional full sources; not human sign-off or physical-device QA", "uniqueOriginalSources": len(set(row["sourceSha256"] for row in rows)), "originalSourcesVerified": True, "cropPixelsVerified": True, "resampledRuntimeImages": False, "contactSheets": pages, "manifestSha256": sha(OUTPUT / "manifest.json")}
    (EVIDENCE / "crop-proof.json").write_text(json.dumps(proof, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(proof))


if __name__ == "__main__":
    main()
