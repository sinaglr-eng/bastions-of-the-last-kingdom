"""Extract all 50 approved FRONT enemy views with alpha-only background masks.

Original reference sheets, historical 136 crops/cutouts and the 0.4.2 crimson
derivative are immutable. Runtime RGB is copied exactly, without resizing.
"""
import argparse
import hashlib
import html
import importlib.util
import json
from pathlib import Path
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--module-dir', type=Path)
parser.add_argument('--review-only', action='store_true')
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
shared_path = root / 'tools/build-reference-cutouts.py'
saved_arguments = sys.argv
sys.argv = [str(shared_path)] + (['--module-dir', str(args.module_dir)] if args.module_dir else [])
spec = importlib.util.spec_from_file_location('original_alpha_cutout', shared_path)
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)
sys.argv = saved_arguments
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageOps

output = root / 'public/assets/ui/reference-enemy-fronts'
evidence = root / 'output/design/ui-refinements-v043-20261018/front-enemies'
settings_path = root / 'tools/enemy-front-cutout-masks.json'
settings = json.loads(settings_path.read_text(encoding='utf-8'))
original_manifest = root / 'public/assets/ui/reference-portraits/manifest.json'
sha = lambda file: hashlib.sha256(file.read_bytes()).hexdigest()


def historical_hashes():
    paths = [*sorted((root / 'public/assets/ui/reference-portraits').glob('*')),
             *sorted((root / 'public/assets/ui/reference-cutouts').glob('*')),
             root / 'public/assets/ui/portrait-variants/lord-bernhard-crimson-reference.png',
             root / 'public/assets/ui/portrait-variants/manifest.json']
    return {file.relative_to(root).as_posix(): sha(file) for file in paths if file.is_file()}


def review(rows):
    font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 16)
    for name, background, ink in [('paper', '#F5EBD4', '#302719'), ('dark', '#365459', '#FFFBF0')]:
        for start in range(0, len(rows), 15):
            sheet = Image.new('RGB', (1500, 1110), background)
            draw = ImageDraw.Draw(sheet)
            for index, row in enumerate(rows[start:start + 15]):
                x, y = index % 5 * 300, index // 5 * 370
                image = ImageOps.contain(Image.open(root / row['output']), (284, 320))
                sheet.paste(image, (x + (300-image.width)//2, y + (324-image.height)//2), image)
                draw.text((x+8, y+331), row['id'] + ' · FRONT', font=font, fill=ink)
                label = row['name']
                while draw.textlength(label, font=font) > 286:
                    label = label[:-2] + '…'
                draw.text((x+8, y+352), label, font=font, fill=ink)
            sheet.save(evidence / f'contact-{name}-{start//15+1:02}.jpg', quality=95)
    cards = ''.join(f'<figure><div class="portrait"><img loading="lazy" src="../../../../{html.escape(row["output"])}" alt="{html.escape(row["name"])} · Front view"></div><figcaption>{html.escape(row["name"])}</figcaption><small>{row["id"]} · FRONT · {row["dimensions"][0]} × {row["dimensions"][1]}</small></figure>' for row in rows)
    (evidence / 'index.html').write_text('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Front enemy portraits</title><style>body{background:#f5ebd4;color:#302719;font:16px system-ui;margin:24px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:16px}figure{margin:0;padding:12px;border:1px solid #bba57e;background:#fff8e8}.portrait{background:repeating-conic-gradient(#365459 0 25%,#436268 0 50%) 50%/24px 24px}img{width:100%;height:320px;object-fit:contain}figcaption{font-weight:700;margin-top:8px}small{display:block;margin-top:5px}</style><h1>Front enemy portraits</h1><p>All 50 enemies use the top-left FRONT panel of their approved geometric reference. Original RGB pixels are unchanged; only transparency and fully transparent margins change. Lord Bernhard uses the approved crimson reference. The historical 136 portraits and 0.4.2 crimson cutout remain unchanged.</p><main>'+cards+'</main></html>\n', encoding='utf-8')


def remove_sheet_fragments(image, trim, rectangle):
    """Remove detached caption/border components, preserving all RGB bytes."""
    rgba = np.array(image)
    count, labels, stats, _ = cv2.connectedComponentsWithStats((rgba[:, :, 3] > 0).astype(np.uint8), 8)
    cleanups = []
    for index in range(1, count):
        left, top, width, height, area = [int(value) for value in stats[index]]
        x, y = rectangle[0]+trim[0]+left, rectangle[1]+trim[1]+top
        border = width <= 3 and height > 6 and (x < 12 or x > 498)
        caption = area < 1000 and height <= 18 and (y < 52 or y > 455)
        if border or caption:
            rgba[labels == index, 3] = 0
            cleanups.append({'sourceBounds': [x, y, width, height], 'pixels': area,
                             'reason': 'Detached sheet border' if border else 'Detached sheet caption fragment'})
    image = Image.fromarray(rgba)
    bounds = image.getchannel('A').getbbox()
    assert bounds
    x, y, right, bottom = bounds
    bounds = [max(0,x-2), max(0,y-2), min(image.width,right+2), min(image.height,bottom+2)]
    return image.crop(tuple(bounds)), [trim[0]+bounds[0], trim[1]+bounds[1], trim[0]+bounds[2], trim[1]+bounds[3]], cleanups


def build():
    old_hashes = historical_hashes()
    originals = json.loads(original_manifest.read_text(encoding='utf-8'))
    sources = [row for row in originals['identities'] if row['category'] == 'enemies']
    assert len(sources) == 50
    rows = []
    for index, row in enumerate(sources):
        crimson = row['id'] == 'host_50'
        variant = json.loads((root / 'public/assets/ui/portrait-variants/manifest.json').read_text(encoding='utf-8')) if crimson else None
        source = root / (variant['source'] if crimson else row['sourceFile'])
        expected = variant['sourceSha256'] if crimson else row['sourceSha256']
        assert sha(source) == expected, f'Approved original changed: {row["id"]}'
        image = Image.open(source).convert('RGB')
        assert image.size == (1536, 1024), f'Review source layout before cropping {row["id"]}'
        setting = settings['identities'].get(row['id'], {})
        rectangle = setting.get('sourceRectangle', settings['sourceRectangle'])
        x, y, right, bottom = rectangle
        assert 0 <= x < right <= 512 and 0 <= y < bottom <= 512, 'Only the top-left FRONT panel is allowed'
        rgb = np.asarray(image.crop(tuple(rectangle)))
        cutout, trim = shared.cutout(rgb, setting)
        cutout, trim, cleanups = remove_sheet_fragments(cutout, trim, rectangle)
        result = np.asarray(cutout)
        left, top, trim_right, trim_bottom = trim
        assert np.array_equal(result[:, :, :3], rgb[top:trim_bottom, left:trim_right]), row['id']
        file = output / (row['id'] + '.png')
        cutout.save(file, optimize=True)
        alpha = result[:, :, 3]
        rows.append({'id': row['id'], 'name': row['name'], 'category': 'enemies', 'view': 'FRONT',
                     'source': source.relative_to(root).as_posix(), 'sourceSha256': sha(source),
                     'sourceRole': 'Approved crimson geometric reference' if crimson else 'Immutable geometric model-authoring reference',
                     'sourceDimensions': list(image.size), 'sourceRectangle': rectangle,
                     'rectangleMode': 'left, top, right, bottom', 'trimRectangle': trim,
                     'output': file.relative_to(root).as_posix(), 'dimensions': list(cutout.size), 'sha256': sha(file),
                     'transparentPixels': int((alpha == 0).sum()), 'opaquePixels': int((alpha == 255).sum()),
                     'edgePixels': int(((alpha > 0) & (alpha < 255)).sum()), 'preservedRgb': True,
                     'removedSheetComponents': cleanups,
                     'opaqueProbesSource': setting.get('opaqueProbesSource', []),
                     'reviewStatus': settings['reviewStatus'],
                     'reviewDecision': setting.get('reviewDecision', 'Top-left FRONT panel; full subject and equipment, without heading or view caption.'),
                     'operation': 'Exact approved RGB crop; deterministic independent alpha mask and transparent-margin trim only'})
        if index % 10 == 0:
            print(f'Prepared FRONT {index+1}/50', flush=True)
    assert old_hashes == historical_hashes(), 'Historical portrait assets must remain byte-identical'
    manifest = {'revision': settings['revision'], 'sourceManifest': original_manifest.relative_to(root).as_posix(),
                'sourceManifestSha256': sha(original_manifest), 'maskSettings': settings_path.relative_to(root).as_posix(),
                'maskSettingsSha256': sha(settings_path), 'algorithm': 'Original deterministic border-calibrated alpha-only cutout',
                'historicalAssetsPreserved': True, 'historicalAssetsSha256': old_hashes,
                'visualReview': settings.get('reviewScope', 'Visual contact review is required'),
                'opencvVersion': cv2.__version__, 'numpyVersion': np.__version__, 'identities': rows}
    (output / 'manifest.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')
    review(rows)
    proof = {'revision': settings['revision'], 'identities': len(rows), 'allFront': all(row['view'] == 'FRONT' for row in rows),
             'allSourceHashesMatch': True, 'allRgbExact': True, 'historicalAssetsPreserved': True,
             'manifestSha256': sha(output/'manifest.json'), 'reviewStatus': settings['reviewStatus']}
    (evidence/'pixel-verification.json').write_text(json.dumps(proof, indent=2)+'\n', encoding='utf-8')
    print(json.dumps(proof), flush=True)


output.mkdir(parents=True, exist_ok=True)
evidence.mkdir(parents=True, exist_ok=True)
if args.review_only:
    manifest = json.loads((output/'manifest.json').read_text(encoding='utf-8'))
    for row in manifest['identities']:
        assert sha(root/row['output']) == row['sha256']
    review(manifest['identities'])
else:
    build()
