"""Prepare the recovered current Blood-Leech reference as an alpha-only UI crop."""
import argparse, hashlib, importlib.util, json, sys
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--module-dir', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
shared_file = root / 'tools/build-reference-cutouts.py'
sys.argv = [str(shared_file)] + (['--module-dir', str(args.module_dir)] if args.module_dir else [])
spec = importlib.util.spec_from_file_location('reference_alpha', shared_file)
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)
import numpy as np
from PIL import Image

source = root / 'output/design/enemies-reconstruction-v6/references/view-crops/host_38-wraith/front.png'
sheet = root / 'output/design/enemies-reconstruction-v6/references/inferred-variants/host_38-wraith.png'
sha = lambda f: hashlib.sha256(f.read_bytes()).hexdigest()
assert sha(source) == 'bed939409a76785f127fe5ca2bb0994590914dfe5f9e4c320f3415d753c76cc8'
assert sha(sheet) == '930ae56f7f626c1524c278b0d10e55b6d3dc579b09b316117e1590d23c3f03f6'
image = Image.open(source).convert('RGB')
assert image.size == (384, 341)
# Exclude the detached FRONT caption and sheet border, keeping the full body,
# backpack, hands, feet and pedestal. No RGB modification or resampling.
rectangle = [4, 4, 380, 312]
rgb = np.asarray(image.crop(tuple(rectangle)))
cutout, trim = shared.cutout(rgb, {})
pixels = np.asarray(cutout)
left, top, right, bottom = trim
assert np.array_equal(pixels[:, :, :3], rgb[top:bottom, left:right])
assert np.any(pixels[:, :, 3] == 0) and np.any(pixels[:, :, 3] == 255)
output = root / 'public/assets/ui/reference-enemy-fronts/host_38-wraith.png'
cutout.save(output, optimize=True)
record = {'id':'host_38-wraith','name':'Blood-Leech Trolls','view':'FRONT',
 'revision':'blood-leech-recovered-reference-fr008-20261106','sourceKind':'Recovered current model-authoring reference crop',
 'source':source.relative_to(root).as_posix(),'sourceSha256':sha(source),
 'parentSheet':sheet.relative_to(root).as_posix(),'parentSheetSha256':sha(sheet),
 'parentEvidenceKind':'Generated inferred variant reference recorded by the V6 modeling package; no new human appearance approval is claimed.',
 'sourceRectangle':rectangle,'trimRectangle':trim,'output':output.relative_to(root).as_posix(),
 'sha256':sha(output),'dimensions':list(cutout.size),'preservedRgb':True,'resampled':False,
 'operation':'Existing deterministic alpha-only UI pipeline; trim caption and transparent margins only',
 'modelRenderFallbackUsed':False,'sourceModel':'public/assets/geometric/approved-enemies-v6/host_38-wraith.glb',
 'sourceModelSha256':'900aaeb6854215cc64081486943af6424a669872f39a6f616a7675b0bfaf83b5'}
(output.parent/'blood-leech-reference.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
(root/'output/implementation/fr008-current/portrait-provenance.json').write_text(json.dumps(record,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'status':'passed','dimensions':list(cutout.size),'sha256':sha(output),'preservedRgb':True}))
