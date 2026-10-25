import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';

const tool=fileURLToPath(new URL('../tools/archive-release.py',import.meta.url));
const bundled=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe');
const python=process.env.ARCHIVE_PYTHON||(fs.existsSync(bundled)?bundled:process.platform==='win32'?'python':'python3');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
function run(command,args,cwd){return spawnSync(command,args,{cwd,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:4*1024*1024});}
function must(command,args,cwd){const result=run(command,args,cwd);assert.equal(result.status,0,result.stderr||result.error?.message||result.stdout);return result.stdout.trim();}
function fixture(t,{version='0.5.0',base='/',large=false}={}){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'bastions archive test ')),repo=path.join(root,'source'),dist=path.join(root,'dist'),out=path.join(root,'release');
  t.after(()=>{assert.ok(path.resolve(root).startsWith(path.resolve(os.tmpdir())+path.sep));assert.ok(path.basename(root).startsWith('bastions archive test '));fs.rmSync(root,{recursive:true,force:true});});
  for(const dir of [repo,dist,path.join(repo,'game'),path.join(repo,'public'),path.join(dist,'assets')])fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(repo,'.gitattributes'),'* text=auto eol=lf\n*.cmd text eol=crlf\n*.bin binary\n');
  fs.writeFileSync(path.join(repo,'.gitignore'),'node_modules/\ndist/\n');
  fs.writeFileSync(path.join(repo,'package.json'),JSON.stringify({name:'archive-fixture',version}));
  fs.writeFileSync(path.join(repo,'pnpm-lock.yaml'),'lockfileVersion: \'9.0\'\n');
  fs.writeFileSync(path.join(repo,'game/release.js'),`export const GAME_VERSION='${version}';\n`);
  const release=JSON.stringify({version,date:'2026-10-25'});
  fs.writeFileSync(path.join(repo,'public/release.json'),release);
  fs.writeFileSync(path.join(repo,'START_GAME.cmd'),'@echo off\necho fixture\n');
  const media=Buffer.alloc(large?3*1024*1024+31:1024);for(let i=0;i<media.length;i++)media[i]=i%251;
  fs.writeFileSync(path.join(repo,'public/media.bin'),media);
  must('git',['init','-q'],repo);must('git',['config','core.autocrlf','false'],repo);
  must('git',['add','.'],repo);must('git',['-c','user.name=Archive Test','-c','user.email=archive-test@example.invalid','commit','-qm','fixture'],repo);
  const commit=must('git',['rev-parse','HEAD'],repo);
  fs.writeFileSync(path.join(repo,'untracked-secret.txt'),'excluded untracked fixture');
  fs.writeFileSync(path.join(repo,'START_GAME.cmd'),'dirty workspace must not enter source ZIP\n');
  for(const page of ['index.html','archer.html'])fs.writeFileSync(path.join(dist,page),`<!doctype html><script type="module" src="${base}assets/game.js"></script><link rel="stylesheet" href="${base}assets/game.css">`);
  fs.writeFileSync(path.join(dist,'assets/game.js'),`console.log('${version}');`);
  fs.writeFileSync(path.join(dist,'assets/game.css'),'body{color:#123}');
  fs.writeFileSync(path.join(dist,'release.json'),release);fs.writeFileSync(path.join(dist,'media.bin'),media);
  const invoke=(action,args=[])=>run(python,[tool,action,'--repo',repo,'--outputdir',out,...args],repo);
  const create=(args=[])=>invoke('create',['--commit',commit,'--dist',dist,'--base',base,...args]);
  return {root,repo,dist,out,commit,media,invoke,create,manifest:()=>JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'))};
}
function passed(result){assert.equal(result.status,0,result.stderr||result.error?.message||result.stdout);return JSON.parse(result.stdout);}
function rejected(result,pattern){assert.notEqual(result.status,0);assert.match(result.stderr,pattern);}
function tamper(f,kind,mode){
  const script=String.raw`
import hashlib,json,pathlib,stat,struct,sys,zipfile
root=pathlib.Path(sys.argv[1]);kind=sys.argv[2];mode=sys.argv[3]
manifest=json.loads((root/'manifest.json').read_text());key=kind+'Archive';target=root/manifest[key]['file']
with zipfile.ZipFile(target) as archive: entries=[(entry,archive.read(entry)) for entry in archive.infolist()]
temp=root/'rewritten.zip'
with zipfile.ZipFile(temp,'x') as archive:
 for entry,data in entries:
  if mode=='forge-source' and entry.filename=='public/media.bin':data=bytes([data[0]^255])+data[1:]
  if mode=='crc':entry.compress_type=zipfile.ZIP_STORED
  archive.writestr(entry,data)
 if mode=='traversal':archive.writestr('../outside.txt',b'x')
 if mode=='absolute':archive.writestr('/outside.txt',b'x')
 if mode=='backslash':
  entry=zipfile.ZipInfo('placeholder');entry.filename='folder'+chr(92)+'outside.txt';archive.writestr(entry,b'x')
 if mode=='drive':archive.writestr('C:outside.txt',b'x')
 if mode=='dot':archive.writestr('folder/./outside.txt',b'x')
 if mode=='case':archive.writestr('PUBLIC/MEDIA.BIN',b'x')
 if mode=='duplicate':archive.writestr('public/media.bin',b'x')
 if mode=='parent-file':archive.writestr('public/media.bin/child',b'x')
 if mode=='symlink':
  link=zipfile.ZipInfo('linked');link.create_system=3;link.external_attr=(stat.S_IFLNK|0o777)<<16;archive.writestr(link,b'../target')
temp.replace(target)
if mode=='crc':
 with zipfile.ZipFile(target) as archive:entry=next(e for e in archive.infolist() if not e.is_dir() and e.filename.endswith('.bin'))
 with target.open('r+b') as stream:
  stream.seek(entry.header_offset+26);name,extra=struct.unpack('<HH',stream.read(4));stream.seek(entry.header_offset+30+name+extra);value=stream.read(1);stream.seek(-1,1);stream.write(bytes([value[0]^255]))
if mode=='forge-source':
 with zipfile.ZipFile(target) as archive:
  files=[dict(file=e.filename,bytes=e.file_size,sha256=hashlib.sha256(archive.read(e)).hexdigest()) for e in archive.infolist() if not e.is_dir()]
 manifest[key].update(files=sorted(files,key=lambda r:r['file']),fileCount=len(files),totalBytes=sum(r['bytes'] for r in files))
manifest[key].update(bytes=target.stat().st_size,sha256=hashlib.sha256(target.read_bytes()).hexdigest())
(root/'manifest.json').write_text(json.dumps(manifest))
`;
  must(python,['-c',script,f.out,kind,mode],f.root);
}

test('release archives bind exact committed source, preserve binary bytes and Git CRLF attributes, and verify without extracting',t=>{
  const f=fixture(t,{large:true}),before=must('git',['status','--porcelain'],f.repo),created=passed(f.create());
  assert.equal(created.version,'0.5.0');assert.equal(created.gitCommit,f.commit);assert.equal(created.productionBasePath,'/');assert.equal(created.extractionPerformed,false);
  const manifest=f.manifest();assert.equal(manifest.schema,'bastions-release-archive-v1');
  assert.equal(manifest.sourceArchive.files.find(row=>row.file==='public/media.bin').sha256,sha(f.media));
  assert.equal(manifest.productionArchive.files.find(row=>row.file==='media.bin').sha256,sha(f.media));
  assert.ok(!manifest.sourceArchive.files.some(row=>/untracked-secret|dist\/|node_modules|manifest\.json/.test(row.file)));
  const cmd=JSON.parse(must(python,['-c',"import json,sys,zipfile;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps(z.read('START_GAME.cmd').decode()))",path.join(f.out,manifest.sourceArchive.file)],f.repo));
  assert.equal(cmd,'@echo off\r\necho fixture\r\n');
  const beforeFiles=fs.readdirSync(f.out).sort(),manifestBytes=fs.readFileSync(path.join(f.out,'manifest.json'));
  const verified=passed(f.invoke('verify',['--commit',f.commit,'--dist',f.dist]));
  assert.equal(verified.sourceMatchesFreshGitTar,true);assert.equal(verified.manifestWritten,false);assert.equal(verified.allZipStreamsCrcAndSha256Verified,true);
  assert.deepEqual(fs.readdirSync(f.out).sort(),beforeFiles);assert.deepEqual(fs.readFileSync(path.join(f.out,'manifest.json')),manifestBytes);assert.equal(must('git',['status','--porcelain'],f.repo),before);
  // Verification also works after the build directory is unavailable.
  fs.renameSync(f.dist,path.join(f.root,'dist-not-in-use'));passed(f.invoke('verify'));
});

test('project-path production is supported and its explicit base is checked',t=>{
  const f=fixture(t,{base:'/bastions-of-the-last-kingdom/'});assert.equal(passed(f.create()).productionBasePath,'/bastions-of-the-last-kingdom/');passed(f.invoke('verify'));
});

test('existing output is refused without changing a byte',t=>{
  const f=fixture(t);fs.mkdirSync(f.out);fs.writeFileSync(path.join(f.out,'keep.txt'),'keep');rejected(f.create(),/must be new/);assert.deepEqual(fs.readdirSync(f.out),['keep.txt']);assert.equal(fs.readFileSync(path.join(f.out,'keep.txt'),'utf8'),'keep');
});

test('only a full exact commit SHA is accepted',t=>{
  const f=fixture(t);rejected(f.create(['--commit','HEAD']),/full lowercase 40-character/);assert.equal(fs.existsSync(f.out),false);
});

test('committed version metadata must agree and use three components',t=>{
  const f=fixture(t,{version:'0.5'});rejected(f.create(),/version must use x.y.z/);assert.equal(fs.existsSync(f.out),false);
});

test('production version and compiled entry base must match the committed release',t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.dist,'release.json'),JSON.stringify({version:'0.4.9'}));rejected(f.create(),/Production release version differs/);
});

test('wrong root/project base is refused',t=>{
  const f=fixture(t,{base:'/project/'});rejected(f.create(['--base','/']),/references missing asset/);
});

test('an output directory inside dist is rejected before writing archives',t=>{
  const f=fixture(t),out=path.join(f.dist,'recursive-backup');rejected(f.create(['--outputdir',out]),/cannot be inside/);assert.equal(fs.existsSync(out),false);
});

test('source tampering still fails when every manifest digest is forged to match the altered ZIP',t=>{
  const f=fixture(t);passed(f.create());tamper(f,'source','forge-source');rejected(f.invoke('verify'),/Fresh Git TAR differs from source ZIP: public\/media.bin/);
});

test('CRC corruption is detected by reading payloads even when the whole-ZIP digest is refreshed',t=>{
  const f=fixture(t);passed(f.create());tamper(f,'production','crc');rejected(f.invoke('verify'),/Bad CRC/);
});

for(const [mode,pattern] of [['traversal',/Unsafe archive path/],['absolute',/Unsafe archive path/],['backslash',/Nonportable archive path/],['drive',/Nonportable archive path/],['dot',/Unsafe archive path/],['case',/case-colliding archive path/],['duplicate',/case-colliding archive path/],['parent-file',/File\/directory archive path collision/],['symlink',/Unsupported ZIP entry type/]])test(`source ZIP rejects ${mode} entries before trusting its inventory`,t=>{
  const f=fixture(t);passed(f.create());tamper(f,'source',mode);rejected(f.invoke('verify'),pattern);
});

test('optional dist comparison detects a changed build without changing archives',t=>{
  const f=fixture(t);passed(f.create());const manifestBytes=fs.readFileSync(path.join(f.out,'manifest.json'));fs.writeFileSync(path.join(f.dist,'assets/game.js'),'changed');rejected(f.invoke('verify',['--dist',f.dist]),/differs from supplied dist/);assert.deepEqual(fs.readFileSync(path.join(f.out,'manifest.json')),manifestBytes);
});

test('verification refuses a different requested commit and a manifest archive path escape',t=>{
  const f=fixture(t);passed(f.create());rejected(f.invoke('verify',['--commit','0'.repeat(40)]),/Requested commit differs/);
  const manifest=f.manifest();manifest.sourceArchive.file='../source.zip';fs.writeFileSync(path.join(f.out,'manifest.json'),JSON.stringify(manifest));rejected(f.invoke('verify'),/Manifest archive filename differs/);
});

test('manifest missing/altered payload inventory cannot silently pass',t=>{
  const f=fixture(t);passed(f.create());const manifest=f.manifest();manifest.productionArchive.files[0].sha256='0'.repeat(64);fs.writeFileSync(path.join(f.out,'manifest.json'),JSON.stringify(manifest));rejected(f.invoke('verify'),/Archive bytes or inventory differ from manifest/);
});
