"""Package the actual tested 0.3.5 release, native scenes and scoped visual evidence.

Run from the authoritative native workspace with --release-worktree pointing to
the tested checkout. Historical archives are immutable. This validator requires
actual reviewer records; render counts cannot create visual acceptance.
"""
from pathlib import Path
import hashlib,json,sys,zipfile,subprocess

ROOT=Path(__file__).resolve().parents[1]
if '--release-worktree' not in sys.argv:raise SystemExit('Provide --release-worktree with the tested release checkout.')
RELEASE=Path(sys.argv[sys.argv.index('--release-worktree')+1]).resolve()
OUT=ROOT/'output/design/geometric-game-v6'
ZIP=ROOT/'output/design/geometric-game-v6-complete.zip'
def sha(path):
 digest=hashlib.sha256()
 with Path(path).open('rb')as file:
  for block in iter(lambda:file.read(2*1024*1024),b''):digest.update(block)
 return digest.hexdigest()
read=lambda path:json.loads(path.read_text(encoding='utf-8-sig'))
VIEWS={'front','back','left','right','three-quarter-front','three-quarter-back'}
view_name=lambda name:{'3/4 front':'three-quarter-front','3/4 back':'three-quarter-back'}.get(name.lower(),name.lower())
prior_hashes={
 'v1':'33b54de0e65a3605b0124a4e1c76d4d07364fb1b003d06b2d8c56fb9b8b4b014',
 'v2':'1ee5a05eea721b53965e3721b1bf1dcfa5c69ce194792de78759a4754a98c4d8',
 'v3':'ab7d5f5e665ea9cc8c1d30b74b9648f0355fffba34463bd2e20b5d872c54b251',
 'v4':'5900df0908797fa41667d80132efe9f0d35637aab99d9489ef3d4cf12cd84237',
 'v5':'a4516a26e00db318d897230d5095e78788167bd1b999c3f84d8184f96f6b7243'
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
 for edition in ['v5','v4','v3','v2']:
  prior_path=ROOT/f'output/design/geometric-game-{edition}/source-six-review-{category}.json'
  if not prior_path.exists():prior_path=ROOT/f'output/design/geometric-game-{edition}/source-six-review-{category}-{edition}.json'
  report=read(prior_path)
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
  original=entry.get('sourceFile',entry.get('source'))
  for prefix in ['output/design/geometric-turnarounds-v1','public/geometric-turnarounds-v1']:
   assert sha(ROOT/prefix/original)==entry['sourceSha256'],('Actual original source PNG changed',aid,prefix)
  add(ROOT/'output/design/geometric-turnarounds-v1'/original)
 report_path=OUT/f'source-six-review-{category}.json'
 if not report_path.exists():report_path=OUT/f'source-six-review-{category}-v6.json'
 report=read(report_path);assert not report['unresolvedSignificantFindingsWithinScope'],category
 if category=='enemies':final_enemy_review={row['id']:row for row in report['entries']}
 assert len(report['entries'])==count and len({r['id'] for r in report['entries']})==count
 for current in report['entries']:
  aid=current['id'];entry=assets[aid];row=current
  assert current['actualGlbSha256']==sha(ROOT/'public/assets/geometric'/entry['file']),('Visual model changed',aid)
  assert current.get('actualNativeSha256',current.get('nativeSha256'))==sha(ROOT/entry.get('nativeFile',entry.get('native'))),('Visual native changed',aid)
  assert current['sourceSha256']==entry['sourceSha256'],('Visual original changed',aid)
  if category=='enemies':
   assert current.get('actualSixViewsInspected'),('Every V6 enemy needs fresh actual six-view inspection',aid)
   assert entry.get('native','').startswith('blender/scenes/geometric-game-v6/enemies/'),('Enemy must use a new V6 native scene',aid)
   fresh+=1
  else:
   assert not current.get('actualSixViewsInspected'),('V6 tower review must record exact V5 inheritance',aid)
   row,edition=eligible_prior(category,aid,current);inherited+=1
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
assert len(assets)==136 and fresh==50 and inherited==86
current_public_geometric={
 'public/assets/geometric/'+entry[key]
 for entry in assets.values()for key in ['file','portrait']
}
def staged_public_duplicate(name):
 return name.startswith('public/assets/geometric/') and Path(name).suffix.lower() in ['.glb','.png'] and name not in current_public_geometric

# Preserve exact V4 and published V5 authoring inputs. No prior ZIP is
# nested inside this ZIP; manifests and referenced native scenes are explicit.
def add_replay_baseline(directory,commit,edition):
 baseline=read(directory/'native-dependencies.json')
 assert baseline['baselineCommit']==commit and baseline['models']==136
 rows=baseline['entries'];assert len(rows)==136 and {r['id']for r in rows}==set(assets)
 by_id={r['id']:r for r in rows}
 prior=read(ROOT/f'output/design/geometric-game-{edition}/native-model-audit.json')
 assert prior['models']==136 and prior['passed']==136
 prior_by_id={r['id']:r for r in prior['results']};assert set(prior_by_id)==set(assets)
 for category,count in [('defenders',48),('champions',38),('enemies',50)]:
  name=f'geometric-{category}.json';path=directory/name
  committed=subprocess.check_output(['git','show',f'{commit}:public/assets/geometric/{name}'],cwd=RELEASE)
  assert sha(path)==hashlib.sha256(committed).hexdigest(),('Baseline manifest differs from immutable commit',edition,category)
  manifest=read(path);entries=manifest.get('assets',manifest.get('entries',[]))
  assert len(entries)==count and len({r['id']for r in entries})==count
  for entry in entries:
   dep=by_id[entry['id']];old=prior_by_id[entry['id']]
   assert dep['category']==category and dep['nativeFile']==entry.get('nativeFile',entry.get('native'))
   assert dep['nativeFile']==old['nativeFile'] and dep['nativeSha256']==old['nativeSha256']
   assert sha(ROOT/dep['nativeFile'])==dep['nativeSha256'],('Historical native input changed',edition,entry['id'])
   assert entry['sourceSha256']==assets[entry['id']]['sourceSha256']
   if edition=='v5' and category!='enemies':
    current=assets[entry['id']]
    assert current==entry,('Inherited tower manifest entry changed from V5',entry['id'])
    assert sha(ROOT/'public/assets/geometric'/current['file'])==dep['glbSha256']
    assert current.get('nativeFile',current.get('native'))==dep['nativeFile']
   add(ROOT/dep['nativeFile'])
  add(path)
 add(directory/'native-dependencies.json');add(ROOT/f'output/design/geometric-game-{edition}/native-model-audit.json')
 return by_id
add_replay_baseline(ROOT/'output/design/geometric-game-v5/baseline-v4-manifests','63da13815eebc873cea1954812a733f975494ab7','v4')
incoming=add_replay_baseline(OUT/'baseline-v5-manifests','5792fa747abab5efe1abec00dfaa25427b54d293','v5')
portrait_baseline_path=OUT/'baseline-v5-manifests/portrait-dependencies.json'
portrait_baseline=read(portrait_baseline_path)
assert portrait_baseline['baselineCommit']=='5792fa747abab5efe1abec00dfaa25427b54d293' and portrait_baseline['baselineVersion']=='0.3.4' and portrait_baseline['models']==136
assert len(portrait_baseline['entries'])==136 and {row['id']for row in portrait_baseline['entries']}==set(assets)
old_portrait_paths={}
for category in ['defenders','champions','enemies']:
 manifest=read(OUT/f'baseline-v5-manifests/geometric-{category}.json')
 for entry in manifest.get('assets',manifest.get('entries',[])):old_portrait_paths[entry['id']]='public/assets/geometric/'+entry['portrait']
with zipfile.ZipFile(ROOT/'output/design/geometric-game-v5-complete.zip') as published_v5:
 for row in portrait_baseline['entries']:
  aid=row['id'];assert row['file']==old_portrait_paths[aid]
  assert hashlib.sha256(published_v5.read(row['file'])).hexdigest()==row['sha256'],('Frozen portrait differs from actual immutable V5 archive',aid)
  portrait='public/assets/geometric/'+assets[aid]['portrait']
  if aid not in final_enemy_review:
   assert portrait==row['file'] and sha(ROOT/portrait)==row['sha256'],('Inherited V5 portrait changed',aid)
  else:
   quarter=next(view for view in final_enemy_review[aid]['actualSixViewsInspected']if view_name(view['view'])=='three-quarter-front')
   assert sha(ROOT/portrait)==quarter['sha256'],('Enemy portrait differs from the approved actual quarter-front render',aid)
  assert sha(ROOT/portrait)==sha(RELEASE/portrait),('Tested portrait differs from native workspace',aid)
add(portrait_baseline_path)
boss_baseline_path=OUT/'baseline-v5-glbs/manifest.json';boss_baseline=read(boss_baseline_path)
assert boss_baseline['baselineArchiveSHA256']==prior_hashes['v5'] and boss_baseline['bosses']==5
assert len(boss_baseline['entries'])==5 and {r['id']for r in boss_baseline['entries']}=={'host_10','host_20','host_30','host_40','host_50'}
for row in boss_baseline['entries']:
 assert row['sha256']==incoming[row['id']]['glbSha256'] and sha(ROOT/row['file'])==row['sha256'],('Actual immutable V5 boss replay differs',row['id'])
 add(ROOT/row['file'])
add(boss_baseline_path)

# Final recorded source resolutions and geometry measurements must cover all
# fifty new exports and bind to the same initial source findings and asset bytes.
initial_path=OUT/'enemy-initial-six-view-review.json';initial=read(initial_path)
assert initial['subjectsActuallyOpened']==50 and initial['sourceModelPairsActuallyInspected']==300
assert len(initial['entries'])==50 and {r['id']for r in initial['entries']}=={f'host_{n:02d}'for n in range(1,51)}
initial_by_id={r['id']:r for r in initial['entries']}
resolution=read(OUT/'enemy-final-source-resolution-audit.json')
assert resolution['models']==50 and resolution['failures']==0 and resolution['initialReviewSha256']==sha(initial_path)
assert len(resolution['entries'])==50 and {r['id']for r in resolution['entries']}==set(initial_by_id)
physical=read(OUT/'enemy-physical-assembly-audit.json')
assert physical['models']==50 and physical['readOnly'] and physical['failures']==0 and physical['checks']>0
assert len(physical['entries'])==50 and {r['id']for r in physical['entries']}==set(initial_by_id)
assert physical['enemyManifestSha256']==sha(ROOT/'public/assets/geometric/geometric-enemies.json')
assert physical['baselineBossGeometry']==boss_baseline['entries']
helmet_source_review=physical['independentHelmetSourceReview']
assert helmet_source_review['file']=='output/design/geometric-game-v6/independent-helmet-source-intervals.json'
assert sha(ROOT/helmet_source_review['file'])==helmet_source_review['sha256']
add(ROOT/helmet_source_review['file'])
for row in physical['entries']:
 assert row['nativeUntouched'] and row['exportUntouched'] and row['checks'] and not row['failures']
 assert all(check['passed']for check in row['checks']),('Physical row contains failed measurement',row['id'])
for report in [resolution,physical]:
 for row in report['entries']:
  entry=assets[row['id']]
  assert row['actualGlbSha256']==sha(ROOT/'public/assets/geometric'/entry['file'])
  assert row['actualNativeSha256']==sha(ROOT/entry['native'])
  assert row['sourceSha256']==entry['sourceSha256']
for row in resolution['entries']:
 original=initial_by_id[row['id']]
 assert row['initialFindingsSha256']==hashlib.sha256(original['visualSourceFindings'].encode('utf-8')).hexdigest()
 assert row['resolution'].strip() and not row['unresolvedSignificantFindings']
 final=final_enemy_review[row['id']]
 assert final['initialFindingsSha256']==row['initialFindingsSha256'] and final['resolution']==row['resolution'] and final['unresolvedSignificantFindings']==row['unresolvedSignificantFindings'],('Resolution must be the actual final source-review record',row['id'])
for module in physical['runtimeModules']:assert sha(RELEASE/module['file'])==module['sha256']
for row in initial['entries']:
 assert row['sourceSha256']==incoming[row['id']]['sourceSha256'] and row['actualNativeSha256']==incoming[row['id']]['nativeSha256']
 assert row['actualGlbSha256']==incoming[row['id']]['glbSha256']
 sheet=row['inspectionEvidenceSheet'];assert sha(ROOT/sheet['path'])==sheet['sha256'];inspection_files.add(sheet['path'])
 for view in row['actualSixViewsInspected']:
  assert view['actuallyOpenedAndCompared'] and sha(ROOT/view['path'])==view['sha256'];inspection_files.add(view['path'])

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
assert validation['version']=='0.3.5' and validation['tests']['tests']==validation['tests']['pass'] and validation['tests']['tests']>=467 and all(validation['tests'][key]==0 for key in ['fail','cancelled','skipped','todo']) and validation['build']['exitCode']==0
assert validation['validatedSourceFiles']
for row in validation['validatedSourceFiles']:assert sha(RELEASE/row['file'])==row['sha256'],('Validated source changed',row['file'])
assert {'tools/package_geometric_game_v6.py','tools/verify_geometric_archive_v6.py','tools/enemy-physical-assembly-v6.mjs','tools/enemy-rider-anatomy-v6.mjs','tests/enemy-physical-assembly-v6.test.mjs','tests/enemy-hindleg-flight-v6.test.mjs'}<={r['file']for r in validation['validatedSourceFiles']}
camp=read(ROOT/'output/design/geometric-game-v5/camp-native-audit.json')
assert camp['status']=='pass' and camp['nativeReadOnly']
assert len(camp['tentAssemblies'])==22 and camp['protectedOriginalMeshes']==6027
assert camp['sourceVerticesMatchedToActualExport']==5691
assert all(row['clearance']>=.22-1e-7 for row in camp['tentAssemblies'])
assert sha(RELEASE/'blender/scenes/fortified-warcamp-v8.blend')==camp['nativeSHA'], 'Audited native camp changed'
assert sha(RELEASE/'public/assets/scenery/fortified-warcamp-v8.glb')==camp['glbSHA'], 'Audited runtime camp changed'
assert sha(ROOT/'public/assets/scenery/fortified-warcamp-v8.glb')==camp['glbSHA'], 'Native workspace and tested camp exports differ'
camp_review=read(ROOT/'output/design/geometric-game-v5/gameplay-environment-review.json')
assert camp_review['status']=='pass' and camp_review['tests']['passed']==39 and camp_review['tests']['failed']==0 and camp_review['tests']['skipped']==0
# V5 source hashes document that release; current V6 source is bound by the
# final validatedSourceFiles above. The unchanged camp geometry stays exact.
add(ROOT/'output/design/geometric-game-v5/camp-native-audit.json')
add(ROOT/'output/design/geometric-game-v5/gameplay-environment-review.json')
for name in camp['views']:
 assert (RELEASE/name).is_file() and (RELEASE/name).stat().st_size>10000, ('Missing actual detail inspection render',name)

# Complete tested project files, including legacy fixture dependencies. Native
# geometric scenes are selected from the current 136 manifest references above.
tracked=subprocess.check_output(['git','ls-files','-z'],cwd=RELEASE).decode('utf-8').split('\0')
for name in tracked:
 if not name or not (RELEASE/name).is_file():continue
 if name.startswith(('blender/scenes/geometric-game-v1/','blender/renders/geometric-game-v1/','output/')):continue
 if staged_public_duplicate(name):continue
 add(RELEASE/name,name)
for base in ['game','data','tests','ui','tools','public','backend','.github','docs','blender/scripts']:
 for path in (RELEASE/base).rglob('*'):
  if path.is_file() and '__pycache__' not in path.parts and path.suffix not in ['.pyc','.pyo']:
   name=path.relative_to(RELEASE).as_posix()
   if staged_public_duplicate(name):continue
   if name in sources:
    assert sha(sources[name])==sha(path),('Authoritative and tested code differs',name)
   else:add(path,name)
for path in OUT.rglob('*'):
 if path.is_file() and path.name!='package-verification.json':add(path)
for name in inspection_files:add(ROOT/name)
for edition in ['v2','v3','v4','v5']:
 for category in ['defenders','champions','enemies']:
  prior_path=ROOT/f'output/design/geometric-game-{edition}/source-six-review-{category}.json'
  if not prior_path.exists():prior_path=ROOT/f'output/design/geometric-game-{edition}/source-six-review-{category}-{edition}.json'
  add(prior_path)
for name in [appearance['sourceCheckpointFile'],'output/design/geometric-game-v1/source-measurements.json','output/design/geometric-game-v1/defenders/reference-measurements.json','output/design/geometric-turnarounds-v1/manifest.json']:
 add(ROOT/name)
for name in ['blender/scenes/fortified-warcamp-v8.blend','blender/renders/fortified-warcamp-v8-review.png','START_GAME.cmd']:add(RELEASE/name,name)
for name in camp['views']:add(RELEASE/name,name)
add(ROOT/'blender/scenes/geometric-game-v1/champions/crownofages.blend')
for name in ['public/release.json','package.json']:assert read(RELEASE/name)['version']=='0.3.5'
assert sum(name.startswith('public/assets/geometric/') and name.endswith('.glb') for name in sources)==136
assert all((name in sources) for name in ['index.html','archer.html','vite.config.js','pnpm-lock.yaml','tools/package_geometric_game_v6.py'])
if '--check-only' in sys.argv:
 print(json.dumps({'models':136,'nativeReplayBaselineModels':{'v4':136,'v5':136},'freshInspectedSubjects':fresh,'inheritedUnchangedSubjects':inherited,'sources':len(sources),'allBindingsVerified':True}));sys.exit(0)
if ZIP.exists():raise SystemExit('Preserve this completed archive; use a new edition rather than overwriting it.')
inventory=[{'file':name,'bytes':path.stat().st_size,'sha256':sha(path)} for name,path in sorted(sources.items())]
temporary=ZIP.with_suffix('.zip.in-progress')
with zipfile.ZipFile(temporary,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as archive:
 for name,path in sorted(sources.items()):archive.write(path,name)
 archive.writestr('PACKAGE_INVENTORY.json',json.dumps(inventory,ensure_ascii=False,indent=2))
with zipfile.ZipFile(temporary) as archive:
 assert archive.testzip() is None
 for row in inventory:assert hashlib.sha256(archive.read(row['file'])).hexdigest()==row['sha256']
for row in inventory:assert sha(sources[row['file']])==row['sha256'],('Source changed during archive creation',row['file'])
for edition,expected in prior_hashes.items():assert sha(ROOT/f'output/design/geometric-game-{edition}-complete.zip')==expected
temporary.rename(ZIP)
report={'edition':'0.3.5','zip':str(ZIP),'bytes':ZIP.stat().st_size,'sha256':sha(ZIP),'entries':len(inventory)+1,'nativeModels':136,'nativeReplayBaselineModels':{'v4':136,'v5':136},'glbModels':136,'freshInspectedSubjects':fresh,'inheritedUnchangedSubjects':inherited,'actualSourceModelPairs':816,'freshEnemyPairs':300,'unchangedInheritedTowerSubjects':86,'surfaceInterfaces':contacts['interfaces'],'integrityVerified':True,'priorArchivesVerified':prior_hashes}
(OUT/'package-verification.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
