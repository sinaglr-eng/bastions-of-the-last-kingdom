"""Package the 0.3.3 native models and current review evidence; preserve all three previous editions.

Visual inspection must be completed and recorded separately by the reviewers.
This tool verifies those records against current delivered bytes; it cannot
infer visual acceptance from a render count or a technical check.
"""
from pathlib import Path
import hashlib,json,sys,zipfile

ROOT=Path(__file__).resolve().parents[1]
if '--release-worktree' not in sys.argv:raise SystemExit('Provide --release-worktree with the isolated, tested release checkout.')
RELEASE=Path(sys.argv[sys.argv.index('--release-worktree')+1]).resolve() if '--release-worktree' in sys.argv else ROOT
OUT=ROOT/'output/design/geometric-game-v4'
ZIP=ROOT/'output/design/geometric-game-v4-complete.zip'
VIEWS={'front','back','left','right','three-quarter-front','three-quarter-back'}
view_name=lambda name:{'3/4 front':'three-quarter-front','3/4 back':'three-quarter-back'}.get(name.lower(),name.lower())
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
read=lambda path:json.loads(path.read_text(encoding='utf-8'))
previous=ROOT/'output/design/geometric-game-v1-complete.zip'
previous_sha=sha(previous) if previous.exists() else None
prior_v2=ROOT/'output/design/geometric-game-v2-complete.zip'
prior_v2_sha=sha(prior_v2)
assert prior_v2_sha=='1ee5a05eea721b53965e3721b1bf1dcfa5c69ce194792de78759a4754a98c4d8','0.3.1 archive changed'
if previous_sha:assert previous_sha=='33b54de0e65a3605b0124a4e1c76d4d07364fb1b003d06b2d8c56fb9b8b4b014','Original 0.3.0 archive changed'
prior_v3=ROOT/'output/design/geometric-game-v3-complete.zip'
prior_v3_sha=sha(prior_v3)
assert prior_v3_sha=='ab7d5f5e665ea9cc8c1d30b74b9648f0355fffba34463bd2e20b5d872c54b251','0.3.2 archive changed'
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
    baseline={row['id']:row for row in read(ROOT/f'output/design/geometric-game-v3/source-six-review-{category}.json')['entries']}
    original_v2={row['id']:row for row in read(ROOT/f'output/design/geometric-game-v2/source-six-review-{category}.json')['entries']}
    for row in report['entries']:
        aid=row['id'];assert aid not in accepted,aid
        entry=assets[aid]
        if not row['actualSixViewsInspected']:
            # Unchanged geometry is supported by its original visual inspection,
            # explicitly identified as inherited, rather than a fictitious new one.
            original=baseline[aid]
            assert row['actualGlbSha256']==original['actualGlbSha256'],('Inherited GLB changed',aid)
            assert row.get('actualNativeSha256',row.get('nativeSha256'))==original.get('actualNativeSha256',original.get('nativeSha256')),('Inherited native changed',aid)
            assert row['sourceSha256']==original['sourceSha256'],('Inherited source changed',aid)
            if not original['actualSixViewsInspected']:
                earlier=original_v2[aid]
                assert earlier['actualGlbSha256']==original['actualGlbSha256'],aid
                assert earlier.get('actualNativeSha256',earlier.get('nativeSha256'))==original.get('actualNativeSha256',original.get('nativeSha256')),aid
                original=earlier
            row={**original,'id':aid,'inheritedVisualInspectionEdition':'0.3.2 or earlier','unchangedInEdition':'0.3.3'}
        assert row['actualGlbSha256']==sha(ROOT/'public/assets/geometric'/entry['file']),('Visually reviewed model changed',aid)
        assert row['sourceSha256']==entry['sourceSha256'],('Source changed',aid)
        assert sha(ROOT/entry.get('nativeFile',entry.get('native')))==row.get('actualNativeSha256',row.get('nativeSha256')),('Visually reviewed native changed',aid)
        evidence=row.get('inspectionEvidenceSheet',{})
        sheet=row.get('contactSheet') or row.get('pairedSixViewSheet') or evidence.get('path')
        sheet_sha=row.get('contactSheetSha256') or row.get('pairedSixViewSheetSha256') or evidence.get('sha256')
        assert sheet and sheet_sha and sha(ROOT/sheet)==sheet_sha,('Actually inspected contact sheet changed',aid)
        row={**row,'verifiedInspectionSheet':sheet}
        views=row['actualSixViewsInspected'];assert len(views)==6 and {view_name(v['view']) for v in views}==VIEWS,aid
        for view in views:
            assert view['actuallyOpenedAndCompared'] and view.get('scopedPass',row.get('passedWithinScope')) is True,(aid,view['view'])
            assert Path(view['path']).stem==view_name(view['view']),(aid,view['view'])
            assert sha(ROOT/view['path'])==view['sha256'],('Visually reviewed render changed',aid,view['view'])
        accepted[aid]=row
assert set(accepted)==set(assets)

native=read(OUT/'native-model-audit.json')
assert native['models']==136 and native['passed']==136
assert native['allNativeReferencesPacked'] and native['allNativeExportGeometryMatched']
for row in native['results']:assert sha(ROOT/row['nativeFile'])==row['nativeSha256'],('Audited native changed',row['id'])
contacts=read(OUT/'actual-surface-contact-audit.json')
assert contacts['models']==136 and contacts['failures']==0 and contacts['coverageFailures']==0 and not contacts['assetMutationsDuringRead']
for row in contacts['results']:assert sha(ROOT/row['file'])==row['assetSha256'],('Surface-audited model changed',row['id'])
runtime=read(OUT/'runtime-model-audit.json')
assert runtime['models']==136 and runtime['passed']==runtime['total']
for row in runtime['results']:assert sha(ROOT/row['file'])==row['fileSha256'],('Runtime-audited model changed',row['file'])
attacks=read(OUT/'attack-animation-audit.json')
assert attacks['failures']==0,'Production attack animation audit has failures'
assert attacks['models']==136 and attacks['productionAttacks']==86 and attacks['productionEnemies']==50,'Incomplete production attack audit'
assert {row['id'] for row in attacks['results']}==set(assets),'Production attack asset coverage mismatch'
for row in attacks['results']:assert sha(ROOT/row['file'])==row['assetSha256'],('Attack-audited model changed',row['id'])
for report in [runtime,contacts,attacks]:
    for module in report['runtimeModules']:assert sha(RELEASE/module['file'])==module['sha256'],('Audited release runtime changed',module['file'])
    for manifest in report.get('manifests',[]):assert sha(ROOT/manifest['file'])==manifest['sha256'],('Audited manifest changed',manifest['file'])
assert len(attacks['manifests'])==3 and len(contacts['manifests'])==3,'Missing production manifest bindings'

appearance=read(OUT/'appearance-proportion-audit.json')
assert appearance['failures']==0 and appearance['models']>0
for row in appearance['results']:assert sha(ROOT/row['file'])==row['assetSha256'],('Appearance-audited model changed',row['id'])
for module in appearance.get('runtimeModules',[]):assert sha(RELEASE/module['file'])==module['sha256'],('Appearance-audited runtime changed',module['file'])
assert sha(ROOT/appearance['sourceCheckpointFile'])==appearance['sourceCheckpointSha256'],'Source-first proportion evidence changed'

files=[]
for base,pattern in [('blender/scenes/geometric-game-v1','*.blend'),('blender/renders/geometric-game-v1','*.png'),('output/design/geometric-game-v1/defenders/renders','*.png'),('public/assets/geometric','*'),('public/geometric-turnarounds-v1','*.png'),('output/design/geometric-game-v4','*')]:
    files.extend(path for path in (ROOT/base).rglob(pattern) if path.is_file() and path.name!='package-verification.json')
for name in ['geometric_game_common.py','geometric_roster_builder.py','geometric_creature_anatomy_v2.py','geometric_defender_fit_v2.py','geometric_defender_fit_v3.py','geometric_champion_fit_v3.py','geometric_creature_anatomy_v3.py','geometric_defender_fit_v4.py','geometric_champion_creature_fit_v4.py','geometric_construct_source_v1.py','geometric_heavy_orc_source_v1.py','geometric_hollow_sky_source_v2.py','geometric_enemy_equipment_final_v1.py','author_geometric_game_defenders.py','author_geometric_roster_v1.py']:
    files.append(ROOT/'blender/scripts'/name)
files.extend(ROOT/'output/design/geometric-turnarounds-v1'/entry.get('sourceFile',entry.get('source')) for entry in assets.values())
for name in ['docs/ATELIER_REVIEW_0_3_3.md','docs/GEOMETRIC_GAME_V4.md','tools/package_geometric_game_v4.py','tools/audit-geometric-appearance.mjs','tests/geometric-wall-height.test.mjs','tests/geometric-appearance.test.mjs','tools/review-geometric-roster.py','tools/verify_geometric_native_v1.py','tools/verify-geometric-runtime.mjs','tools/audit-geometric-contacts.mjs','tools/verify-geometric-published.mjs','public/geometric-turnarounds-v1/manifest.json','public/geometric-turnarounds-v1/roster.json','public/geometric-turnarounds-v1/gallery-data.js','output/design/geometric-turnarounds-v1/manifest.json','output/design/geometric-game-v1/source-measurements.json','output/design/geometric-game-v1/defenders/reference-measurements.json','blender/scripts/defender_turnarounds_v3/equipment.json','blender/scenes/lady-claire-geometric-v1/lady-claire.blend']:
    files.append(ROOT/name)
files.extend(path for base in ['game/core','game/render','tests/helpers'] for path in (ROOT/base).glob('*.js' if base.startswith('game/') else '*.mjs'))
files.extend(ROOT/name for name in ['game/archer-preview.js','game/release.js','game/site-url.js','data/enemies.json','data/towers.json','data/balance.json','data/waves.json','package.json','pnpm-lock.yaml'])
files.extend(ROOT/row['verifiedInspectionSheet'] for row in accepted.values())
files.extend(ROOT/name for name in ['tools/record_defender_v2_source_review.py','tools/record_defender_v3_source_review.py','tools/inherit-geometric-enemy-review-v3.py','tests/geometric-crossbow-fit.test.mjs','tests/geometric-construct-attacks.test.mjs','tests/geometric-batching.test.mjs','tests/geometric-game-assets.test.mjs'])
files=sorted(set(files));assert all(path.is_file() for path in files)
# Keep the actual isolated release runtime in the archive even when the shared
# checkout contains other in-progress work. Archive paths remain project-relative.
sources={path.relative_to(ROOT).as_posix():path for path in files}
for name in list(sources):
    if name.startswith(('game/','data/','tests/')) or name in ['package.json','pnpm-lock.yaml']:
        sources[name]=RELEASE/name
assert all(path.is_file() for path in sources.values())
# Archive the complete tested game and regression suite from the isolated
# release, including the entry points needed to build it. Shared-checkout
# experiments must never replace the bytes used for release validation.
for base in ['game','data','tests']:
    for path in (RELEASE/base).rglob('*'):
        if path.is_file() and path.suffix in ['.js','.mjs','.css','.json']:
            sources[path.relative_to(RELEASE).as_posix()]=path
for base in ['ui','tools','public','backend','.github']:
    for path in (RELEASE/base).rglob('*'):
        if path.is_file():
            sources[path.relative_to(RELEASE).as_posix()]=path
for base in ['blender/scenes','blender/renders','blender/scripts']:
    for path in (RELEASE/base).rglob('*'):
        name=path.relative_to(RELEASE).as_posix()
        if path.is_file() and name not in sources and '__pycache__' not in path.parts and not (path.suffix.startswith('.blend') and path.suffix!='.blend') and path.suffix not in ['.pyc','.pyo'] and 'geometric-game-v1' not in path.parts:
            sources[name]=path
checkpoint='output/design/geometric-game-v3/source-creature-checkpoints.json'
assert (RELEASE/checkpoint).is_file(),checkpoint
sources[checkpoint]=RELEASE/checkpoint
for edition in ['v2','v3']:
    for category in ['defenders','champions','enemies']:
        name=f'output/design/geometric-game-{edition}/source-six-review-{category}.json'
        assert (ROOT/name).is_file(),name
        sources[name]=ROOT/name
for name in ['ui/style.css','ui/theme.css','tools/animation-review.html','tools/animation-review.js','README.md','CHANGELOG.md','index.html','archer.html','vite.config.js','tools/audit-geometric-drawcalls.mjs']:
    path=RELEASE/name
    assert path.is_file(),name
    sources[name]=path
for name in ['tools/audit-geometric-contacts.mjs','tools/audit-geometric-attacks.mjs','tools/audit-geometric-appearance.mjs','tools/verify-geometric-runtime.mjs','tools/verify-geometric-published.mjs','tools/package_geometric_game_v4.py']:
    path=ROOT/name if name.endswith('package_geometric_game_v4.py') else RELEASE/name
    assert path.is_file(),name
    sources[name]=path
sources['START_GAME.cmd']=RELEASE/'START_GAME.cmd'
assert sources['START_GAME.cmd'].is_file()
assert len(native['results'])==136
assert sum(path.suffix=='.glb' for path in files)==136
if '--check-only' in sys.argv:
    print(json.dumps({'models':136,'sourcePairsVerified':816,'contacts':contacts['interfaces'],'nativeAndRuntimeHashesVerified':True}));sys.exit(0)
if ZIP.exists():raise SystemExit('This edition archive already exists; preserve it or explicitly choose a new edition.')
inventory=[{'file':name,'bytes':path.stat().st_size,'sha256':sha(path)} for name,path in sorted(sources.items())]
temporary=ZIP.with_suffix('.zip.in-progress')
with zipfile.ZipFile(temporary,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
    for name,path in sorted(sources.items()):archive.write(path,name)
    archive.writestr('PACKAGE_INVENTORY.json',json.dumps(inventory,ensure_ascii=False,indent=2))
with zipfile.ZipFile(temporary) as archive:
    assert archive.testzip() is None
    for row in inventory:assert hashlib.sha256(archive.read(row['file'])).hexdigest()==row['sha256']
temporary.rename(ZIP)
assert sha(previous)==previous_sha and sha(prior_v2)==prior_v2_sha and sha(prior_v3)==prior_v3_sha,'Previous archive changed during packaging'
report={'previousEdition3ArchiveSha256':prior_v3_sha,'previousEdition2ArchiveSha256':prior_v2_sha,'edition':'0.3.3','zip':str(ZIP),'bytes':ZIP.stat().st_size,'sha256':sha(ZIP),'entries':len(inventory)+1,'nativeModels':136,'glbModels':136,'actualSourceModelPairs':816,'surfaceInterfaces':contacts['interfaces'],'integrityVerified':True,'previousEditionArchivePreserved':bool(previous_sha),'previousEditionArchiveSha256':previous_sha}
(OUT/'package-verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
