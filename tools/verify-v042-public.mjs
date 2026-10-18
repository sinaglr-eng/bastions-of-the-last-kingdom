// Public GET verification only. This tool never deploys, reads credentials or
// uses browser sessions. Run after the release owner confirms publication.
// node tools/verify-v042-public.mjs [--base=https://.../] [--dist=dist] [--output=report.json]
import {createHash,randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const defaultBase='https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/';
const defaultOutput=path.join(root,'output/design/ui-refinements-v042-20261018/public-verification.json');
const manifestPath='assets/ui/reference-cutouts/manifest.json';
const crimsonManifestPath='assets/ui/portrait-variants/manifest.json';
// Canonical JSON keeps the immutable record independent of Git's LF/CRLF
// checkout policy. Individual PNGs and compiled assets still use raw hashes.
const immutableManifestSha='5d6f7703ad89fec39b4f5b05d2510e4fce3ecf387e7b9812b851805ca191cc0d';
const crimsonExpected={revision:'bernhard-crimson-20261018-v1',identity:'host_50',output:'public/assets/ui/reference-cutouts/host_50-crimson.png',dimensions:[426,422],sha256:'61a4a3e4dae617b6af817d3f825aee707012adb104b357678465f80272eaa82a',sourceSha256:'e57b84ce6650d7633003e7599ec064f310cfc408ed70de5af2e9d75e8b8cce32',preservedRgb:true};
const expected={version:'0.4.2',uiRevision:'cartographer-refined-20261018-v3',uiPortraitRevision:'reference-cutouts-20261016-v1',uiEnemyPortraitRevision:'bernhard-crimson-20261018-v1'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const invariant=(condition,message)=>{if(!condition)throw Error(message);};
const parseJson=bytes=>JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
const jsonSha=value=>sha(Buffer.from(JSON.stringify(value)));
// Windows/Vite HTML can contain CRCRLF at an existing line boundary. Normalize
// only CR runs immediately before LF; preserve every other HTML difference.
const htmlText=value=>Buffer.from(value).toString('utf8').replace(/\r+\n/g,'\n');
const signature='89504e470d0a1a0a';
const markers={
  javascript:['assets/ui/reference-cutouts/','reference-cutouts-20261016-v1','atlas-book','catalog-index-page','catalog-reading-page','warbands-atlas','folio-construction-seal','catalog-selected-heading','warband-story','host_50-crimson','folio-champion-context','data-effective-stats'],
  css:['--folio-grain','--folio-frame','book-corners','catalog-reading-page','catalog-bookmark','preparation-folio','catalog-heading-pin','is-compact-external','folio-create-actions'],
};

function publicUrl(base,value){
  const url=new URL(value,base);
  invariant(url.origin===base.origin&&url.pathname.startsWith(base.pathname)&&!url.username&&!url.password,`Asset escapes public project base: ${value}`);
  return url;
}

function compiledEntries(html,base){
  const entries=new Map();
  for(const [tag] of html.matchAll(/<(?:script|link)\b[^>]*>/gi)){
    const attributes=Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(match=>[match[1].toLowerCase(),match[2]]));
    const source=/^<script\b/i.test(tag)?attributes.src:['stylesheet','modulepreload'].includes(attributes.rel)?attributes.href:null;
    if(!source||!/(?:\.m?js|\.css)(?:\?|$)/i.test(source))continue;
    const url=publicUrl(base,source),file=decodeURIComponent(url.pathname.slice(base.pathname.length));
    entries.set(file,{file,kind:/\.css$/i.test(url.pathname)?'css':'javascript'});
  }
  const result=[...entries.values()].sort((a,b)=>a.file.localeCompare(b.file));
  invariant(result.some(row=>row.kind==='javascript')&&result.some(row=>row.kind==='css'),'Public index does not contain compiled JavaScript and CSS entries');
  return result;
}

async function pool(items,concurrency,operation){
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(concurrency,items.length)},async()=>{
    while(cursor<items.length){const index=cursor++;await operation(items[index],index);}
  }));
}

// Injectable fetch supports local fixture checks without any public requests.
export async function verifyPublic({base=defaultBase,manifest,manifestSha256=null,crimsonManifest,localBuild,concurrency=6,timeoutMs=30000,fetchImpl=fetch}={}){
  const started=Date.now(),nonce=randomBytes(10).toString('hex');
  const report={schemaVersion:1,status:'running',startedAt:new Date(started).toISOString(),expected,
    publicBase:String(base),authentication:'None; public GETs only; credentials omitted; no credential files or browser sessions read',
    concurrency,cachePolicy:'Unique per-run query, no-store, no-cache headers',localManifestSha256:manifestSha256,
    release:null,compiled:[],uiMarkers:null,localBuildComparison:{status:'not checked',index:false,indexComparison:'Exact HTML text after normalizing CR runs immediately before LF (including CRLF and CRCRLF) to LF; all other HTML text is preserved; compiled assets use exact raw bytes',entries:false,exactHashes:0},portraits:{expected:136,checked:0,passed:0,pngSignatures:0,rgbaHeaders:0,exactHashes:0,servedBytes:0},crimson:{expected:1,checked:0,passed:0},
    requests:0,failures:[],limits:['HTTP signatures, hashes and bundle markers do not prove browser rendering, gameplay behavior, or physical iPad/Safari interaction.']};
  const fail=(file,error)=>report.failures.push({file,error:error instanceof Error?error.message:String(error)});
  let publicBase;
  async function get(file){
    const url=publicUrl(publicBase,file);url.searchParams.set('verify',`0.4.2-${nonce}-${report.requests++}`);
    const response=await fetchImpl(url,{method:'GET',credentials:'omit',redirect:'error',cache:'no-store',
      headers:{'Cache-Control':'no-cache',Pragma:'no-cache'},signal:AbortSignal.timeout(timeoutMs)});
    invariant(response.ok,`HTTP ${response.status}`);
    const bytes=Buffer.from(await response.arrayBuffer());
    invariant(bytes.length>0&&bytes.length<=20*1024*1024,'Empty or unexpectedly large public response');
    return {bytes,contentType:response.headers.get('content-type')||'',httpStatus:response.status};
  }
  async function checkedGet(file,validate){
    try{const result=await get(file);return await validate(result);}
    catch(error){fail(file,error);return null;}
  }
  try{
    publicBase=new URL(base);
    invariant(['https:','http:'].includes(publicBase.protocol)&&!publicBase.username&&!publicBase.password&&!publicBase.search&&!publicBase.hash,'Base must be an HTTP(S) URL without credentials, query or fragment');
    if(!publicBase.pathname.endsWith('/'))publicBase.pathname+='/';
    report.publicBase=publicBase.href;
    invariant(Number.isInteger(concurrency)&&concurrency>=1&&concurrency<=8,'Concurrency must be an integer from 1 to 8');
    invariant(Number.isInteger(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=60000,'Timeout must be between 1000 and 60000 milliseconds');
    invariant(jsonSha(manifest)===immutableManifestSha,'The original 136-portrait manifest is not the immutable 0.4.1 manifest');
    invariant(manifest?.revision===expected.uiPortraitRevision,'Local cutout manifest has the wrong revision');
    invariant(manifest.identities?.length===136&&new Set(manifest.identities.map(row=>row.id)).size===136,'Local manifest must contain 136 unique portrait identities');
    for(const row of manifest.identities){
      invariant(/^[a-z0-9_-]+$/.test(row.id)&&row.output===`public/assets/ui/reference-cutouts/${row.id}.png`,`Unexpected local cutout path: ${row.id}`);
      invariant(/^[a-f0-9]{64}$/.test(row.sha256)&&row.dimensions?.length===2&&row.dimensions.every(value=>Number.isInteger(value)&&value>0),`Invalid local hash or dimensions: ${row.id}`);
    }
    for(const [key,value]of Object.entries(crimsonExpected))invariant(JSON.stringify(crimsonManifest?.[key])===JSON.stringify(value),`Local crimson manifest differs: ${key}`);
    invariant(localBuild?.indexHtml&&localBuild?.assets,'A final local production build is required for exact compiled comparison');
    const localEntries=compiledEntries(String(localBuild.indexHtml),publicBase);
    for(const entry of localEntries)invariant(Buffer.isBuffer(localBuild.assets[entry.file]),`Missing local compiled asset: ${entry.file}`);
    await checkedGet('release.json',({bytes})=>{
      const release=parseJson(bytes);report.release=Object.fromEntries(Object.keys(expected).map(key=>[key,release[key]??null]));
      for(const [key,value] of Object.entries(expected))invariant(release[key]===value,`Expected ${key}=${value}; received ${release[key]}`);
      report.release.sha256=sha(bytes);
    });
    if(report.failures.length)throw Error('Release metadata does not match 0.4.2; stopped before bulk asset requests');
    let entries;
    await pool(['index.html',manifestPath,crimsonManifestPath],concurrency,async file=>checkedGet(file,({bytes,contentType})=>{
      if(file==='index.html'){
        invariant(/^text\/html\b/i.test(contentType),`Unexpected HTML MIME: ${contentType}`);
        entries=compiledEntries(bytes.toString('utf8'),publicBase);report.indexSha256=sha(bytes);
        invariant(htmlText(bytes)===htmlText(localBuild.indexHtml),'Public index differs from the final local production index');report.localBuildComparison.index=true;
        invariant(JSON.stringify(entries)===JSON.stringify(localEntries),'Public compiled entry names differ from final local production build');report.localBuildComparison.entries=true;
      }else if(file===manifestPath){
        const served=parseJson(bytes);
        invariant(jsonSha(served)===immutableManifestSha,'Public original portrait manifest record changed');
        invariant(served.revision===expected.uiPortraitRevision&&served.identities?.length===136,'Public manifest revision/count differs');
        invariant(new Set(served.identities.map(row=>row.id)).size===136,'Public manifest contains duplicate identities');
        const byId=new Map(served.identities.map(row=>[row.id,row]));
        for(const row of manifest.identities){
          const actual=byId.get(row.id);
          invariant(actual&&actual.output===row.output&&actual.sha256===row.sha256&&JSON.stringify(actual.dimensions)===JSON.stringify(row.dimensions),`Public manifest identity differs: ${row.id}`);
        }
        report.publicManifest={revision:served.revision,identities:136,sha256:sha(bytes),immutableCanonicalSha256:jsonSha(served),comparison:'Immutable canonical JSON record; exact identity paths, dimensions and output SHA-256 values from local verified cutout manifest'};
      }else{
        const served=parseJson(bytes);
        for(const [key,value]of Object.entries(crimsonExpected))invariant(JSON.stringify(served[key])===JSON.stringify(value),`Public crimson manifest differs: ${key}`);
        invariant(JSON.stringify(served)===JSON.stringify(crimsonManifest),'Public crimson manifest differs from local verified record');
        report.crimson.manifestSha256=sha(bytes);report.crimson.revision=served.revision;
      }
    }));
    if(report.failures.length)throw Error('Public index or portrait manifest differs; stopped before bulk asset requests');
    const sources={javascript:[],css:[]};
    await pool(entries,concurrency,async entry=>checkedGet(entry.file,({bytes,contentType})=>{
      invariant(entry.kind==='css'?/^text\/css\b/i.test(contentType):/^(?:text|application)\/(?:javascript|ecmascript)\b/i.test(contentType),`Unexpected ${entry.kind} MIME: ${contentType}`);
      sources[entry.kind].push(bytes.toString('utf8'));
      invariant(sha(bytes)===sha(localBuild.assets[entry.file]),`Public compiled bytes differ from final local build: ${entry.file}`);report.localBuildComparison.exactHashes++;
      report.compiled.push({...entry,bytes:bytes.length,sha256:sha(bytes)});
    }));
    report.localBuildComparison.status=report.localBuildComparison.exactHashes===entries.length?'passed':'failed';
    report.uiMarkers=Object.fromEntries(Object.entries(markers).map(([kind,required])=>{
      const source=sources[kind].join('\n'),missing=required.filter(marker=>!source.includes(marker));
      if(missing.length)fail(`compiled-${kind}`,`Missing 0.4.2 design markers: ${missing.join(', ')}`);
      return [kind,{required,missing}];
    }));
    const receipts=[];
    await pool(manifest.identities,concurrency,async row=>{
      const file=row.output.replace(/^public\//,'');report.portraits.checked++;
      await checkedGet(file,({bytes,contentType})=>{
        report.portraits.servedBytes+=bytes.length;
        invariant(/^image\/png\b/i.test(contentType),`Unexpected PNG MIME: ${contentType}`);
        invariant(bytes.length>=33&&bytes.subarray(0,8).toString('hex')===signature&&bytes.toString('ascii',12,16)==='IHDR','Invalid PNG signature or IHDR');
        report.portraits.pngSignatures++;
        invariant(bytes.readUInt32BE(16)===row.dimensions[0]&&bytes.readUInt32BE(20)===row.dimensions[1],`PNG dimensions differ for ${row.id}`);
        invariant(bytes[24]===8&&bytes[25]===6,'Expected eight-bit RGBA PNG header');report.portraits.rgbaHeaders++;
        const actualSha=sha(bytes);invariant(actualSha===row.sha256,`PNG SHA-256 differs for ${row.id}`);report.portraits.exactHashes++;
        receipts.push([row.id,bytes.length,actualSha]);report.portraits.passed++;
      });
    });
    receipts.sort((a,b)=>a[0].localeCompare(b[0]));
    report.portraits.inventorySha256=sha(Buffer.from(JSON.stringify(receipts)));
    const file=crimsonExpected.output.replace(/^public\//,'');report.crimson.checked++;
    await checkedGet(file,({bytes,contentType})=>{
      invariant(/^image\/png\b/i.test(contentType),`Unexpected crimson PNG MIME: ${contentType}`);
      invariant(bytes.length>=33&&bytes.subarray(0,8).toString('hex')===signature&&bytes.toString('ascii',12,16)==='IHDR','Invalid crimson PNG signature or IHDR');
      invariant(bytes.readUInt32BE(16)===crimsonExpected.dimensions[0]&&bytes.readUInt32BE(20)===crimsonExpected.dimensions[1],'Crimson PNG dimensions differ');
      invariant(bytes[24]===8&&bytes[25]===6,'Expected eight-bit RGBA crimson PNG header');
      invariant(sha(bytes)===crimsonExpected.sha256,'Crimson PNG SHA-256 differs');
      Object.assign(report.crimson,{passed:1,bytes:bytes.length,sha256:sha(bytes),dimensions:crimsonExpected.dimensions,rgbaHeader:true,activeLookup:'host_50 maps to host_50-crimson.png in the exact compiled bundle'});
    });
  }catch(error){fail('verification',error);}
  report.compiled.sort((a,b)=>a.file.localeCompare(b.file));
  report.failures.sort((a,b)=>a.file.localeCompare(b.file));
  report.status=report.failures.length===0&&report.portraits.passed===136&&report.crimson.passed===1&&report.localBuildComparison.status==='passed'?'passed':'failed';
  report.finishedAt=new Date().toISOString();report.durationMs=Date.now()-started;
  return report;
}

async function main(){
  const args=process.argv.slice(2);
  if(args.length===1&&args[0]==='--help'){
    console.log('Usage: node tools/verify-v042-public.mjs [--base=https://host/project/] [--dist=dist] [--output=path.json] [--concurrency=6] [--timeout-ms=30000]\nRead-only public GETs; no deployment or credentials. Compares exact index/bundle bytes with the final local production build. Checks all 136 immutable cutouts plus the active crimson Bernhard portrait. The default report is output/design/ui-refinements-v042-20261018/public-verification.json.');return;
  }
  invariant(args.every(arg=>/^--(?:base|dist|output|concurrency|timeout-ms)=.+$/.test(arg)),'Unknown argument; use --help');
  const options=Object.fromEntries(args.map(arg=>{const at=arg.indexOf('=');return [arg.slice(2,at),arg.slice(at+1)];}));
  invariant(Object.keys(options).length===args.length,'Duplicate arguments are not supported');
  const bytes=await readFile(path.join(root,'public',manifestPath));
  const crimsonManifest=parseJson(await readFile(path.join(root,'public',crimsonManifestPath))),base=new URL(options.base||defaultBase),dist=path.resolve(root,options.dist||'dist');
  if(!base.pathname.endsWith('/'))base.pathname+='/';
  const indexHtml=await readFile(path.join(dist,'index.html')),assets={};
  for(const entry of compiledEntries(indexHtml.toString('utf8'),base))assets[entry.file]=await readFile(path.join(dist,entry.file));
  const report=await verifyPublic({base:base.href,manifest:parseJson(bytes),manifestSha256:sha(bytes),crimsonManifest,localBuild:{indexHtml,assets},
    concurrency:options.concurrency?Number(options.concurrency):6,timeoutMs:options['timeout-ms']?Number(options['timeout-ms']):30000});
  const output=path.resolve(root,options.output||defaultOutput);
  await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n','utf8');
  console.log(JSON.stringify({status:report.status,version:expected.version,report:output,requests:report.requests,localBuildComparison:report.localBuildComparison,portraits:report.portraits,crimson:report.crimson,failures:report.failures}));
  if(report.status!=='passed')process.exitCode=1;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
