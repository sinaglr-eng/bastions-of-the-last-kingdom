import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {OUTCOME_ART_REVISION,OUTCOME_ART_SCENES} from '../ui/outcome-art.js';
import {runResultModel,runResultMarkup} from '../ui/run-results.js';
import {siteUrl} from '../game/site-url.js';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignEnemies,campaignRecipes,campaignWaves} from '../game/core/campaign-roster.js';

const read=file=>readFileSync(new URL('../'+file,import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(read('public/assets/ui/results/v049/manifest.json'));
const sourceFile='output/design/followup-v048-20261021/art-review/manifest.json',sourceBytes=read(sourceFile),source=JSON.parse(sourceBytes);
const added=OUTCOME_ART_SCENES.lost.filter(scene=>scene.path.startsWith('assets/ui/results/v049/'));

test('all ten approved illustrations retain exact original candidate pixels, prompts, reviews and ordered input references',()=>{
  assert.equal(OUTCOME_ART_REVISION,'outcome-scenes-20261022-v3');
  assert.equal(manifest.revision,'approved-defeat-scenes-20261022-v1');assert.equal(manifest.approval,'approved');assert.equal(manifest.approvedCount,10);
  assert.deepEqual(manifest.approvalEvidence,{date:'2026-10-22',decision:'Schvaluji sceny',scope:'All ten 0.4.8 defeat candidates'});
  assert.equal(manifest.sourceManifest,sourceFile);assert.equal(manifest.sourceManifestSha256,hash(sourceBytes));
  assert.equal(source.approval,'pending');assert.equal(source.runtimeIntegration,false,'The historical candidate record is preserved verbatim.');
  assert.equal(source.candidates.length,10);assert.equal(manifest.identities.length,10);assert.equal(added.length,10);
  assert.equal(new Set(manifest.identities.map(row=>row.id)).size,10);
  for(const candidate of source.candidates){
    const id='defeat-v049-'+candidate.id,row=manifest.identities.find(row=>row.id===id),scene=added.find(scene=>scene.id===id);
    assert.ok(row,id);assert.ok(scene,id);assert.equal(row.sourceCandidateId,candidate.id);assert.equal(row.outcome,'lost');assert.equal(row.approval,'approved');
    assert.equal(row.file,'public/assets/ui/results/v049/'+candidate.file);assert.equal(scene.path,row.file.slice('public/'.length));assert.equal(scene.outcome,'lost');
    for(const [key,value]of Object.entries(candidate))if(!['id','file','approval'].includes(key))assert.deepEqual(row[key],value,`${id} original ${key}`);
    const bytes=read(row.file),reviewed=read(path.posix.dirname(sourceFile)+'/'+candidate.file);
    assert.deepEqual(bytes,reviewed,id+' reviewed pixels');assert.equal(hash(bytes),candidate.sha256);assert.equal(bytes.length,candidate.bytes);
    assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],candidate.dimensions);
    assert.equal(row.copiedWithoutPixelEdits,true);assert.equal(row.references.length,5);
    for(const reference of row.references)assert.equal(hash(read(reference.file)),reference.sha256,`${id} ${reference.file}`);
    assert.ok(scene.alt.startsWith(candidate.title+': '));assert.ok(scene.alt.length>100);assert.match(scene.alt,/defeated/);assert.ok(Object.isFrozen(scene));
  }
  assert.equal(OUTCOME_ART_SCENES.lost.length,13);assert.equal(OUTCOME_ART_SCENES.won.length,3);
  const all=Object.values(OUTCOME_ART_SCENES).flat();assert.equal(new Set(all.map(scene=>scene.id)).size,16);assert.equal(new Set(all.map(scene=>scene.path)).size,16);
});

test('each approved scene renders in the existing defeat result without changing gameplay, scores, review stability or seeded RNG',()=>{
  const archived=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(read('data/'+key+'.json'))]));
  const data={...archived,towers:campaignTowers(archived.towers),enemies:campaignEnemies(archived.enemies),recipes:campaignRecipes(archived.recipes),waves:campaignWaves(archived.waves)};
  const game=new Game(data,{seed:4901}),control=new Game(data,{seed:4901});game.end(false);control.end(false);
  const state=()=>JSON.stringify({phase:game.phase,round:game.round,seed:game.seed,lives:game.lives,score:game.score,kills:game.kills,towers:game.towers,draws:game.draft.draws,gold:game.economy.gold,cp:game.commandPoints.value,elapsedSeconds:game.elapsedSeconds});
  const before=state(),model=runResultModel(game),stableArt=model.art;
  for(const art of added){
    const html=runResultMarkup({...model,art});assert.ok(html.includes(`data-outcome-art="${art.id}"`));assert.ok(html.includes(`src="${siteUrl(art.path)}"`));
    assert.match(html,/run-result-defeat-art/);assert.match(html,/Defeated on wave 1/);assert.match(html,/data-action="restart"/);assert.match(html,/data-action="result-review"/);
    assert.equal(runResultModel(game).art,stableArt,'Rendering another explicit scene does not change the ended attempt’s chosen scene.');
  }
  assert.equal(state(),before);for(let i=0;i<20;i++)assert.equal(game.rng(),control.rng());
});
