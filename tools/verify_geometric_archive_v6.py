"""Independently extract the immutable V6 ZIP and rebuild its actual game.

Provide --archive, --destination, --dependencies and --output absolute paths.
The destination must be new. Cached dependencies may be reused only when their
project lockfile is byte-identical to the archive's extracted lockfile.
"""
import argparse,hashlib,json,os,re,stat,subprocess,zipfile,datetime
from pathlib import Path,PurePosixPath

def sha(path):
    digest=hashlib.sha256()
    with Path(path).open('rb') as file:
        for block in iter(lambda:file.read(2*1024*1024),b''):digest.update(block)
    return digest.hexdigest()

HISTORICAL_ARCHIVES={
    'v1':'33b54de0e65a3605b0124a4e1c76d4d07364fb1b003d06b2d8c56fb9b8b4b014',
    'v2':'1ee5a05eea721b53965e3721b1bf1dcfa5c69ce194792de78759a4754a98c4d8',
    'v3':'ab7d5f5e665ea9cc8c1d30b74b9648f0355fffba34463bd2e20b5d872c54b251',
    'v4':'5900df0908797fa41667d80132efe9f0d35637aab99d9489ef3d4cf12cd84237',
    'v5':'a4516a26e00db318d897230d5095e78788167bd1b999c3f84d8184f96f6b7243',
}

def verify(args):
    archive_path=Path(args.archive).resolve(strict=True);destination=Path(args.destination).resolve();dependencies=Path(args.dependencies).resolve(strict=True);output=Path(args.output).resolve()
    assert destination.is_absolute() and not destination.exists(),'Extraction destination must be a new absolute directory'
    assert archive_path.suffix.lower()=='.zip' and dependencies.name=='node_modules'
    assert destination.parent.is_dir(),'Create the intended task workspace parent explicitly first'
    historical_directory=Path(args.historical_archive_directory).resolve(strict=True) if args.historical_archive_directory else archive_path.parent
    historical={}
    for edition,expected in HISTORICAL_ARCHIVES.items():
        path=historical_directory/f'geometric-game-{edition}-complete.zip'
        assert sha(path)==expected,('Historical archive differs before V6 extraction',edition)
        historical[edition]={'file':str(path),'sha256':expected,'bytes':path.stat().st_size}
    before=sha(archive_path);records=[]
    with zipfile.ZipFile(archive_path) as archive:
        names=archive.namelist();assert len(names)==len(set(names))==len(set(name.casefold() for name in names)),'Duplicate/case-colliding members'
        inventory=json.loads(archive.read('PACKAGE_INVENTORY.json'));assert len(inventory)==len({row['file'] for row in inventory})
        assert set(names)=={row['file'] for row in inventory}|{'PACKAGE_INVENTORY.json'},'Every real member must be covered by the inventory'
        for member in archive.infolist():
            name=member.filename;parts=PurePosixPath(name).parts
            assert parts and not PurePosixPath(name).is_absolute() and '..' not in parts and '.' not in parts and '\\' not in name and ':' not in name
            assert not stat.S_ISLNK(member.external_attr>>16),'No archive symlinks'
            resolved=(destination/name).resolve();assert resolved.is_relative_to(destination),'Archive member escapes extraction directory'
        # Read every compressed byte stream before any extraction. Zip CRC and
        # independently computed SHA-256 must agree with each inventory row.
        for row in inventory:
            digest=hashlib.sha256();count=0
            with archive.open(row['file']) as file:
                for block in iter(lambda:file.read(2*1024*1024),b''):digest.update(block);count+=len(block)
            assert digest.hexdigest()==row['sha256'] and count==row['bytes'],row['file']
        destination.mkdir()
        archive.extractall(destination)
    for row in inventory:assert sha(destination/row['file'])==row['sha256'],('Extracted bytes differ',row['file'])
    assert json.loads((destination/'package.json').read_text())['version']=='0.3.5'
    asset_ids=set();current_natives=set();current_glbs=set();current_portraits=set();current_by_id={}
    for category,count in [('defenders',48),('champions',38),('enemies',50)]:
        manifest=json.loads((destination/f'public/assets/geometric/geometric-{category}.json').read_text(encoding='utf-8-sig'))
        rows=manifest.get('assets',manifest.get('entries',[]));assert len(rows)==count
        for row in rows:
            assert row['id'] not in asset_ids;asset_ids.add(row['id']);current_by_id[row['id']]=row
            current_natives.add(row.get('nativeFile',row.get('native')))
            current_glbs.add('public/assets/geometric/'+row['file']);current_portraits.add('public/assets/geometric/'+row['portrait'])
            assert (destination/row.get('nativeFile',row.get('native'))).is_file()
            assert sha(destination/'public/assets/geometric'/row['file'])==row.get('metrics',row.get('qa'))['fileSha256']
            original=row.get('sourceFile',row.get('source'))
            for prefix in ['output/design/geometric-turnarounds-v1','public/geometric-turnarounds-v1']:
                assert sha(destination/prefix/original)==row['sourceSha256'],('Extracted actual original source PNG differs',row['id'],prefix)
    assert len(asset_ids)==len(current_natives)==136
    assert {row['file']for row in inventory if row['file'].startswith('public/assets/geometric/') and row['file'].endswith('.glb')}==current_glbs,'Only the136 current geometric GLBs may be packaged'
    assert current_portraits<={row['file']for row in inventory},'Every current portrait must be packaged'
    native_audit=json.loads((destination/'output/design/geometric-game-v6/native-model-audit.json').read_text(encoding='utf-8-sig'))
    assert native_audit['models']==native_audit['passed']==136 and {row['id']for row in native_audit['results']}==asset_ids
    for row in native_audit['results']:assert row['nativeFile']in current_natives and sha(destination/row['nativeFile'])==row['nativeSha256'],('Actual extracted current native differs',row['id'])
    for edition,rel in [('v4','output/design/geometric-game-v5/baseline-v4-manifests'),('v5','output/design/geometric-game-v6/baseline-v5-manifests')]:
        baseline=json.loads((destination/rel/'native-dependencies.json').read_text(encoding='utf-8-sig'))
        assert baseline['models']==136 and len(baseline['entries'])==136 and {row['id'] for row in baseline['entries']}==asset_ids
        for row in baseline['entries']:assert sha(destination/row['nativeFile'])==row['nativeSha256'],('Extracted native replay input differs',edition,row['id'])
    portrait_baseline=json.loads((destination/'output/design/geometric-game-v6/baseline-v5-manifests/portrait-dependencies.json').read_text(encoding='utf-8-sig'))
    assert portrait_baseline['baselineCommit']=='5792fa747abab5efe1abec00dfaa25427b54d293' and portrait_baseline['baselineVersion']=='0.3.4' and portrait_baseline['models']==136
    assert len(portrait_baseline['entries'])==136 and {row['id']for row in portrait_baseline['entries']}==asset_ids
    final_review=json.loads((destination/'output/design/geometric-game-v6/source-six-review-enemies.json').read_text(encoding='utf-8-sig'))
    final_enemies={row['id']:row for row in final_review['entries']};assert len(final_enemies)==50 and set(final_enemies)=={f'host_{number:02d}'for number in range(1,51)}
    old_portrait_paths={}
    for category in ['defenders','champions','enemies']:
        manifest=json.loads((destination/f'output/design/geometric-game-v6/baseline-v5-manifests/geometric-{category}.json').read_text(encoding='utf-8-sig'))
        for row in manifest.get('assets',manifest.get('entries',[])):
            old_portrait_paths[row['id']]='public/assets/geometric/'+row['portrait']
            current=current_by_id[row['id']]
            assert current['sourceSha256']==row['sourceSha256'] and current.get('sourceFile',current.get('source'))==row.get('sourceFile',row.get('source')),('Original source identity differs from frozen V5 manifest',row['id'])
    with zipfile.ZipFile(historical['v5']['file']) as published_v5:
        for row in portrait_baseline['entries']:
            aid=row['id'];assert row['file']==old_portrait_paths[aid]
            assert hashlib.sha256(published_v5.read(row['file'])).hexdigest()==row['sha256'],('Recorded portrait differs from actual immutable V5 ZIP',aid)
            current='public/assets/geometric/'+current_by_id[aid]['portrait']
            if aid not in final_enemies:
                assert current==row['file'] and sha(destination/current)==row['sha256'],('Extracted inherited portrait differs from published V5',aid)
            else:
                quarter=next(view for view in final_enemies[aid]['actualSixViewsInspected']if view['view'].lower()in ['three-quarter-front','3/4 front'])
                assert sha(destination/quarter['path'])==quarter['sha256']==sha(destination/current),('Extracted enemy portrait differs from approved actual render',aid)
    boss_baseline=json.loads((destination/'output/design/geometric-game-v6/baseline-v5-glbs/manifest.json').read_text(encoding='utf-8-sig'))
    assert boss_baseline['baselineArchiveSHA256']==HISTORICAL_ARCHIVES['v5'] and boss_baseline['bosses']==5
    assert {row['id']for row in boss_baseline['entries']}=={'host_10','host_20','host_30','host_40','host_50'}
    for row in boss_baseline['entries']:assert sha(destination/row['file'])==row['sha256'],('Extracted actual V5 boss geometry differs',row['id'])
    assert sha(destination/'pnpm-lock.yaml')==sha(dependencies.parent/'pnpm-lock.yaml'),'Cached dependency lockfile differs'
    output.parent.mkdir(parents=True,exist_ok=True)
    if os.name=='nt':
        quote=lambda value:"'"+str(value).replace("'","''")+"'"
        command='New-Item -ItemType Junction -Path '+quote(destination/'node_modules')+' -Target '+quote(dependencies)+' | Out-Null'
        subprocess.run(['powershell','-NoProfile','-NonInteractive','-Command',command],check=True,cwd=destination)
    else:(destination/'node_modules').symlink_to(dependencies,target_is_directory=True)
    environment=dict(os.environ,VITE_BASE_PATH=args.base_path)
    # The independent run must import only canonical assets from this fresh
    # extraction. An authoring-shell fixture override cannot redirect it.
    environment.pop('GEOMETRIC_V6_STAGE_MANIFEST',None)
    for name,script in [('tests','pnpm test'),('build','pnpm build')]:
        log=output.parent/('independent-archive-'+name+'.log')
        with log.open('w',encoding='utf-8',newline='\n') as file:
            if os.name=='nt':command=['powershell','-NoProfile','-NonInteractive','-Command',script+'; exit $LASTEXITCODE']
            else:command=['sh','-c',script]
            result=subprocess.run(command,cwd=destination,env=environment,stdout=file,stderr=subprocess.STDOUT)
        records.append(dict(command=script,exitCode=result.returncode,log=str(log),logSHA=sha(log)))
        assert result.returncode==0,('Independent extracted project failed',script,str(log))
        if name=='tests':
            counters=dict(re.findall(r'^(?:#|ℹ)\s+(tests|pass|fail|cancelled|skipped|todo)\s+(\d+)\s*$',log.read_text(encoding='utf-8'),re.MULTILINE))
            assert {'tests','pass','fail','cancelled','skipped','todo'}<=set(counters),'Missing actual full test-run summary'
            records[-1]['summary']={key:int(value) for key,value in counters.items()}
            assert int(counters['tests'])==int(counters['pass']) and int(counters['tests'])>=467 and all(int(counters[key])==0 for key in ['fail','cancelled','skipped','todo']),'Incomplete extracted-project test pass'
    assert (destination/'dist/index.html').is_file() and (destination/'dist/archer.html').is_file()
    for page in ['index.html','archer.html']:
        built=(destination/'dist'/page).read_text(encoding='utf-8')
        script_urls=re.findall(r'<script\b[^>]*\bsrc=[\"\']([^\"\']+)[\"\']',built)
        assert script_urls and all(url.startswith(args.base_path+'assets/') for url in script_urls),('Built entry uses incorrect production base path',page,script_urls)
    extracted_public=[row for row in inventory if row['file'].startswith('public/')]
    for row in extracted_public:assert sha(destination/row['file'])==row['sha256'],'Build modified original public assets'
    assert sha(archive_path)==before,'Original archive changed during rebuild'
    for edition,row in historical.items():assert sha(row['file'])==row['sha256'],('Historical archive changed during V6 extraction/rebuild',edition)
    report=dict(status='pass',independentExtraction=True,zip=str(archive_path),zipSHA256=before,bytes=archive_path.stat().st_size,entries=len(inventory)+1,allInventoryStreamsCRCAndSHA256Verified=True,allExtractedFileHashesVerified=True,currentManifestModels=136,nativeReplayBaselineModels={'v4':136,'v5':136},newExtractionDirectory=str(destination),dependencyLockSHA256=sha(destination/'pnpm-lock.yaml'),dependencyReuse='Exact-lockfile cached node_modules junction' if os.name=='nt' else 'Exact-lockfile cached node_modules symlink',commands=records,productionBasePath=args.base_path,productionEntryPoints=['index.html','archer.html'],publicOriginalFilesUnchanged=len(extracted_public),archiveImmutableAfterRebuild=True,timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat())
    report.update(historicalArchivesUnchanged=historical,actualV5BossReplayModels=5,frozenV5PortraitModels=136,inheritedPortraitsVerified=86,freshEnemyPortraitsBoundToApprovedRenders=50)
    report.update(originalSourceModelsVerified=136,originalSourcePNGCopiesVerified=272)
    output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8',newline='\n');print(json.dumps(report))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    for name in ['archive','destination','dependencies','output']:parser.add_argument('--'+name,required=True)
    parser.add_argument('--historical-archive-directory',help='Directory containing the five immutable prior ZIPs; defaults to the V6 archive directory')
    parser.add_argument('--base-path',default='/bastions-of-the-last-kingdom/');verify(parser.parse_args())
