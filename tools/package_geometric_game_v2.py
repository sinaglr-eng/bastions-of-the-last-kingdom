"""Package the 0.3.1 native models and current review evidence; preserve v1.

Visual inspection must be completed and recorded separately by the reviewers.
This tool verifies those records against current delivered bytes; it cannot
infer visual acceptance from a render count or a technical check.
"""
from pathlib import Path
import hashlib,json,sys,zipfile

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'output/design/geometric-game-v2'
ZIP=ROOT/'output/design/geometric-game-v2-complete.zip'
VIEWS={'front','back','left','right','three-quarter-front','three-quarter-back'}
view_name=lambda name:{'3/4 front':'three-quarter-front','3/4 back':'three-quarter-back'}.get(name.lower(),name.lower())
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
read=lambda path:json.loads(path.read_text(encoding='utf-8'))
previous=ROOT/'output/design/geometric-game-v1-complete.zip'
previous_sha=sha(previous) if previous.exists() else None
if previous_sha:assert previous_sha=='33b54de0e65a3605b0124a4e1c76d4d07364fb1b003d06b2d8c56fb9b8b4b014','Original 0.3.0 archive changed'
assets={}
for category,expected in [('defenders',48),('champions',38),('enemies',50)]:
    manifest=read(ROOT/f'public/assets/geometric/geometric-{category}.json')
    rows=manifest.get('assets',manifest.get('entries',[]))
    assert len(rows)==expected,(category,len(rows))
    for entry in rows:
        assert entry['id'] not in assets,entry['id']
        assets[entry['id']]=entry
        assert sha(ROOT/'public/assets/geometric'/entry['file'])==entry.get('metrics',entry.get('qa'))['fileSha256'],entry['id']

review=read(OUT/'independent-visual-review/review-index.json')
assert review['actual_views']==816 and review['complete_subjects']==136
assert review['source_hashes_match'] and review['asset_hashes_match'] and review['declared_render_geometry_matches']
accepted={}
for category in ['defenders','champions','enemies']:
    report=read(OUT/f'source-six-review-{category}.json')
    assert not report['unresolvedSignificantFindingsWithinScope'],category
    for row in report['entries']:
        aid=row['id'];assert aid not in accepted,aid
        entry=assets[aid]
        assert row['actualGlbSha256']==sha(ROOT/'public/assets/geometric'/entry['file']),('Visually reviewed model changed',aid)
        assert row['sourceSha256']==entry['sourceSha256'],('Source changed',aid)
        assert sha(ROOT/entry.get('nativeFile',entry.get('native')))==row.get('actualNativeSha256',row.get('nativeSha256')),('Visually reviewed native changed',aid)
        sheet=row.get('contactSheet',row.get('pairedSixViewSheet'))
        assert sha(ROOT/sheet)==row.get('contactSheetSha256',row.get('pairedSixViewSheetSha256')),('Actually inspected contact sheet changed',aid)
        views=row['actualSixViewsInspected'];assert len(views)==6 and {view_name(v['view']) for v in views}==VIEWS,aid
        for view in views:
            assert view['actuallyOpenedAndCompared'] and view['scopedPass'],(aid,view['view'])
            assert Path(view['path']).stem==view_name(view['view']),(aid,view['view'])
            assert sha(ROOT/view['path'])==view['sha256'],('Visually reviewed render changed',aid,view['view'])
        accepted[aid]=row
assert set(accepted)==set(assets)

native=read(OUT/'native-model-audit.json')
assert native['models']==136 and native['passed']==136
assert native['allNativeReferencesPacked'] and native['allNativeExportGeometryMatched']
for row in native['results']:assert sha(ROOT/row['nativeFile'])==row['nativeSha256'],('Audited native changed',row['id'])
contacts=read(OUT/'actual-surface-contact-audit.json')
assert contacts['models']==136 and contacts['failures']==0 and not contacts['assetMutationsDuringRead']
for row in contacts['results']:assert sha(ROOT/row['file'])==row['assetSha256'],('Surface-audited model changed',row['id'])
runtime=read(OUT/'runtime-model-audit.json')
assert runtime['models']==136 and runtime['passed']==runtime['total']
for row in runtime['results']:assert sha(ROOT/row['file'])==row['fileSha256'],('Runtime-audited model changed',row['file'])
for report in [runtime,contacts]:
    for module in report['runtimeModules']:assert sha(ROOT/module['file'])==module['sha256'],('Audited runtime changed',module['file'])

files=[]
for base,pattern in [('blender/scenes/geometric-game-v1','*.blend'),('blender/renders/geometric-game-v1','*.png'),('output/design/geometric-game-v1/defenders/renders','*.png'),('public/assets/geometric','*'),('public/geometric-turnarounds-v1','*.png'),('output/design/geometric-game-v2','*')]:
    files.extend(path for path in (ROOT/base).rglob(pattern) if path.is_file() and path.name!='package-verification.json')
for name in ['geometric_game_common.py','geometric_roster_builder.py','geometric_creature_anatomy_v2.py','geometric_defender_fit_v2.py','geometric_construct_source_v1.py','geometric_heavy_orc_source_v1.py','geometric_hollow_sky_source_v2.py','geometric_enemy_equipment_final_v1.py','author_geometric_game_defenders.py','author_geometric_roster_v1.py']:
    files.append(ROOT/'blender/scripts'/name)
files.extend(ROOT/'output/design/geometric-turnarounds-v1'/entry.get('sourceFile',entry.get('source')) for entry in assets.values())
for name in ['docs/ATELIER_REVIEW_0_3_1.md','docs/GEOMETRIC_GAME_V2.md','tools/package_geometric_game_v2.py','tools/review-geometric-roster.py','tools/verify_geometric_native_v1.py','tools/verify-geometric-runtime.mjs','tools/audit-geometric-contacts.mjs','tools/verify-geometric-published.mjs','public/geometric-turnarounds-v1/manifest.json','public/geometric-turnarounds-v1/roster.json','public/geometric-turnarounds-v1/gallery-data.js','output/design/geometric-turnarounds-v1/manifest.json','output/design/geometric-game-v1/source-measurements.json','output/design/geometric-game-v1/defenders/reference-measurements.json','blender/scripts/defender_turnarounds_v3/equipment.json','blender/scenes/lady-claire-geometric-v1/lady-claire.blend']:
    files.append(ROOT/name)
files.extend(path for base in ['game/core','game/render','tests/helpers'] for path in (ROOT/base).glob('*.js' if base.startswith('game/') else '*.mjs'))
files.extend(ROOT/name for name in ['game/archer-preview.js','game/release.js','game/site-url.js','data/enemies.json','data/towers.json','data/balance.json','data/waves.json','package.json','pnpm-lock.yaml'])
files.extend(ROOT/row.get('contactSheet',row.get('pairedSixViewSheet')) for row in accepted.values())
files.append(ROOT/'tools/record_defender_v2_source_review.py')
files=sorted(set(files));assert all(path.is_file() for path in files)
assert len(native['results'])==136
assert sum(path.suffix=='.glb' for path in files)==136
if '--check-only' in sys.argv:
    print(json.dumps({'models':136,'sourcePairsVerified':816,'contacts':contacts['interfaces'],'nativeAndRuntimeHashesVerified':True}));sys.exit(0)
if ZIP.exists():raise SystemExit('This edition archive already exists; preserve it or explicitly choose a new edition.')
inventory=[{'file':path.relative_to(ROOT).as_posix(),'bytes':path.stat().st_size,'sha256':sha(path)} for path in files]
temporary=ZIP.with_suffix('.zip.in-progress')
with zipfile.ZipFile(temporary,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for path in files:archive.write(path,path.relative_to(ROOT).as_posix())
    archive.writestr('PACKAGE_INVENTORY.json',json.dumps(inventory,ensure_ascii=False,indent=2))
with zipfile.ZipFile(temporary) as archive:
    assert archive.testzip() is None
    for row in inventory:assert hashlib.sha256(archive.read(row['file'])).hexdigest()==row['sha256']
temporary.rename(ZIP)
report={'edition':'0.3.1','zip':str(ZIP),'bytes':ZIP.stat().st_size,'sha256':sha(ZIP),'entries':len(inventory)+1,'nativeModels':136,'glbModels':136,'actualSourceModelPairs':816,'surfaceInterfaces':contacts['interfaces'],'integrityVerified':True,'previousEditionArchivePreserved':bool(previous_sha),'previousEditionArchiveSha256':previous_sha}
(OUT/'package-verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
