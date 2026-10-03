"""Independently extract the immutable V5 ZIP and rebuild its actual game.

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

def verify(args):
    archive_path=Path(args.archive).resolve(strict=True);destination=Path(args.destination).resolve();dependencies=Path(args.dependencies).resolve(strict=True);output=Path(args.output).resolve()
    assert destination.is_absolute() and not destination.exists(),'Extraction destination must be a new absolute directory'
    assert archive_path.suffix.lower()=='.zip' and dependencies.name=='node_modules'
    assert destination.parent.is_dir(),'Create the intended task workspace parent explicitly first'
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
    assert json.loads((destination/'package.json').read_text())['version']=='0.3.4'
    asset_ids=set();current_natives=set()
    for category,count in [('defenders',48),('champions',38),('enemies',50)]:
        manifest=json.loads((destination/f'public/assets/geometric/geometric-{category}.json').read_text(encoding='utf-8-sig'))
        rows=manifest.get('assets',manifest.get('entries',[]));assert len(rows)==count
        for row in rows:
            assert row['id'] not in asset_ids;asset_ids.add(row['id'])
            current_natives.add(row.get('nativeFile',row.get('native')))
            assert (destination/row.get('nativeFile',row.get('native'))).is_file()
            assert sha(destination/'public/assets/geometric'/row['file'])==row.get('metrics',row.get('qa'))['fileSha256']
    assert len(asset_ids)==len(current_natives)==136
    baseline=json.loads((destination/'output/design/geometric-game-v5/baseline-v4-manifests/native-dependencies.json').read_text(encoding='utf-8-sig'))
    assert baseline['models']==136 and len(baseline['entries'])==136 and {row['id'] for row in baseline['entries']}==asset_ids
    for row in baseline['entries']:assert sha(destination/row['nativeFile'])==row['nativeSha256'],('Extracted native replay input differs',row['id'])
    assert sha(destination/'pnpm-lock.yaml')==sha(dependencies.parent/'pnpm-lock.yaml'),'Cached dependency lockfile differs'
    output.parent.mkdir(parents=True,exist_ok=True)
    if os.name=='nt':
        quote=lambda value:"'"+str(value).replace("'","''")+"'"
        command='New-Item -ItemType Junction -Path '+quote(destination/'node_modules')+' -Target '+quote(dependencies)+' | Out-Null'
        subprocess.run(['powershell','-NoProfile','-NonInteractive','-Command',command],check=True,cwd=destination)
    else:(destination/'node_modules').symlink_to(dependencies,target_is_directory=True)
    environment=dict(os.environ,VITE_BASE_PATH=args.base_path)
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
            assert int(counters['tests'])==int(counters['pass']) and all(int(counters[key])==0 for key in ['fail','cancelled','skipped','todo']),'Incomplete extracted-project test pass'
    assert (destination/'dist/index.html').is_file() and (destination/'dist/archer.html').is_file()
    for page in ['index.html','archer.html']:
        built=(destination/'dist'/page).read_text(encoding='utf-8')
        script_urls=re.findall(r'<script\b[^>]*\bsrc=[\"\']([^\"\']+)[\"\']',built)
        assert script_urls and all(url.startswith(args.base_path+'assets/') for url in script_urls),('Built entry uses incorrect production base path',page,script_urls)
    extracted_public=[row for row in inventory if row['file'].startswith('public/')]
    for row in extracted_public:assert sha(destination/row['file'])==row['sha256'],'Build modified original public assets'
    assert sha(archive_path)==before,'Original archive changed during rebuild'
    report=dict(status='pass',independentExtraction=True,zip=str(archive_path),zipSHA256=before,bytes=archive_path.stat().st_size,entries=len(inventory)+1,allInventoryStreamsCRCAndSHA256Verified=True,allExtractedFileHashesVerified=True,currentManifestModels=136,nativeReplayBaselineModels=136,newExtractionDirectory=str(destination),dependencyLockSHA256=sha(destination/'pnpm-lock.yaml'),dependencyReuse='Exact-lockfile cached node_modules junction' if os.name=='nt' else 'Exact-lockfile cached node_modules symlink',commands=records,productionBasePath=args.base_path,productionEntryPoints=['index.html','archer.html'],publicOriginalFilesUnchanged=len(extracted_public),archiveImmutableAfterRebuild=True,timestamp=datetime.datetime.now(datetime.timezone.utc).isoformat())
    output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8',newline='\n');print(json.dumps(report))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    for name in ['archive','destination','dependencies','output']:parser.add_argument('--'+name,required=True)
    parser.add_argument('--base-path',default='/bastions-of-the-last-kingdom/');verify(parser.parse_args())
