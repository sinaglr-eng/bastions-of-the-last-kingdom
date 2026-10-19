// Public GET verification only. This tool never deploys, reads credentials or
// uses browser sessions. Run after the release owner confirms publication.
// node tools/verify-v047-public.mjs [--base=https://.../] [--dist=dist] [--output=report.json]
import {createHash,randomBytes} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const defaultBase='https://sinaglr-eng.github.io/bastions-of-the-last-kingdom/';
const defaultOutput=path.join(root,'output/design/ipad-performance-v047-20261019/public-verification.json');
const manifestPath='assets/ui/reference-cutouts/manifest.json';
const crimsonManifestPath='assets/ui/portrait-variants/manifest.json';
const frontManifestPath='assets/ui/reference-enemy-fronts/manifest.json';
const defeatManifestPath='assets/ui/results/manifest.json';
const outcomeManifestPath='assets/ui/results/v044/manifest.json';
const variantManifestPath='assets/ui/results/v045/manifest.json';
const legacyOutcomeRevision='outcome-scenes-20261018-v1';
const variantCanonicalSha='d71df30941072fbc9439c504cb8040b75c11f33a51ed913584f1dc59ae7f0ac9';
const variantExpected=[
  {
    "id": "defeat-02",
    "outcome": "lost",
    "file": "public/assets/ui/results/v045/defeat-02.png",
    "dimensions": [
      1672,
      941
    ],
    "bytes": 2277495,
    "sha256": "4de70fdd9d05cf2e35bb33c157fe27e4a86e854098b9dfa3831db7ae48b4b4fb"
  },
  {
    "id": "defeat-03",
    "outcome": "lost",
    "file": "public/assets/ui/results/v045/defeat-03.png",
    "dimensions": [
      1672,
      941
    ],
    "bytes": 2249658,
    "sha256": "c5f04d55af0bf4a4aaec5d52bfb090820ad36b706066848b04c171f931059b69"
  },
  {
    "id": "victory-02",
    "outcome": "won",
    "file": "public/assets/ui/results/v045/victory-02.png",
    "dimensions": [
      1672,
      941
    ],
    "bytes": 2378379,
    "sha256": "7a86162cf423fedbf66a67c0d717a9c059798582be0b38a1bcd6a5468682ba58"
  },
  {
    "id": "victory-03",
    "outcome": "won",
    "file": "public/assets/ui/results/v045/victory-03.png",
    "dimensions": [
      1672,
      941
    ],
    "bytes": 2318690,
    "sha256": "d96348d2f97a98b852d738d552422a8047a878f871a937dd2e3e8c7cb4959aef"
  }
];
// Canonical JSON keeps the immutable record independent of Git's LF/CRLF
// checkout policy. Individual PNGs and compiled assets still use raw hashes.
const immutableManifestSha='5d6f7703ad89fec39b4f5b05d2510e4fce3ecf387e7b9812b851805ca191cc0d';
const crimsonExpected={revision:'bernhard-crimson-20261018-v1',identity:'host_50',output:'public/assets/ui/reference-cutouts/host_50-crimson.png',dimensions:[426,422],sha256:'61a4a3e4dae617b6af817d3f825aee707012adb104b357678465f80272eaa82a',sourceSha256:'e57b84ce6650d7633003e7599ec064f310cfc408ed70de5af2e9d75e8b8cce32',preservedRgb:true};
const defeatExpected={revision:'defeat-city-20261018-v1',file:'public/assets/ui/results/defeat-city-v043.png',dimensions:[1672,941],bytes:2540557,sha256:'d827523f201adfa0472d1afa2aaed6d2c9e27c9ca7069d9542686fc80e56f812',generator:'Built-in ImageGen',transparentBackground:false};
const outcomeCanonicalSha='1a0b36c0b65e4d60f5882f3e7f3b686eaeea64c7e11d247ac0b602262ffbce2b';
const outcomeExpected=[
  {id:'defeat',file:'public/assets/ui/results/v044/defeat.png',dimensions:[1672,941],bytes:2179822,sha256:'350365c17e344e55f9191c6ac287f646cb8bd9ce54a6bf7565023a2430ce8ab7'},
  {id:'victory',file:'public/assets/ui/results/v044/victory.png',dimensions:[1672,941],bytes:2299564,sha256:'b52df65307d67977a851177fc5912c21a4b0c8f7f43cc899f702310c69d2a27e'},
];
const expected={version:'0.4.7',uiRevision:'ipad-input-results-20261019-v8',performanceRevision:'ipad-render-input-20261019-v1',uiPortraitRevision:'reference-cutouts-20261016-v1',uiEnemyPortraitRevision:'enemy-front-cutouts-20261018-v1',uiOutcomeArtRevision:'outcome-scenes-20261018-v2',artRevision:'basic-defenders-v7',championArtRevision:'champions-v8',enemyArtRevision:'approved-enemies-v6',motionRevision:'approved-motion-v1',vfxRevision:'attack-ability-vfx-20261018-v1',balanceRevision:'approved-b01-b06-20261018'};
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const invariant=(condition,message)=>{if(!condition)throw Error(message);};
const parseJson=bytes=>JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));
const jsonSha=value=>sha(Buffer.from(JSON.stringify(value)));
// Windows/Vite HTML can contain CRCRLF at an existing line boundary. Normalize
// only CR runs immediately before LF; preserve every other HTML difference.
const htmlText=value=>Buffer.from(value).toString('utf8').replace(/\r+\n/g,'\n');
const signature='89504e470d0a1a0a';
const markers={
  javascript:['"reference-cutouts"','reference-cutouts-20261016-v1','atlas-book','catalog-index-page','catalog-reading-page','warbands-atlas','folio-construction-seal','catalog-selected-heading','warband-story','"reference-enemy-fronts"','enemy-front-cutouts-20261018-v1','assets/ui/results/v044/','assets/ui/results/v045/','data-outcome-art','run-result-victory-art','mystery-placement','Place a defender on the map','folio-ingredient-recipe','folio-champion-context','data-effective-stats','catalog-index-tools','catalog-basic-detail','approved-motion-v1','approved-enemies-v6'],
  css:['--folio-grain','--folio-frame','book-corners','catalog-reading-page','catalog-bookmark','preparation-folio','catalog-heading-pin','is-compact-external','folio-create-actions','folio-decision-row','run-result-defeat-art','run-result-art','mystery-placement','crafting-order','catalog-index-tools','catalog-basic-ranks'],
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

function validateOutcomeManifest(manifest,original,front){
  invariant(manifest?.revision===legacyOutcomeRevision,'Local outcome manifest revision differs');
  invariant(manifest.generator==='Built-in ImageGen'&&manifest.transparentBackground===false&&manifest.copiedWithoutPixelEdits===true,'Local outcome generation operation differs');
  invariant(manifest.identities?.length===2,'Local outcome manifest must contain exactly two identities');
  const referenceHashes=new Map([...original.identities,...front.identities].map(row=>[row.output,row.sha256]));
  referenceHashes.set('output/design/ui-refinements-v043-20261018/24-public-game-final.jpg','d8bb6dd4e99bd2e4492ccd438649bb22389659dbba7ec5eed0ad33b11f4a537c');
  const referenceIds={defeat:['frostblade','roseguard','host_07','host_44'],victory:['frostblade','roseguard','greenheart','host_50']};
  for(const [index,asset]of outcomeExpected.entries()){
    const row=manifest.identities[index];
    for(const [key,value]of Object.entries(asset))invariant(JSON.stringify(row?.[key])===JSON.stringify(value),`Local outcome ${asset.id} provenance differs: ${key}`);
    invariant(row.references?.length===5,`Local outcome ${asset.id} needs all five approved input references`);
    for(const [at,reference]of row.references.entries()){
      invariant(referenceHashes.get(reference.file)===reference.sha256,`Local outcome ${asset.id} input reference hash differs: ${reference.file}`);
      const identity=at<4?reference.file.match(/\/([^/]+)\.png$/)?.[1]:null;
      invariant(at<4?identity===referenceIds[asset.id][at]:reference.file==='output/design/ui-refinements-v043-20261018/24-public-game-final.jpg',`Local outcome ${asset.id} input reference identity/order differs`);
    }
    invariant(typeof row.prompt==='string'&&row.prompt.length>1000&&typeof row.review==='string'&&row.review.length>100,`Local outcome ${asset.id} prompt or review is missing`);
  }
  invariant(jsonSha(manifest)===outcomeCanonicalSha,'Local outcome complete prompt/provenance record differs from the approved canonical JSON');
}

function validateVariantManifest(manifest,original,front){
  invariant(manifest?.revision===expected.uiOutcomeArtRevision,'Local variant manifest revision differs');
  invariant(manifest.generator==='Built-in ImageGen'&&manifest.transparentBackground===false&&manifest.copiedWithoutPixelEdits===true,'Local variant generation operation differs');
  invariant(manifest.sha256Policy?.jsonMetadata==='utf8-lf'&&manifest.sha256Policy?.otherFiles==='exact-bytes'&&Object.keys(manifest.sha256Policy).length===2,'Local variant JSON/binary digest policy differs');
  invariant(manifest.identities?.length===4&&new Set(manifest.identities.map(row=>row.id)).size===4,'Local variant manifest must contain exactly four unique new identities');
  const referenceHashes=new Map([...original.identities,...front.identities].map(row=>[row.output,row.sha256]));
  for(const asset of outcomeExpected)referenceHashes.set(asset.file,asset.sha256);
  const referenceIds={
    'defeat-02':['tempest','thornwarden','host_10','host_14','defeat'],
    'defeat-03':['kingdomprotector','embercrown','host_18','host_19','defeat'],
    'victory-02':['crownofages','verdantguard','host_50','host_31','victory'],
    'victory-03':['ladyclaire','dawnspire','host_50','host_10','victory'],
  };
  for(const [index,asset]of variantExpected.entries()){
    const row=manifest.identities[index];
    for(const [key,value]of Object.entries(asset))invariant(JSON.stringify(row?.[key])===JSON.stringify(value),'Local variant asset provenance differs: '+asset.id+' '+key);
    invariant(row.references?.length===5,'Local variant needs all five approved references: '+asset.id);
    for(const [at,reference]of row.references.entries()){
      invariant(referenceHashes.get(reference.file)===reference.sha256,'Local variant input reference hash differs: '+asset.id+' '+reference.file);
      const identity=reference.file.match(/\/([^/]+)\.png$/)?.[1];
      invariant(identity===referenceIds[asset.id][at],'Local variant input reference identity/order differs: '+asset.id);
      invariant(at<4?reference.role==='Approved character identity':reference.role==='Preserved 044 outcome world and rendering style','Local variant reference role differs: '+asset.id);
    }
    invariant(typeof row.prompt==='string'&&row.prompt.length>1000&&typeof row.review==='string'&&row.review.length>100,'Local variant prompt/review is missing: '+asset.id);
    invariant(/^exec-[a-f0-9-]+\.png$/.test(row.sourceGenerationFile),'Local variant original generation record differs: '+asset.id);
    invariant(row.subjects?.defenders?.length===2&&row.subjects?.enemies?.length===2,'Local variant subject identities differ: '+asset.id);
  }
  const preserved=outcomeExpected.map(asset=>({id:asset.id+'-01',outcome:asset.id==='victory'?'won':'lost',file:asset.file,sourceManifest:'public/assets/ui/results/v044/manifest.json',sourceIdentity:asset.id,preservedWithoutChanges:true,dimensions:asset.dimensions,bytes:asset.bytes,sha256:asset.sha256}));
  invariant(JSON.stringify(manifest.preservedAssets)===JSON.stringify(preserved),'Local variant historical outcome pool entries differ');
  invariant(manifest.preservedManifest?.file==='public/assets/ui/results/v044/manifest.json'&&manifest.preservedManifest?.sha256==='70840fe49eac6f73a63845d077611ec9b148ba47d47b085eac9f0197f27b39ff','Local variant preserved LF-JSON manifest record differs');
  invariant(manifest.selection?.scenesPerOutcome===3&&manifest.selection?.presentationRandomSource==='Math.random, independent of Game.rng','Local variant selection provenance differs');
  invariant(jsonSha(manifest)===variantCanonicalSha,'Local variant complete prompt/provenance record differs from the approved canonical JSON');
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
export async function verifyUiPublic({base=defaultBase,manifest,manifestSha256=null,crimsonManifest,frontManifest,defeatManifest,outcomeManifest,variantManifest,localBuild,concurrency=6,timeoutMs=30000,fetchImpl=fetch}={}){
  const started=Date.now(),nonce=randomBytes(10).toString('hex');
  const report={schemaVersion:1,status:'running',startedAt:new Date(started).toISOString(),expected,
    publicBase:String(base),authentication:'None; public GETs only; credentials omitted; no credential files or browser sessions read',
    concurrency,cachePolicy:'Unique per-run query, no-store, no-cache headers',localManifestSha256:manifestSha256,
    release:null,compiled:[],uiMarkers:null,localBuildComparison:{status:'not checked',index:false,indexComparison:'Exact HTML text after normalizing CR runs immediately before LF (including CRLF and CRCRLF) to LF; all other HTML text is preserved; compiled assets use exact raw bytes',entries:false,exactHashes:0},portraits:{expected:136,checked:0,passed:0,pngSignatures:0,rgbaHeaders:0,exactHashes:0,servedBytes:0},crimson:{expected:1,checked:0,passed:0},fronts:{expected:50,checked:0,passed:0,pngSignatures:0,rgbaHeaders:0,exactHashes:0,servedBytes:0,sourceMetadata:0},defeat:{expected:1,checked:0,passed:0},
    outcomes:{expected:2,checked:0,passed:0,exactHashes:0,assets:[]},variants:{expected:4,checked:0,passed:0,exactHashes:0,assets:[]},requests:0,failures:[],limits:['HTTP signatures, hashes and bundle markers do not prove browser rendering, gameplay behavior, or physical iPad/Safari interaction.','FRONT metadata and served bytes are checked here; independent local pixel tests compare RGB and alpha against original source sheets.','Historical and new outcome prompts, reference identities/hashes, generation records and pool links are preserved in exact canonical JSON; this checker does not visually reassess generated art or prove random selection behavior.']};
  const fail=(file,error)=>report.failures.push({file,error:error instanceof Error?error.message:String(error)});
  let publicBase;
  async function get(file){
    const url=publicUrl(publicBase,file);url.searchParams.set('verify',`0.4.7-${nonce}-${report.requests++}`);
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
    validateOutcomeManifest(outcomeManifest,manifest,frontManifest);
    validateVariantManifest(variantManifest,manifest,frontManifest);
    invariant(localBuild?.indexHtml&&localBuild?.assets,'A final local production build is required for exact compiled comparison');
    const localEntries=compiledEntries(String(localBuild.indexHtml),publicBase);
    for(const entry of localEntries)invariant(Buffer.isBuffer(localBuild.assets[entry.file]),`Missing local compiled asset: ${entry.file}`);
    await checkedGet('release.json',({bytes})=>{
      const release=parseJson(bytes);report.release=Object.fromEntries(Object.keys(expected).map(key=>[key,release[key]??null]));
      for(const [key,value] of Object.entries(expected))invariant(release[key]===value,`Expected ${key}=${value}; received ${release[key]}`);
      report.release.sha256=sha(bytes);
    });
    if(report.failures.length)throw Error('Release metadata does not match 0.4.7; stopped before bulk asset requests');
    let entries;
    await pool(['index.html',manifestPath,crimsonManifestPath,frontManifestPath,defeatManifestPath,outcomeManifestPath,variantManifestPath],concurrency,async file=>checkedGet(file,({bytes,contentType})=>{
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
      }else if(file===defeatManifestPath){
        const served=parseJson(bytes);validateDefeatManifest(served);
        invariant(jsonSha(served)===jsonSha(defeatManifest),'Public defeat manifest differs from local provenance record');
        Object.assign(report.defeat,{manifestSha256:sha(bytes),manifestCanonicalSha256:jsonSha(served),revision:served.revision,manifestComparison:'Exact canonical JSON; generation prompt and provenance values are preserved'});
      }else if(file===outcomeManifestPath){
        const served=parseJson(bytes);validateOutcomeManifest(served,manifest,frontManifest);
        invariant(jsonSha(served)===jsonSha(outcomeManifest),'Public outcome manifest differs from local provenance record');
        Object.assign(report.outcomes,{manifestSha256:sha(bytes),manifestCanonicalSha256:jsonSha(served),revision:served.revision,manifestComparison:'Exact approved canonical JSON; complete generation prompts, reviews and all ordered input reference hashes are preserved'});

      }else{
        const served=parseJson(bytes);validateVariantManifest(served,manifest,frontManifest);
        invariant(jsonSha(served)===jsonSha(variantManifest),'Public variant manifest differs from local provenance record');
        Object.assign(report.variants,{manifestSha256:sha(bytes),manifestCanonicalSha256:jsonSha(served),revision:served.revision,manifestComparison:'Exact approved canonical JSON; complete new generation prompts, ordered reference identities, reviews, historical pool links and source/output hashes are preserved'});
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
      if(missing.length)fail(`compiled-${kind}`,`Missing 0.4.7 design markers: ${missing.join(', ')}`);
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
    await pool(outcomeExpected,concurrency,async asset=>{
      const file=asset.file.replace(/^public\//,'');report.outcomes.checked++;
      await checkedGet(file,({bytes,contentType})=>{
        invariant(/^image\/png\b/i.test(contentType),`Unexpected ${asset.id} outcome PNG MIME: ${contentType}`);
        pngHeader(bytes,asset.dimensions,`${asset.id} outcome`,{rgba:false});
        invariant(bytes.length===asset.bytes,`${asset.id} outcome PNG byte count differs`);
        invariant(sha(bytes)===asset.sha256,`${asset.id} outcome PNG SHA-256 differs`);
        report.outcomes.assets.push({id:asset.id,file,bytes:bytes.length,sha256:sha(bytes),dimensions:asset.dimensions,pngHeader:true});
        report.outcomes.exactHashes++;report.outcomes.passed++;
      });
    });

    await pool(variantExpected,concurrency,async asset=>{
      const file=asset.file.replace(/^public\//,'');report.variants.checked++;
      await checkedGet(file,({bytes,contentType})=>{
        invariant(/^image\/png\b/i.test(contentType),'Unexpected variant PNG MIME: '+contentType);
        pngHeader(bytes,asset.dimensions,asset.id+' variant',{rgba:false});
        invariant(bytes.length===asset.bytes,asset.id+' variant PNG byte count differs');
        invariant(sha(bytes)===asset.sha256,asset.id+' variant PNG SHA-256 differs');
        report.variants.assets.push({id:asset.id,file,bytes:bytes.length,sha256:sha(bytes),dimensions:asset.dimensions,pngHeader:true});
        report.variants.exactHashes++;report.variants.passed++;
      });
    });
  }catch(error){fail('verification',error);}
  report.compiled.sort((a,b)=>a.file.localeCompare(b.file));
  report.failures.sort((a,b)=>a.file.localeCompare(b.file));
  report.outcomes.assets.sort((a,b)=>a.id.localeCompare(b.id));
  report.variants.assets.sort((a,b)=>a.id.localeCompare(b.id));
  report.status=report.failures.length===0&&report.portraits.passed===136&&report.crimson.passed===1&&report.fronts.passed===50&&report.defeat.passed===1&&report.outcomes.passed===2&&report.variants.passed===4&&report.localBuildComparison.status==='passed'?'passed':'failed';
  report.finishedAt=new Date().toISOString();report.durationMs=Date.now()-started;
  return report;
}

const geometricRoot='assets/geometric/';
const geometricManifestPins={
  defenders:{revision:'approved-basic-defenders-v7',count:48,kind:'basic',sha256:'fee51231bdc6b5d7642f00d4acb28300cdfc120b8a6cefc94e485d9d9bbff5db'},
  champions:{revision:'approved-champions-v8',count:38,kind:'champion',sha256:'e6d43f5fd11df841e02c9a424ed80be816ef4606b18a3f68b49ee91686862176'},
  enemies:{revision:'approved-enemies-v6',count:54,kind:'enemy',sha256:'5d62668702b049bc233142ab9d2416c639288b78483efff303f7cf5f30a21a0e'},
};
const geometricProvenancePath=geometricRoot+'approved-enemies-v6/provenance.json';
const geometricProvenanceSha='be11dfcdcdb486ad9f15b37912f28c126920ec87cf1e8faa7e0ae6ec0e36afd6';
const approvedEnemyBytes=387872104;

function validateGeometricPublication(manifests,provenance){
  invariant(manifests&&Object.keys(manifests).sort().join(',')==='champions,defenders,enemies','Exactly three local geometric manifests are required');
  for(const [kind,pin]of Object.entries(geometricManifestPins)){
    const manifest=manifests[kind];
    invariant(manifest?.revision===pin.revision&&manifest.language==='en'&&manifest.motionRevision===expected.motionRevision,'Local geometric '+kind+' revision/language/motion differs');
    invariant(manifest.entries?.length===pin.count&&new Set(manifest.entries.map(row=>row.id)).size===pin.count,'Local geometric '+kind+' identity count differs');
    for(const row of manifest.entries){
      invariant(/^[a-z0-9_-]+$/.test(row.id)&&/^[a-f0-9]{64}$/.test(row.assetSha256),'Local geometric '+kind+' identity/hash differs');
      invariant(row.motion?.revision===expected.motionRevision&&row.motion.kind===pin.kind&&row.motion.id===row.id&&Number.isFinite(row.motion.height)&&row.motion.height>0,'Local geometric '+kind+' motion binding differs: '+row.id);
      invariant(row.reconstruction&&typeof row.reconstruction.sourceGlbFile==='string','Local geometric '+kind+' reconstruction provenance missing: '+row.id);
      invariant(kind==='enemies'?row.file==='approved-enemies-v6/'+row.id+'.glb':row.file===kind+'/'+row.id+'.glb','Local geometric '+kind+' active asset path differs: '+row.id);
    }
    invariant(jsonSha(manifest)===pin.sha256,'Local geometric '+kind+' complete manifest record differs from approved canonical JSON');
  }
  invariant(provenance?.schemaVersion===1&&provenance.language==='en'&&provenance.revision===expected.motionRevision,'Local geometric provenance revision/language differs');
  invariant(provenance.enemyApprovalSha256==='95cc726ce86d7b8afafdde23b72443670e33a2c19e0d023ff0bdfd62857cf26e'&&provenance.motionApprovalSha256==='d22efee1baf6a87ac73e8c63375889cd545907bf174e8759bcaf9bcd669160da'&&provenance.materialDecisionSha256==='d04753e2a2c199868a279de13fdf2d2ae9de1cc5b89a027f768891a6d4086f4d','Local geometric approval receipts differ');
  invariant(provenance.enemies?.length===54&&new Set(provenance.enemies.map(row=>row.id)).size===54,'Local approved enemy provenance must contain 54 unique assets');
  const byId=new Map(manifests.enemies.entries.map(row=>[row.id,row]));
  for(const row of provenance.enemies){
    const entry=byId.get(row.id);
    invariant(entry&&row.file===geometricRoot+entry.file&&row.sha256===entry.assetSha256,'Local approved enemy manifest/provenance identity differs: '+row.id);
    invariant(Number.isInteger(row.bytes)&&row.bytes>=20&&row.bytes<=100*1024*1024,'Local approved enemy byte budget differs: '+row.id);
    invariant(row.approvedSource===entry.reconstruction.sourceGlbFile,'Local approved enemy original source differs: '+row.id);
  }
  invariant(provenance.enemies.reduce((total,row)=>total+row.bytes,0)===approvedEnemyBytes,'Local approved enemy total byte count differs');
  invariant(manifests.enemies.provenance==='approved-enemies-v6/provenance.json','Local enemy active provenance path differs');
  invariant(provenance.activeManifest==='assets/geometric/geometric-enemies.json'&&provenance.activeEnemyModelCount===54&&provenance.historicalArtworkInventory?.file==='assets/geometric/source-manifest.json'&&provenance.historicalArtworkInventory.unchanged===true,'Local active model inventory and preserved historical artwork authority differ');
  invariant(provenance.motionSources?.length===4&&provenance.motionSources.every(row=>row.file.startsWith('game/render/approved-motion-v1/')&&/^[a-f0-9]{64}$/.test(row.sha256)),'Local approved motion source provenance differs');
  invariant(jsonSha(provenance)===geometricProvenanceSha,'Local geometric complete provenance differs from approved canonical JSON');
}

// Separate metadata/GLB component allows corruption fixtures without repeating
// the historical portrait requests. The public CLI always runs both components.
export async function verifyGeometricPublic({base=defaultBase,geometricManifests,enemyProvenance,timeoutMs=30000,fetchImpl=fetch}={}){
  const started=Date.now(),nonce=randomBytes(10).toString('hex');
  const report={status:'running',motionRevision:expected.motionRevision,manifests:{expected:3,checked:0,passed:0,assets:[]},provenance:{passed:false},models:{expected:54,checked:0,passed:0,exactHashes:0,glbHeaders:0,servedBytes:0,expectedBytes:approvedEnemyBytes,assets:[],transferPolicy:'One sequential streamed GLB at a time; exact SHA-256 and declared GLB length; no model body is buffered in full'},requests:0,failures:[],metadataComparison:'Complete approved canonical JSON values; formatting line endings may differ. GLBs use exact raw bytes.',limitations:['HTTP metadata, GLB headers and hashes do not certify browser decode, motion appearance or device frame rate.','The 136-entry historical source-manifest remains an archived concept inventory; the three active model manifests select the current 48/38/54 production models.']};
  const fail=(file,error)=>report.failures.push({file,error:error instanceof Error?error.message:String(error)});
  let publicBase;
  const responseFor=async file=>{
    const url=publicUrl(publicBase,file);url.searchParams.set('verify','0.4.7-geometric-'+nonce+'-'+report.requests++);
    const response=await fetchImpl(url,{method:'GET',credentials:'omit',redirect:'error',cache:'no-store',headers:{'Cache-Control':'no-cache',Pragma:'no-cache'},signal:AbortSignal.timeout(timeoutMs)});
    invariant(response.ok,'HTTP '+response.status);return response;
  };
  try{
    publicBase=new URL(base);invariant(['http:','https:'].includes(publicBase.protocol)&&!publicBase.username&&!publicBase.password&&!publicBase.search&&!publicBase.hash,'Base must be an HTTP(S) URL without credentials, query or fragment');if(!publicBase.pathname.endsWith('/'))publicBase.pathname+='/';
    invariant(Number.isInteger(timeoutMs)&&timeoutMs>=1000&&timeoutMs<=60000,'Timeout must be between 1000 and 60000 milliseconds');
    validateGeometricPublication(geometricManifests,enemyProvenance);
    for(const kind of Object.keys(geometricManifestPins)){
      const file=geometricRoot+'geometric-'+kind+'.json';report.manifests.checked++;
      try{
        const response=await responseFor(file),bytes=Buffer.from(await response.arrayBuffer());invariant(bytes.length>0&&bytes.length<=2*1024*1024,'Empty or unexpectedly large geometric manifest');
        const served=parseJson(bytes);invariant(jsonSha(served)===jsonSha(geometricManifests[kind]),'Public geometric '+kind+' manifest differs from local approved record');
        report.manifests.assets.push({file,revision:served.revision,motionRevision:served.motionRevision,identities:served.entries.length,sha256:sha(bytes),canonicalSha256:jsonSha(served)});report.manifests.passed++;
      }catch(error){fail(file,error);}
    }
    try{
      const response=await responseFor(geometricProvenancePath),bytes=Buffer.from(await response.arrayBuffer());invariant(bytes.length>0&&bytes.length<=2*1024*1024,'Empty or unexpectedly large geometric provenance');
      const served=parseJson(bytes);invariant(jsonSha(served)===jsonSha(enemyProvenance),'Public geometric provenance differs from local approved record');
      Object.assign(report.provenance,{passed:true,file:geometricProvenancePath,sha256:sha(bytes),canonicalSha256:jsonSha(served),approvedEnemyCount:served.enemies.length,motionSources:served.motionSources.length});
    }catch(error){fail(geometricProvenancePath,error);}
    invariant(report.failures.length===0,'Public geometric metadata differs; stopped before large model requests');
    for(const asset of enemyProvenance.enemies){
      report.models.checked++;
      try{
        const response=await responseFor(asset.file),mime=response.headers.get('content-type')||'';
        invariant(/^(?:model\/gltf-binary|application\/(?:octet-stream|gltf-binary))\b/i.test(mime),'Unexpected GLB MIME: '+mime);invariant(response.body,'GLB response has no readable stream');
        const digest=createHash('sha256'),header=Buffer.alloc(12);let headerBytes=0,total=0;
        for await(const chunk of response.body){
          const bytes=Buffer.from(chunk);total+=bytes.length;invariant(total<=asset.bytes&&total<=100*1024*1024,'GLB response exceeds its exact approved byte count');digest.update(bytes);
          if(headerBytes<12){const length=Math.min(bytes.length,12-headerBytes);bytes.copy(header,headerBytes,0,length);headerBytes+=length;}
        }
        report.models.servedBytes+=total;
        invariant(total===asset.bytes,'GLB byte count differs: '+asset.id);
        invariant(headerBytes===12&&header.toString('ascii',0,4)==='glTF'&&header.readUInt32LE(4)===2&&header.readUInt32LE(8)===asset.bytes,'GLB signature, version or declared length differs: '+asset.id);report.models.glbHeaders++;
        const actual=digest.digest('hex');invariant(actual===asset.sha256,'GLB SHA-256 differs: '+asset.id);report.models.exactHashes++;report.models.passed++;
        report.models.assets.push({id:asset.id,file:asset.file,bytes:total,sha256:actual,glbHeader:true});
      }catch(error){fail(asset.file,error);break;}
    }
  }catch(error){fail('geometric-verification',error);}
  report.status=!report.failures.length&&report.manifests.passed===3&&report.provenance.passed&&report.models.passed===54&&report.models.servedBytes===approvedEnemyBytes?'passed':'failed';report.finishedAt=new Date().toISOString();report.durationMs=Date.now()-started;return report;
}

export async function verifyPublic(options={}){
  const started=Date.now();
  try{validateGeometricPublication(options.geometricManifests,options.enemyProvenance);}catch(error){return {schemaVersion:1,status:'failed',expected,requests:0,failures:[{file:'local-geometric-provenance',error:error.message}]};}
  const report=await verifyUiPublic(options);if(report.status!=='passed')return report;
  const geometric=await verifyGeometricPublic(options);report.geometric=geometric;report.requests+=geometric.requests;report.failures.push(...geometric.failures);report.status=geometric.status==='passed'?'passed':'failed';report.finishedAt=new Date().toISOString();report.durationMs=Date.now()-started;return report;
}

async function main(){
  const args=process.argv.slice(2);
  if(args.length===1&&args[0]==='--help'){
    console.log('Usage: node tools/verify-v047-public.mjs [--base=https://host/project/] [--dist=dist] [--output=path.json] [--concurrency=6] [--timeout-ms=30000]\nRead-only public GETs; no deployment or credentials. Compares strict HTML and exact compiled bytes with the final local production build. Checks all 136 immutable cutouts, legacy crimson PNG, all 50 FRONT cutouts, legacy defeat art and both immutable 0.4.4 outcome scenes and four 0.4.5 variants with approved provenance manifests. Also compares all three active geometric manifests, approved motion provenance and all 54 approved enemy V6 GLBs with sequential streaming SHA-256. JSON formatting line endings may differ; complete metadata, ordered input reference hashes and generation prompt values must match exactly. The default report is output/design/ipad-performance-v047-20261019/public-verification.json.');return;
  }
  invariant(args.every(arg=>/^--(?:base|dist|output|concurrency|timeout-ms)=.+$/.test(arg)),'Unknown argument; use --help');
  const options=Object.fromEntries(args.map(arg=>{const at=arg.indexOf('=');return [arg.slice(2,at),arg.slice(at+1)];}));
  invariant(Object.keys(options).length===args.length,'Duplicate arguments are not supported');
  const bytes=await readFile(path.join(root,'public',manifestPath));
  const crimsonManifest=parseJson(await readFile(path.join(root,'public',crimsonManifestPath))),frontManifest=parseJson(await readFile(path.join(root,'public',frontManifestPath))),defeatManifest=parseJson(await readFile(path.join(root,'public',defeatManifestPath))),outcomeManifest=parseJson(await readFile(path.join(root,'public',outcomeManifestPath))),variantManifest=parseJson(await readFile(path.join(root,'public',variantManifestPath))),base=new URL(options.base||defaultBase),dist=path.resolve(root,options.dist||'dist');
  if(!base.pathname.endsWith('/'))base.pathname+='/';
  const indexHtml=await readFile(path.join(dist,'index.html')),assets={};
  for(const entry of compiledEntries(indexHtml.toString('utf8'),base))assets[entry.file]=await readFile(path.join(dist,entry.file));
  const geometricManifests=Object.fromEntries(await Promise.all(['defenders','champions','enemies'].map(async kind=>[kind,parseJson(await readFile(path.join(root,'public/assets/geometric/geometric-'+kind+'.json')))])));
  const enemyProvenance=parseJson(await readFile(path.join(root,'public/assets/geometric/approved-enemies-v6/provenance.json')));
  const report=await verifyPublic({geometricManifests,enemyProvenance,base:base.href,manifest:parseJson(bytes),manifestSha256:sha(bytes),crimsonManifest,frontManifest,defeatManifest,outcomeManifest,variantManifest,localBuild:{indexHtml,assets},
    concurrency:options.concurrency?Number(options.concurrency):6,timeoutMs:options['timeout-ms']?Number(options['timeout-ms']):30000});
  const output=path.resolve(root,options.output||defaultOutput);
  await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n','utf8');
  console.log(JSON.stringify({status:report.status,version:expected.version,report:output,requests:report.requests,localBuildComparison:report.localBuildComparison,portraits:report.portraits,crimson:report.crimson,fronts:report.fronts,defeat:report.defeat,outcomes:report.outcomes,variants:report.variants,geometric:report.geometric,failures:report.failures}));
  if(report.status!=='passed')process.exitCode=1;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  main().catch(error=>{console.error(error.message);process.exitCode=1;});
}
