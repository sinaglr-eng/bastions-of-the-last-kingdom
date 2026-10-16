// Prepare-only helper. Run after the release owner confirms publication:
// node tmp/v040-verify-public.mjs --mode=40 --label=initial
// node tmp/v040-verify-public.mjs --mode=31 --label=rollback
// node tmp/v040-verify-public.mjs --mode=40 --label=restored
// Public GETs only, six concurrent requests, no authentication or deployment.
import fs from 'node:fs';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const evidence=path.join(root,'output/design/cartographer-ui-v040-20261016');
const publicBase=new URL('https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/');
const sourceZip='C:/Users/sinag/Documents/ChatGPT/Tower Defense game/backups/releases/v0.3.31/bastions-v0.3.31-production.zip';
const sourceZipSha256='a57f3ed1c5b9c759b7a54a8b54980efa4b99a1cf87f6c70d7b7255d89a70f52a';
const releaseCommits={'0.4.0':execFileSync('git',['-C',root,'rev-parse','v0.4.0-stable^{commit}'],{encoding:'utf8'}).trim(),'0.3.31':'c01ac5a2ab1ef62e77d2ce545f24234b80b5c847'};
const python=process.env.V040_PYTHON||'C:/Users/sinag/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const json=async file=>JSON.parse((await readFile(path.join(root,file),'utf8')).replace(/^\uFEFF/,''));
const args=process.argv.slice(2);
const modeArg=args.find(arg=>arg.startsWith('--mode='))?.slice(7)||args.find(arg=>!arg.startsWith('--'))||'40';
const version=['31','031','0.3.31'].includes(modeArg)?'0.3.31':['40','040','0.4.0'].includes(modeArg)?'0.4.0':null;
const label=args.find(arg=>arg.startsWith('--label='))?.slice(8)||'verification';
if(!version||!/^[a-zA-Z0-9_.-]{1,60}$/.test(label)||args.some(arg=>arg.startsWith('--')&&!arg.startsWith('--mode=')&&!arg.startsWith('--label=')))throw Error('Usage: node tmp/v040-verify-public.mjs --mode=40|31 --label=initial|rollback|restored');
const started=Date.now(),stamp=new Date(started).toISOString().replaceAll(':','').replaceAll('.',''),nonce=crypto.randomBytes(10).toString('hex');
const output=path.join(evidence,`public-http-v${version.replaceAll('.','')}-${label}-${stamp}.json`);
const proof={schemaVersion:1,status:'running',version,label,startedAt:new Date(started).toISOString(),publicBase:publicBase.href,concurrency:6,authentication:'None; public GET requests only; credentials omitted',cachePolicy:'Unique per-run query on every request, cache=no-store, no-cache request headers',expectedSource:null,activeAudio:null,compiledEntryPaths:[],files:[],failures:[],models:{checked:0,knownInventory:352,reason:'Skipped as requested; no public model-byte claim. Local protected preservation is a separate proof.'},limits:['HTTP hashes and MIME receipts do not establish playback/listening, image decoding, browser interaction or physical iPad/Safari coverage.']};
try{proof.localHead=execFileSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).trim();}catch{proof.localHead=null;}

function invariant(condition,message){if(!condition)throw Error(message);}
function attrs(tag){return Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(match=>[match[1].toLowerCase(),match[2]]));}
function compiledEntries(html){
  const entries=[];
  for(const match of html.matchAll(/<(?:script|link)\b[^>]*>/gi)){
    const attributes=attrs(match[0]),script=/^<script\b/i.test(match[0]);
    const source=script?attributes.src:['stylesheet','modulepreload'].includes(attributes.rel)?attributes.href:null;
    if(!source||!/(?:\.m?js|\.css)(?:\?|$)/.test(source))continue;
    const url=new URL(source,publicBase);
    invariant(url.origin===publicBase.origin&&url.pathname.startsWith(publicBase.pathname),`Compiled entry escapes repository base: ${source}`);
    entries.push(decodeURIComponent(url.pathname.slice(publicBase.pathname.length)));
  }
  return [...new Set(entries)].sort();
}
function row(file,bytes,group,extra={}){return {file,bytes:bytes.length,sha256:sha(bytes),group,...extra};}
const canonicalLF=bytes=>Buffer.from(bytes.toString('utf8').replace(/\r+\n/g,'\n'));
function gitPublicBytes(file){return execFileSync('git',['-C',root,'show',`${releaseCommits[version]}:public/${file}`],{maxBuffer:8*1024*1024});}
function textRepresentation(file,raw,expected,basis){
  invariant(canonicalLF(raw).equals(canonicalLF(expected)),`Text representation differs beyond CR-before-LF normalization: ${file}`);
  const text=raw.toString('utf8');
  return {basis,rawBytes:raw.length,rawSha256:sha(raw),expectedBytes:expected.length,expectedSha256:sha(expected),rawCRLFSequences:(text.match(/\r+\n/g)||[]).length,rawRepeatedCRBeforeLF:(text.match(/\r{2,}\n/g)||[]).length,onlyEolDifference:!raw.equals(expected),servedComparison:'Exact expected bytes; served content is not normalized'};
}
function publicJsonRow(file,raw,group){
  const committed=gitPublicBytes(file);
  return row(file,committed,group,{representation:textRepresentation(file,raw,committed,`Exact Git public blob from ${releaseCommits[version]}:public/${file}; Git attributes define deployed JSON bytes`)});
}
function audioPaths(catalogues){
  const found=new Map();
  const collect=(value,catalogue)=>{
    if(!value||typeof value!=='object')return;
    if(typeof value.url==='string'&&/\.mp3(?:\?|$)/i.test(value.url)){
      const url=new URL(value.url,new URL(catalogue,publicBase));
      invariant(url.origin===publicBase.origin&&url.pathname.startsWith(publicBase.pathname),`Audio URL escapes repository base: ${value.url}`);
      const file=decodeURIComponent(url.pathname.slice(publicBase.pathname.length));
      found.set(file,{file,id:value.id||file,claimedSha256:value.sha256||null});
    }
    for(const child of Object.values(value))if(child&&typeof child==='object')collect(child,catalogue);
  };
  for(const [file,value]of catalogues)collect(value,file);
  return [...found.values()].sort((a,b)=>a.file.localeCompare(b.file));
}
function inventoryDigest(rows){return sha(Buffer.from(JSON.stringify(rows.map(item=>[`public/${item.file}`,item.bytes,item.sha256]).sort((a,b)=>a[0].localeCompare(b[0])))));}
async function hashFile(file){const hash=crypto.createHash('sha256');for await(const bytes of fs.createReadStream(file))hash.update(bytes);return hash.digest('hex');}

const archiveReader=String.raw`
import hashlib,json,posixpath,re,sys,zipfile
from urllib.parse import urlsplit
archive_path=sys.argv[1]
catalogue_paths=json.loads(sys.argv[2])
with zipfile.ZipFile(archive_path) as archive:
    def record(name,group,extra=None):
        data=archive.read(name)
        result={'file':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest(),'group':group}
        if extra: result.update(extra)
        return result
    index=archive.read('index.html').decode('utf-8')
    release=archive.read('release.json').decode('utf-8')
    entries=[]
    for tag in re.findall(r'<(?:script|link)\b[^>]*>',index,re.I):
        attributes=dict((name.lower(),value) for name,value in re.findall(r'''([\w:-]+)\s*=\s*["']([^"']*)["']''',tag))
        source=attributes.get('src') if tag.lower().startswith('<script') else attributes.get('href') if attributes.get('rel') in ('stylesheet','modulepreload') else None
        if not source or not re.search(r'\.(?:m?js|css)(?:\?|$)',source): continue
        parsed=urlsplit(source)
        assert not parsed.netloc and not parsed.scheme and parsed.path.startswith('/bastions-of-the-last-kingdom/')
        entries.append(parsed.path.removeprefix('/bastions-of-the-last-kingdom/'))
    catalogues=[(name,json.loads(archive.read(name))) for name in catalogue_paths]
    audio={}
    def collect(value,base):
        if isinstance(value,dict):
            url=value.get('url')
            if isinstance(url,str) and re.search(r'\.mp3(?:\?|$)',url,re.I):
                parsed=urlsplit(url)
                assert not parsed.netloc and not parsed.scheme
                name=posixpath.normpath(posixpath.join(posixpath.dirname(base),parsed.path))
                assert name.startswith('assets/audio/')
                audio[name]=record(name,'audio',{'id':value.get('id',name)})
                if value.get('sha256'): assert value['sha256']==audio[name]['sha256']
            for child in value.values(): collect(child,base)
        elif isinstance(value,list):
            for child in value: collect(child,base)
    for name,value in catalogues: collect(value,name)
    result={'index':index,'release':json.loads(release),'releaseText':release,'catalogueTexts':dict((name,archive.read(name).decode('utf-8')) for name in catalogue_paths),'metadata':[record('index.html','metadata'),record('release.json','metadata')],
      'compiled':[record(name,'compiled') for name in sorted(set(entries))],
      'catalogues':[record(name,'audio-catalogue') for name in catalogue_paths],
      'audio':[audio[name] for name in sorted(audio)]}
    print(json.dumps(result))
`;

async function expectations(){
  const preservation=await json('output/design/cartographer-ui-v040-20261016/final-preservation-proof.json');
  const baseline=await json('output/design/cartographer-ui-v040-20261016/before-protected.json');
  invariant(preservation.status==='passed','Local preservation proof is not passed');
  const baselineFiles=new Map(baseline.files.map(item=>[item.file,item]));
  const catalogueFiles=preservation.media.activeAudio.catalogues.map(item=>item.file.replace(/^public\//,''));
  invariant(catalogueFiles.length===2,'Expected exactly the two current active audio catalogues');
  let expected;
  if(version==='0.3.31'){
    invariant(await hashFile(sourceZip)===sourceZipSha256,'Offline 0.3.31 production ZIP hash differs from its verified receipt');
    expected=JSON.parse(execFileSync(python,['-c',archiveReader,sourceZip,JSON.stringify(catalogueFiles)],{encoding:'utf8',maxBuffer:8*1024*1024}));
    const rawIndex=Buffer.from(expected.index),canonicalIndex=canonicalLF(rawIndex);
    const releaseRow=publicJsonRow('release.json',Buffer.from(expected.releaseText),'metadata');
    expected.index=canonicalIndex.toString('utf8');expected.release=JSON.parse(gitPublicBytes('release.json').toString('utf8'));
    expected.metadata=[row('index.html',canonicalIndex,'metadata',{representation:textRepresentation('index.html',rawIndex,canonicalIndex,'Canonical LF of generated offline ZIP index: /\\r+\\n/g → LF; Linux Vite CI generates LF')}),releaseRow];
    expected.catalogues=catalogueFiles.map(file=>publicJsonRow(file,Buffer.from(expected.catalogueTexts[file]),'audio-catalogue'));
    delete expected.releaseText;delete expected.catalogueTexts;
    proof.expectedSource={kind:'Verified offline production ZIP compiled/media bytes; exact stable Git public JSON blobs; generated index canonical LF',archive:sourceZip,archiveSha256:sourceZipSha256,stableTag:'v0.3.31-stable',sourceCommit:releaseCommits[version]};
    proof.portraits={checked:0,reason:'0.3.31 predates the new reference portrait namespace; old UI is verified by its release, index and compiled entry hashes.'};
  }else{
    const dist=path.join(root,'dist'),rawIndexBytes=await readFile(path.join(dist,'index.html')),indexBytes=canonicalLF(rawIndexBytes),rawReleaseBytes=await readFile(path.join(dist,'release.json')),releaseBytes=gitPublicBytes('release.json');
    const index=indexBytes.toString('utf8'),release=JSON.parse(releaseBytes.toString('utf8'));
    const compiled=[];for(const file of compiledEntries(index))compiled.push(row(file,await readFile(path.join(dist,file)),'compiled'));
    const catalogues=[];for(const file of catalogueFiles)catalogues.push([file,JSON.parse(gitPublicBytes(file).toString('utf8'))]);
    const audio=[];for(const item of audioPaths(catalogues)){
      const expected=row(item.file,await readFile(path.join(dist,item.file)),'audio',{id:item.id});
      invariant(!item.claimedSha256||expected.sha256===item.claimedSha256,`Active catalogue SHA differs from dist: ${item.file}`);audio.push(expected);
    }
    const manifestFile='assets/ui/reference-portraits/manifest.json',rawManifestBytes=await readFile(path.join(dist,manifestFile)),manifestBytes=gitPublicBytes(manifestFile),manifest=JSON.parse(manifestBytes.toString('utf8'));
    invariant(manifest.identities.length===136&&new Set(manifest.identities.map(item=>item.id)).size===136,'Expected 136 unique portrait identities');
    const portraits=[];for(const item of manifest.identities){
      const file=item.output.replace(/^public\//,''),bytes=await readFile(path.join(dist,file));
      invariant(sha(bytes)===item.sha256,`Dist portrait differs from exact crop manifest: ${item.id}`);
      invariant(bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'&&bytes.readUInt32BE(16)===item.dimensions[0]&&bytes.readUInt32BE(20)===item.dimensions[1],`Invalid local PNG dimensions: ${item.id}`);
      portraits.push(row(file,bytes,'portrait',{id:item.id,dimensions:item.dimensions}));
    }
    expected={index,release,metadata:[row('index.html',indexBytes,'metadata',{representation:textRepresentation('index.html',rawIndexBytes,indexBytes,'Canonical LF of generated local Vite index: /\\r+\\n/g → LF; Linux Vite CI generates LF')}),publicJsonRow('release.json',rawReleaseBytes,'metadata')],compiled,catalogues:await Promise.all(catalogueFiles.map(async file=>publicJsonRow(file,await readFile(path.join(dist,file)),'audio-catalogue'))),audio,portraits,portraitManifest:publicJsonRow(manifestFile,rawManifestBytes,'portrait-manifest')};
    proof.expectedSource={kind:'Current repository-base build compiled/media bytes; exact committed public JSON blobs; generated index canonical LF',directory:dist,sourceCommit:releaseCommits[version],indexSha256:sha(indexBytes),rawIndexSha256:sha(rawIndexBytes),releaseSha256:sha(releaseBytes),rawReleaseSha256:sha(rawReleaseBytes)};
    proof.portraits={expected:136,manifestRevision:manifest.revision,manifestSha256:sha(manifestBytes)};
  }
  invariant(expected.release.version===version,`Expected source release is ${expected.release.version}, requested ${version}`);
  const entryNames=compiledEntries(expected.index);
  invariant(entryNames.length>=3&&JSON.stringify(entryNames)===JSON.stringify(expected.compiled.map(item=>item.file).sort()),'Compiled entry extraction disagrees with expected index or is not a repository-base build');
  proof.compiledEntryPaths=entryNames;
  invariant(expected.audio.length===113,'Expected exactly 113 unique active MP3s');
  for(const item of expected.audio){
    const old=baselineFiles.get(`public/${item.file}`);
    invariant(old&&old.bytes===item.bytes&&old.sha256===item.sha256,`Selected audio bytes differ from preserved baseline: ${item.file}`);
  }
  for(const item of expected.catalogues){
    const stableBlob=execFileSync('git',['-C',root,'show',`${releaseCommits['0.3.31']}:public/${item.file}`],{maxBuffer:8*1024*1024});
    invariant(stableBlob.length===item.bytes&&sha(stableBlob)===item.sha256,`Active catalogue Git blob differs from preserved release: ${item.file}`);
  }
  proof.textRepresentations=[...expected.metadata,...expected.catalogues,...(expected.portraitManifest?[expected.portraitManifest]:[])].map(item=>({file:item.file,...item.representation}));
  const digest=inventoryDigest(expected.audio),bytes=expected.audio.reduce((sum,item)=>sum+item.bytes,0);
  invariant(digest===preservation.media.activeAudio.digest&&bytes===preservation.media.activeAudio.bytes&&expected.audio.length===preservation.media.activeAudio.count,'Active audio inventory differs from current preservation proof');
  proof.activeAudio={expected:113,bytes,digest,catalogues:catalogueFiles,source:'Exact URLs recursively collected from the two active catalogues, then checked against preserved baseline and current active inventory',categories:{alliedVoices:expected.audio.filter(item=>item.file.startsWith('assets/audio/allied-recast-20261011/')).length,attacks:expected.audio.filter(item=>item.file.startsWith('assets/audio/attacks/')).length,music:expected.audio.filter(item=>item.file.startsWith('assets/audio/music/')).length}};
  invariant(proof.activeAudio.categories.alliedVoices===92&&proof.activeAudio.categories.attacks===15&&proof.activeAudio.categories.music===6,'Unexpected active audio category split');
  return expected;
}

let requestNumber=0;
async function verifyOne(expected){
  const url=new URL(expected.file,publicBase);url.searchParams.set('verify',`${version}-${nonce}-${requestNumber++}`);
  const result={...expected,url:url.href,status:'failed'};
  try{
    const response=await fetch(url,{method:'GET',cache:'no-store',credentials:'omit',redirect:'error',headers:{'Cache-Control':'no-cache',Pragma:'no-cache'},signal:AbortSignal.timeout(30000)});
    result.httpStatus=response.status;result.contentType=response.headers.get('content-type');
    invariant(response.ok,`HTTP ${response.status}`);
    const bytes=Buffer.from(await response.arrayBuffer());result.servedBytes=bytes.length;result.servedSha256=sha(bytes);
    invariant(bytes.length===expected.bytes&&result.servedSha256===expected.sha256,`Served bytes/SHA differ: expected ${expected.bytes}/${expected.sha256}, got ${bytes.length}/${result.servedSha256}`);
    if(expected.file==='release.json'){
      const release=JSON.parse(bytes.toString('utf8'));invariant(release.version===version,`Served release is ${release.version}`);proof.servedRelease=release;
    }else if(expected.file==='index.html'){
      const entries=compiledEntries(bytes.toString('utf8'));invariant(JSON.stringify(entries)===JSON.stringify(proof.compiledEntryPaths),'Served index compiled entry names differ');proof.servedCompiledEntryPaths=entries;
    }else if(expected.group==='portrait'){
      invariant(bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'&&bytes.readUInt32BE(16)===expected.dimensions[0]&&bytes.readUInt32BE(20)===expected.dimensions[1],'Served PNG signature/dimensions differ');
      invariant(/^image\/png\b/i.test(result.contentType||''),`Unexpected PNG MIME: ${result.contentType}`);
    }
    result.status='passed';
  }catch(error){result.error=error.message;proof.failures.push({file:expected.file,group:expected.group,error:error.message,httpStatus:result.httpStatus||null});}
  proof.files.push(result);return result;
}
async function verifyPool(items){
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(6,items.length)},async()=>{while(cursor<items.length){const index=cursor++;await verifyOne(items[index]);}}));
}
async function save(){
  proof.finishedAt=new Date().toISOString();proof.durationMs=Date.now()-started;
  proof.files.sort((a,b)=>a.file.localeCompare(b.file));
  proof.groups=Object.fromEntries([...new Set(proof.files.map(item=>item.group))].map(group=>{const rows=proof.files.filter(item=>item.group===group);return [group,{checked:rows.length,passed:rows.filter(item=>item.status==='passed').length,bytes:rows.reduce((sum,item)=>sum+(item.servedBytes||0),0)}];}));
  proof.status=proof.failures.length?'failed':'passed';
  await mkdir(evidence,{recursive:true});await writeFile(output,JSON.stringify(proof,null,2)+'\n');
  await writeFile(path.join(evidence,`public-http-v${version.replaceAll('.','')}-latest.json`),JSON.stringify(proof,null,2)+'\n');
  console.log(JSON.stringify({status:proof.status,version,label,proof:output,groups:proof.groups,activeAudio:proof.activeAudio,failures:proof.failures.slice(0,12),failureCount:proof.failures.length}));
  if(proof.failures.length)process.exitCode=1;
}

try{
  const expected=await expectations();
  await verifyPool(expected.metadata);
  if(proof.failures.length){proof.limits.push('Stopped before bulk asset requests because served release/index does not match the selected expected source.');}
  else await verifyPool([...expected.compiled,...expected.catalogues,...expected.audio,...(expected.portraitManifest?[expected.portraitManifest]:[]),...(expected.portraits||[])]);
}catch(error){proof.failures.push({group:'preflight',error:error.message});}
await save();
