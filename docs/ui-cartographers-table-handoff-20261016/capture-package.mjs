// Documentation capture only. Writes solely to this handoff directory.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../../game/core/campaign-roster.js';
import {towerStats} from '../../game/core/math.js';
const here=fileURLToPath(new URL('./',import.meta.url)),repo=fileURLToPath(new URL('../../',import.meta.url)),gallery='output/design/ui-cartographers-table-20261016-v2';
const read=f=>JSON.parse(fs.readFileSync(path.join(repo,f))),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const write=(f,data)=>fs.writeFileSync(path.join(here,f),JSON.stringify(data,null,2)+'\n');
for(const dir of ['reference-ui','reference-art','evidence','prompts','before-approval'])fs.mkdirSync(path.join(here,dir),{recursive:true});
const selection=read(gallery+'/selected-files.json'),review=read(gallery+'/current-review.json');
const ui=[];
for(const [key,file]of Object.entries(selection)){const source=gallery+'/'+file,destination='reference-ui/'+key+'.png';fs.copyFileSync(path.join(repo,source),path.join(here,destination));ui.push({key,source,file:destination,sha256:hash(path.join(repo,source)),role:'Approved interface layout reference; character and scenery pixels are illustrative and must not replace approved game art'});}
write('SELECTED_CONCEPTS.json',{date:'2026-10-16',count:ui.length,approval:'User accepted current UI direction and three reviews; latest scope restricts work to UI and source-art previews',screens:ui});
for(const file of ['current-review.json','README.md','design-notes.md','index.html'])fs.copyFileSync(path.join(repo,gallery,file),path.join(here,'before-approval',file));
for(const [source,destination]of [
 [gallery+'/prompts.json','prompts/original-generation.json'],[gallery+'/review.json','evidence/original-review.json'],[gallery+'/runtime-reference.json','evidence/original-runtime.json'],
 ...['01','02','03'].flatMap(n=>[['prompts.json','prompts/review-'+n+'-image-edits.json'],['refinement-prompts.json','prompts/review-'+n+'-refinements.json'],['user-comments.json','evidence/review-'+n+'-original-comments.json'],['review.json','evidence/review-'+n+'.json']].map(([f,d])=>[gallery+'/reviews/20261016-comments-'+n+'/'+f,d])),
 [gallery+'/reviews/20261016-comments-01/recipe-progress-reference.json','evidence/recipe-progress.json'],[gallery+'/reviews/20261016-comments-02/runtime-reference.json','evidence/combination-options.json'],[gallery+'/reviews/20261016-comments-03/runtime-reference.json','evidence/rank-statistics.json']
 ])if(fs.existsSync(path.join(repo,source)))fs.copyFileSync(path.join(repo,source),path.join(here,destination));
const towers=campaignTowers(read('data/towers.json')),recipes=campaignRecipes(read('data/recipes.json')),enemies=campaignEnemies(read('data/enemies.json')),waves=campaignWaves(read('data/waves.json'));
const sourceManifest=read('public/assets/geometric/source-manifest.json'),enemyManifest=read('public/assets/geometric/geometric-enemies.json').entries;
const portraitRows=[];
for(const item of sourceManifest){
 const enemy=enemyManifest.find(e=>e.id===item.id),expected=enemy?.sourceSha256||item.sha256;
 const galleryFile='public/geometric-modeling-references-v2/approved/'+item.category+'/'+item.id+'.png';
 const candidates=[item.publicPath?'public/'+item.publicPath:null,item.file.startsWith('assets/')?'public/'+item.file:null,...['public/geometric-modeling-references-v2/approved/','public/geometric-turnarounds-v2/','public/geometric-turnarounds-v1/'].map(p=>p+item.category+'/'+item.id+'.png')].filter(Boolean);
 const source=candidates.find(p=>fs.existsSync(path.join(repo,p))&&hash(path.join(repo,p))===expected);assert(source,'Missing exact approved authoring raster '+item.id);
 const file='reference-art/'+expected+'.png';if(!fs.existsSync(path.join(here,file)))fs.copyFileSync(path.join(repo,source),path.join(here,file));
 const basic=item.category==='towers',family=basic?item.id.replace(/-\d+$/,''):item.id,tier=basic?Number(item.id.match(/-(\d+)$/)[1]):1;
 const name=item.category==='enemies'?(enemies[item.id]?.name||item.id):towers[family]?.name||item.id;
 const image=fs.readFileSync(path.join(here,file));assert.equal(image.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
 portraitRows.push({id:item.id,category:item.category,family,tier,name:basic?name+' '+['I','II','III','IV','V','VI'][tier-1]:name,source,file,sha256:expected,width:image.readUInt32BE(16),height:image.readUInt32BE(20),provenance:item.currentModelReconstruction?.approvedAuthoringReference||{kind:'Original geometric turnaround',source:enemy?.source||item.file,sha256:expected},latestGalleryAlias:{file:galleryFile,exists:fs.existsSync(path.join(repo,galleryFile)),matchesAuthoringSource:fs.existsSync(path.join(repo,galleryFile))&&hash(path.join(repo,galleryFile))===expected},plannedUiFile:'assets/ui/reference-portraits/'+item.id+'.png',cropPlan:{status:'Source verified; exact per-identity crop must be authored and visually checked during implementation',preference:basic||item.category==='enemies'?'Complete FRONT or 3/4 FRONT figure from its labelled panel; preserve all equipment':'Exact named figure on the current model authoring concept board; never assume this is a six-view sheet',forbid:['Whole multi-character board as portrait','Mirroring','Model render or WebGL snapshot','Generative redraw','Different family/rank fallback']}});
}
assert.equal(portraitRows.length,136);
write('PORTRAIT_SOURCES.json',{date:'2026-10-16',scope:'Original approved geometric reference illustration pixels only; no generated portrait crops or production asset changes in this handoff',count:portraitRows.length,uniqueFiles:new Set(portraitRows.map(r=>r.file)).size,latestGalleryAliasesMatching:portraitRows.filter(r=>r.latestGalleryAlias.matchesAuthoringSource).length,precedence:'Exact approved source tied to current model takes precedence over a different gallery revision. All differences are explicit; do not silently redraw models or substitute another art revision.',rows:portraitRows});
write('RUNTIME_REFERENCE.json',{date:'2026-10-16',version:read('package.json').version,basicFamilies:Object.entries(towers).filter(([,s])=>!s.advanced).map(([family])=>family),fixedChampions:Object.entries(towers).filter(([,s])=>s.advanced).map(([family,s])=>({family,name:s.name})),recipes:recipes.map(r=>({id:r.id,name:towers[r.resultFamily||r.id]?.name,ingredients:r.ingredients})),waves:waves.map(w=>({id:w.id,name:w.name,count:w.count,boss:!!w.boss})),rankSamples:Object.fromEntries(['archer','mage','frostwarden'].map(family=>[family,Array.from({length:6},(_,i)=>{const s=towerStats({family,tier:i+1},{towers,balance:read('data/balance.json')});return {rank:i+1,type:s.type,damage:s.damage,baseDirectDps:s.damage/s.interval,range:s.range,interval:s.interval,slow:s.slow||0,slowDuration:s.slowDuration||0,cleave:s.cleave||0,cleaveRadius:s.cleaveRadius||0};})]))});
const files=[];function walk(folder){for(const e of fs.readdirSync(path.join(repo,folder),{withFileTypes:true})){const f=folder+'/'+e.name;if(e.isDirectory())walk(f);else files.push(f);}}
for(const d of ['game','ui','data','public/assets'])walk(d);
for(const f of ['package.json','pnpm-lock.yaml','vite.config.js','.github/workflows/pages.yml'])if(fs.existsSync(path.join(repo,f)))files.push(f);
write('SOURCE_BASELINE.json',{date:'2026-10-16',version:read('package.json').version,role:'Preparation snapshot, not a claim that future authorized implementation must keep UI files unchanged. Future code may change approved UI integration; protected models/audio/map/gameplay retain identity.',count:files.length,files:Object.fromEntries(files.sort().map(f=>[f,hash(path.join(repo,f))]))});
write('CAPTURE_RECEIPT.json',{date:'2026-10-16',selectedScreens:ui.length,portraitIdentities:portraitRows.length,uniqueSourceRasters:new Set(portraitRows.map(r=>r.file)).size,allOriginalHashesVerified:true,latestGalleryAliasDifferences:portraitRows.filter(r=>!r.latestGalleryAlias.matchesAuthoringSource).map(r=>r.id),productionFilesChangedByCapture:false});
console.log(JSON.stringify({selectedScreens:ui.length,portraitIdentities:portraitRows.length,uniqueSourceRasters:new Set(portraitRows.map(r=>r.file)).size,baselineFiles:files.length,version:read('package.json').version}));
