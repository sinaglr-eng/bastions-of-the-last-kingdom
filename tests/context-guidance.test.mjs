import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {ContextGuidance,contextGuidanceMarkup,guidanceTopicMarkup,guidanceSeen} from '../ui/context-guidance.js';
import {TUTORIAL_STEPS} from '../ui/tutorial.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
function harness(options={}){const game=new Game(data,{seed:30,waveLimit:10}),guidance=new ContextGuidance(options),off=game.on((type,payload)=>guidance.event(type,payload,game));return {game,guidance,place(){game.draft.roundForced={family:'archer',tier:1};for(let x=3;x<8;x++)assert.equal(game.place(x,3),true);},dispose:off};}

test('first placement guidance is optional and rendering/acknowledging consumes no inventory, CP, RNG or pause state',()=>{
  const seen=[],h=harness({onSeen:ids=>seen.push(ids)}),control=harness();try{
    const before=JSON.stringify({draws:h.game.draft.draws,towers:h.game.towers,cp:h.game.commandPoints.value,phase:h.game.phase,paused:h.game.paused});const model=h.guidance.model(h.game);assert.equal(model.id,'placement');assert.match(contextGuidanceMarkup(model),/data-action="guidance-dismiss"/);assert.match(contextGuidanceMarkup(model),/data-action="guidance-help"/);
    for(let refresh=0;refresh<20;refresh++)h.guidance.model(h.game);assert.deepEqual(seen,[]);assert.equal(h.guidance.dismiss('placement'),true);assert.equal(h.guidance.model(h.game),null);assert.equal(h.guidance.dismiss('placement'),false);assert.deepEqual(seen,[['placement']]);assert.equal(JSON.stringify({draws:h.game.draft.draws,towers:h.game.towers,cp:h.game.commandPoints.value,phase:h.game.phase,paused:h.game.paused}),before);assert.equal(h.game.rng(),control.game.rng());
  }finally{h.dispose();control.dispose();}
});

test('CP appears only at the first legal relevant action and dismissal/restoration prevents repeated later-round introductions',()=>{
  const saved=[],h=harness({seen:['placement'],onSeen:ids=>saved.push(ids)});try{
    h.guidance.event('change',{},h.game);assert.equal(h.guidance.model(h.game),null);h.place();assert.equal(h.game.phase,'select');assert.equal(h.guidance.model(h.game).id,'cp');const points=h.game.commandPoints.value;assert.equal(h.guidance.dismiss('cp'),true);assert.equal(h.game.commandPoints.value,points);assert.equal(h.guidance.model(h.game),null);assert.deepEqual(saved,[['placement','cp']]);
    h.game.select(h.game.roundCandidates[0].tower.id);h.game.keep();h.game.startCombat();h.game.completeWave();assert.equal(h.game.round,2);assert.equal(h.game.phase,'build');assert.equal(h.guidance.model(h.game),null);
    const next=harness({seen:saved[0]});try{next.place();assert.equal(next.guidance.model(next.game),null);}finally{next.dispose();}
  }finally{h.dispose();}
});

test('actual first wave MVP event offers a short tip without changing the award, and later awards do not repeat acknowledged guidance',()=>{
  const h=harness({seen:['placement','cp']});try{
    h.place();h.game.select(h.game.roundCandidates[0].tower.id);h.game.keep();const tower=h.game.selection;h.game.startCombat();const enemy=h.game.combat.spawn('host_01',{variant:{hp:10000,armor:0}});h.game.combat.damage(enemy,10,'physical',{directHit:true},tower);assert.equal(h.guidance.model(h.game),null);h.game.completeWave();assert.equal(tower.mvpLevel,1);assert.equal(h.game.phase,'build');const model=h.guidance.model(h.game);assert.equal(model.id,'mvp');assert.match(model.summary,/earned an MVP level for actual damage/);assert.ok(model.summary.includes(data.towers[tower.family].name));assert.equal(h.guidance.dismiss('mvp'),true);assert.equal(tower.mvpLevel,1);
    h.game.emit('mvp-awarded',{tower,level:2,damage:10,round:2});assert.equal(h.guidance.model(h.game),null);h.game.end(false);assert.equal(h.guidance.model(h.game),null);
  }finally{h.dispose();}
});

test('an unacknowledged CP tip stays optional between waves and never expands combat or paused-combat guidance',()=>{
  const h=harness({seen:['placement']});try{
    h.place();assert.equal(h.guidance.model(h.game).id,'cp');h.game.select(h.game.roundCandidates[0].tower.id);h.game.keep();h.game.startCombat();assert.equal(h.guidance.model(h.game),null);h.game.paused=true;assert.equal(h.guidance.model(h.game),null);h.game.paused=false;h.game.completeWave();assert.equal(h.game.round,2);assert.equal(h.guidance.model(h.game).id,'cp');assert.notEqual(h.guidance.model(h.game).id,'placement');
  }finally{h.dispose();}
});

test('seen preferences reject hostile types, duplicates and unknown IDs; unavailable storage need not block dismissal',()=>{
  assert.deepEqual(guidanceSeen(['cp','unknown','cp',null,0,'mvp']),['cp','mvp']);for(const value of [null,'cp',{},false])assert.deepEqual(guidanceSeen(value),[]);
  const h=harness({seen:['placement'],onSeen:()=>false});try{h.place();assert.equal(h.guidance.dismiss('cp'),true);assert.equal(h.guidance.model(h.game),null);assert.equal(h.guidance.dismiss('unknown'),false);}finally{h.dispose();}
});

test('guidance describes current rules and the tutorial points to the actual folio, books and combat controls',()=>{
  const game=new Game(data,{seed:22}),cp=guidanceTopicMarkup('cp',game),mvp=guidanceTopicMarkup('mvp',game);assert.match(cp,new RegExp(`Reroll · ${game.commandPoints.cost('reroll')} CP`));assert.match(cp,new RegExp(`Each defeated boss adds ${game.commandPoints.config.bossReward} CP`));assert.match(cp,/returning reserved recruit is protected/);assert.match(mvp,/most actual HP damage/);assert.match(mvp,/already at level 10/);assert.match(mvp,/Each level adds 5% own damage, up to \+50%/);assert.doesNotMatch(mvp,/nearby enemy armor|nearby allies|75%/);assert.equal(guidanceTopicMarkup('unknown',game),'');
  assert.deepEqual(TUTORIAL_STEPS.map(step=>step.id),['camera','maze','place','keeper','recipes','waves','start','pause','speed','finish']);
  assert.match(TUTORIAL_STEPS.find(step=>step.id==='camera').text,/Touch \/ iPad: drag one finger to pan; pinch to zoom; drag two fingers to rotate/);
  assert.equal(TUTORIAL_STEPS.find(step=>step.id==='recipes').target,'.header-actions [data-action="codex"]');assert.match(TUTORIAL_STEPS.find(step=>step.id==='recipes').text,/exact ingredients/);
  assert.equal(TUTORIAL_STEPS.find(step=>step.id==='waves').target,'.header-actions [data-action="warbands"]');assert.match(TUTORIAL_STEPS.find(step=>step.id==='waves').text,/Current wave during combat/);
  assert.equal(TUTORIAL_STEPS.find(step=>step.id==='pause').target,'#header-combat-controls [data-action="pause"]');assert.match(TUTORIAL_STEPS.find(step=>step.id==='speed').text,/1× → 2× → 3× → 5× → 1×/);
  assert.match(TUTORIAL_STEPS.at(-1).text,/enter your name above the Top 10/);
});
