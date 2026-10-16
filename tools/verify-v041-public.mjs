// Public GET verification only. This tool never deploys, reads credentials or
// uses browser sessions. Run after the release owner confirms publication.
// node tools/verify-v041-public.mjs [--base=https://.../] [--output=report.json]
import {createHash,randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const defaultBase='https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/';
const defaultOutput=path.join(root,'output/design/cartographer-ui-v041-20261016/public-verification.json');
const manifestPath='assets/ui/reference-cutouts/manifest.json';
const expected={version:'0.4.1',uiRevision:'cartographer-crafted-20261016-v2',uiPortraitRevision:'reference-cutouts-20261016-v1'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const invariant=(condition,message)=>{if(!condition)throw Error(message);};
const parseJson=bytes=>JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
const signature='89504e470d0a1a0a';
const markers={
  javascript:['assets/ui/reference-cutouts/','reference-cutouts-20261016-v1','atlas-book','catalog-index-page','catalog-reading-page','warbands-atlas','folio-construction-seal'],
  css:['--folio-grain','--folio-frame','book-corners','catalog-reading-page','catalog-bookmark','preparation-folio'],
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
export async function verifyPublic({base=defaultBase,manifest,manifestSha256=null,concurrency=6,timeoutMs=30000,fetchImpl=fetch}={}){
  const started=Date.now(),nonce=randomBytes(10).toString('hex');
  const report={schemaVersion:1,status:'running',startedAt:new Date(started).toISOString(),expected,
    publicBase:String(base),authentication:'None; public GETs only; credentials omitted; no credential files or browser sessions read',
    concurrency,cachePolicy:'Unique per-run query, no-store, no-cache headers',localManifestSha256:manifestSha256,
    release:null,compiled:[],uiMarkers:null,portraits:{expected:136,checked:0,passed:0,pngSignatures:0,rgbaHeaders:0,exactHashes:0,servedBytes:0},
    requests:0,failures:[],limits:['HTTP signatures, hashes and bundle markers do not prove browser rendering, gameplay behavior, or physical iPad/Safari interaction.']};
  const fail=(file,error)=>report.failures.push({file,error:error instanceof Error?error.message:String(error)});
  let publicBase;
  async function get(file){
    const url=publicUrl(publicBase,file);url.searchParams.set('verify',`0.4.1-${nonce}-${report.requests++}`);
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
    invariant(manifest?.revision===expected.uiPortraitRevision,'Local cutout manifest has the wrong revision');
    invariant(manifest.identities?.length===136&&new Set(manifest.identities.map(row=>row.id)).size===136,'Local manifest must contain 136 unique portrait identities');
    for(const row of manifest.identities){
      invariant(/^[a-z0-9_-]+$/.test(row.id)&&row.output===`public/assets/ui/reference-cutouts/${row.id}.png`,`Unexpected local cutout path: ${row.id}`);
      invariant(/^[a-f0-9]{64}$/.test(row.sha256)&&row.dimensions?.length===2&&row.dimensions.every(value=>Number.isInteger(value)&&value>0),`Invalid local hash or dimensions: ${row.id}`);
    }
    await checkedGet('release.json',({bytes})=>{
      const release=parseJson(bytes);report.release=Object.fromEntries(Object.keys(expected).map(key=>[key,release[key]??null]));
      for(const [key,value] of Object.entries(expected))invariant(release[key]===value,`Expected ${key}=${value}; received ${release[key]}`);
      report.release.sha256=sha(bytes);
    });
    if(report.failures.length)throw Error('Release metadata does not match 0.4.1; stopped before bulk asset requests');
    let entries;
    await pool(['index.html',manifestPath],concurrency,async file=>checkedGet(file,({bytes,contentType})=>{
      if(file==='index.html'){
        invariant(/^text\/html\b/i.test(contentType),`Unexpected HTML MIME: ${contentType}`);
        entries=compiledEntries(bytes.toString('utf8'),publicBase);report.indexSha256=sha(bytes);
      }else{
        const served=parseJson(bytes);
        invariant(served.revision===expected.uiPortraitRevision&&served.identities?.length===136,'Public manifest revision/count differs');
        invariant(new Set(served.identities.map(row=>row.id)).size===136,'Public manifest contains duplicate identities');
        const byId=new Map(served.identities.map(row=>[row.id,row]));
        for(const row of manifest.identities){
          const actual=byId.get(row.id);
          invariant(actual&&actual.output===row.output&&actual.sha256===row.sha256&&JSON.stringify(actual.dimensions)===JSON.stringify(row.dimensions),`Public manifest identity differs: ${row.id}`);
        }
        report.publicManifest={revision:served.revision,identities:136,sha256:sha(bytes),comparison:'Exact identity paths, dimensions and output SHA-256 values from local verified cutout manifest'};
      }
    }));
    if(report.failures.length)throw Error('Public index or portrait manifest differs; stopped before bulk asset requests');
    const sources={javascript:[],css:[]};
    await pool(entries,concurrency,async entry=>checkedGet(entry.file,({bytes,contentType})=>{
      invariant(entry.kind==='css'?/^text\/css\b/i.test(contentType):/^(?:text|application)\/(?:javascript|ecmascript)\b/i.test(contentType),`Unexpected ${entry.kind} MIME: ${contentType}`);
      sources[entry.kind].push(bytes.toString('utf8'));
      report.compiled.push({...entry,bytes:bytes.length,sha256:sha(bytes)});
    }));
    report.uiMarkers=Object.fromEntries(Object.entries(markers).map(([kind,required])=>{
      const source=sources[kind].join('\n'),missing=required.filter(marker=>!source.includes(marker));
      if(missing.length)fail(`compiled-${kind}`,`Missing 0.4.1 design markers: ${missing.join(', ')}`);
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
  }catch(error){fail('verification',error);}
  report.compiled.sort((a,b)=>a.file.localeCompare(b.file));
  report.failures.sort((a,b)=>a.file.localeCompare(b.file));
  report.status=report.failures.length===0&&report.portraits.passed===136?'passed':'failed';
  report.finishedAt=new Date().toISOString();report.durationMs=Date.now()-started;
  return report;
}

async function main(){
  const args=process.argv.slice(2);
  if(args.length===1&&args[0]==='--help'){
    console.log('Usage: node tools/verify-v041-public.mjs [--base=https://host/project/] [--output=path.json] [--concurrency=6] [--timeout-ms=30000]\nRead-only public GETs; no deployment or credentials. The default report is output/design/cartographer-ui-v041-20261016/public-verification.json.');return;
  }
  invariant(args.every(arg=>/^--(?:base|output|concurrency|timeout-ms)=.+$/.test(arg)),'Unknown argument; use --help');
  const options=Object.fromEntries(args.map(arg=>{const at=arg.indexOf('=');return [arg.slice(2,at),arg.slice(at+1)];}));
  invariant(Object.keys(options).length===args.length,'Duplicate arguments are not supported');
  const bytes=await readFile(path.join(root,'public',manifestPath));
  const report=await verifyPublic({base:options.base||defaultBase,manifest:parseJson(bytes),manifestSha256:sha(bytes),
    concurrency:options.concurrency?Number(options.concurrency):6,timeoutMs:options['timeout-ms']?Number(options['timeout-ms']):30000});
  const output=path.resolve(root,options.output||defaultOutput);
  await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n','utf8');
  console.log(JSON.stringify({status:report.status,version:expected.version,report:output,requests:report.requests,portraits:report.portraits,failures:report.failures}));
  if(report.status!=='passed')process.exitCode=1;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
