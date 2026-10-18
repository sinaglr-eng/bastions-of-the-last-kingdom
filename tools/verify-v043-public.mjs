// Public GET verification only. This tool never deploys, reads credentials or
// uses browser sessions. Run after the release owner confirms publication.
// node tools/verify-v043-public.mjs [--base=https://.../] [--dist=dist] [--output=report.json]
import {createHash,randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const defaultBase='https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/';
const defaultOutput=path.join(root,'output/design/ui-refinements-v043-20261018/public-verification.json');
const manifestPath='assets/ui/reference-cutouts/manifest.json';
const crimsonManifestPath='assets/ui/portrait-variants/manifest.json';
const frontManifestPath='assets/ui/reference-enemy-fronts/manifest.json';
const defeatManifestPath='assets/ui/results/manifest.json';
// Canonical JSON keeps the immutable record independent of Git's LF/CRLF
// checkout policy. Individual PNGs and compiled assets still use raw hashes.
const immutableManifestSha='5d6f7703ad89fec39b4f5b05d2510e4fce3ecf387e7b9812b851805ca191cc0d';
const crimsonExpected={revision:'bernhard-crimson-20261018-v1',identity:'host_50',output:'public/assets/ui/reference-cutouts/host_50-crimson.png',dimensions:[426,422],sha256:'61a4a3e4dae617b6af817d3f825aee707012adb104b357678465f80272eaa82a',sourceSha256:'e57b84ce6650d7633003e7599ec064f310cfc408ed70de5af2e9d75e8b8cce32',preservedRgb:true};
const defeatExpected={revision:'defeat-city-20261018-v1',file:'public/assets/ui/results/defeat-city-v043.png',dimensions:[1672,941],bytes:2540557,sha256:'d827523f201adfa0472d1afa2aaed6d2c9e27c9ca7069d9542686fc80e56f812',generator:'Built-in ImageGen',transparentBackground:false};
const expected={version:'0.4.3',uiRevision:'cartographer-polished-20261018-v4',uiPortraitRevision:'reference-cutouts-20261016-v1',uiEnemyPortraitRevision:'enemy-front-cutouts-20261018-v1'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const invariant=(condition,message)=>{if(!condition)throw Error(message);};
const parseJson=bytes=>JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
const jsonSha=value=>sha(Buffer.from(JSON.stringify(value)));
// Windows/Vite HTML can contain CRCRLF at an existing line boundary. Normalize
// only CR runs immediately before LF; preserve every other HTML difference.
const htmlText=value=>Buffer.from(value).toString('utf8').replace(/\r+\n/g,'\n');
const signature='89504e470d0a1a0a';
const markers={
  javascript:['assets/ui/reference-cutouts/','reference-cutouts-20261016-v1','atlas-book','catalog-index-page','catalog-reading-page','warbands-atlas','folio-construction-seal','catalog-selected-heading','warband-story','assets/ui/reference-enemy-fronts/','enemy-front-cutouts-20261018-v1','defeat-city-v043.png','folio-ingredient-recipe','folio-champion-context','data-effective-stats'],
  css:['--folio-grain','--folio-frame','book-corners','catalog-reading-page','catalog-bookmark','preparation-folio','catalog-heading-pin','is-compact-external','folio-create-actions','folio-decision-row','run-result-defeat-art'],
};

function validateFrontManifest(front,original,crimson){
  invariant(front?.revision===expected.uiEnemyPortraitRevision,'Local FRONT manifest has the wrong revision');
  invariant(front.sha256Policy?.jsonMetadata==='utf8-lf'&&front.sha256Policy?.otherFiles==='exact-bytes'&&Object.keys(front.sha256Policy).length===2,'Local FRONT JSON/binary digest policy differs');
  invariant(front.sourceManifest==='public/assets/ui/reference-portraits/manifest.json'&&front.sourceManifestSha256==='45dcbf77adf145b4943242c1cb65c604950b89225b6e879038cb8530db55d36f','Local FRONT source manifest provenance differs');
  invariant(front.maskSettings==='tools/enemy-front-cutout-masks.json'&&/^[a-f0-9]{64}$/.test(front.maskSettingsSha256),'Local FRONT alpha-mask provenance differs');
  invariant(front.algorithm==='Original deterministic border-calibrated alpha-only cutout'&&front.historicalAssetsPreserved===true,'Local FRONT alpha/RGB preservation record differs');
  invariant(typeof front.visualReview==='string'&&front.visualReview.length>40,'Local FRONT visual review record is missing');
  const rows=front.identities;
  invariant(rows?.length===50&&new Set(rows.map(row=>row.id)).size===50,'Local FRONT manifest must contain 50 unique identities');
  const historicalJson={'public/assets/ui/reference-portraits/manifest.json':'45dcbf77adf145b4943242c1cb65c604950b89225b6e879038cb8530db55d36f','public/assets/ui/reference-cutouts/manifest.json':'64416209e4367d68289f35b0f2bd4782e9f29551f8a5bbad265963d131c88baf','public/assets/ui/portrait-variants/manifest.json':'fe074b9d8ea0a156e0a54ab7bd545efd8d73294cce80da47ee11d1a80025ba11'};
  for(const [file,digest]of Object.entries(historicalJson))invariant(front.historicalAssetsSha256?.[file]===digest,`Local FRONT historical LF-JSON record differs: ${file}`);
  const originals=new Map(original.identities.map(row=>[row.id,row]));
  for(const row of original.identities){
    invariant(front.historicalAssetsSha256?.[row.output]===row.sha256&&front.historicalAssetsSha256?.[row.sourceCrop]===row.sourceCropSha256,`Local FRONT historical portrait record differs: ${row.id}`);
  }
  invariant(front.historicalAssetsSha256?.[crimson.output]===crimson.sha256&&front.historicalAssetsSha256?.[crimson.source]===crimson.sourceSha256,'Local FRONT legacy crimson preservation record differs');
  for(const [index,row]of rows.entries()){
    const id=`host_${String(index+1).padStart(2,'0')}`,old=originals.get(id);
    invariant(row.id===id&&row.category==='enemies'&&typeof row.name==='string'&&row.name.length>0,`Local FRONT identity/order differs: ${id}`);
    invariant(row.view==='FRONT'&&row.reviewStatus==='approved'&&typeof row.reviewDecision==='string'&&row.reviewDecision.length>30,`Local FRONT view/review differs: ${id}`);
    invariant(row.preservedRgb===true&&/alpha mask.*trim only/.test(row.operation),`Local FRONT RGB/alpha operation differs: ${id}`);
    invariant(row.output===`public/assets/ui/reference-enemy-fronts/${id}.png`&&/^[a-f0-9]{64}$/.test(row.sha256),`Local FRONT output/hash differs: ${id}`);
    invariant(row.sourceSha256===(id==='host_50'?crimson.sourceSha256:old.originalSourceSha256),`Local FRONT approved source differs: ${id}`);
    invariant(row.source===(id==='host_50'?crimson.source:`docs/ui-cartographers-table-handoff-20261016/reference-art/${row.sourceSha256}.png`),`Local FRONT source path differs: ${id}`);
    invariant(JSON.stringify(row.sourceDimensions)==='[1536,1024]'&&row.rectangleMode==='left, top, right, bottom',`Local FRONT source geometry differs: ${id}`);
    const rectangle=row.sourceRectangle,trim=row.trimRectangle;
    invariant(rectangle?.length===4&&rectangle.every(Number.isInteger)&&rectangle[0]>=0&&rectangle[1]>=0&&rectangle[2]<=512&&rectangle[3]<=512&&rectangle[0]<rectangle[2]&&rectangle[1]<rectangle[3],`Local FRONT rectangle leaves the top-left FRONT panel: ${id}`);
    invariant(trim?.length===4&&trim.every(Number.isInteger)&&trim[0]>=0&&trim[1]>=0&&trim[2]<=rectangle[2]-rectangle[0]&&trim[3]<=rectangle[3]-rectangle[1]&&trim[0]<trim[2]&&trim[1]<trim[3],`Local FRONT trim differs: ${id}`);
    invariant(JSON.stringify(row.dimensions)===JSON.stringify([trim[2]-trim[0],trim[3]-trim[1]]),`Local FRONT dimensions differ: ${id}`);
    const pixels=row.dimensions[0]*row.dimensions[1];
    invariant([row.transparentPixels,row.opaquePixels,row.edgePixels].every(value=>Number.isInteger(value)&&value>0)&&row.transparentPixels+row.opaquePixels+row.edgePixels===pixels,`Local FRONT alpha counts differ: ${id}`);
    invariant(row.transparentPixels>pixels*.04&&row.opaquePixels>pixels*.12,`Local FRONT alpha coverage differs: ${id}`);
    invariant(Array.isArray(row.opaqueProbesSource)&&row.opaqueProbesSource.every(probe=>probe.length===2&&probe.every(Number.isInteger)&&probe[0]>=rectangle[0]+trim[0]&&probe[0]<rectangle[0]+trim[2]&&probe[1]>=rectangle[1]+trim[1]&&probe[1]<rectangle[1]+trim[3]),`Local FRONT opacity probes differ: ${id}`);
  }
}

function validateDefeatManifest(manifest){
  for(const [key,value]of Object.entries(defeatExpected))invariant(JSON.stringify(manifest?.[key])===JSON.stringify(value),`Local defeat provenance differs: ${key}`);
  invariant(manifest.operation==='New illustration; generated PNG copied without pixel edits or resampling','Local defeat operation differs');
  invariant(typeof manifest.prompt==='string'&&manifest.prompt.length>100&&typeof manifest.review==='string'&&manifest.review.length>40,'Local defeat generation prompt/review is missing');
}

function pngHeader(bytes,dimensions,label,{rgba=true}={}){
  invariant(bytes.length>=33&&bytes.subarray(0,8).toString('hex')===signature&&bytes.toString('ascii',12,16)==='IHDR',`Invalid ${label} PNG signature or IHDR`);
  invariant(bytes.readUInt32BE(16)===dimensions[0]&&bytes.readUInt32BE(20)===dimensions[1],`${label} PNG dimensions differ`);
  invariant(bytes[24]===8&&(rgba?bytes[25]===6:[2,6].includes(bytes[25])),`Expected eight-bit ${rgba?'RGBA':'RGB/RGBA'} ${label} PNG header`);
}

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
export async function verifyPublic({base=defaultBase,manifest,manifestSha256=null,crimsonManifest,frontManifest,defeatManifest,localBuild,concurrency=6,timeoutMs=30000,fetchImpl=fetch}={}){
  const started=Date.now(),nonce=randomBytes(10).toString('hex');
  const report={schemaVersion:1,status:'running',startedAt:new Date(started).toISOString(),expected,
    publicBase:String(base),authentication:'None; public GETs only; credentials omitted; no credential files or browser sessions read',
    concurrency,cachePolicy:'Unique per-run query, no-store, no-cache headers',localManifestSha256:manifestSha256,
    release:null,compiled:[],uiMarkers:null,localBuildComparison:{status:'not checked',index:false,indexComparison:'Exact HTML text after normalizing CR runs immediately before LF (including CRLF and CRCRLF) to LF; all other HTML text is preserved; compiled assets use exact raw bytes',entries:false,exactHashes:0},portraits:{expected:136,checked:0,passed:0,pngSignatures:0,rgbaHeaders:0,exactHashes:0,servedBytes:0},crimson:{expected:1,checked:0,passed:0},fronts:{expected:50,checked:0,passed:0,pngSignatures:0,rgbaHeaders:0,exactHashes:0,servedBytes:0,sourceMetadata:0},defeat:{expected:1,checked:0,passed:0},
    requests:0,failures:[],limits:['HTTP signatures, hashes and bundle markers do not prove browser rendering, gameplay behavior, or physical iPad/Safari interaction.','FRONT metadata and served bytes are checked here; independent local pixel tests compare RGB and alpha against original source sheets.']};
  const fail=(file,error)=>report.failures.push({file,error:error instanceof Error?error.message:String(error)});
  let publicBase;
  async function get(file){
    const url=publicUrl(publicBase,file);url.searchParams.set('verify',`0.4.3-${nonce}-${report.requests++}`);
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
    validateFrontManifest(frontManifest,manifest,crimsonManifest);report.fronts.sourceMetadata=50;
    validateDefeatManifest(defeatManifest);
    invariant(localBuild?.indexHtml&&localBuild?.assets,'A final local production build is required for exact compiled comparison');
    const localEntries=compiledEntries(String(localBuild.indexHtml),publicBase);
    for(const entry of localEntries)invariant(Buffer.isBuffer(localBuild.assets[entry.file]),`Missing local compiled asset: ${entry.file}`);
    await checkedGet('release.json',({bytes})=>{
      const release=parseJson(bytes);report.release=Object.fromEntries(Object.keys(expected).map(key=>[key,release[key]??null]));
      for(const [key,value] of Object.entries(expected))invariant(release[key]===value,`Expected ${key}=${value}; received ${release[key]}`);
      report.release.sha256=sha(bytes);
    });
    if(report.failures.length)throw Error('Release metadata does not match 0.4.3; stopped before bulk asset requests');
    let entries;
    await pool(['index.html',manifestPath,crimsonManifestPath,frontManifestPath,defeatManifestPath],concurrency,async file=>checkedGet(file,({bytes,contentType})=>{
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
      }else if(file===crimsonManifestPath){
        const served=parseJson(bytes);
        for(const [key,value]of Object.entries(crimsonExpected))invariant(JSON.stringify(served[key])===JSON.stringify(value),`Public crimson manifest differs: ${key}`);
        invariant(JSON.stringify(served)===JSON.stringify(crimsonManifest),'Public crimson manifest differs from local verified record');
        report.crimson.manifestSha256=sha(bytes);report.crimson.revision=served.revision;
      }else if(file===frontManifestPath){
        const served=parseJson(bytes);validateFrontManifest(served,manifest,crimsonManifest);
        invariant(jsonSha(served)===jsonSha(frontManifest),'Public FRONT manifest differs from local verified record');
        Object.assign(report.fronts,{manifestSha256:sha(bytes),manifestCanonicalSha256:jsonSha(served),revision:served.revision,manifestComparison:'Exact canonical JSON; checkout line endings in JSON formatting may differ; every metadata value is preserved',sourceMetadataDigestPolicy:'UTF-8 text with CRLF converted to LF only; all other formatting/content preserved; non-JSON files use exact raw bytes',allFront:true,preservedRgb:true,historicalAssetsPreserved:true});
      }else{
        const served=parseJson(bytes);validateDefeatManifest(served);
        invariant(jsonSha(served)===jsonSha(defeatManifest),'Public defeat manifest differs from local provenance record');
        Object.assign(report.defeat,{manifestSha256:sha(bytes),manifestCanonicalSha256:jsonSha(served),revision:served.revision,manifestComparison:'Exact canonical JSON; generation prompt and provenance values are preserved'});
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
      if(missing.length)fail(`compiled-${kind}`,`Missing 0.4.3 design markers: ${missing.join(', ')}`);
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
      Object.assign(report.crimson,{passed:1,bytes:bytes.length,sha256:sha(bytes),dimensions:crimsonExpected.dimensions,rgbaHeader:true,role:'Legacy 0.4.2 crimson derivative preserved; active enemy atlas uses the FRONT namespace'});
    });
    const frontReceipts=[];
    await pool(frontManifest.identities,concurrency,async row=>{
      const file=row.output.replace(/^public\//,'');report.fronts.checked++;
      await checkedGet(file,({bytes,contentType})=>{
        report.fronts.servedBytes+=bytes.length;
        invariant(/^image\/png\b/i.test(contentType),`Unexpected FRONT PNG MIME: ${contentType}`);
        pngHeader(bytes,row.dimensions,`FRONT ${row.id}`);report.fronts.pngSignatures++;report.fronts.rgbaHeaders++;
        const actualSha=sha(bytes);invariant(actualSha===row.sha256,`FRONT PNG SHA-256 differs: ${row.id}`);report.fronts.exactHashes++;
        frontReceipts.push([row.id,bytes.length,actualSha]);report.fronts.passed++;
      });
    });
    frontReceipts.sort((a,b)=>a[0].localeCompare(b[0]));report.fronts.inventorySha256=sha(Buffer.from(JSON.stringify(frontReceipts)));
    report.defeat.checked++;
    await checkedGet(defeatExpected.file.replace(/^public\//,''),({bytes,contentType})=>{
      invariant(/^image\/png\b/i.test(contentType),`Unexpected defeat PNG MIME: ${contentType}`);
      pngHeader(bytes,defeatExpected.dimensions,'Defeat',{rgba:false});
      invariant(bytes.length===defeatExpected.bytes,'Defeat PNG byte count differs');
      invariant(sha(bytes)===defeatExpected.sha256,'Defeat PNG SHA-256 differs');
      Object.assign(report.defeat,{passed:1,bytes:bytes.length,sha256:sha(bytes),dimensions:defeatExpected.dimensions,pngHeader:true});
    });
  }catch(error){fail('verification',error);}
  report.compiled.sort((a,b)=>a.file.localeCompare(b.file));
  report.failures.sort((a,b)=>a.file.localeCompare(b.file));
  report.status=report.failures.length===0&&report.portraits.passed===136&&report.crimson.passed===1&&report.fronts.passed===50&&report.defeat.passed===1&&report.localBuildComparison.status==='passed'?'passed':'failed';
  report.finishedAt=new Date().toISOString();report.durationMs=Date.now()-started;
  return report;
}

async function main(){
  const args=process.argv.slice(2);
  if(args.length===1&&args[0]==='--help'){
    console.log('Usage: node tools/verify-v043-public.mjs [--base=https://host/project/] [--dist=dist] [--output=path.json] [--concurrency=6] [--timeout-ms=30000]\nRead-only public GETs; no deployment or credentials. Compares strict HTML and exact compiled bytes with the final local production build. Checks all 136 immutable cutouts, legacy crimson PNG, all 50 FRONT cutouts and defeat art with provenance manifests. JSON formatting line endings may differ; metadata and generation prompt values must match exactly. The default report is output/design/ui-refinements-v043-20261018/public-verification.json.');return;
  }
  invariant(args.every(arg=>/^--(?:base|dist|output|concurrency|timeout-ms)=.+$/.test(arg)),'Unknown argument; use --help');
  const options=Object.fromEntries(args.map(arg=>{const at=arg.indexOf('=');return [arg.slice(2,at),arg.slice(at+1)];}));
  invariant(Object.keys(options).length===args.length,'Duplicate arguments are not supported');
  const bytes=await readFile(path.join(root,'public',manifestPath));
  const crimsonManifest=parseJson(await readFile(path.join(root,'public',crimsonManifestPath))),frontManifest=parseJson(await readFile(path.join(root,'public',frontManifestPath))),defeatManifest=parseJson(await readFile(path.join(root,'public',defeatManifestPath))),base=new URL(options.base||defaultBase),dist=path.resolve(root,options.dist||'dist');
  if(!base.pathname.endsWith('/'))base.pathname+='/';
  const indexHtml=await readFile(path.join(dist,'index.html')),assets={};
  for(const entry of compiledEntries(indexHtml.toString('utf8'),base))assets[entry.file]=await readFile(path.join(dist,entry.file));
  const report=await verifyPublic({base:base.href,manifest:parseJson(bytes),manifestSha256:sha(bytes),crimsonManifest,frontManifest,defeatManifest,localBuild:{indexHtml,assets},
    concurrency:options.concurrency?Number(options.concurrency):6,timeoutMs:options['timeout-ms']?Number(options['timeout-ms']):30000});
  const output=path.resolve(root,options.output||defaultOutput);
  await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n','utf8');
  console.log(JSON.stringify({status:report.status,version:expected.version,report:output,requests:report.requests,localBuildComparison:report.localBuildComparison,portraits:report.portraits,crimson:report.crimson,fronts:report.fronts,defeat:report.defeat,failures:report.failures}));
  if(report.status!=='passed')process.exitCode=1;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
