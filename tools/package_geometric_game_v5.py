"""Package the actual tested 0.3.4 release, native scenes and scoped visual evidence.

Run from the authoritative native workspace with --release-worktree pointing to
the tested checkout. Historical archives are immutable. This validator requires
actual reviewer records; render counts cannot create visual acceptance.
"""
from pathlib import Path
import hashlib,json,sys,zipfile,subprocess

ROOT=Path(__file__).resolve().parents[1]
if '--release-worktree' not in sys.argv:raise SystemExit('Provide --release-worktree with the tested release checkout.')
RELEASE=Path(sys.argv[sys.argv.index('--release-worktree')+1]).resolve()
OUT=ROOT/'output/design/geometric-game-v5'
ZIP=ROOT/'output/design/geometric-game-v5-complete.zip'
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
read=lambda path:json.loads(path.read_text(encoding='utf-8-sig'))
VIEWS={'front','back','left','right','three-quarter-front','three-quarter-back'}
view_name=lambda name:{'3/4 front':'three-quarter-front','3/4 back':'three-quarter-back'}.get(name.lower(),name.lower())
prior_hashes={
 'v1':'33b54de0e65a3605b0124a4e1c76d4d07364fb1b003d06b2d8c56fb9b8b4b014',
 'v2':'1ee5a05eea721b53965e3721b1bf1dcfa5c69ce194792de78759a4754a98c4d8',
 'v3':'ab7d5f5e665ea9cc8c1d30b74b9648f0355fffba34463bd2e20b5d872c54b251',
 'v4':'5900df0908797fa41667d80132efe9f0d35637aab99d9489ef3d4cf12cd84237'
}
for edition,expected in prior_hashes.items():
 assert sha(ROOT/f'output/design/geometric-game-{edition}-complete.zip')==expected,('Historical archive changed',edition)
assets={};sources={};fresh=0;inherited=0;inspection_files=set()
def add(path,name=None):
 path=Path(path);assert path.is_file(),str(path)
 name=name or path.relative_to(ROOT).as_posix()
 assert not Path(name).is_absolute() and '..' not in Path(name).parts,name
 if name in sources:assert sha(sources[name])==sha(path),('Conflicting packaged bytes',name)
 sources[name]=path

def eligible_prior(category,aid,current):
 for edition in ['v4','v3','v2']:
  report=read(ROOT/f'output/design/geometric-game-{edition}/source-six-review-{category}.json')
  row=next(r for r in report['entries'] if r['id']==aid)
  if row.get('actualSixViewsInspected'):
   assert row['actualGlbSha256']==current['actualGlbSha256'],('Inherited geometry changed',aid)
   assert row.get('actualNativeSha256',row.get('nativeSha256'))==current.get('actualNativeSha256',current.get('nativeSha256')),('Inherited native changed',aid)
   assert row['sourceSha256']==current['sourceSha256'],('Inherited source changed',aid)
   return row,edition
 raise AssertionError(('No eligible actual prior visual inspection',aid))

for category,count in [('defenders',48),('champions',38),('enemies',50)]:
 manifest=read(ROOT/f'public/assets/geometric/geometric-{category}.json')
 rows=manifest.get('assets',manifest.get('entries',[]));assert len(rows)==count
 for entry in rows:
  aid=entry['id'];assert aid not in assets;assets[aid]=entry
  file=ROOT/'public/assets/geometric'/entry['file'];assert sha(file)==entry.get('metrics',entry.get('qa'))['fileSha256'],aid
  assert sha(file)==sha(RELEASE/file.relative_to(ROOT)),('Tested release export differs',aid)
  add(ROOT/entry.get('nativeFile',entry.get('native')))
  add(ROOT/'output/design/geometric-turnarounds-v1'/entry.get('sourceFile',entry.get('source')))
 report_path=OUT/f'source-six-review-{category}.json'
 if not report_path.exists():report_path=OUT/f'source-six-review-{category}-v5.json'
 report=read(report_path);assert not report['unresolvedSignificantFindingsWithinScope'],category
 assert len(report['entries'])==count and len({r['id'] for r in report['entries']})==count
 for current in report['entries']:
  aid=current['id'];entry=assets[aid];row=current
  assert current['actualGlbSha256']==sha(ROOT/'public/assets/geometric'/entry['file']),('Visual model changed',aid)
  assert current.get('actualNativeSha256',current.get('nativeSha256'))==sha(ROOT/entry.get('nativeFile',entry.get('native'))),('Visual native changed',aid)
  assert current['sourceSha256']==entry['sourceSha256'],('Visual original changed',aid)
  if not current.get('actualSixViewsInspected'):
   row,edition=eligible_prior(category,aid,current);inherited+=1
  else:fresh+=1
  evidence=row.get('inspectionEvidenceSheet',{})
  sheet=row.get('contactSheet') or row.get('pairedSixViewSheet') or evidence.get('path')
  sheet_sha=row.get('contactSheetSha256') or row.get('pairedSixViewSheetSha256') or evidence.get('sha256')
  assert sheet and sheet_sha and sha(ROOT/sheet)==sheet_sha,('Actual inspection sheet changed',aid)
  inspection_files.add(sheet)
  views=row['actualSixViewsInspected'];assert len(views)==6 and {view_name(v['view']) for v in views}==VIEWS,aid
  for view in views:
   assert view['actuallyOpenedAndCompared'] and view.get('scopedPass',row.get('passedWithinScope')) is True,(aid,view['view'])
   assert Path(view['path']).stem==view_name(view['view'])
   assert sha(ROOT/view['path'])==view['sha256'],('Actually inspected render changed',aid,view['view'])
   inspection_files.add(view['path'])
assert len(assets)==136 and fresh+inherited==136

# Replay the V5 authoring passes from exact completed V4 inputs in a separate
# copy. Current manifest-selected V5 scenes alone cannot replay the changes.
baseline_dir=OUT/'baseline-v4-manifests'
baseline=read(baseline_dir/'native-dependencies.json')
baseline_commit='63da13815eebc873cea1954812a733f975494ab7'
assert baseline['baselineCommit']==baseline_commit and baseline['models']==136
baseline_rows=baseline['entries']
assert len(baseline_rows)==136 and {row['id'] for row in baseline_rows}==set(assets)
baseline_by_id={row['id']:row for row in baseline_rows}
prior_native=read(ROOT/'output/design/geometric-game-v4/native-model-audit.json')
assert prior_native['models']==136 and prior_native['passed']==136
prior_native_by_id={row['id']:row for row in prior_native['results']}
assert set(prior_native_by_id)==set(assets)
for category,count in [('defenders',48),('champions',38),('enemies',50)]:
 name=f'geometric-{category}.json';path=baseline_dir/name
 committed=subprocess.check_output(['git','show',f'{baseline_commit}:public/assets/geometric/{name}'],cwd=RELEASE)
 assert sha(path)==hashlib.sha256(committed).hexdigest(),('V4 manifest differs from immutable baseline commit',category)
 manifest=read(path);rows=manifest.get('assets',manifest.get('entries',[]))
 assert len(rows)==count and len({row['id'] for row in rows})==count
 for entry in rows:
  dep=baseline_by_id[entry['id']];prior=prior_native_by_id[entry['id']]
  assert dep['category']==category and dep['nativeFile']==entry.get('nativeFile',entry.get('native'))
  assert dep['nativeFile']==prior['nativeFile'] and dep['nativeSha256']==prior['nativeSha256'],('Historical native audit differs',entry['id'])
  assert sha(ROOT/dep['nativeFile'])==dep['nativeSha256'],('Historical authoring input changed',entry['id'])
  add(ROOT/dep['nativeFile'])
 add(path)
add(baseline_dir/'native-dependencies.json')
add(ROOT/'output/design/geometric-game-v4/native-model-audit.json')

native=read(OUT/'native-model-audit.json')
assert native['models']==136 and native['passed']==136 and native['allNativeReferencesPacked'] and native['allNativeExportGeometryMatched']
assert {r['id'] for r in native['results']}==set(assets)
for row in native['results']:assert sha(ROOT/row['nativeFile'])==row['nativeSha256'],row['id']
contacts=read(OUT/'actual-surface-contact-audit.json')
assert contacts['models']==136 and contacts['failures']==0 and contacts['coverageFailures']==0 and not contacts['assetMutationsDuringRead']
runtime=read(OUT/'runtime-model-audit.json')
assert runtime['models']==136 and runtime['passed']==runtime['total']
attacks=read(OUT/'attack-animation-audit.json')
assert attacks['failures']==0 and attacks['models']==136 and attacks['productionAttacks']==86 and attacks['productionEnemies']==50
assert {r['id'] for r in attacks['results']}==set(assets)
appearance=read(OUT/'appearance-proportion-audit.json')
assert appearance['failures']==0 and appearance['models']>0
for report in [contacts,runtime,attacks,appearance]:
 for row in report['results']:assert sha(ROOT/row['file'])==row.get('assetSha256',row.get('fileSha256')),('Audited actual export changed',row.get('id',row['file']))
 for module in report['runtimeModules']:assert sha(RELEASE/module['file'])==module['sha256'],('Audited tested runtime changed',module['file'])
 for manifest in report.get('manifests',[]):assert sha(ROOT/manifest['file'])==manifest['sha256']
assert len(attacks['manifests'])==3 and len(contacts['manifests'])==3
assert sha(ROOT/appearance['sourceCheckpointFile'])==appearance['sourceCheckpointSha256']
proportions=read(OUT/'proportions-cloak-audit.json')
assert proportions['subjects']==136 and proportions['failures']==0 and len(proportions['entries'])==136
for row in proportions['entries']:
 assert row['actualGlbSha256']==sha(ROOT/'public/assets/geometric'/assets[row['id']]['file']),('Head/cloth audited export changed',row['id'])
shapes=read(OUT/'champion-physical-shape-audit.json')
assert shapes['models']==9 and shapes['readOnly'] and len(shapes['results'])==9
for row in shapes['results']:
 entry=assets[row['id']]
 assert row['passed'] and row['glbSha256']==sha(ROOT/'public/assets/geometric'/entry['file']) and row['nativeSha256']==sha(ROOT/entry.get('nativeFile',entry.get('native'))),('Targeted shape audit changed',row['id'])
validation=read(OUT/'release-validation.json')
assert validation['version']=='0.3.4' and validation['tests']['fail']==0 and validation['tests']['skipped']==0 and validation['build']['exitCode']==0
for row in validation['validatedSourceFiles']:assert sha(RELEASE/row['file'])==row['sha256'],('Validated source changed',row['file'])
camp=read(OUT/'camp-native-audit.json')
assert camp['status']=='pass' and camp['nativeReadOnly']
assert len(camp['tentAssemblies'])==22 and camp['protectedOriginalMeshes']==6027
assert camp['sourceVerticesMatchedToActualExport']==5691
assert all(row['clearance']>=.22-1e-7 for row in camp['tentAssemblies'])
assert sha(RELEASE/'blender/scenes/fortified-warcamp-v8.blend')==camp['nativeSHA'], 'Audited native camp changed'
assert sha(RELEASE/'public/assets/scenery/fortified-warcamp-v8.glb')==camp['glbSHA'], 'Audited runtime camp changed'
assert sha(ROOT/'public/assets/scenery/fortified-warcamp-v8.glb')==camp['glbSHA'], 'Native workspace and tested camp exports differ'
camp_review=read(OUT/'gameplay-environment-review.json')
assert camp_review['status']=='pass' and camp_review['tests']['passed']==39 and camp_review['tests']['failed']==0 and camp_review['tests']['skipped']==0
for row in camp_review['files']:
 assert sha(RELEASE/row['path'])==row['sha256'], ('Reviewed gameplay/environment file changed',row['path'])
for name in camp['views']:
 assert (RELEASE/name).is_file() and (RELEASE/name).stat().st_size>10000, ('Missing actual detail inspection render',name)

# Complete tested project files, including legacy fixture dependencies. Native
# geometric scenes are selected from the current 136 manifest references above.
tracked=subprocess.check_output(['git','ls-files','-z'],cwd=RELEASE).decode('utf-8').split('\0')
for name in tracked:
 if not name or not (RELEASE/name).is_file():continue
 if name.startswith(('blender/scenes/geometric-game-v1/','blender/renders/geometric-game-v1/','output/')):continue
 add(RELEASE/name,name)
for base in ['game','data','tests','ui','tools','public','backend','.github','docs','blender/scripts']:
 for path in (RELEASE/base).rglob('*'):
  if path.is_file() and '__pycache__' not in path.parts and path.suffix not in ['.pyc','.pyo']:
   name=path.relative_to(RELEASE).as_posix()
   if name in sources:
    assert sha(sources[name])==sha(path),('Authoritative and tested code differs',name)
   else:add(path,name)
for path in OUT.rglob('*'):
 if path.is_file() and path.name!='package-verification.json':add(path)
for name in inspection_files:add(ROOT/name)
for edition in ['v2','v3','v4']:
 for category in ['defenders','champions','enemies']:add(ROOT/f'output/design/geometric-game-{edition}/source-six-review-{category}.json')
for name in [appearance['sourceCheckpointFile'],'output/design/geometric-game-v1/source-measurements.json','output/design/geometric-game-v1/defenders/reference-measurements.json','output/design/geometric-turnarounds-v1/manifest.json']:
 add(ROOT/name)
for name in ['blender/scenes/fortified-warcamp-v8.blend','blender/renders/fortified-warcamp-v8-review.png','START_GAME.cmd']:add(RELEASE/name,name)
for name in camp['views']:add(RELEASE/name,name)
add(ROOT/'blender/scenes/geometric-game-v1/champions/crownofages.blend')
for name in ['public/release.json','package.json']:assert read(RELEASE/name)['version']=='0.3.4'
assert sum(name.startswith('public/assets/geometric/') and name.endswith('.glb') for name in sources)==136
assert all((name in sources) for name in ['index.html','archer.html','vite.config.js','pnpm-lock.yaml','tools/package_geometric_game_v5.py'])
if '--check-only' in sys.argv:
 print(json.dumps({'models':136,'nativeReplayBaselineModels':136,'freshInspectedSubjects':fresh,'inheritedUnchangedSubjects':inherited,'sources':len(sources),'allBindingsVerified':True}));sys.exit(0)
if ZIP.exists():raise SystemExit('Preserve this completed archive; use a new edition rather than overwriting it.')
inventory=[{'file':name,'bytes':path.stat().st_size,'sha256':sha(path)} for name,path in sorted(sources.items())]
temporary=ZIP.with_suffix('.zip.in-progress')
with zipfile.ZipFile(temporary,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
 for name,path in sorted(sources.items()):archive.write(path,name)
 archive.writestr('PACKAGE_INVENTORY.json',json.dumps(inventory,ensure_ascii=False,indent=2))
with zipfile.ZipFile(temporary) as archive:
 assert archive.testzip() is None
 for row in inventory:assert hashlib.sha256(archive.read(row['file'])).hexdigest()==row['sha256']
temporary.rename(ZIP)
for edition,expected in prior_hashes.items():assert sha(ROOT/f'output/design/geometric-game-{edition}-complete.zip')==expected
report={'edition':'0.3.4','zip':str(ZIP),'bytes':ZIP.stat().st_size,'sha256':sha(ZIP),'entries':len(inventory)+1,'nativeModels':136,'nativeReplayBaselineModels':136,'glbModels':136,'freshInspectedSubjects':fresh,'inheritedUnchangedSubjects':inherited,'actualSourceModelPairs':816,'surfaceInterfaces':contacts['interfaces'],'integrityVerified':True,'priorArchivesVerified':prior_hashes}
(OUT/'package-verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
