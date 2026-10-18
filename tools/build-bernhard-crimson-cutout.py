"""Extract the approved crimson Bernhard front view without repainting pixels."""
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--module-dir', type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
shared = root / 'tools/build-reference-cutouts.py'
saved_arguments = sys.argv
sys.argv = [str(shared)] + (['--module-dir', str(args.module_dir)] if args.module_dir else [])
spec = importlib.util.spec_from_file_location('approved_cutouts', shared)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
sys.argv = saved_arguments

from PIL import Image
import numpy as np

source = root / 'public/assets/ui/portrait-variants/lord-bernhard-crimson-reference.png'
output = root / 'public/assets/ui/reference-cutouts/host_50-crimson.png'
rectangle = [8, 35, 508, 462]
original = Image.open(source).convert('RGB')
crop = np.asarray(original.crop(rectangle))
result, trim = module.cutout(crop, {})
result.save(output, optimize=True)
rgba = np.asarray(result)
expected = crop[trim[1]:trim[3], trim[0]:trim[2]]
assert np.array_equal(rgba[:, :, :3], expected), 'Original approved RGB must be preserved'
assert (rgba[:, :, 3] == 0).any() and (rgba[:, :, 3] == 255).any()
digest = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
manifest = {
    'revision': 'bernhard-crimson-20261018-v1',
    'identity': 'host_50',
    'name': 'Lord Bernhard, the Black Sorcerer on the Wyvern Queen',
    'source': source.relative_to(root).as_posix(),
    'sourceSha256': digest(source),
    'sourceRole': 'Previously approved geometric reference with dark crimson accents',
    'sourceRectangle': rectangle,
    'trimRectangle': trim,
    'output': output.relative_to(root).as_posix(),
    'dimensions': list(result.size),
    'sha256': digest(output),
    'preservedRgb': True,
    'transparency': 'Independent alpha mask; no source recoloring, resampling or repainting',
    'historicalAssets': 'The original 136 portraits and cutouts remain unchanged'
}
(source.parent / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
print(json.dumps(manifest))
