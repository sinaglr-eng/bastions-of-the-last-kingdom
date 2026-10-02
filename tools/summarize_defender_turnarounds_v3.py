"""Package measured native/export checks and honest reference discrepancies.

Run after author_defender_turnarounds_v3.py, check_defender_turnarounds_v3.py,
and analyze_defender_turnarounds_v3.py. No metric is inferred from file existence.
"""
import csv
import hashlib
import json
import re
import shutil
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'output/design/hooded-turnarounds-v3'
CONFIG = ROOT / 'blender/scripts/defender_turnarounds_v3'
FAMILIES = ['soldier', 'archer', 'druid', 'mage', 'cleric', 'runebreaker', 'frostwarden', 'stormcaller']

def read(path):
    return json.loads(path.read_text(encoding='utf-8'))

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def build():
    qa = read(OUT / 'structural-qa.json')
    comparison = read(OUT / 'comparison/comparison-results.json')
    roundtrip = read(OUT / 'roundtrip-qa.json')
    assert roundtrip['status'] == 'passed' and roundtrip['modelsPassed'] == 48
    exact = {(x['family'],x['rank']): x for x in roundtrip['models']}
    configs = [read(CONFIG / (name + '-measurements.json')) for name in ['martials', 'casters', 'specialists']]
    metrics = [item for family in FAMILIES for item in read(OUT / (family + '-metrics.json'))]
    assert len(metrics) == len(qa['units']) == 48
    assert len(comparison['views']) == 192
    native = {(item['family'], item['rank']): item for item in qa['units']}
    units, table = [], []
    for exported in metrics:
        family, rank = exported['family'], exported['tier']
        visual = 'engineer' if family == 'runebreaker' else family
        config = next(c for c in configs if visual in c)
        authoring = next(c for c in config[visual] if c['rank'] == rank)
        actual = native[family, rank]
        h = actual['bareBodyHMeasured'] or actual['bareBodyHFromAuthoringConfig']
        views = [v for v in comparison['views'] if v['family'] == family and v['rank'] == rank]
        parts = []
        for part in actual['evaluatedMeshReports']:
            bounds = part['boundsWithoutLayoutTranslation']
            parts.append({'name': part['part'], 'holdingHand': part['handAncestor'],
                          'materials': part['materialSlots'], 'bounds': bounds,
                          'boundsNormalizedByH': {k: [x/h for x in v] for k,v in bounds.items()},
                          'triangles': part['triangles']})
        model_path = OUT / 'glb' / exported['file']
        live_path = ROOT / 'public/assets/models' / exported['file']
        digest = sha(model_path)
        assert digest == exported['sha256'] == sha(live_path), (family, rank, 'integrated model hash')
        proof = exact[family,rank]
        assert digest == proof['glbSha256']
        assert sha(ROOT / proof['nativeScene']) == proof['nativeSceneSha256']
        portrait = ROOT / f'public/assets/army/{family}-t{rank}.png'
        assert sha(portrait) == sha(OUT / f'portraits/{family}-t{rank}.png')
        reference = ROOT / f'blender/references/hooded-turnarounds-v3/{visual}-variant-b-turnaround.png'
        unit = {'family': family, 'rank': rank, 'reference': str(reference.relative_to(ROOT)),
                'referenceSha256': sha(reference), 'authoringSpecification': authoring,
                'workingH': h, 'workingHIndependentRasterMeasurement': False,
                'workingHMeaning': actual['bareBodyHMeaning'],
                'observedSourceFeatures': config['sourceObservations'].get(visual),
                'inferredHiddenConstruction': config['inferredHiddenConstruction'],
                'actualMeasuredPhysicalParts': parts,
                'actualHandJoints': actual['handJoints'],
                'actualAuthoredJointsWithoutFoundation': {key: [v[0],v[1],v[2]-.12] for key,v in exported['landmarks'].items()},
                'structuralChecksPassed': actual['passed'], 'structuralChecks': actual['checks'],
                'roundtrip': exported['roundtrip'],
                'independentNativeGlbProof': {k:v for k,v in proof.items() if k != 'parts'},
                'comparisonViews': views,
                'landmarkTarget1PercentH': {'evaluated': False, 'passed': None,
                    'reason': 'Raster source anatomy has not been independently annotated. Construction estimates and measured native coordinates do not establish <=1% reference error.'},
                'glbSha256': digest, 'portraitSha256': sha(portrait)}
        units.append(unit)
        scores = [v['silhouetteIoU'] for v in views]
        table.append({'family': family, 'rank': rank, 'triangles': exported['exportMetrics']['triangles'],
                      'structuralPass': actual['passed'], 'roundtripPass': exported['roundtrip']['passed'],
                      'roundtripBoundsError': exported['roundtrip']['boundsError'],
                      'independentVertexError': proof['maximumBidirectionalWorldVertexError'],
                      'independentMaterialError': proof['maximumMaterialChannelError'],
                      'frontIoU': scores[0], 'backIoU': scores[1], 'leftIoU': scores[2], 'rightIoU': scores[3],
                      'meanIoU': sum(scores)/4, 'all4ViewsMeet097': all(s >= .97 for s in scores),
                      'referenceLandmark1PercentEvaluated': False, 'glbSha256': digest})
    spec = {'revision': 'hooded-turnarounds-v3',
            'authority': ['Latest user instructions including integration/publication', 'latest-design-changes.txt', 'modeling-notes.txt and manifest exception', 'eight current four-view PNG sheets'],
            'measurementDistinction': 'Source feature readings and reconciled construction estimates are labelled. Actual native mesh bounds/materials/joints are independently measured. Raster 1% anatomical accuracy is not certified.',
            'frame': {'front': '+Y', 'anatomicalRight': '+X', 'up': '+Z', 'soleZWithoutFoundation': 0,
                      'export': 'glTF +Y up, -Z front; unit lifted .12 above separate hex foundation'},
            'units': units}
    (OUT / 'reconstruction-spec.json').write_text(json.dumps(spec, indent=2)+'\n', encoding='utf-8')
    with (OUT / 'all-48-results.csv').open('w', newline='', encoding='utf-8-sig') as handle:
        writer = csv.DictWriter(handle, fieldnames=list(table[0])); writer.writeheader(); writer.writerows(table)
    summary = {'revision': 'hooded-turnarounds-v3', 'blenderVersion': qa['summary']['blenderVersion'],
               'models': 48, 'editableNativeScenes': 8, 'orthographicViews': 192,
               'threeQuarterViews': 48, 'effectsPresentationViews': 48, 'portraits': 48,
               'independentStructuralQA': qa['summary'], 'roundtripPassed': sum(x['roundtripPass'] for x in table),
               'maxRoundtripBoundsError': max(x['roundtripBoundsError'] for x in table),
               'exactNativeGlbVerification': {k:v for k,v in roundtrip.items() if k not in ('models','failures')},
               'triangleRange': [min(x['triangles'] for x in table),max(x['triangles'] for x in table)],
               'allIntegratedGlbAndPortraitHashesMatch': True, 'comparison': comparison['summary'],
               'visualTargetMet': False, 'referenceLandmark1PercentEvaluated': False,
               'remainingDeviationCategories': ['hood/head and facial proportions', 'hat, mitre and cape silhouettes', 'weapon curves and fixed 3D depth', 'pose/garment proportions relative to raster artwork'],
               'knownReferenceExceptions': ['Stormcaller VI silver dorsal hand plate follows text despite PNG omission',
                   'Bow and broad staff ornaments appear face-on in multiple nominal orthographic drawings; fixed physical orientation reconciles their inconsistent apparent thickness'],
               'previewEffectsLimitation': 'Native thin golden halo approximates runtime additive sprite; runtime owns exact rank ring, VI body glow and eight motes.',
               'results': table}
    test_log = (ROOT / 'tmp/v3-final-tests.log').read_text(encoding='utf-8')
    test_count = int(re.search(r'^ℹ tests (\d+)$', test_log, re.M)[1])
    pass_count = int(re.search(r'^ℹ pass (\d+)$', test_log, re.M)[1])
    fail_count = int(re.search(r'^ℹ fail (\d+)$', test_log, re.M)[1])
    assert test_count == pass_count and fail_count == 0
    summary['gameTests'] = {'tests': test_count, 'passed': pass_count, 'failed': fail_count}
    (OUT / 'test-results.txt').write_text(test_log, encoding='utf-8')
    (OUT / 'verification-summary.json').write_text(json.dumps(summary, indent=2)+'\n', encoding='utf-8')
    font = ImageFont.load_default(size=18); small = ImageFont.load_default(size=14)
    sheet = Image.new('RGB', (6*205, 8*253+60), '#f3f1e9'); draw = ImageDraw.Draw(sheet)
    draw.text((18,14), 'BLENDER 5.2.2 | 48 NATIVE DEFENDERS | I - VI', font=font, fill='#21313b')
    for row,family in enumerate(FAMILIES):
        for rank in range(1,7):
            picture = Image.open(ROOT / f'blender/renders/hooded-turnarounds-v3/{family}-t{rank}-three-quarter.png').convert('RGBA')
            picture.thumbnail((200,225),Image.Resampling.LANCZOS)
            x,y=(rank-1)*205,row*253+60
            sheet.paste(picture,(x+(205-picture.width)//2,y),picture)
            draw.text((x+9,y+231),f'{family} {rank}',font=small,fill='#21313b')
    sheet.save(OUT / 'all-48-models.png')
    web = ROOT / 'public/model-review'
    web.mkdir(parents=True, exist_ok=True)
    shutil.copytree(OUT / 'comparison', web / 'comparison', dirs_exist_ok=True,
                    ignore=shutil.ignore_patterns('specialist-native-front-review.png'))
    for name in ['all-48-models.png', 'all-48-results.csv', 'verification-summary.json',
                 'reconstruction-spec.json', 'structural-qa.json', 'roundtrip-qa.json', 'test-results.txt']:
        shutil.copyfile(OUT / name, web / name)
    rows=[]
    for family in FAMILIES:
        values=[x for x in table if x['family']==family]
        score=sum(x['meanIoU'] for x in values)/6
        rows.append(f'<tr><td>{family}</td><td>{sum(x["structuralPass"] for x in values)}/6</td><td>{min(x["triangles"] for x in values)}–{max(x["triangles"] for x in values)}</td><td>{score:.4f}</td></tr>')
    avg=comparison['summary']['meanSilhouetteIoU']
    html=f'''<!doctype html><html lang="cs"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Kontrola 48 obránců · Blender 5.2</title>
<style>body{{font:16px system-ui;background:#f4f2e9;color:#1f3438;max-width:1200px;margin:32px auto;padding:18px}}a{{color:#0a6784}}img{{max-width:100%}}.status{{padding:18px;background:#fff0cb;border-left:4px solid #ba8229}}table{{border-collapse:collapse;width:100%;margin:24px 0}}td,th{{border:1px solid #bbcac6;padding:10px;text-align:left}}</style>
<h1>48 obránců z Blenderu 5.2.2</h1><p>Osm tříd, každá v úrovních I–VI. Nové fyzické modely, osm editovatelných scén a 192 ortografických porovnání. <a href="../archer.html?family=archer">Otevřít 3D ateliér</a> · <a href="../">Otevřít hru</a></p>
<p>Technické kontroly: {qa['summary']['passedUnits']}/48. Zpětný import: {summary['roundtripPassed']}/48. Testy hry: {pass_count}/{test_count}. Cleric má latinský kříž; Frost Warden celé ledové kopí. Efekty jsou oddělené od GLB a ve hře je vytváří renderer.</p>
<div class="status"><strong>Přesná vizuální rekonstrukce není certifikovaná.</strong> Průměrná naměřená IoU siluety: {avg:.4f}; požadovaný cíl 0,97 nebyl dosažen. Žádný z {len(comparison['views'])} pohledů cílem neprošel. Odchylka anatomických bodů do 1 % H nebyla nezávisle ověřena. Zbývají rozdíly v proporcích hlavy, oděvu, pokrývek hlavy, póze a křivkách výbavy. Nejistota segmentace rasterových předloh je uvedena v podrobném protokolu.</div>
<p><a href="comparison/index.html">Všech 192 překryvů a rozdílů</a> · <a href="all-48-results.csv">Výsledky všech 48 modelů (CSV)</a> · <a href="verification-summary.json">Souhrn kontrol</a> · <a href="structural-qa.json">Nezávislé kontroly geometrie</a> · <a href="roundtrip-qa.json">Skutečná shoda nativních scén a GLB</a> · <a href="reconstruction-spec.json">Specifikace a skutečná měření</a> · <a href="test-results.txt">Výsledky testů hry</a></p>
<table><thead><tr><th>Třída</th><th>Technická kontrola</th><th>Trojúhelníky GLB</th><th>Průměrná IoU</th></tr></thead><tbody>{''.join(rows)}</tbody></table>
<img src="all-48-models.png" alt="Všech 48 skutečně vyrenderovaných 3D modelů, osm tříd a šest úrovní">
<p>Nativní scény a opakovatelný generátor: <a href="https://github.com/sinaglr-eng/bastions-of-the-last-kingdom/tree/main/blender/scenes/hooded-turnarounds-v3">osm .blend scén</a> · <a href="https://github.com/sinaglr-eng/bastions-of-the-last-kingdom/blob/main/blender/scripts/author_defender_turnarounds_v3.py">Blender Python generátor</a>. Známá výjimka: stříbrný hřbetní plát rukavice Stormcallera VI podle závazných poznámek. Nativní tenká zlatá aura přibližuje měkkou aditivní auru hry.</p></html>'''
    (web / 'index.html').write_text(html, encoding='utf-8')
    print(json.dumps({k:v for k,v in summary.items() if k not in ('results','comparison')},indent=2))

if __name__ == '__main__':
    build()
