import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {RunStatistics} from '../game/core/run-statistics.js';
import {DeveloperConsoleSession} from '../game/core/developer-console.js';
import {campaignTowers,campaignEnemies,campaignRecipes,campaignWaves} from '../game/core/campaign-roster.js';
import {RunResultFacts,runResultModel,runResultMarkup,endedRunReviewMarkup} from '../ui/run-results.js';
import {resultLeaderboardMarkup,connectResultLeaderboard} from '../ui/leaderboard.js';

const archived=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...archived,towers:campaignTowers(archived.towers),enemies:campaignEnemies(archived.enemies),recipes:campaignRecipes(archived.recipes),waves:campaignWaves(archived.waves)};
function harness(limit=10){
  const game=new Game(data,{seed:24,waveLimit:limit}),tracker=new RunStatistics(game,{id:'result-fixture',clock:()=>0}),facts=new RunResultFacts(),off=game.on((type,payload)=>facts.event(type,payload,game));let cell=0;
  return {game,tracker,facts,build(){game.draft.roundForced={family:'archer',tier:1};while(game.phase==='build'){assert.ok(cell<37*37);game.place(cell%37,Math.floor(cell++/37));}game.select(game.roundCandidates[0].tower.id);assert.equal(game.keep(),true);assert.equal(game.startCombat(),true);game.combat.spawnQueue=[];},leak({name='Recorded invader',leak=1,flying=false}={}){const enemy=game.combat.spawn('host_01',{variant:{name,leak,flying}});enemy.pathIndex=enemy.route.length;game.tick(.01);return enemy;},model(){return runResultModel(game,{tracker,facts});},dispose(){off();tracker.dispose();}};
}

test('a real second-wave defeat separates one completed wave and records the actual last flying leak with clamped health loss',()=>{
  const h=harness();try{
    h.build();h.game.completeWave();assert.equal(h.game.round,2);h.game.lives=3;h.build();const enemy=h.leak({name:'Bat Scouts · Moon Clan',leak:7,flying:true});
    assert.equal(h.game.phase,'lost');const model=h.model();assert.equal(model.completedWaves,1);assert.equal(model.defeatWave,2);assert.equal(model.finalWaveLeaks,1);assert.equal(model.finalWaveHealthLost,3);assert.equal(model.totalLeaks,1);assert.equal(model.lastLeak.name,enemy.name);assert.equal(model.lastLeak.healthLost,3);assert.equal(model.lastLeak.flying,true);
    const html=runResultMarkup(model);assert.match(html,/assets\/ui\/results\/v044\/defeat\.png/);assert.doesNotMatch(html,/v044\/victory\.png/);assert.match(html,/1 <span>waves completed/);assert.match(html,/Defeated on wave 2/);assert.match(html,/1 invader reached the keep · 3 keep health lost/);assert.match(html,/Last leak: Bat Scouts · Moon Clan · Flying/);assert.doesNotMatch(html,/need.*(?:archer|army)|caused by|weak defense/i);
  }finally{h.dispose();}
});

test('each observed leak counts actual health damage separately from recovered health and duplicate event delivery',()=>{
  const h=harness();try{
    h.game.lives=10;h.build();h.game.combat.spawnQueue=[{time:1e9,type:'host_01'}];const first=h.leak({name:'First invader',leak:2});assert.equal(h.game.lives,8);assert.equal(h.game.phase,'combat');
    h.facts.event('leak',{enemy:first},h.game);assert.equal(h.facts.waves.get(1).leaks,1,'a repeated UI delivery does not invent a second leak');
    h.game.lives=10;h.game.emit('recover',{source:h.game.selection});h.leak({name:'Last invader',leak:20});const model=h.model();assert.equal(model.finalWaveLeaks,2);assert.equal(model.finalWaveHealthLost,12);assert.equal(model.lastLeak.healthLost,10);assert.equal(model.completedWaves,0);
  }finally{h.dispose();}
});

test('actual 10-wave and 50-wave victories include the completed final wave and never display a defeat wave',()=>{
  for(const limit of [10,50]){
    const h=harness(limit);try{
      for(let round=1;round<=limit;round++){h.build();h.game.completeWave();}
      const model=h.model();assert.equal(model.won,true);assert.equal(model.completedWaves,limit);assert.equal(model.defeatWave,null);assert.equal(h.facts.completedWaves.size,limit);assert.equal(h.tracker.waves.length,limit);assert.equal(h.tracker.waves.at(-1).completed,true);assert.equal(model.finalWaveLeaks,0);
      const html=runResultMarkup(model);assert.match(html,/assets\/ui\/results\/v044\/victory\.png/);assert.doesNotMatch(html,/v044\/defeat\.png/);assert.match(html,new RegExp(`Campaign completed · ${limit} waves`));assert.doesNotMatch(html,/Defeated on wave/);
    }finally{h.dispose();}
  }
});

test('actual Sandbox jumps and restarted losses count only completed wave IDs, including a later final-wave victory',async()=>{
  const h=harness();let session;
  try{
    h.build();h.game.completeWave();h.build();h.game.completeWave();assert.deepEqual([...h.facts.completedWaves],[1,2]);assert.equal(h.tracker.waves.length,2);
    session=new DeveloperConsoleSession(h.game);await session.activate();session.setResources({lives:1});session.runWave(10);h.game.combat.spawnQueue=[];h.leak({name:'First jumped-wave leak',leak:1});
    let model=h.model();assert.equal(h.game.phase,'lost');assert.equal(model.completedWaves,2,'Jumping to wave 10 did not complete waves 3–9');assert.equal(model.defeatWave,10);assert.equal(model.lastLeak.name,'First jumped-wave leak');assert.equal(runResultModel(h.game,{tracker:h.tracker}).completedWaves,2,'Recorded statistics also outrank the Sandbox round counter');
    session.restartWave();h.game.combat.spawnQueue=[];h.leak({name:'Restarted jumped-wave leak',leak:1});model=h.model();assert.equal(model.completedWaves,2);assert.equal(model.finalWaveLeaks,1);assert.equal(model.lastLeak.name,'Restarted jumped-wave leak','A new real wave resumes factual recording after the previous ended attempt');
    session.restartWave();h.game.combat.spawnQueue=[];h.game.completeWave();assert.deepEqual([...h.facts.completedWaves],[1,2,10]);session.runWave(50);h.game.combat.spawnQueue=[];h.game.completeWave();
    model=h.model();assert.equal(model.won,true);assert.equal(model.completedWaves,4);assert.equal(model.defeatWave,null);assert.equal(model.finalWaveLeaks,0);assert.equal(model.lastLeak,null);assert.equal(h.tracker.waves.length,2,'Developer attempts do not alter ordinary statistics history');
    const html=runResultMarkup(model),review=endedRunReviewMarkup(model);assert.match(html,/4 <span>waves completed/);assert.match(html,/Final wave completed · Wave 50/);assert.doesNotMatch(html,/Campaign completed · 50 waves/);assert.match(review,/Final wave completed/);assert.doesNotMatch(review,/<h2>Campaign completed/);
    session.restartWave();h.game.combat.spawnQueue=[];h.game.completeWave();assert.equal(h.model().completedWaves,4,'Replaying an already completed wave does not invent a fifth distinct completed wave');
  }finally{session?.dispose();h.dispose();}
});

test('a real Sandbox loss without earlier completions reports zero from the available observer, and ordinary fallback remains intact',async()=>{
  const h=harness();let session;
  try{
    session=new DeveloperConsoleSession(h.game);await session.activate();session.setResources({lives:1});session.runWave(10);h.game.combat.spawnQueue=[];h.leak();assert.equal(h.model().completedWaves,0);assert.equal(runResultModel(h.game,{facts:h.facts}).completedWaves,0);assert.equal(runResultModel(h.game,{tracker:h.tracker}).completedWaves,0);
    const ordinary=harness();try{ordinary.build();ordinary.game.completeWave();ordinary.build();ordinary.game.lives=1;ordinary.leak();assert.equal(runResultModel(ordinary.game).completedWaves,1,'The normal sequential Game invariant remains a fallback when neither recorder was supplied');}finally{ordinary.dispose();}
  }finally{session?.dispose();h.dispose();}
});

test('results and ended review stay read-only, preserve tracker sequence and RNG, and expose explicit retry/return actions',()=>{
  const h=harness(),control=harness();try{
    for(const run of [h,control]){run.build();run.game.lives=1;run.leak();}
    const before=JSON.stringify({towers:h.game.towers,draws:h.game.draft.draws,phase:h.game.phase,round:h.game.round,lives:h.game.lives,cp:h.game.commandPoints.value,score:h.game.score,elapsed:h.game.elapsedSeconds}),sequence=h.tracker.sequence,waves=JSON.stringify(h.tracker.waves),facts=JSON.stringify([...h.facts.waves].map(([id,wave])=>[id,{...wave,leakIds:[...wave.leakIds]}]));
    for(let update=0;update<20;update++){const model=h.model();runResultMarkup(model,{leaderboardMarkup:resultLeaderboardMarkup()});const review=endedRunReviewMarkup(model);assert.match(review,/Read-only battlefield/);assert.match(review,/data-action="result-return"/);assert.match(review,/data-action="restart"/);assert.doesNotMatch(review,/data-action="(?:keep|merge|craft|reroll|reserve|move)"|Build your defense|Place.*recruit/);}
    assert.equal(h.tracker.sequence,sequence);assert.equal(JSON.stringify(h.tracker.waves),waves);assert.equal(JSON.stringify([...h.facts.waves].map(([id,wave])=>[id,{...wave,leakIds:[...wave.leakIds]}])),facts);assert.equal(JSON.stringify({towers:h.game.towers,draws:h.game.draft.draws,phase:h.game.phase,round:h.game.round,lives:h.game.lives,cp:h.game.commandPoints.value,score:h.game.score,elapsed:h.game.elapsedSeconds}),before);assert.equal(h.game.rng(),control.game.rng());
  }finally{h.dispose();control.dispose();}
});

test('missing event history and duration produce honest unavailable detail; developer results remain locally retryable',()=>{
  const game=new Game(data,{seed:26});game.end(false);delete game.elapsedSeconds;const model=runResultModel(game);assert.equal(model.completedWaves,0);assert.equal(model.finalWaveLeaks,null);assert.equal(model.finalWaveHealthLost,null);assert.equal(model.lastThreat,null);
  let html=runResultMarkup(model);assert.match(html,/Leak detail was not recorded/);assert.match(html,/Last invader detail is unavailable/);assert.match(html,/Not recorded/);assert.match(html,/Play again/);
  game.developerMode=true;html=runResultMarkup(runResultModel(game),{leaderboardMarkup:resultLeaderboardMarkup()});assert.match(html,/this run is excluded/);assert.match(html,/data-action="restart"/);assert.doesNotMatch(html,/result-leaderboard|score-form/);
});

test('last recorded spawn and enemy names are factual copied values escaped in result markup',()=>{
  const h=harness();try{
    h.build();const enemy=h.game.combat.spawn('host_01',{variant:{name:'<img src=x onerror=bad()>',flying:false}});h.game.end(false);enemy.name='Changed after the event';const model=h.model();assert.equal(model.lastLeak,null);assert.equal(model.lastThreat.name,'<img src=x onerror=bad()>');const html=runResultMarkup(model);assert.match(html,/Last recorded invader: &lt;img/);assert.doesNotMatch(html,/<img src=x|onerror="/);
    const frozen=JSON.stringify(model);h.facts.event('spawn',{enemy:{name:'Later invader'}},h.game);assert.equal(JSON.stringify(h.model()),frozen,'ended observer ignores later inspection deliveries');
  }finally{h.dispose();}
});

class Element{
  constructor(){this.matches=new Map();this.listeners=new Map();this.textContent='';this.disabled=false;}
  querySelector(selector){return this.matches.get(selector)||null;}addEventListener(type,listener){this.listeners.set(type,listener);}
}
test('an actual offline leaderboard rejection leaves local result and retry ahead of the optional online section',async()=>{
  const h=harness();try{
    h.build();h.game.lives=1;h.leak();const model=h.model(),html=runResultMarkup(model,{leaderboardMarkup:resultLeaderboardMarkup()});assert.ok(html.indexOf('data-action="restart"')<html.indexOf('result-leaderboard'));assert.ok(html.indexOf('data-action="result-review"')<html.indexOf('run-result-online'));assert.match(html,/<details class="run-result-online">/);assert.doesNotMatch(html,/<details class="run-result-online" open/);
    const container=new Element(),form=new Element(),input=new Element(),button=new Element(),status=new Element(),message=new Element();form.matches.set('input',input);form.matches.set('button',button);form.matches.set('.score-status',message);container.matches.set('form',form);container.matches.set('.leaderboard-status',status);container.matches.set('.leaderboard-rows',new Element());
    await connectResultLeaderboard(container,{leaderboard:async()=>{throw new Error('Online scores unavailable');},saveScore:async()=>{throw new Error('Offline');}});assert.equal(status.textContent,'Online scores unavailable');assert.equal(runResultMarkup(model,{leaderboardMarkup:resultLeaderboardMarkup()}),html);assert.match(html,/Play again remain available if online scores cannot load/);assert.equal(model.defeatWave,1);
  }finally{h.dispose();}
});
