import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,createReadStream} from 'node:fs';
import {Readable} from 'node:stream';
import {createHash} from 'node:crypto';
import {verifyUiPublic as verifyPublic,verifyPublic as verifyFullPublic,verifyGeometricPublic} from '../tools/verify-v048-public.mjs';

const bytes=path=>readFileSync(new URL(`../${path}`,import.meta.url));
const base='https://example.test/project/';
const manifestBytes=bytes('public/assets/ui/reference-cutouts/manifest.json'),manifest=JSON.parse(manifestBytes),manifestSha256=createHash('sha256').update(manifestBytes).digest('hex');
const crimsonBytes=bytes('public/assets/ui/portrait-variants/manifest.json'),crimsonManifest=JSON.parse(crimsonBytes);
const frontBytes=bytes('public/assets/ui/reference-enemy-fronts/manifest.json'),frontManifest=JSON.parse(frontBytes);
const defeatBytes=bytes('public/assets/ui/results/manifest.json'),defeatManifest=JSON.parse(defeatBytes);
const outcomeBytes=bytes('public/assets/ui/results/v044/manifest.json'),outcomeManifest=JSON.parse(outcomeBytes);
const variantBytes=bytes('public/assets/ui/results/v045/manifest.json'),variantManifest=JSON.parse(variantBytes);
const release={version:'0.4.8',uiRevision:'onboarding-hand-lightning-20261021-v9',performanceRevision:'ipad-render-input-20261019-v1',artRevision:'basic-defenders-v7',championArtRevision:'champions-v8',enemyArtRevision:'approved-enemies-v6',motionRevision:'approved-motion-v1',vfxRevision:'hand-lightning-20261021-v2',balanceRevision:'approved-b01-b06-20261018',uiPortraitRevision:manifest.revision,uiEnemyPortraitRevision:frontManifest.revision,uiOutcomeArtRevision:variantManifest.revision};
const javascript=Buffer.from('const Ap="reference-cutouts-20261016-v1",Cp="enemy-front-cutouts-20261018-v1";function portrait(id,enemy){return`assets/ui/${enemy?"reference-enemy-fronts":"reference-cutouts"}/${id}.png`};function outcome(won){return"assets/ui/results/v044/"+(won?"victory":"defeat")+".png"} /* catalog-basic-detail approved-motion-v1 approved-enemies-v6 assets/ui/results/v045/ outcome-scenes-20261018-v2 data-outcome-art catalog-index-tools atlas-book catalog-index-page catalog-reading-page warbands-atlas folio-construction-seal catalog-selected-heading warband-story run-result-victory-art mystery-placement Place a defender on the map folio-ingredient-recipe folio-champion-context data-effective-stats data-tutorial-choice Start tutorial Skip tutorial tutorial-layer */');
const css=Buffer.from('catalog-basic-ranks catalog-index-tools --folio-grain --folio-frame book-corners catalog-reading-page catalog-bookmark preparation-folio catalog-heading-pin is-compact-external folio-create-actions folio-decision-row run-result-defeat-art run-result-art mystery-placement crafting-order tutorial-welcome tutorial-layer');
const indexHtml=Buffer.from('<!doctype html>\n<html><head><script type="module" src="./assets/index-fixture.js"></script><link rel="stylesheet" href="./assets/index-fixture.css"></head></html>');
const localBuild={indexHtml,assets:{'assets/index-fixture.js':javascript,'assets/index-fixture.css':css}};

function fixture(overrides={}){
  const files=new Map([['release.json',Buffer.from(JSON.stringify(release))],['index.html',indexHtml],['assets/index-fixture.js',javascript],['assets/index-fixture.css',css],['assets/ui/reference-cutouts/manifest.json',manifestBytes],['assets/ui/portrait-variants/manifest.json',crimsonBytes],['assets/ui/reference-enemy-fronts/manifest.json',frontBytes],['assets/ui/results/manifest.json',defeatBytes],...manifest.identities.map(row=>[row.output.replace(/^public\//,''),bytes(row.output)]),[crimsonManifest.output.replace(/^public\//,''),bytes(crimsonManifest.output)],...frontManifest.identities.map(row=>[row.output.replace(/^public\//,''),bytes(row.output)]),[defeatManifest.file.replace(/^public\//,''),bytes(defeatManifest.file)]]);
  files.set('assets/ui/results/v044/manifest.json',outcomeBytes);
  for(const row of outcomeManifest.identities)files.set(row.file.replace(/^public\//,''),bytes(row.file));
  files.set('assets/ui/results/v045/manifest.json',variantBytes);
  for(const row of variantManifest.identities)files.set(row.file.replace(/^public\//,''),bytes(row.file));
  for(const [file,value]of Object.entries(overrides))files.set(file,value);
  const requests=[];
  const fetchImpl=async(url,options)=>{
    requests.push({url:String(url),options});
    const pathname=new URL(url).pathname.replace(/^\/project\//,''),body=files.get(pathname);
    const mime=pathname.endsWith('.png')?'image/png':pathname.endsWith('.js')?'application/javascript':pathname.endsWith('.css')?'text/css':pathname.endsWith('.html')?'text/html':'application/json';
    return new Response(body||'',{status:body?200:404,headers:{'content-type':mime}});
  };
  return {fetchImpl,requests};
}
const verify=options=>verifyPublic({base,manifest,manifestSha256,crimsonManifest,frontManifest,defeatManifest,outcomeManifest,variantManifest,localBuild,...options});

test('0.4.8 UI component verifies all historical assets, both 0.4.4 outcomes, four new variants and exact build with credential-free GETs',async()=>{
  const {fetchImpl,requests}=fixture(),report=await verify({fetchImpl});
  assert.equal(report.status,'passed');assert.equal(report.portraits.passed,136);assert.equal(report.portraits.exactHashes,136);assert.equal(report.crimson.passed,1);assert.equal(report.crimson.rgbaHeader,true);assert.deepEqual(report.crimson.dimensions,[426,422]);assert.equal(report.localBuildComparison.status,'passed');assert.equal(report.localBuildComparison.exactHashes,2);
  assert.equal(report.fronts.passed,50);assert.equal(report.fronts.exactHashes,50);assert.equal(report.fronts.rgbaHeaders,50);assert.equal(report.fronts.sourceMetadata,50);assert.equal(report.fronts.allFront,true);assert.equal(report.defeat.passed,1);assert.equal(report.defeat.sha256,defeatManifest.sha256);assert.deepEqual(report.defeat.dimensions,[1672,941]);
  assert.equal(report.outcomes.passed,2);assert.equal(report.outcomes.exactHashes,2);assert.deepEqual(report.outcomes.assets.map(row=>row.id),['defeat','victory']);assert.ok(report.outcomes.assets.every(row=>row.pngHeader&&row.dimensions[0]===1672&&row.dimensions[1]===941));
  assert.equal(report.variants.passed,4);assert.equal(report.variants.exactHashes,4);assert.deepEqual(report.variants.assets.map(row=>row.id),variantManifest.identities.map(row=>row.id).sort());
  assert.equal(requests.length,204);assert.ok(requests.every(({options,url})=>options.method==='GET'&&options.credentials==='omit'&&options.redirect==='error'&&options.cache==='no-store'&&url.startsWith(base)&&new URL(url).searchParams.has('verify')));
});

test('release metadata mismatch stops verification before any bulk assets or compiled requests',async()=>{
  const {fetchImpl,requests}=fixture({'release.json':Buffer.from(JSON.stringify({...release,version:'0.4.1'}))}),report=await verify({fetchImpl});
  assert.equal(report.status,'failed');assert.equal(requests.length,1);assert.equal(report.portraits.checked,0);assert.ok(report.failures.some(row=>row.error.includes('Expected version=0.4.8')));
});

test('0.4.8 requires its exact UI, hand-lightning VFX and performance revisions before requesting immutable assets',async()=>{
  for(const [key,value]of [['uiRevision','ipad-input-results-20261019-v8'],['vfxRevision',undefined],['vfxRevision','attack-ability-vfx-20261018-v1'],['performanceRevision',undefined],['performanceRevision','ipad-render-input-older']]){
    const {fetchImpl,requests}=fixture({'release.json':Buffer.from(JSON.stringify({...release,[key]:value}))}),report=await verify({fetchImpl});
    assert.equal(report.status,'failed');assert.equal(requests.length,1);assert.equal(report.portraits.checked,0);
    assert.ok(report.failures.some(row=>row.error.includes(`Expected ${key}=`)));
  }
});

test('LF, CRLF and Vite CRCRLF boundaries preserve JSON records and HTML while other HTML differences remain rejected',async()=>{
  for(const ending of ['\r\n','\r\r\n'])for(const changedSide of ['public','local']){
    const changed=Buffer.from(indexHtml.toString('utf8').replaceAll('\n',ending));
    const {fetchImpl}=fixture({'index.html':changedSide==='public'?changed:indexHtml,'assets/ui/reference-cutouts/manifest.json':Buffer.from(JSON.stringify(manifest,null,2)+'\n'),'assets/ui/reference-enemy-fronts/manifest.json':Buffer.from(JSON.stringify(frontManifest,null,2).replaceAll('\n',ending)),'assets/ui/results/manifest.json':Buffer.from(JSON.stringify(defeatManifest,null,2).replaceAll('\n',ending)),'assets/ui/results/v044/manifest.json':Buffer.from(JSON.stringify(outcomeManifest,null,2).replaceAll('\n',ending)),'assets/ui/results/v045/manifest.json':Buffer.from(JSON.stringify(variantManifest,null,2).replaceAll('\n',ending))}),report=await verify({fetchImpl,localBuild:{...localBuild,indexHtml:changedSide==='local'?changed:indexHtml}});
    assert.equal(report.status,'passed',`${changedSide} ${JSON.stringify(ending)}`);assert.equal(report.localBuildComparison.index,true);assert.equal(report.portraits.passed,136);
  }
  const {fetchImpl}=fixture({'index.html':Buffer.from(indexHtml.toString('utf8').replace('<html>','<html lang="en">'))}),changedMarkup=await verify({fetchImpl});
  assert.equal(changedMarkup.status,'failed');assert.equal(changedMarkup.localBuildComparison.index,false);assert.equal(changedMarkup.portraits.checked,0);assert.ok(changedMarkup.failures.some(row=>row.error.includes('Public index differs')));
});

test('exact local bundle comparison detects a stale compiled response even if all required UI markers still exist',async()=>{
  const {fetchImpl}=fixture({'assets/index-fixture.js':Buffer.concat([javascript,Buffer.from(' stale')])}),report=await verify({fetchImpl});
  assert.equal(report.status,'failed');assert.equal(report.localBuildComparison.status,'failed');assert.ok(report.failures.some(row=>row.error.includes('Public compiled bytes differ')));
});

test('compiled portrait templates need the exact namespace identities even when revisions and all local/public bytes still match',async()=>{
  assert.doesNotMatch(javascript.toString(),/assets\/ui\/reference-(?:cutouts|enemy-fronts)\//,'Vite composes the path through a template rather than emitting a complete literal URL.');
  for(const namespace of ['reference-cutouts','reference-enemy-fronts']){
    const changed=Buffer.from(javascript.toString().replace(`"${namespace}"`,`"missing-${namespace}"`)),{fetchImpl}=fixture({'assets/index-fixture.js':changed}),report=await verify({fetchImpl,localBuild:{...localBuild,assets:{...localBuild.assets,'assets/index-fixture.js':changed}}});
    assert.equal(report.status,'failed');assert.equal(report.localBuildComparison.status,'passed','Exact byte validation remains independent of required namespace identity.');assert.equal(report.portraits.passed,136);assert.equal(report.fronts.passed,50);assert.ok(report.uiMarkers.javascript.missing.includes(`"${namespace}"`));assert.ok(report.failures.some(row=>row.file==='compiled-javascript'));
  }
});

test('crimson portrait corruption fails independently of the unchanged original 136 portraits',async()=>{
  const damaged=Buffer.from(bytes(crimsonManifest.output));damaged[damaged.length-1]^=1;
  const {fetchImpl}=fixture({[crimsonManifest.output.replace(/^public\//,'')]:damaged}),report=await verify({fetchImpl});
  assert.equal(report.status,'failed');assert.equal(report.portraits.passed,136);assert.equal(report.crimson.passed,0);assert.ok(report.failures.some(row=>row.error.includes('Crimson PNG SHA-256 differs')));
});

test('missing final local build and changed immutable manifest are rejected before network requests',async()=>{
  for(const override of [{localBuild:null},{manifest:{...manifest,algorithm:'changed record'}}]){
    const {fetchImpl,requests}=fixture(),report=await verify({fetchImpl,...override});assert.equal(report.status,'failed');assert.equal(requests.length,0);
  }
});

test('invalid local FRONT view, source, RGB, alpha, identity, trim or historical metadata fails before any request',async()=>{
  const changes=[m=>{m.identities[0].view='LEFT';},m=>{m.identities[0].sourceSha256='0'.repeat(64);},m=>{m.identities[0].preservedRgb=false;},m=>{m.identities[0].transparentPixels++;},m=>{m.identities[1].id=m.identities[0].id;},m=>{m.identities[0].sourceRectangle[2]=1024;},m=>{m.identities[0].trimRectangle[2]=999;},m=>{m.historicalAssetsSha256[manifest.identities[0].output]='0'.repeat(64);},m=>{m.sha256Policy.jsonMetadata='exact-bytes';},m=>{m.sha256Policy.otherFiles='utf8-lf';},m=>{m.sourceManifestSha256='fbeb324675a49612afef8e600d0a311139d05daf4324002844255fc5f7c1f0c4';},m=>{m.historicalAssetsSha256['public/assets/ui/reference-portraits/manifest.json']='0'.repeat(64);}];
  for(const change of changes){const altered=structuredClone(frontManifest);change(altered);const {fetchImpl,requests}=fixture(),report=await verify({fetchImpl,frontManifest:altered});assert.equal(report.status,'failed');assert.equal(requests.length,0);assert.ok(report.failures.some(row=>/FRONT/.test(row.error)));}
});

test('a changed public FRONT manifest cannot silently replace the locally verified crop metadata',async()=>{
  const altered=structuredClone(frontManifest);altered.identities[0].reviewDecision+=' Changed record.';
  const {fetchImpl}=fixture({'assets/ui/reference-enemy-fronts/manifest.json':Buffer.from(JSON.stringify(altered))}),report=await verify({fetchImpl});
  assert.equal(report.status,'failed');assert.equal(report.portraits.checked,0);assert.equal(report.fronts.checked,0);assert.ok(report.failures.some(row=>row.error.includes('Public FRONT manifest differs')));
});

test('FRONT PNG corruption and a non-RGBA header fail independently of every historical portrait and defeat art',async()=>{
  const row=frontManifest.identities[0];
  for(const change of [buffer=>{buffer[buffer.length-1]^=1;},buffer=>{buffer[25]=2;}]){
    const damaged=Buffer.from(bytes(row.output));change(damaged);const {fetchImpl}=fixture({[row.output.replace(/^public\//,'')]:damaged}),report=await verify({fetchImpl});
    assert.equal(report.status,'failed');assert.equal(report.portraits.passed,136);assert.equal(report.crimson.passed,1);assert.equal(report.fronts.passed,49);assert.equal(report.defeat.passed,1);assert.ok(report.failures.some(failure=>failure.file===row.output.replace(/^public\//,'')&&/FRONT/.test(failure.error)));
  }
});

test('changed defeat prompt/provenance is rejected and invalid local asset identity fails before requests',async()=>{
  const altered={...defeatManifest,prompt:defeatManifest.prompt+' Changed prompt.'};
  const {fetchImpl}=fixture({'assets/ui/results/manifest.json':Buffer.from(JSON.stringify(altered))}),report=await verify({fetchImpl});
  assert.equal(report.status,'failed');assert.equal(report.portraits.checked,0);assert.equal(report.defeat.checked,0);assert.ok(report.failures.some(row=>row.error.includes('Public defeat manifest differs')));
  const next=fixture(),invalid=await verify({fetchImpl:next.fetchImpl,defeatManifest:{...defeatManifest,file:'public/assets/ui/results/other.png'}});assert.equal(invalid.status,'failed');assert.equal(next.requests.length,0);
});

test('defeat PNG corruption is rejected after the unchanged original, crimson and 50 FRONT portraits pass',async()=>{
  const damaged=Buffer.from(bytes(defeatManifest.file));damaged[damaged.length-1]^=1;
  const {fetchImpl}=fixture({[defeatManifest.file.replace(/^public\//,'')]:damaged}),report=await verify({fetchImpl});
  assert.equal(report.status,'failed');assert.equal(report.portraits.passed,136);assert.equal(report.crimson.passed,1);assert.equal(report.fronts.passed,50);assert.equal(report.defeat.passed,0);assert.ok(report.failures.some(row=>row.error.includes('Defeat PNG SHA-256 differs')));
});

test('both approved outcome identities retain complete prompts, generation settings, dimensions and all ordered input reference hashes before any GET',async()=>{
  const changes=[m=>{m.revision='other';},m=>{m.generator='other';},m=>{m.transparentBackground=true;},m=>{m.copiedWithoutPixelEdits=false;},m=>{m.identities.reverse();},m=>{m.identities.pop();},m=>{m.identities[0].file='public/assets/ui/results/v044/other.png';},m=>{m.identities[0].sha256='0'.repeat(64);},m=>{m.identities[1].bytes++;},m=>{m.identities[1].dimensions[0]--;},m=>{m.identities[0].prompt+=' Altered prompt.';},m=>{m.identities[1].review+=' Altered review.';},m=>{m.identities[1].sourceGenerationFile='other.png';},m=>{m.identities[0].references.pop();},m=>{m.identities[0].references[0].sha256='0'.repeat(64);},m=>{m.identities[1].references.reverse();}];
  for(const change of changes){
    const altered=structuredClone(outcomeManifest);change(altered);const {fetchImpl,requests}=fixture(),report=await verify({fetchImpl,outcomeManifest:altered});
    assert.equal(report.status,'failed');assert.equal(requests.length,0);assert.ok(report.failures.some(row=>/outcome/i.test(row.error)));
  }
});

test('a public outcome provenance change cannot replace an approved prompt or input reference despite unchanged artwork',async()=>{
  for(const change of [m=>{m.identities[0].prompt+=' Altered prompt.';},m=>{m.identities[1].references[0].sha256='0'.repeat(64);}]){
    const altered=structuredClone(outcomeManifest);change(altered);const {fetchImpl}=fixture({'assets/ui/results/v044/manifest.json':Buffer.from(JSON.stringify(altered))}),report=await verify({fetchImpl});
    assert.equal(report.status,'failed');assert.equal(report.portraits.checked,0);assert.equal(report.outcomes.checked,0);assert.ok(report.failures.some(row=>row.file==='assets/ui/results/v044/manifest.json'&&/outcome/i.test(row.error)));
  }
});

test('missing or corrupted new outcome PNGs and wrong dimensions fail independently of every historical image and the other outcome',async()=>{
  for(const row of outcomeManifest.identities)for(const fault of ['missing','bytes','dimensions']){
    const file=row.file.replace(/^public\//,''),damaged=Buffer.from(bytes(row.file));
    if(fault==='bytes')damaged[damaged.length-1]^=1;
    if(fault==='dimensions')damaged.writeUInt32BE(row.dimensions[0]-1,16);
    const {fetchImpl}=fixture({[file]:fault==='missing'?null:damaged}),report=await verify({fetchImpl});
    assert.equal(report.status,'failed');assert.equal(report.portraits.passed,136);assert.equal(report.crimson.passed,1);assert.equal(report.fronts.passed,50);assert.equal(report.defeat.passed,1);assert.equal(report.outcomes.checked,2);assert.equal(report.outcomes.passed,1);assert.equal(report.outcomes.exactHashes,1);assert.ok(report.failures.some(failure=>failure.file===file));
  }
});

test('compiled outcome path and both-result presentation markers remain necessary with exact public/local bytes and valid artwork',async()=>{
  for(const [kind,marker]of [['javascript','assets/ui/results/v045/'],['javascript','catalog-index-tools'],['css','catalog-index-tools'],['javascript','assets/ui/results/v044/'],['javascript','run-result-victory-art'],['javascript','Place a defender on the map'],['css','run-result-art'],['javascript','data-tutorial-choice'],['javascript','Start tutorial'],['javascript','Skip tutorial'],['javascript','tutorial-layer'],['css','tutorial-welcome'],['css','tutorial-layer']]){
    const source=kind==='css'?css:javascript,file=kind==='css'?'assets/index-fixture.css':'assets/index-fixture.js',changed=Buffer.from(source.toString().replace(marker,'missing-marker')),{fetchImpl}=fixture({[file]:changed}),report=await verify({fetchImpl,localBuild:{...localBuild,assets:{...localBuild.assets,[file]:changed}}});
    assert.equal(report.status,'failed');assert.equal(report.localBuildComparison.status,'passed');assert.equal(report.outcomes.passed,2);assert.ok(report.uiMarkers[kind].missing.includes(marker));
  }
});

test('new variant prompts, reference identities, historical pool and selection provenance are immutable before any request',async()=>{
  const changes=[
    m=>{m.revision='other';},m=>{m.generator='other';},m=>{m.transparentBackground=true;},m=>{m.copiedWithoutPixelEdits=false;},
    m=>{m.sha256Policy.jsonMetadata='exact-bytes';},m=>{m.sha256Policy.otherFiles='utf8-lf';},m=>{m.identities.reverse();},m=>{m.identities.pop();},
    m=>{m.identities[0].file='public/assets/ui/results/v045/other.png';},m=>{m.identities[1].outcome='won';},m=>{m.identities[2].bytes++;},m=>{m.identities[3].sha256='0'.repeat(64);},
    m=>{m.identities[0].prompt+=' Altered prompt.';},m=>{m.identities[1].review+=' Altered review.';},m=>{m.identities[2].sourceGenerationFile='other.png';},
    m=>{m.identities[0].references[0].sha256='0'.repeat(64);},m=>{m.identities[1].references.reverse();},m=>{m.identities[2].references[0].role='Other identity';},m=>{m.identities[3].subjects.defenders[0]='Other defender';},
    m=>{m.preservedAssets[0].sha256='0'.repeat(64);},m=>{m.preservedAssets[1].preservedWithoutChanges=false;},m=>{m.preservedManifest.sha256='0'.repeat(64);},
    m=>{m.selection.scenesPerOutcome=2;},m=>{m.selection.presentationRandomSource='Game.rng';},m=>{m.selection.cache='Other cache';},m=>{m.selection.consecutiveRepeatPolicy='Allow repeats';},
  ];
  for(const change of changes){
    const altered=structuredClone(variantManifest);change(altered);const {fetchImpl,requests}=fixture(),report=await verify({fetchImpl,variantManifest:altered});
    assert.equal(report.status,'failed');assert.equal(requests.length,0);assert.ok(report.failures.some(row=>/variant/i.test(row.error)));
  }
});

test('changed public variant provenance stops before assets while the original outcome manifest stays independently protected',async()=>{
  for(const change of [m=>{m.identities[0].prompt+=' Altered prompt.';},m=>{m.identities[2].references[2].sha256='0'.repeat(64);},m=>{m.preservedAssets[1].sourceIdentity='other';}]){
    const altered=structuredClone(variantManifest);change(altered);const {fetchImpl}=fixture({'assets/ui/results/v045/manifest.json':Buffer.from(JSON.stringify(altered))}),report=await verify({fetchImpl});
    assert.equal(report.status,'failed');assert.equal(report.variants.checked,0);assert.equal(report.outcomes.checked,0);assert.equal(report.portraits.checked,0);assert.ok(report.failures.some(row=>row.file==='assets/ui/results/v045/manifest.json'&&/variant/i.test(row.error)));
  }
});

test('all four new variant PNGs reject missing files, corrupted bytes and wrong geometry independently of historical assets',async()=>{
  for(const row of variantManifest.identities)for(const fault of ['missing','bytes','dimensions']){
    const file=row.file.replace(/^public\//,''),damaged=Buffer.from(bytes(row.file));
    if(fault==='bytes')damaged[damaged.length-1]^=1;
    if(fault==='dimensions')damaged.writeUInt32BE(row.dimensions[0]-1,16);
    const {fetchImpl}=fixture({[file]:fault==='missing'?null:damaged}),report=await verify({fetchImpl});
    assert.equal(report.status,'failed');assert.equal(report.portraits.passed,136);assert.equal(report.crimson.passed,1);assert.equal(report.fronts.passed,50);assert.equal(report.defeat.passed,1);assert.equal(report.outcomes.passed,2);assert.equal(report.variants.checked,4);assert.equal(report.variants.passed,3);assert.equal(report.variants.exactHashes,3);assert.ok(report.failures.some(failure=>failure.file===file));
  }
});

const geometricManifests=Object.fromEntries(['defenders','champions','enemies'].map(kind=>[kind,JSON.parse(bytes('public/assets/geometric/geometric-'+kind+'.json'))]));
const enemyProvenance=JSON.parse(bytes('public/assets/geometric/approved-enemies-v6/provenance.json'));
function geometricFixture({overrides={},modelFault=null,ending='\n'}={}){
  const requests=[],transfers={active:0,maximum:0,completed:0};
  const records=new Map(Object.entries(geometricManifests).map(([kind,manifest])=>['assets/geometric/geometric-'+kind+'.json',Buffer.from((JSON.stringify(manifest,null,2)+'\n').replaceAll('\n',ending))]));
  records.set('assets/geometric/approved-enemies-v6/provenance.json',Buffer.from((JSON.stringify(enemyProvenance,null,2)+'\n').replaceAll('\n',ending)));
  const fetchImpl=async(url,options)=>{
    requests.push({url:String(url),options});const file=new URL(url).pathname.replace(/^\/project\//,'');
    if(Object.hasOwn(overrides,file))return new Response(overrides[file]||'',{status:overrides[file]?200:404,headers:{'content-type':'application/json'}});
    if(records.has(file))return new Response(records.get(file),{headers:{'content-type':'application/json'}});
    const row=enemyProvenance.enemies.find(row=>row.file===file);if(!row||modelFault==='missing')return new Response('',{status:404});
    async function* stream(){
      transfers.active++;transfers.maximum=Math.max(transfers.maximum,transfers.active);let first=true;
      try{
        for await(const value of createReadStream(new URL('../public/'+file,import.meta.url),{highWaterMark:16384})){
          const chunk=Buffer.from(value);
          if(first&&modelFault==='header')chunk[0]^=1;
          if(first&&modelFault==='hash')chunk[20]^=1;
          first=false;yield chunk;
        }
        if(modelFault==='overrun')yield Buffer.from([0]);
      }finally{transfers.active--;transfers.completed++;}
    }
    const response=new Response(Readable.toWeb(Readable.from(stream())),{headers:{'content-type':'model/gltf-binary'}});
    response.arrayBuffer=()=>{throw Error('The verifier buffered a GLB rather than streaming it');};return response;
  };
  return {fetchImpl,requests,transfers};
}
const verifyGeometry=options=>verifyGeometricPublic({base,geometricManifests,enemyProvenance,...options});

test('geometric local manifest identity, motion and approval provenance mutations fail before any GET',async()=>{
  const changes=[
    m=>{m.defenders.motionRevision='other';},m=>{m.champions.entries[0].motion.kind='enemy';},m=>{m.enemies.entries[0].motion.id='other';},
    m=>{m.defenders.entries.pop();},m=>{m.champions.entries[0].assetSha256='0'.repeat(64);},m=>{m.enemies.entries[0].file='../other.glb';},m=>{m.enemies.entries[0].name='Changed identity';},
  ];
  for(const change of changes){const altered=structuredClone(geometricManifests);change(altered);const {fetchImpl,requests}=geometricFixture(),report=await verifyGeometry({fetchImpl,geometricManifests:altered});assert.equal(report.status,'failed');assert.equal(requests.length,0);}
  const provenanceChanges=[p=>{p.enemyApprovalSha256='0'.repeat(64);},p=>{p.motionApprovalSha256='0'.repeat(64);},p=>{p.materialDecisionSha256='0'.repeat(64);},p=>{p.enemies.pop();},p=>{p.enemies[0].bytes++;},p=>{p.enemies[0].approvedSource='other.glb';},p=>{p.motionSources[0].sha256='0'.repeat(64);},p=>{p.policy+=' Changed record.';},p=>{p.activeEnemyModelCount=136;},p=>{p.historicalArtworkInventory.unchanged=false;}];
  for(const change of provenanceChanges){const altered=structuredClone(enemyProvenance);change(altered);const {fetchImpl,requests}=geometricFixture(),report=await verifyGeometry({fetchImpl,enemyProvenance:altered});assert.equal(report.status,'failed');assert.equal(requests.length,0);}
});

test('geometric metadata permits formatting line endings while retaining every approved value',async()=>{
  for(const ending of ['\n','\r\n','\r\r\n']){
    const {fetchImpl}=geometricFixture({ending,modelFault:'missing'}),report=await verifyGeometry({fetchImpl});
    assert.equal(report.manifests.passed,3);assert.equal(report.provenance.passed,true);assert.equal(report.models.checked,1);assert.equal(report.models.passed,0);assert.equal(report.status,'failed','The deliberately absent first model does not turn metadata-only coverage into a full publication claim');
  }
});

test('changed public geometric manifests or approval records stop before large GLB transfers',async()=>{
  const cases=Object.entries(geometricManifests).map(([kind,manifest])=>['assets/geometric/geometric-'+kind+'.json',{...manifest,motionRevision:'other'}]);cases.push(['assets/geometric/approved-enemies-v6/provenance.json',{...enemyProvenance,policy:'Other approval'}]);
  for(const [file,record]of cases){const {fetchImpl,requests}=geometricFixture({overrides:{[file]:Buffer.from(JSON.stringify(record))}}),report=await verifyGeometry({fetchImpl});assert.equal(report.status,'failed');assert.equal(report.models.checked,0);assert.equal(requests.length,4);assert.ok(report.failures.some(failure=>failure.file===file));}
});

test('streaming GLB verification rejects missing, malformed, corrupt and oversized approved models and stops the bulk transfer',async()=>{
  for(const fault of ['missing','header','hash','overrun']){
    const {fetchImpl,requests,transfers}=geometricFixture({modelFault:fault}),report=await verifyGeometry({fetchImpl});
    assert.equal(report.status,'failed');assert.equal(report.manifests.passed,3);assert.equal(report.provenance.passed,true);assert.equal(report.models.checked,1);assert.equal(report.models.passed,0);assert.equal(requests.length,5);assert.ok(transfers.maximum<=1);assert.equal(transfers.active,0);assert.ok(report.failures.some(row=>row.file===enemyProvenance.enemies[0].file));
  }
});

test('full publication verifier retains all historical checks and streams all 54 exact approved models sequentially',async()=>{
  const ui=fixture(),geometry=geometricFixture(),fetchImpl=(url,options)=>new URL(url).pathname.includes('/assets/geometric/')?geometry.fetchImpl(url,options):ui.fetchImpl(url,options);
  const report=await verifyFullPublic({base,manifest,manifestSha256,crimsonManifest,frontManifest,defeatManifest,outcomeManifest,variantManifest,localBuild,geometricManifests,enemyProvenance,fetchImpl});
  assert.equal(report.status,'passed');assert.equal(report.requests,262);assert.equal(report.requests,ui.requests.length+geometry.requests.length);assert.equal(report.portraits.passed,136);assert.equal(report.fronts.passed,50);assert.equal(report.outcomes.passed,2);assert.equal(report.variants.passed,4);
  assert.equal(report.geometric.manifests.passed,3);assert.equal(report.geometric.provenance.passed,true);assert.equal(report.geometric.models.passed,54);assert.equal(report.geometric.models.exactHashes,54);assert.equal(report.geometric.models.glbHeaders,54);assert.equal(report.geometric.models.servedBytes,387872104);assert.equal(geometry.transfers.maximum,1);assert.equal(geometry.transfers.completed,54);assert.equal(geometry.transfers.active,0);
  assert.ok(geometry.requests.every(({options,url})=>options.method==='GET'&&options.credentials==='omit'&&options.redirect==='error'&&options.cache==='no-store'&&url.startsWith(base)&&new URL(url).searchParams.has('verify')));
});

test('aggregate verification rejects invalid local authority or a stale release before requesting geometry',async()=>{
  const ui=fixture(),geometry=geometricFixture(),fetchImpl=(url,options)=>new URL(url).pathname.includes('/assets/geometric/')?geometry.fetchImpl(url,options):ui.fetchImpl(url,options);
  const invalid=await verifyFullPublic({base,geometricManifests:{},enemyProvenance,fetchImpl});assert.equal(invalid.status,'failed');assert.equal(invalid.requests,0);assert.equal(ui.requests.length+geometry.requests.length,0);
  const stale=fixture({'release.json':Buffer.from(JSON.stringify({...release,motionRevision:'other'}))});
  const report=await verifyFullPublic({base,manifest,manifestSha256,crimsonManifest,frontManifest,defeatManifest,outcomeManifest,variantManifest,localBuild,geometricManifests,enemyProvenance,fetchImpl:(url,options)=>new URL(url).pathname.includes('/assets/geometric/')?geometry.fetchImpl(url,options):stale.fetchImpl(url,options)});
  assert.equal(report.status,'failed');assert.equal(report.requests,1);assert.equal(geometry.requests.length,0);
});
