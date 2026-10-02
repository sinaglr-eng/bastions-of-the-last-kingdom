"""Production defender authoring dispatch; never downgrade native animated assets.

Blender 5.2 --background --python blender/scripts/author_defenders_v8.py
    [--family soldier,worldfire,ladyclaire] [--no-render]
Hidden archival families are generated only when explicitly requested.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))
ROOT = HERE.parent.parent
OUT = ROOT / 'public/assets/models'
DATA = json.loads((ROOT / 'data/towers.json').read_text(encoding='utf-8'))


def merge_rows(rows):
    destination = OUT / 'manifest.json'
    entries = json.loads(destination.read_text(encoding='utf-8'))
    for row in rows:
        entries = [entry for entry in entries if not (
            entry.get('kind') == 'tower' and entry.get('family') == row['family']
            and entry.get('tier') == row['tier'])]
        entries.append(row)
    destination.write_text(json.dumps(entries, indent=2) + '\n', encoding='utf-8')


def generate(render=True, family=None):
    import defender_humans_v8 as humans
    import author_defender_creatures_v8 as creatures
    requested = family.split(',') if family else [key for key, tower in DATA.items() if not tower.get('hidden')]
    if not requested or any(key not in DATA for key in requested):
        raise ValueError('Unknown defender family')
    human_families = [key for key in requested if key in humans.BASIC + humans.FAMILIES]
    creature_families = [key for key in requested if key in creatures.OWNED]
    if human_families:
        humans.generate(human_families, render=render)
        patch = ROOT / 'artifacts' / ('defender-humans-v8-metadata-' + human_families[0] + '.json')
        merge_rows(json.loads(patch.read_text(encoding='utf-8')))
    if creature_families:
        creatures.generate(creature_families, render=render)
        rows = json.loads((ROOT / 'artifacts/defender-creatures-v8-metadata.json').read_text(encoding='utf-8'))
        merge_rows([row for row in rows if row['family'] in creature_families])
    secret_families = [key for key in requested if DATA[key].get('secret')]
    if secret_families:
        import author_secret_champions
        author_secret_champions.generate(render=render, family=','.join(secret_families))
    handled = set(human_families + creature_families + secret_families)
    if handled != set(requested):
        raise ValueError('Missing native author for ' + ','.join(set(requested) - handled))
    print('DESIGNED_DEFENDERS_V8 requested native surfaces and animations complete', flush=True)


if __name__ == '__main__':
    family = sys.argv[sys.argv.index('--family') + 1] if '--family' in sys.argv else None
    generate(render='--no-render' not in sys.argv, family=family)
