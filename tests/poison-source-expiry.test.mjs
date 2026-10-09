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
  Object.assign(enemy,{x:15,z:19,speed:0,hp:1e5,maxHp:1e5,...properties});
  return enemy;
}
const strike=(game,source,enemy,overrides={})=>game.combat.impact({
  source,target:enemy,stats:{...towerStats(source,data),...overrides},
});
const sum=(hits,predicate=()=>true)=>hits.filter(predicate).reduce((total,hit)=>total+hit.applied,0);
const dotTotal=(hits,source)=>sum(hits,hit=>!hit.directHit&&hit.id===source.id);
const statusView=enemy=>enemy.statuses.poison&&{
  dps:enemy.statuses.poison.dps,time:enemy.statuses.poison.time,source:enemy.statuses.poison.source.id,
};
function advance(game,seconds,step){
  let remaining=seconds;
  while(remaining>1e-10){
    const slice=Math.min(step,remaining);
    game.tick(slice/game.speed);remaining-=slice;
  }
}

test('a weaker real hit cannot extend another source poison and a crossing tick credits each actual expiry slice',()=>{
  const {game,sources:[strong,weak],tracker,hits}=battle(),enemy=foe(game),initialHp=enemy.hp;
  strike(game,strong,enemy);game.tick(4.9);
  close(enemy.statuses.poison.time,.1);assert.equal(enemy.statuses.poison.source,strong);
  strike(game,weak,enemy);
  close(enemy.statuses.poison.applications.find(application=>application.source===strong).time,.1,
    'weak hit must preserve the strong source deadline');
  close(enemy.statuses.poison.time,5,'the visible status includes the later weaker expiry');
  assert.equal(enemy.statuses.poison.dps,384);assert.equal(enemy.statuses.poison.source,strong);
  const beforeCrossing=hits.length;
  game.tick(.2);
  const crossing=hits.slice(beforeCrossing);
  assert.deepEqual(crossing.map(hit=>[hit.id,hit.directHit,hit.type]),[
    [strong.id,false,'poison'],[weak.id,false,'poison'],
  ]);
  close(crossing[0].applied,38.4);close(crossing[1].applied,.6);
  close(dotTotal(hits,strong),1920);close(dotTotal(hits,weak),.6);
  assert.equal(enemy.statuses.poison.source,weak);assert.equal(enemy.statuses.poison.dps,6);
  close(enemy.statuses.poison.time,4.8,'the weaker application ages even while suppressed');
  const rows=tracker.snapshot(game.towers,game.combat.elapsed),byId=new Map(rows.map(row=>[row.id,row]));
  close(byId.get(strong.id).damage,1920,'the direct hit at t=0 has left the current five-second window');
  close(byId.get(weak.id).damage,6.6);close(byId.get(strong.id).dps,384);
  close(sum(hits),initialHp-enemy.hp);
  game.tick(4.8);
  assert.equal(enemy.statuses.poison,undefined);
  close(dotTotal(hits,strong),1920);close(dotTotal(hits,weak),29.4);
  close(sum(hits),initialHp-enemy.hp);
});

test('equal-strength poison belongs to the most recent real caster and stronger applications never stack damage',()=>{
  const {game,sources:[first,second,strong],tracker,hits}=battle([['druid',1],['druid',1],['druid',2]]);
  const enemy=foe(game),initialHp=enemy.hp;
  strike(game,first,enemy);game.tick(1);
  strike(game,second,enemy);assert.equal(enemy.statuses.poison.source,second);
  const beforeTie=enemy.hp;game.tick(1);close(beforeTie-enemy.hp,6);
  strike(game,strong,enemy);assert.equal(enemy.statuses.poison.source,strong);
  const beforeStrong=enemy.hp;game.tick(1);close(beforeStrong-enemy.hp,12);
  strike(game,first,enemy);assert.equal(enemy.statuses.poison.source,strong);
  close(enemy.statuses.poison.applications.find(application=>application.source===strong).time,4,
    'a weaker refresh cannot extend the strongest caster');
  close(enemy.statuses.poison.time,5);
  game.tick(.5);
  close(dotTotal(hits,first),6);close(dotTotal(hits,second),6);close(dotTotal(hits,strong),18);
  const rows=tracker.snapshot(game.towers,game.combat.elapsed);
  for(const source of [first,second,strong])close(rows.find(row=>row.id===source.id).damage,
    sum(hits,hit=>hit.id===source.id));
  close(rows.reduce((total,row)=>total+row.damage,0),initialHp-enemy.hp);
});

test('a suppressed weaker poison expires on its own clock and cannot revive after the stronger caster expires',()=>{
  const {game,sources:[weak,strong],hits}=battle([['druid',1],['druid',6]]),enemy=foe(game);
  strike(game,weak,enemy);game.tick(1);
  strike(game,strong,enemy);game.tick(4.1);
  assert.equal(enemy.statuses.poison.source,strong);close(enemy.statuses.poison.time,.9);
  game.tick(1);
  assert.equal(enemy.statuses.poison,undefined);
  close(dotTotal(hits,weak),6);close(dotTotal(hits,strong),1920);
  const hp=enemy.hp;game.tick(1);close(enemy.hp,hp,'both applications have expired');
});

test('resisted fallback poison caps overkill, credits the real killing caster and conserves effective HP damage',()=>{
  const {game,sources:[strong,weak],tracker,hits}=battle();
  // Two direct hits remove 18 and 3 HP; the strong poison removes 960 HP.
  // The remaining .15 HP must be removed by the weaker fallback, not credited
  // to the old source or counted as its uncapped .3 HP poison slice.
  const initialHp=981.15,enemy=foe(game,{hp:initialHp,maxHp:initialHp,resists:{magic:.25,poison:.25}});
  strike(game,strong,enemy);game.tick(4.9);strike(game,weak,enemy);game.tick(.2);
  assert.equal(enemy.dead,true);assert.equal(strong.kills,0);assert.equal(weak.kills,1);
  assert.equal(game.kills,1);assert.equal(enemy.statuses.poison,undefined);
  close(dotTotal(hits,strong),960);close(dotTotal(hits,weak),.15);
  const fatal=hits.at(-1);assert.equal(fatal.id,weak.id);assert.equal(fatal.directHit,false);
  close(fatal.damage,.3);close(fatal.applied,.15);
  close(sum(hits),initialHp-Math.max(0,enemy.hp));
  const rows=tracker.snapshot(game.towers,game.combat.elapsed);
  for(const source of [strong,weak])close(rows.find(row=>row.id===source.id).damage,
    sum(hits,hit=>hit.id===source.id&&hit.time>game.combat.elapsed-5));
});

test('blocked or magic-immune real impacts create no poison owner and no fictitious DPS contribution',()=>{
  const {game,sources:[strong,weak],tracker,hits}=battle();
  const shielded=foe(game,{shields:1}),immune=foe(game,{magicImmune:true});
  strike(game,strong,shielded);strike(game,weak,immune);
  assert.equal(shielded.shields,0);assert.equal(shielded.statuses.poison,undefined);
  assert.equal(immune.statuses.poison,undefined);assert.equal(hits.length,0);
  assert.ok(tracker.snapshot(game.towers,0).every(row=>row.damage===0&&row.dps===0));
  strike(game,strong,shielded);game.tick(.25);
  assert.equal(shielded.statuses.poison.source,strong);assert.equal(immune.statuses.poison,undefined);
  close(dotTotal(hits,strong),96);assert.ok(hits.every(hit=>hit.id===strong.id));
});

test('expiry integration, actual DPS and pause agree for fine/coarse ticks at 1x and 3x game speed',()=>{
  function replay(step,speed){
    const {game,sources:[strong,weak],tracker,hits}=battle(),enemy=foe(game),initialHp=enemy.hp;
    game.speed=speed;
    // Short lifetimes keep the entire scenario inside one five-second DPS
    // window, allowing an exact peak/current comparison across frame sizes.
    strike(game,strong,enemy,{dotDuration:1});advance(game,.9,step);
    strike(game,weak,enemy,{dotDuration:1});
    const frozen={time:game.combat.elapsed,hp:enemy.hp,status:statusView(enemy),
      rows:tracker.snapshot(game.towers,game.combat.elapsed),hits:hits.length};
    game.paused=true;game.tick(30);
    assert.equal(game.combat.elapsed,frozen.time);assert.equal(enemy.hp,frozen.hp);
    assert.deepEqual(statusView(enemy),frozen.status);assert.equal(hits.length,frozen.hits);
    assert.deepEqual(tracker.snapshot(game.towers,game.combat.elapsed),frozen.rows);
    game.paused=false;advance(game,.2,step);advance(game,.8,step);
    assert.equal(enemy.statuses.poison,undefined);close(game.combat.elapsed,1.9);
    close(dotTotal(hits,strong),384);close(dotTotal(hits,weak),5.4);
    close(sum(hits),initialHp-enemy.hp);
    const rows=tracker.snapshot(game.towers,game.combat.elapsed);
    for(const source of [strong,weak]){
      const row=rows.find(candidate=>candidate.id===source.id),applied=sum(hits,hit=>hit.id===source.id);
      close(row.damage,applied);close(row.currentDps,applied/5);close(row.dps,applied/5);
    }
    return {hp:enemy.hp,dot:[dotTotal(hits,strong),dotTotal(hits,weak)],rows};
  }
  const reference=replay(.02,1);
  for(const [step,speed] of [[.25,1],[.02,3],[.25,3]]){
    const actual=replay(step,speed);close(actual.hp,reference.hp);
    actual.dot.forEach((damage,index)=>close(damage,reference.dot[index]));
    for(const [index,row] of actual.rows.entries()){
      assert.equal(row.id,reference.rows[index].id);
      for(const key of ['damage','dps','currentDps','peakDamage'])close(row[key],reference.rows[index][key]);
    }
  }
});

for(const [family,name,poisonDps] of [['rangermentor','Nature Spirit',96],['mothernature','Mother Nature',1898.4]]){
  test(`live campaign ${name} applies its approved poison and actual hits credit only the current strongest source`,()=>{
    const archiveBefore=JSON.stringify(archived),{game,sources:[champion,druid],tracker,hits}=battle([[family,1],['druid',6]]);
    const stats=towerStats(champion,data),enemy=foe(game),initialHp=enemy.hp;
    assert.equal(stats.name,name);assert.equal(stats.poisonDps,poisonDps);assert.equal(stats.interval,.5);
    strike(game,champion,enemy);game.tick(.25);
    strike(game,druid,enemy);game.tick(.25);
    const championIsStrongest=poisonDps>384;
    assert.equal(enemy.statuses.poison.source,championIsStrongest?champion:druid);
    close(dotTotal(hits,champion),poisonDps*(championIsStrongest?.5:.25));
    close(dotTotal(hits,druid),championIsStrongest?0:96);
    const rows=tracker.snapshot(game.towers,game.combat.elapsed);
    for(const source of [champion,druid]){
      const applied=sum(hits,hit=>hit.id===source.id),row=rows.find(candidate=>candidate.id===source.id);
      close(row.damage,applied);close(row.dps,applied/5);
    }
    assert.ok(hits.some(hit=>hit.id===champion.id&&hit.directHit));
    assert.ok(hits.some(hit=>hit.id===champion.id&&!hit.directHit));
    close(sum(hits),initialHp-enemy.hp);
    assert.equal(JSON.stringify(archived),archiveBefore,'live campaign combat must not mutate archived source definitions');
  });
}
