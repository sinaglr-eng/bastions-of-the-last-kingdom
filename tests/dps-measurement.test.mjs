import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignEnemies,campaignRecipes,campaignWaves} from '../game/core/campaign-roster.js';
import {combatTowerStats} from '../game/core/math.js';
import {TowerDpsTracker} from '../game/core/tower-dps.js';
import {DpsMeasurement} from '../ui/dps-measurement.js';
import {towerDpsContents} from '../ui/tower-dps.js';

const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),enemies:campaignEnemies(raw.enemies),recipes:campaignRecipes(raw.recipes),waves:campaignWaves(raw.waves)};
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);
function session(){
  const game=new Game(data,{seed:42}),tracker=new TowerDpsTracker(),measurement=new DpsMeasurement(),hits=[];
  game.on((event,payload)=>{
    if(event==='wave'){tracker.reset(game.combat.elapsed);measurement.startWave(game.round);}
    if(event==='hit'){tracker.recordHit(payload,game.combat.elapsed);hits.push({time:game.combat.elapsed,...payload});}
    if(event==='wave-complete')measurement.completeWave(game,tracker);
  });
  return {game,tracker,measurement,hits};
}
function draft(game,choices,z=18){
  for(const [index,family]of choices.entries()){
    game.draft.roundForced={family,tier:1};assert.equal(game.place(15+index,z),true);
  }
  game.draft.roundForced=null;
}
function firstCombat(family='archer'){
  const state=session(),{game}=state;
  draft(game,[family,'archer','mage','druid','cleric']);
  const source=game.roundCandidates[0].tower;game.select(source.id);assert.equal(game.keep(),true);assert.equal(game.startCombat(),true);
  source.attackPaused=true;game.combat.spawnQueue=[{time:1e9,type:'host_01',modifiers:{}}];
  return {...state,source};
}
function foe(game,{armor=0,hp=1e6}={}){
  const enemy=game.combat.spawn('host_01',{variant:{hp,armor,speed:0}});enemy.x=15;enemy.z=19;return enemy;
}
function strike(game,source,target,extra={}){
  const {stats}=combatTowerStats(source,game.towers,data);game.combat.impact({source,target,stats:{...stats,...extra}});
}
const view=state=>state.measurement.view(state.game,state.tracker);
const markup=state=>{const current=view(state);return towerDpsContents(current.rows,data,{},current.options);};

test('first construction, revealed recruits and ready phase show truthful unmeasured state without fictional draft performers',()=>{
  const state=session(),{game}=state;
  const initial=view(state);assert.deepEqual(initial.rows,[]);assert.equal(initial.options.measured,false);assert.equal(initial.options.wave,null);
  assert.match(markup(state),/Not measured yet/);assert.match(markup(state),/tower-dps-summary-score[^>]*>—<\/strong>/);assert.doesNotMatch(markup(state),/0\.0|tower-dps-select/);
  draft(game,['archer','mage','druid','cleric','frostwarden']);
  assert.equal(game.phase,'select');assert.deepEqual(view(state).rows,[]);assert.equal(view(state).options.measured,false);
  game.select(game.roundCandidates[0].tower.id);assert.equal(game.keep(),true);assert.equal(game.phase,'ready');
  assert.deepEqual(view(state).rows,[]);assert.match(markup(state),/Not measured yet/);
  assert.equal(game.startCombat(),true);const measured=view(state);assert.equal(measured.options.measured,true);assert.equal(measured.options.wave,1);
  assert.equal(measured.rows.length,1);assert.equal(measured.rows[0].dps,0);assert.match(markup(state),/Wave 1/);assert.doesNotMatch(markup(state),/Not measured yet|Completed wave/);
});

test('real projectile and poison damage after armor use the five-game-second denominator and ignore overkill',()=>{
  const state=firstCombat('druid'),{game,source}=state,enemy=foe(game,{armor:30});
  game.tick(.2);const initial=enemy.hp;strike(game,source,enemy);
  close(initial-enemy.hp,3);close(view(state).rows[0].dps,3/5);
  game.tick(.25);close(initial-enemy.hp,3.75);close(view(state).rows[0].dps,3.75/5);
  assert.ok(state.hits.some(hit=>!hit.directHit&&hit.effect==='poison'&&hit.source===source));
  const weak=foe(game,{hp:.5});strike(game,source,weak);assert.equal(weak.dead,true);
  const actualRemoved=state.hits.filter(hit=>hit.source===source).reduce((sum,hit)=>sum+hit.effectiveDamage,0);
  close(view(state).rows[0].peakDamage,actualRemoved);close(view(state).rows[0].dps,actualRemoved/5);
  assert.equal(state.hits.at(-1).effectiveDamage,.5,'The real hit event caps overkill before DPS attribution');
});

test('1×/3× combat clocks and global pause produce identical measured direct and DOT peaks at equal game time',()=>{
  const run=speed=>{
    const state=firstCombat('druid'),{game,source}=state,enemy=foe(game,{armor:30});game.speed=speed;strike(game,source,enemy);
    for(let frame=0;frame<24;frame++){
      game.tick(.05/speed);
      if(frame===9){const frozen=view(state),clock=game.combat.elapsed;game.paused=true;game.tick(60);
        assert.equal(game.combat.elapsed,clock);assert.deepEqual(view(state).rows,frozen.rows);assert.match(markup(state),/Wave 1 · Paused/);game.paused=false;
      }
    }
    close(game.combat.elapsed,1.2);const row=view(state).rows[0],removed=state.hits.reduce((sum,hit)=>sum+hit.effectiveDamage,0);
    close(row.peakDamage,removed);close(row.dps,removed/5);return {rows:view(state).rows,removed,time:game.combat.elapsed};
  };
  const normal=run(1),fast=run(3);assert.deepEqual(normal.rows,fast.rows);close(normal.removed,fast.removed);close(normal.time,fast.time);
});

test('completed wave preserves the hit-captured peak and its source clock through construction and excludes the next draft',()=>{
  const state=firstCombat(),{game,source}=state,enemy=foe(game);game.tick(.1);strike(game,source,enemy);
  const peak=view(state).rows[0].dps;assert.ok(peak>0);
  for(let tick=0;tick<60;tick++)game.tick(.1);
  assert.equal(view(state).rows[0].currentDps,0);assert.equal(view(state).rows[0].dps,peak,'The true maximum survives after its window expires');
  const clock=game.combat.elapsed;game.completeWave();assert.equal(game.round,2);assert.equal(game.phase,'build');
  const completed=view(state);assert.equal(completed.options.wave,1);assert.equal(completed.options.completed,true);assert.equal(completed.rows[0].dps,peak);
  assert.equal(completed.rows[0].selectable,true);assert.equal(completed.rows[0].archived,false);
  game.tick(600);assert.equal(game.combat.elapsed,clock);assert.deepEqual(view(state).rows,completed.rows);
  game.draft.roundForced={family:'mage',tier:1};assert.equal(game.place(15,20),true);
  assert.equal(game.roundCandidates.length,1);assert.deepEqual(view(state).rows,completed.rows);assert.ok(view(state).rows.every(row=>row.state==='active'));
  const html=markup(state);assert.doesNotMatch(html,/tower-dps-note|Completed wave|Measured over/);assert.match(html,/Last wave 1/);assert.doesNotMatch(html,/Wave 2|Select Mage/);
  const rendered=html,stored=structuredClone(state.measurement.completedRows);view(state).rows[0].dps=999;
  assert.deepEqual(state.measurement.completedRows,stored,'Callers cannot overwrite stored completed rows');assert.equal(markup(state),rendered);
});

test('real champion crafting that reuses an ID archives the old measured row and gives the champion a fresh next-wave score',()=>{
  const state=firstCombat('frostwarden'),{game,source}=state,enemy=foe(game);game.tick(.1);strike(game,source,enemy);
  const original={...view(state).rows[0]};assert.ok(original.dps>0);game.completeWave();
  assert.equal(source.mvpLevel,1);assert.equal(view(state).rows[0].mvpLevel,1,'The completed measurement records the actual end-of-wave MVP award');
  assert.equal(game.mvp.setLevel(source,7),true);assert.equal(view(state).rows[0].mvpLevel,1,'Later preparation changes cannot rewrite a measured historical MVP level');
  draft(game,['soldier','stormcaller','mage','druid','archer'],20);game.select(source.id);
  assert.ok(game.availableRecipes().some(recipe=>recipe.id==='rimewatch'));assert.equal(game.craft('rimewatch'),true);
  assert.equal(game.selection,source);assert.equal(source.family,'rimewatch');assert.equal(source.id,original.id);assert.equal(game.phase,'ready');
  const completed=view(state);assert.equal(completed.rows.length,1);assert.equal(completed.rows[0].family,'frostwarden');
  assert.equal(completed.rows[0].dps,original.dps);assert.equal(completed.rows[0].archived,true);assert.equal(completed.rows[0].selectable,false);
  assert.equal(completed.rows[0].mvpLevel,1);assert.match(markup(state),/Rank I · MVP 1/);assert.equal(source.mvpLevel,7,'The real champion inherits its foundation MVP separately');
  assert.ok(!completed.rows.some(row=>row.family==='rimewatch'),'A newly forged champion never appears as an old-wave performer');
  const html=markup(state);assert.match(html,new RegExp(`<button[^>]*data-id="${source.id}"[^>]* disabled`));assert.match(html,/Measured Frost Warden/);assert.match(html,/Combined \/ removed/);assert.doesNotMatch(html,/Frostsword Watchmen/);
  assert.equal(game.startCombat(),true);game.combat.spawnQueue=[{time:1e9,type:'host_01',modifiers:{}}];source.attackPaused=true;
  const next=view(state);assert.equal(next.options.wave,2);assert.equal(next.options.completed,false);assert.equal(next.rows.length,1);
  assert.equal(next.rows[0].family,'rimewatch');assert.equal(next.rows[0].dps,0);assert.equal(next.rows[0].peakDamage,0);assert.match(markup(state),/Wave 2/);assert.doesNotMatch(markup(state),/Completed wave 1|Combined \/ removed/);
  assert.equal(next.rows[0].mvpLevel,7);assert.match(markup(state),/Champion · MVP 7/);
  const fresh=foe(game),hp=fresh.hp;game.tick(.1);strike(game,source,fresh);close(view(state).rows[0].dps,(hp-fresh.hp)/5);
  assert.ok(view(state).rows[0].dps>0,'New combat measures the new champion under its new family signature');
});

test('compact summary sums individual measured peaks even when their windows occur at different times',()=>{
  const state=firstCombat('mage'),{game,source}=state,enemy=foe(game);
  const other={id:game.nextId++,family:'archer',tier:1,state:'active',x:15,z:20,kills:0,cooldown:0,attackPaused:true};game.towers.push(other);
  game.tick(.1);strike(game,source,enemy,{damage:100});for(let tick=0;tick<60;tick++)game.tick(.1);strike(game,other,enemy,{damage:50});
  const rows=view(state).rows;assert.deepEqual(rows.map(row=>row.dps),[20,10]);assert.deepEqual(rows.map(row=>row.currentDps),[0,10]);
  const html=markup(state),summary=html.slice(html.indexOf('<summary'),html.indexOf('</summary>'));
  assert.match(summary,/tower-dps-summary-score[^>]*>30\.0<\/strong>/);assert.doesNotMatch(summary,/tower-dps-value/);assert.match(summary,/Sum of individual defender peak DPS this wave/);
  game.completeWave();const completed=markup(state),completedSummary=completed.slice(completed.indexOf('<summary'),completed.indexOf('</summary>'));
  assert.match(completedSummary,/Last wave 1/);assert.match(completedSummary,/>30\.0<\/strong>/);assert.doesNotMatch(completed,/tower-dps-note|Completed wave|Measured over/);
});

test('a new game session starts unmeasured independently of the prior session completed score',()=>{
  const old=firstCombat(),enemy=foe(old.game);strike(old.game,old.source,enemy);old.game.completeWave();assert.ok(view(old).rows[0].dps>0);
  const fresh=session();assert.deepEqual(view(fresh).rows,[]);assert.equal(view(fresh).options.measured,false);assert.equal(view(fresh).options.completed,false);
  assert.match(markup(fresh),/Not measured yet/);assert.doesNotMatch(markup(fresh),/Completed wave 1|Last wave 1/);
});
