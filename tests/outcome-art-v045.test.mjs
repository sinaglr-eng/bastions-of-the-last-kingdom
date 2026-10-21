import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {OUTCOME_ART_REVISION,OUTCOME_ART_SCENES,createOutcomeArtSelector} from '../ui/outcome-art.js';
import {runResultModel,runResultMarkup} from '../ui/run-results.js';
import {Game} from '../game/core/game.js';
import {DeveloperConsoleSession} from '../game/core/developer-console.js';
import {campaignTowers,campaignEnemies,campaignRecipes,campaignWaves} from '../game/core/campaign-roster.js';

const read=file=>readFileSync(new URL('../'+file,import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifest=JSON.parse(read('public/assets/ui/results/v045/manifest.json'));
const archived=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(read('data/'+key+'.json'))]));
const data={...archived,towers:campaignTowers(archived.towers),enemies:campaignEnemies(archived.enemies),recipes:campaignRecipes(archived.recipes),waves:campaignWaves(archived.waves)};

test('all six outcome scenes resolve to the reviewed original PNGs with matching provenance and English alternatives',()=>{
  assert.equal(manifest.revision,OUTCOME_ART_REVISION);assert.equal(manifest.identities.length,4);assert.equal(manifest.preservedAssets.length,2);
  const assets=[...manifest.identities,...manifest.preservedAssets];
  for(const outcome of ['won','lost']){
    assert.equal(OUTCOME_ART_SCENES[outcome].length,3);
    for(const scene of OUTCOME_ART_SCENES[outcome]){
      const entry=assets.find(asset=>asset.id===scene.id);assert.ok(entry,scene.id);assert.equal(entry.outcome,outcome);assert.equal(entry.file,'public/'+scene.path);
      const bytes=read(entry.file);assert.equal(bytes.toString('hex',0,8),'89504e470d0a1a0a');assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],entry.dimensions);assert.equal(bytes.length,entry.bytes);assert.equal(hash(bytes),entry.sha256);
      assert.ok(scene.alt.length>70);assert.match(scene.alt,outcome==='won'?/celebrate above the defeated Lord Bernhard/:/victorious|triumph above the defeated/);
    }
  }
  for(const entry of manifest.identities){
    assert.equal(entry.references.length,5);assert.match(entry.prompt,/No gore|No wounds/);assert.ok(entry.review.includes('Inspected against'));
    for(const ref of entry.references)assert.equal(hash(read(ref.file)),ref.sha256,ref.file);
  }
  const legacy=manifest.preservedManifest;assert.equal(hash(read(legacy.file).toString('utf8').replace(/\r\n/g,'\n')),legacy.sha256);
});

test('presentation sampling covers every scene, separates outcome pools and excludes the preceding scene of the same outcome',()=>{
  const samples=[0,0,.999,0,0,.999],selector=createOutcomeArtSelector({random:()=>samples.shift()});
  const lose=Array.from({length:3},()=>selector(Object.freeze({phase:'lost'})));
  const win=Array.from({length:3},()=>selector(Object.freeze({phase:'won'})));
  assert.deepEqual(lose.map(art=>art.id),['defeat-01','defeat-02','defeat-03']);
  assert.deepEqual(win.map(art=>art.id),['victory-01','victory-02','victory-03']);
  for(const choices of [lose,win])for(let i=1;i<choices.length;i++)assert.notEqual(choices[i].id,choices[i-1].id);
});

test('each presentation bag shows all approved scenes once and never repeats across cycle boundaries',()=>{
  for(const value of [0,.4,.999,NaN,-3,9]){
    const selector=createOutcomeArtSelector({random:()=>value}),sequences={won:[],lost:[]};
    for(let i=0;i<30;i++)for(const phase of ['lost','won'])sequences[phase].push(selector({phase}).id);
    for(const phase of ['lost','won']){
      const ids=OUTCOME_ART_SCENES[phase].map(art=>art.id).sort(),sequence=sequences[phase];
      for(let start=0;start<sequence.length;start+=ids.length)assert.deepEqual(sequence.slice(start,start+ids.length).sort(),ids,`${phase} cycle ${start/ids.length}`);
      for(let i=1;i<sequence.length;i++)assert.notEqual(sequence[i],sequence[i-1],`${phase} consecutive results ${i}`);
    }
  }
});

test('reopening one ended run keeps the same scene and does not resample or access simulation RNG',()=>{
  let samples=0,rngReads=0;const events=new Set(),selector=createOutcomeArtSelector({random:()=>{samples++;return .7;}});
  const game=Object.freeze({phase:'lost',get rng(){rngReads++;throw Error('Presentation must not read Game.rng');},on:listener=>{events.add(listener);return ()=>events.delete(listener);}});
  const first=selector(game);for(let i=0;i<30;i++)assert.equal(selector(game),first);
  assert.equal(samples,1);assert.equal(rngReads,0);assert.equal(events.size,1,'Repeated result refreshes do not add event observers');assert.ok(Object.isFrozen(first));
});

test('a real Sandbox restart of the same Game and wave chooses a new scene, while repeated result review remains stable',async()=>{
  const game=new Game(data,{seed:4045}),session=new DeveloperConsoleSession(game);const selector=createOutcomeArtSelector({random:()=>0});
  try{
    await session.activate();session.runWave(50);game.end(false);const first=selector(game),firstModel=runResultModel(game),html=runResultMarkup(firstModel);
    for(let i=0;i<10;i++){assert.equal(selector(game),first);assert.equal(runResultModel(game).art,firstModel.art);assert.equal(runResultMarkup(runResultModel(game)),html);}
    session.restartWave();game.end(false);const second=selector(game),secondModel=runResultModel(game);
    assert.equal(game.round,50);assert.notEqual(second.id,first.id);assert.notEqual(secondModel.art.id,firstModel.art.id);
    assert.equal(selector(game),second);assert.equal(runResultModel(game).art,secondModel.art);
    assert.match(runResultMarkup(secondModel),new RegExp('data-outcome-art="'+secondModel.art.id+'"'));
  }finally{session.dispose();}
});

test('selecting and rendering result art changes no gameplay fields or seeded random draws',()=>{
  const game=new Game(data,{seed:2045}),control=new Game(data,{seed:2045});game.end(false);control.end(false);
  const state=()=>JSON.stringify({phase:game.phase,round:game.round,seed:game.seed,lives:game.lives,score:game.score,kills:game.kills,towers:game.towers,draws:game.draft.draws,gold:game.economy.gold,cp:game.commandPoints.value,elapsedSeconds:game.elapsedSeconds});
  const before=state(),keys=Object.keys(game);let samples=0;const selector=createOutcomeArtSelector({random:()=>{samples++;return .9;}});
  const first=selector(game);for(let i=0;i<25;i++){assert.equal(selector(game),first);runResultMarkup(runResultModel(game));}
  assert.equal(samples,1);assert.equal(state(),before);assert.deepEqual(Object.keys(game),keys);for(let i=0;i<10;i++)assert.equal(game.rng(),control.rng());
});

test('non-ended phases choose no illustration, and a later ended attempt is independently sampled',()=>{
  let samples=0;const selector=createOutcomeArtSelector({random:()=>{samples++;return .5;}}),game={phase:'build'};
  for(const phase of ['build','select','ready','combat']){game.phase=phase;assert.equal(selector(game),null);}assert.equal(samples,0);
  game.phase='lost';const first=selector(game);game.phase='build';assert.equal(selector(game),null);game.phase='lost';const second=selector(game);
  assert.notEqual(second.id,first.id);assert.equal(samples,2);
});
