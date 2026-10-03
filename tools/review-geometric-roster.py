"""Actual six-view source/render contact sheets. No image deformation or invented view.

Every subject receives six paired views at one uniform display scale per bitmap.
This is a visual review artifact, not a numerical silhouette or 1% accuracy claim.
"""
import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageOps

ROOT = Path(__file__).resolve().parents[1]
VIEWS = [('FRONT', 'front'), ('BACK', 'back'), ('LEFT', 'left'), ('RIGHT', 'right'),
         ('3/4 FRONT', 'three-quarter-front'), ('3/4 BACK', 'three-quarter-back')]
BG = (246, 241, 231)
INK = (54, 64, 61)


def font(size):
    for candidate in ['C:/Windows/Fonts/segoeui.ttf', 'C:/Windows/Fonts/arial.ttf']:
        if Path(candidate).exists():
            return ImageFont.truetype(candidate, size)
    return ImageFont.load_default()


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fitted(image, size, crop_alpha=False):
    rgba = image.convert('RGBA')
    if crop_alpha and rgba.getextrema()[3][0] == 0:
        bounds = rgba.getchannel('A').getbbox()
        if bounds:
            rgba = rgba.crop(bounds)
    # Display cropping/translation and a single isotropic scale; no shape edits.
    rgba = ImageOps.contain(rgba, size, Image.Resampling.LANCZOS)
    result = Image.new('RGB', size, BG)
    offset = ((size[0] - rgba.width) // 2, (size[1] - rgba.height) // 2)
    result.paste(rgba, offset, rgba)
    return result


def source_panel(image, index):
    w, h = image.size
    col, row = index % 3, index // 3
    return image.crop((col * w // 3, row * h // 2, (col + 1) * w // 3, (row + 1) * h // 2))


def render_root(subject):
    category = subject['category']
    if category == 'towers':
        return ROOT / 'output/design/geometric-game-v1/defenders/renders' / subject['id']
    if category == 'claire':
        category = 'champions'
    return ROOT / 'blender/renders/geometric-game-v1' / category / subject['id']


def build_subject(subject, out, asset=None):
    source = ROOT / 'public/geometric-turnarounds-v1' / subject['file']
    model_dir = render_root(subject)
    source_image = Image.open(source)
    image = Image.new('RGB', (1060, 2358), BG)
    draw = ImageDraw.Draw(image)
    draw.text((30, 18), f"{subject['id']}   {subject['name']}", font=font(26), fill=INK)
    draw.text((30, 60), 'SOURCE: approved geometric six views', font=font(16), fill=INK)
    draw.text((552, 60), 'MODEL: actual Blender render', font=font(16), fill=INK)
    renders, missing = [], []
    for index, (label, name) in enumerate(VIEWS):
        y = 93 + index * 367
        draw.text((30, y), label, font=font(19), fill=INK)
        image.paste(fitted(source_panel(source_image, index), (492, 328)), (25, y + 28))
        path = model_dir / (name + '.png')
        if path.exists():
            image.paste(fitted(Image.open(path), (492, 328), crop_alpha=True), (543, y + 28))
            renders.append({'view': label, 'path': str(path.relative_to(ROOT)).replace('\\', '/'),
                            'sha256': digest(path)})
        else:
            missing.append(label)
            draw.text((565, y + 160), 'RENDER NOT AVAILABLE YET', font=font(19), fill=(148, 64, 43))
        draw.line((25, y + 360, 1035, y + 360), fill=(214, 210, 201), width=1)
    draw.text((30, 2310), 'Display crops/scales are uniform. These sheets do not certify silhouette IoU or 1% dimensions.', font=font(15), fill=INK)
    category_dir = out / 'paired-six-views' / subject['category']
    category_dir.mkdir(parents=True, exist_ok=True)
    target = category_dir / (subject['id'] + '.jpg')
    image.save(target, quality=94, subsampling=0)
    asset = asset or {}
    qa = asset.get('qa', asset.get('metrics', {}))
    asset_file = ROOT / 'public/assets/geometric' / asset.get('file', '__missing__')
    asset_hash = digest(asset_file) if asset_file.exists() else None
    declared_views = asset.get('views', qa.get('views', []))
    return {'id': subject['id'], 'category': subject['category'], 'source': subject['file'],
            'source_sha256': digest(source), 'reference_manifest_sha256': subject['sha256'],
            'source_hash_matches': digest(source) == subject['sha256'],
            'asset_file': asset.get('file'), 'asset_sha256': asset_hash,
            'asset_manifest_sha256': qa.get('fileSha256'),
            'asset_hash_matches': asset_hash is not None and asset_hash == qa.get('fileSha256'),
            'declared_render_geometry_matches': len(declared_views) == 6 and all(v.get('geometrySha256') == qa.get('geometrySha256') for v in declared_views),
            'renders': renders, 'missing': missing,
            'comparison': str(target.relative_to(ROOT)).replace('\\', '/')}


def build_contacts(subjects, out):
    for category in ['towers', 'champions', 'claire', 'enemies']:
        group = [s for s in subjects if s['category'] == category]
        for offset in range(0, len(group), 12):
            page = group[offset:offset + 12]
            rows = (len(page) + 2) // 3
            image = Image.new('RGB', (1860, 54 + rows * 358), BG)
            draw = ImageDraw.Draw(image)
            draw.text((24, 12), f'{category.upper()}  |  SOURCE / ACTUAL MODEL  |  {offset + 1}-{offset + len(page)}', font=font(22), fill=INK)
            for index, subject in enumerate(page):
                x, y = (index % 3) * 620, 54 + (index // 3) * 358
                draw.text((x + 20, y + 9), subject['id'], font=font(19), fill=INK)
                source = Image.open(ROOT / 'public/geometric-turnarounds-v1' / subject['file'])
                image.paste(fitted(source_panel(source, 0), (282, 295)), (x + 13, y + 40))
                path = render_root(subject) / 'front.png'
                if path.exists():
                    image.paste(fitted(Image.open(path), (282, 295), crop_alpha=True), (x + 314, y + 40))
                else:
                    draw.text((x + 326, y + 180), 'Awaiting render', font=font(18), fill=(148, 64, 43))
                draw.line((x + 304, y + 40, x + 304, y + 339), fill=(211, 208, 198), width=1)
                draw.line((x + 10, y + 352, x + 610, y + 352), fill=(211, 208, 198), width=1)
            image.save(out / f'contact-{category}-{offset // 12 + 1}.jpg', quality=94, subsampling=0)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--require-complete', action='store_true')
    parser.add_argument('--output', default='output/design/geometric-game-v1/independent-visual-review')
    args = parser.parse_args()
    raw = (ROOT / 'public/geometric-turnarounds-v1/gallery-data.js').read_text(encoding='utf8').strip()
    roster = json.loads(raw.split('=', 1)[1].rstrip(';'))
    subjects = roster['sheets']
    assets, manifests = {}, []
    for name in ['geometric-defenders.json', 'geometric-champions.json', 'geometric-enemies.json']:
        path = ROOT / 'public/assets/geometric' / name
        manifest = json.loads(path.read_text(encoding='utf8'))
        manifests.append({'file': name, 'sha256': digest(path)})
        for asset in manifest.get('entries', manifest.get('assets', [])):
            assets[asset['id']] = asset
    out = ROOT / args.output
    out.mkdir(parents=True, exist_ok=True)
    results = [build_subject(subject, out, assets.get(subject['id'])) for subject in subjects]
    build_contacts(subjects, out)
    report = {'source_revision': roster['revision'], 'subjects': len(results),
              'expected_views': len(results) * 6,
              'actual_views': sum(len(r['renders']) for r in results),
              'complete_subjects': sum(not r['missing'] for r in results),
              'source_hashes_match': all(r['source_hash_matches'] for r in results),
              'asset_hashes_match': all(r['asset_hash_matches'] for r in results),
              'declared_render_geometry_matches': all(r['declared_render_geometry_matches'] for r in results),
              'model_manifests': manifests,
              'method': 'Actual source and Blender renders; only uniform display crops/scales; no warped registration.',
              'limitations': 'Visual review only. No claim that geometric coverage probes or silhouettes meet 1%/IoU0.97.',
              'results': results}
    (out / 'review-index.json').write_text(json.dumps(report, indent=2), encoding='utf8')
    print(json.dumps({k: v for k, v in report.items() if k != 'results'}))
    if args.require_complete and (report['actual_views'] != report['expected_views'] or not report['source_hashes_match'] or not report['asset_hashes_match'] or not report['declared_render_geometry_matches']):
        raise SystemExit('The actual six-view review is incomplete.')


if __name__ == '__main__':
    main()
