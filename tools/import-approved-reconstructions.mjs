import {readFileSync,writeFileSync,copyFileSync,mkdirSync,readdirSync,existsSync,chmodSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const source=resolve(process.argv.find(v=>v.startsWith('--source='))?.slice(9)||'C:/Users/sinag/.codex/worktrees/4a36/Tower Defense game');
if(root===source)throw new Error('Import destination must differ from the approved authoring workspace');
const assets=join(root,'public/assets/geometric'),out=join(root,'output/design/reconstruction-integration-v7-v8');
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const write=(p,d)=>writeFileSync(p,JSON.stringify(d,null,2)+'\n','utf8');
const entries=d=>d.entries||d.assets||d.subjects;
function copyExact(from,to,sha){
  if(existsSync(to)&&hash(to)===sha)return;
  // Approved source files have Windows ReadOnly attributes. Remove that flag
  // only on an existing destination; the locked authoring workspace is untouched.
  if(existsSync(to))chmodSync(to,0o666);copyFileSync(from,to);
  if(hash(to)!==sha)throw new Error('Copied delivery hash mismatch '+to);
}
const basicDelivery='output/design/basic-defenders-reconstruction-v7',championDelivery='output/design/champions-reconstruction-v8';
const approval=read(join(source,'design/approvals/basic-defenders-v7-lock.json'));
if(approval.status!=='approved-and-locked')throw new Error('The approved v7 lock receipt is required');
const inventory=new Map(approval.files.map(row=>[row.path,row]));
const champPackage=read(join(source,championDelivery,'package-manifest.json'));
const champInventory=new Map(champPackage.files.map(row=>[row.file,row]));
const champRoster=new Map(read(join(source,championDelivery,'roster.json')).subjects.map(row=>[row.id,row]));
const mounted=new Set(['frostblade','roseguard','highking','crownofages']);
const creatures=new Set(['embercrown','worldfire','thunderheart','phoenix','starfall','griffinbomber']);
const machines=new Set(['kingsreach','stonewarden','fireballista','mechanicalgolem','emeraldgolem']);
const bows=new Set(['thornwarden','verdantguard','wyvernhunter','royalranger','kingsrangerguard','elvenking']);
const swords=new Set(['rimewatch','highking','crownofages','kingdomprotector']);
const sourceManifestPath=join(assets,'source-manifest.json'),originalSources=read(sourceManifestPath);
const receipts=[];
mkdirSync(out,{recursive:true});
const priorReceipt=join(out,'source-import-manifest.json');
const priorBounds=new Map(existsSync(priorReceipt)?read(priorReceipt).receipts.map(row=>[row.id,row.oldNativeBounds]):[]);
function publishReference(basic,delivery,id,reference){
  const sourceFile=join(source,basic?reference.path:delivery+'/'+reference.file),bytes=readFileSync(sourceFile);
  if(hash(sourceFile)!==reference.sha256)throw new Error('Approved concept hash differs '+id);
  const extension=bytes.subarray(0,8).toString('hex')==='89504e470d0a1a0a'?'.png':bytes[0]===0xff&&bytes[1]===0xd8?'.jpg':null;
  if(!extension)throw new Error('Unrecognized approved concept format '+id);
  const file='reconstruction-references/'+(basic?'defenders/':'champions/')+reference.sha256+extension;
  mkdirSync(join(assets,'reconstruction-references',basic?'defenders':'champions'),{recursive:true});copyExact(sourceFile,join(assets,file),reference.sha256);
  return file;
}
for(const category of ['defenders','champions']){
  const basic=category==='defenders',delivery=basic?basicDelivery:championDelivery;
  const folder=join(source,delivery,basic?'models':'refined/models');
  const current=read(join(assets,'geometric-'+category+'.json')),old=entries(current);
  const names=readdirSync(folder).filter(name=>name.endsWith('.glb'));
  if(names.length!==(basic?48:38)||old.length!==names.length)throw new Error('Unexpected roster count');
  const records=[];
  for(const oldRow of old){
    const id=oldRow.id;if(!names.includes(id+'.glb'))throw new Error('Missing approved game ID '+id);
    const metadataPath=join(source,delivery,basic?'final/'+id+'.json':'refined/metadata/'+id+'.json');
    const metadata=read(metadataPath),glb=join(folder,id+'.glb'),blend=join(folder,id+'.blend');
    const glbHash=hash(glb),nativeHash=hash(blend),expected=basic?metadata.export.sha256:metadata.validation.glbSha256;
    if(glbHash!==expected||nativeHash!==(basic?metadata.sceneSha256:metadata.blendSha256))throw new Error('Stale approved model metadata '+id);
    const receipt=basic?inventory.get(delivery+'/models/'+id+'.glb'):champInventory.get('refined/models/'+id+'.glb');
    if(receipt?.sha256!==glbHash)throw new Error('Approved package receipt differs '+id);
    const chosen=metadata.views.find(view=>view.view==='isometric')||metadata.views.find(view=>view.view==='front')||metadata.views[0];
    const render=basic?join(source,delivery,'final/renders',id,chosen.view+'.png'):join(source,delivery,chosen.file);
    const renderBytes=readFileSync(render);
    if(renderBytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||hash(render)!==chosen.imageSha256)throw new Error('Portrait must be the exact current approved PNG '+id);
    const file=category+'/'+id+'.glb',portrait='portraits/'+id+'.png';
    copyExact(glb,join(assets,file),glbHash);copyExact(render,join(assets,portrait),chosen.imageSha256);
    if(hash(join(assets,file))!==glbHash||hash(join(assets,portrait))!==chosen.imageSha256)throw new Error('Import byte mismatch '+id);
    const metrics=basic?metadata.technical:metadata.validation,role=basic?'humanoid':id==='rangermentor'?'spirit':mounted.has(id)?'mounted':creatures.has(id)?'creature':machines.has(id)?'construct':'humanoid';
    const style=basic?(id.startsWith('soldier-')?(id==='soldier-1'?'spear':'sword'):id.startsWith('archer-')?'bow':id.startsWith('runebreaker-')?'hammer':'staff'):
      id==='rangermentor'?'focus':bows.has(id)?'bow':swords.has(id)?'sword':['frostblade','roseguard'].includes(id)?'lance':['embercrown','worldfire','thunderheart','phoenix','starfall'].includes(id)?'breath':machines.has(id)?'siege':['royalmarshal','griffinbomber'].includes(id)?'bomb':'staff';
    const sourceRecord=originalSources.find(row=>row.id===id),reference=basic?metadata.sources[0]:metadata.references.find(row=>row.role==='current-primary')||metadata.references[0];
    const publishedReferenceFile=publishReference(basic,delivery,id,reference);
    const reconstruction={revision:basic?'basic-defenders-v7':'champions-v8',sourceDelivery:delivery,sourceGlbFile:delivery+'/'+(basic?'models':'refined/models')+'/'+id+'.glb',sourceNativeFile:delivery+'/'+(basic?'models':'refined/models')+'/'+id+'.blend',sourceNativeSha256:nativeHash,sourceMetadataSha256:hash(metadataPath),sourceRenderSha256:chosen.imageSha256,portraitView:chosen.view,reviewedViews:metadata.views.length,nativeFront:basic?'+Y':'-Y',nativeRight:basic?'+X':'-X',attackStyle:style,role,presentationScale:role==='humanoid'&&!basic?1.6:1,staticAuthoringDelivery:!basic,approvedAuthoringReference:reference,limitations:basic?'Rigid source skin; gameplay animation is a separate runtime adaptation.':'Static approved source reconstruction; conservative runtime articulation cannot deform unified body/limb surfaces.'};
    reconstruction.sourceGlbSha256=glbHash;reconstruction.publishedReferenceFile=publishedReferenceFile;
    const row={id,name:metadata.name,kind:'tower',family:basic?metadata.family:id,tier:basic?metadata.rank:1,file,portrait,assetSha256:glbHash,portraitSha256:chosen.imageSha256,source:sourceRecord?.file,sourceSha256:sourceRecord?.sha256,locomotion:id==='starfall'||id==='mechanicalgolem'?'flying':mounted.has(id)||creatures.has(id)&&id!=='starfall'?'quadruped':'biped',attackStyle:style,metrics:{triangles:metrics.triangles,meshes:metrics.meshes,boundsMin:metrics.boundsMin,boundsMax:metrics.boundsMax,boundsSize:metrics.boundsSize},reconstruction};
    row.source='assets/geometric/'+publishedReferenceFile;row.sourceSha256=reference.sha256;if(id==='rangermentor')row.locomotion='flying';
    records.push(row);receipts.push({id,file,sourceGlbFile:reconstruction.sourceGlbFile,sourceGlbSha256:glbHash,copiedGlbSha256:hash(join(assets,file)),sourceNativeSha256:nativeHash,portrait,sourcePortrait:render.slice(source.length+1).replaceAll('\\','/'),portraitSha256:chosen.imageSha256,oldNativeBounds:oldRow.qa?.boundsSize||oldRow.metrics?.boundsSize,newNativeBounds:metrics.boundsSize,presentationScale:reconstruction.presentationScale,role,attackStyle:style});
    receipts.at(-1).oldNativeBounds=priorBounds.get(id)||receipts.at(-1).oldNativeBounds;receipts.at(-1).publishedReferenceFile=publishedReferenceFile;receipts.at(-1).approvedAuthoringReference=reference;
    if(sourceRecord){
      sourceRecord.historicalReference??=Object.fromEntries(Object.entries(sourceRecord).filter(([key])=>key!=='currentModelReconstruction'));
      sourceRecord.file=row.source;sourceRecord.publicPath=row.source;sourceRecord.sha256=reference.sha256;
      sourceRecord.currentModelReconstruction={revision:reconstruction.revision,assetSha256:glbHash,approvedAuthoringReference:reference,publishedReferenceFile};
    }
  }
  write(join(assets,'geometric-'+category+'.json'),{revision:basic?'approved-basic-defenders-v7':'approved-champions-v8',language:'en',sourceManifestSha256:hash(join(source,delivery,basic?'final/manifest.json':'package-manifest.json')),entries:records});
}
write(sourceManifestPath,originalSources);
const names=Object.fromEntries(['defenders','champions'].flatMap(category=>read(join(assets,'geometric-'+category+'.json')).entries).filter(row=>row.tier===1).map(row=>[row.family,row.reconstruction.revision==='basic-defenders-v7'?row.name.replace(/\s+(?:I|II|III|IV|V|VI)$/,''):row.name]));
if(Object.keys(names).length!==46)throw new Error('Expected 46 approved family display names');
const descriptions=Object.fromEntries([...champRoster].map(([id,row])=>[id,row.description]));
writeFileSync(join(root,'game/core/approved-defender-names.js'),'// Display names from the approved immutable V7/V8 reconstruction manifests.\n// Stable family IDs, balance statistics and recipes are unchanged.\nexport const APPROVED_DEFENDER_NAMES = Object.freeze('+JSON.stringify(names,null,2)+');\n\n// Current V8 roster descriptions copied verbatim; historical data stays intact.\nexport const APPROVED_CHAMPION_DESCRIPTIONS = Object.freeze('+JSON.stringify(descriptions,null,2)+');\n','utf8');
write(join(out,'source-import-manifest.json'),{stage:'Approved source bytes imported; runtime verification pending',sourceWorkspace:source,models:receipts.length,originalsModified:false,basicApprovalReceiptSha256:hash(join(source,'design/approvals/basic-defenders-v7-lock.json')),basicApprovedArchive:approval.approvedArchive,championPackageAudit:read(join(source,'output/design/champions-38-refined-models-v8-package-audit.json')),receipts});
console.log(JSON.stringify({models:receipts.length,glbBytes:receipts.reduce((n,row)=>n+readFileSync(join(assets,row.file)).length,0),receipt:'output/design/reconstruction-integration-v7-v8/source-import-manifest.json'}));
