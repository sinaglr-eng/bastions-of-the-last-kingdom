import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {towerStats} from '../game/core/math.js';
import {campaignTowers} from '../game/core/campaign-roster.js';
import {TowerDpsTracker,effectiveHitDamage} from '../game/core/tower-dps.js';

const archived=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[
  key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url),'utf8')),
]));
const data={...archived,towers:campaignTowers(archived.towers)};
const close=(actual,expected,message='')=>assert.ok(Math.abs(actual-expected)<1e-7,
  `${message}: ${actual} != ${expected}`);

// Every source is actually placed and retained. Advance construction through
// the real wave-completion transition before keeping the next scenario source.
function battle(specifications=[['druid',6],['druid',1]]){
  const game=new Game(data,{seed:42}),sources=[];
  for(const [index,[family,tier]] of specifications.entries()){
    game.draft.roundForced={family,tier};
    const id=game.nextId;
    for(let cell=0;cell<5;cell++)assert.equal(game.place(15+cell,18+index*2),true);
    game.select(id);assert.equal(game.keep(),true);assert.equal(game.startCombat(),true);
    sources.push(game.towers.find(tower=>tower.id===id));
    if(index<specifications.length-1)game.completeWave();
  }
  // Keep one future spawn so the isolated enemy scenario cannot finish its
  // wave, and suppress automatic shots while we control actual impact times.
  game.combat.spawnQueue=[{time:1e9,type:'goblin',modifiers:{}}];
  for(const tower of game.towers)tower.cooldown=1e6;
  const tracker=new TowerDpsTracker(),hits=[];
  game.on((event,hit)=>{
    if(event==='wave')tracker.reset(game.combat.elapsed);
    if(event==='hit'){
      tracker.recordHit(hit,game.combat.elapsed);
      hits.push({time:game.combat.elapsed,id:hit.source?.id,type:hit.type,
        directHit:hit.directHit,damage:hit.damage,applied:effectiveHitDamage(hit)});
    }
  });
  return {game,sources,tracker,hits};
}
function foe(game,properties={}){
  const enemy=game.combat.spawn('goblin');
  Object.assign(enemy,{x:15,z:19,speed:0,armor:0,regen:0,hp:1e5,maxHp:1e5,...properties});
  return enemy;
}
const strike=(game,source,enemy,overrides={})=>game.combat.impact({
  source,target:enemy,stats:{...towerStats(source,data),...overrides},
});
const sum=(hits,predicate=()=>true)=>hits.filter(predicate).reduce((total,hit)=>total+hit.applied,0);
const dotTotal=(hits,source)=>sum(hits,hit=>!hit.directHit&&hit.id===source.id);
const statusView=enemy=>enemy.statuses.poison&&{
  dps:enemy.statuses.poison.dps,time:enemy.statuses.poison.time,applications:enemy.statuses.poison.applications.map(a=>[a.dps,a.time,a.source.id]),
};
function advance(game,seconds,step){
  let remaining=seconds;
  while(remaining>1e-10){
    const slice=Math.min(step,remaining);
    game.tick(slice/game.speed);remaining-=slice;
  }
}

test('a weaker real hit adds its own stack without extending another source deadline, and crossing ticks credit both actual owners',()=>{
  const {game,sources:[strong,weak],tracker,hits}=battle(),enemy=foe(game),initialHp=enemy.hp;
  strike(game,strong,enemy);game.tick(4.9);close(enemy.statuses.poison.time,.1);
  strike(game,weak,enemy);assert.equal(enemy.statuses.poison.dps,390);assert.equal(enemy.statuses.poison.stacks,2);
  close(enemy.statuses.poison.applications.find(a=>a.source===strong).time,.1);close(enemy.statuses.poison.time,5);
  const index=hits.length;game.tick(.2);const crossing=hits.slice(index);
  assert.deepEqual(crossing.map(h=>[h.id,h.directHit,h.type]),[[strong.id,false,'magical'],[weak.id,false,'magical'],[weak.id,false,'magical']]);
  close(crossing[0].applied,38.4);close(crossing[1].applied,.6);close(crossing[2].applied,.6);
  close(dotTotal(hits,strong),1920);close(dotTotal(hits,weak),1.2);assert.equal(enemy.statuses.poison.applications[0].source,weak);close(enemy.statuses.poison.time,4.8);
  const rows=tracker.snapshot(game.towers,game.combat.elapsed);close(rows.find(r=>r.id===weak.id).damage,towerStats(weak,data).damage+1.2);close(sum(hits),initialHp-enemy.hp);
  game.tick(4.8);assert.equal(enemy.statuses.poison,undefined);close(dotTotal(hits,weak),30);close(sum(hits),initialHp-enemy.hp);
});

test('equal and stronger hits all stack independently, including repeat hits by the same actual defender',()=>{
  const {game,sources:[first,second,strong],tracker,hits}=battle([['druid',1],['druid',1],['druid',2]]),enemy=foe(game),initialHp=enemy.hp;
  strike(game,first,enemy);game.tick(1);strike(game,second,enemy);let hp=enemy.hp;game.tick(1);close(hp-enemy.hp,12);
  strike(game,strong,enemy);hp=enemy.hp;game.tick(1);close(hp-enemy.hp,24);
  strike(game,first,enemy);assert.equal(enemy.statuses.poison.stacks,4);assert.equal(enemy.statuses.poison.dps,30);
  assert.deepEqual(enemy.statuses.poison.applications.map(a=>a.time),[2,3,4,5]);game.tick(.5);
  close(dotTotal(hits,first),24);close(dotTotal(hits,second),15);close(dotTotal(hits,strong),18);
  for(const source of [first,second,strong])close(tracker.snapshot(game.towers,game.combat.elapsed).find(r=>r.id===source.id).damage,sum(hits,h=>h.id===source.id));close(sum(hits),initialHp-enemy.hp);
});

test('an earlier weaker stack expires independently and cannot revive after all stacks expire',()=>{
  const {game,sources:[weak,strong],hits}=battle([['druid',1],['druid',6]]),enemy=foe(game);
  strike(game,weak,enemy);game.tick(1);strike(game,strong,enemy);game.tick(4.1);
  assert.equal(enemy.statuses.poison.stacks,1);assert.equal(enemy.statuses.poison.applications[0].source,strong);close(enemy.statuses.poison.time,.9);
  game.tick(1);assert.equal(enemy.statuses.poison,undefined);close(dotTotal(hits,weak),30);close(dotTotal(hits,strong),1920);const hp=enemy.hp;game.tick(1);close(enemy.hp,hp);
});

test('an actual surviving stack caps overkill, credits its real killing caster and never resurrects an expired owner',()=>{
  const {game,sources:[strong,weak],tracker,hits}=battle(),enemy=foe(game);
  strike(game,strong,enemy);game.tick(4.9);strike(game,weak,enemy);game.tick(.1);assert.equal(enemy.statuses.poison.applications.length,1);
  enemy.hp=.15;game.tick(.1);assert.equal(enemy.dead,true);assert.equal(strong.kills,0);assert.equal(weak.kills,1);assert.equal(game.kills,1);assert.equal(enemy.statuses.poison,undefined);
  const fatal=hits.at(-1);assert.equal(fatal.id,weak.id);assert.equal(fatal.directHit,false);close(fatal.damage,.6);close(fatal.applied,.15);
  for(const source of [strong,weak])close(tracker.snapshot(game.towers,game.combat.elapsed).find(r=>r.id===source.id).damage,sum(hits,h=>h.id===source.id&&h.time>game.combat.elapsed-5));
});

test('blocked or Magical-immune real impacts create no poison owner and no fictitious DPS contribution',()=>{
  const {game,sources:[strong,weak],tracker,hits}=battle(),shielded=foe(game,{shields:1}),immune=foe(game,{magicImmune:true});
  strike(game,strong,shielded);strike(game,weak,immune);assert.equal(shielded.shields,0);assert.equal(shielded.statuses.poison,undefined);assert.equal(immune.statuses.poison,undefined);assert.equal(hits.length,0);
  assert.ok(tracker.snapshot(game.towers,0).every(r=>r.damage===0&&r.dps===0));strike(game,strong,shielded);game.tick(.25);
  assert.equal(shielded.statuses.poison.applications[0].source,strong);close(dotTotal(hits,strong),96);assert.ok(hits.every(h=>h.id===strong.id));
});

test('independent 5s expiry integration and pause agree for fine/coarse ticks at1x and3x, with real window accounting',()=>{
  function replay(step,speed){
    const {game,sources:[strong,weak],tracker,hits}=battle(),enemy=foe(game),initialHp=enemy.hp;game.speed=speed;
    strike(game,strong,enemy);advance(game,.9,step);strike(game,weak,enemy);const frozen={time:game.combat.elapsed,hp:enemy.hp,status:statusView(enemy),rows:tracker.snapshot(game.towers,game.combat.elapsed),hits:hits.length};
    game.paused=true;game.tick(30);assert.equal(game.combat.elapsed,frozen.time);assert.equal(enemy.hp,frozen.hp);assert.deepEqual(statusView(enemy),frozen.status);assert.equal(hits.length,frozen.hits);assert.deepEqual(tracker.snapshot(game.towers,game.combat.elapsed),frozen.rows);
    game.paused=false;advance(game,5,step);assert.equal(enemy.statuses.poison,undefined);close(game.combat.elapsed,5.9);close(dotTotal(hits,strong),1920);close(dotTotal(hits,weak),30);close(sum(hits),initialHp-enemy.hp);
    for(const source of [strong,weak]){const row=tracker.snapshot(game.towers,game.combat.elapsed).find(r=>r.id===source.id);close(row.damage,sum(hits,h=>h.id===source.id&&h.time>game.combat.elapsed-5));close(row.currentDps,row.damage/5);}
    return enemy.hp;
  }
  const reference=replay(.02,1);for(const [step,speed]of [[.25,1],[.02,3],[.25,3]])close(replay(step,speed),reference);
});

for(const [family,name,poisonDps]of [['rangermentor','Nature Spirit',96],['mothernature','Mother Nature',1898.4]])test('current '+name+' poison adds to Druid stacks and both actual sources retain DPS credit',()=>{
  const original=JSON.stringify(archived),{game,sources:[champion,druid],tracker,hits}=battle([[family,1],['druid',6]]),enemy=foe(game),hp=enemy.hp,stats=towerStats(champion,data);
  assert.equal(stats.name,name);assert.equal(stats.poisonDps,poisonDps);assert.equal(stats.interval,.5);strike(game,champion,enemy);game.tick(.25);strike(game,druid,enemy);game.tick(.25);
  assert.equal(enemy.statuses.poison.dps,poisonDps+384);assert.equal(enemy.statuses.poison.stacks,2);close(dotTotal(hits,champion),poisonDps*.5);close(dotTotal(hits,druid),96);
  for(const source of [champion,druid]){const row=tracker.snapshot(game.towers,game.combat.elapsed).find(r=>r.id===source.id);close(row.damage,sum(hits,h=>h.id===source.id));close(row.dps,row.damage/5);}
  close(sum(hits),hp-enemy.hp);assert.equal(JSON.stringify(archived),original);
});
