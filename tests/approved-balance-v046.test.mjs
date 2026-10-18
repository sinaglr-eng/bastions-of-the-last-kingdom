import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {DeveloperConsoleSession} from '../game/core/developer-console.js';
import {campaignTowers,campaignEnemies,campaignRecipes,campaignWaves} from '../game/core/campaign-roster.js';
import {towerStats,combatTowerStats,damageAfterDefense,supportBonuses} from '../game/core/math.js';
import {supportSourceAreas,enemyStatusState} from '../game/render/support-effects.js';
import {abilityLines} from '../ui/grimoire.js';
import {mvpDetailsMarkup} from '../ui/mvp-details.js';
import {RunStatistics} from '../game/core/run-statistics.js';

const archived=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const data={...archived,towers:campaignTowers(archived.towers),enemies:campaignEnemies(archived.enemies),recipes:campaignRecipes(archived.recipes),waves:campaignWaves(archived.waves)};
const decisions=JSON.parse(readFileSync(new URL('../design/audit-20261018-v046/balance/proposals.json',import.meta.url))).decisions;
const close=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);
function arena(){const g=new Game(data,{seed:460});g.phase='combat';g.combat.start(g.wave);g.combat.spawnQueue=[{time:1e9,type:'host_01',modifiers:{}}];return g;}
function unit(g,family,extra={}){const t={id:g.nextId++,family,tier:1,x:12,z:12,state:'active',kills:0,cooldown:1e9,mvpLevel:0,...extra};g.towers.push(t);return t;}
function foe(g,extra={}){const e=g.combat.spawn('host_01',{variant:{hp:1e9,armor:0,speed:1,...extra}});Object.assign(e,{x:12,z:13,route:[{x:12,z:13},{x:12,z:35}],pathIndex:1});return e;}

test('B05: every one of the 48 basic ranks and 38 champion primary ranges matches the approved source without rewriting archive data',()=>{
  const approved=decisions.find(d=>d.id==='B05'),before=JSON.stringify(archived);
  let basics=0,champions=0;
  for(const [family,ranges]of Object.entries(approved.basicRanks))ranges.forEach((range,index)=>{assert.equal(towerStats({family,tier:index+1},data).range,range,`${family} ${index+1}`);basics++;});
  for(const [family,range]of Object.entries(approved.championAttackOrPrimaryRanges)){assert.equal(towerStats({family,tier:1},data).range,range,family);champions++;}
  assert.equal(basics,48);assert.equal(champions,38);assert.equal(JSON.stringify(archived),before);assert.equal(archived.towers.stormcaller.levels[5].range,12);
});

test('current rank/ability narratives reflect the approved range and stacking mechanics while original authoring copy stays intact',()=>{
  assert.equal(towerStats({family:'stormcaller',tier:6},data).range,8);
  assert.match(data.towers.stormcaller.description,/within eight tiles/);assert.doesNotMatch(data.towers.stormcaller.description,/twelve/);
  assert.match(archived.towers.stormcaller.description,/twelve/);
  assert.doesNotMatch(data.towers.mage.description,/armor-ignoring/);assert.match(data.towers.mage.description,/own armor and immunity/);
  assert.doesNotMatch(data.towers.cleric.description,/Different blessing ranks combine/);assert.match(data.towers.cleric.description,/strongest standard blessing/);
  for(const family of ['royalranger','kingsrangerguard','elvenking'])assert.match(data.towers[family].description,/local movement-slow aura/);
  const oath=abilityLines(towerStats({family:'elvenking',tier:1},data)).join(' ');
  assert.match(oath,/Flying targets: 75% slow for 2s/);
});

test('B01: MVP contributes exactly 5% per level and max 50% across primary, DOT, aura and lightning, with no ally bonus or old armor field',()=>{
  for(const family of ['druid','fireballista','phoenix','ladyclaire'])for(const level of [0,1,5,10,99]){
    const g=arena(),t=unit(g,family,{mvpLevel:level}),other=unit(g,'soldier',{mvpLevel:10}),base=towerStats(t,data),effective=combatTowerStats(t,g.towers,data).stats;
    for(const key of ['damage','poisonDps','burnDps','burnAura','chainDamage','forkedDamage'])if(base[key])close(effective[key],base[key]*(1+Math.min(level,10)*.05));
    const e=foe(g,{armor:60});e.mvpArmorReduction=1;
    close(damageAfterDefense(100,'physical',e,{},data.balance),100/3);
    g.combat.prepareArmor(e);assert.equal(e.mvpArmorReduction,undefined);
    assert.ok(!supportSourceAreas(other,data,{towers:g.towers}).some(a=>a.key==='mvpArmor'));
    assert.doesNotMatch(mvpDetailsMarkup(t),/Nearby|Enemy armor|allies|75%/);
  }
});

test('B03: Frozen Celestial direct targeting and impact are ground only without melee contact restrictions; its own slow radius is separate',()=>{
  const g=arena(),t=unit(g,'winterhold'),s=towerStats(t,data),air=foe(g,{flying:true}),ground=foe(g);ground.z=16.9;air.z=13;
  assert.equal(s.melee,undefined);assert.equal(s.range,5);assert.equal(s.slowAuraRange,4.5);assert.equal(s.type,'holy');assert.equal(s.damage,60);assert.equal(s.interval,1);
  assert.deepEqual(g.combat.targetList(t,s),[ground]);
  const hp=air.hp;g.combat.impact({source:t,target:air,stats:s});assert.equal(air.hp,hp);assert.deepEqual(air.statuses,{});
  g.combat.impact({source:t,target:ground,stats:s});close(ground.maxHp-ground.hp,60,'Ranged contact at 4.9 tiles remains valid');
  ground.z=16.5;g.tick(.01);close(ground.currentSpeed,.25);close(air.currentSpeed,1);
  assert.equal(enemyStatusState(air,g.towers,data).some(e=>e.key==='slow'),false);
  ground.z=16.501;g.tick(.01);close(ground.currentSpeed,1);
  ground.z=13;ground.boss=true;g.tick(.01);close(ground.currentSpeed,.625);
  ground.physicalImmune=true;g.tick(.01);close(ground.currentSpeed,1);
  assert.match(abilityLines(s).join(' '),/ground targets only.*75% movement slow aura within 4.5 tiles · ground only/);
});

for(const [family,amount,radius,onHit]of [['royalranger',.25,3.5,.4],['kingsrangerguard',.3,3.5,.5],['elvenking',.4,4,.75]])test(`B04: ${family} slow aura has a fixed footprint, strongest-only air hit, no linger, boss and immunity rules`,()=>{
  const g=arena(),t=unit(g,family),e=foe(g,{flying:true}),s=towerStats(t,data);unit(g,'mothernature');e.z=12+radius;
  assert.equal(combatTowerStats(t,g.towers,data).stats.range,s.range+3);
  assert.equal(s.slowAura,amount);assert.equal(s.slowAuraRange,radius);
  g.tick(0);close(e.currentSpeed,1-amount);assert.equal(e.statuses.slow,undefined);
  e.z=12+radius+.001;g.tick(0);close(e.currentSpeed,1);assert.equal(e.statuses.slow,undefined);
  e.z=13;g.combat.applyEffects(e,s,t);g.tick(0);close(e.currentSpeed,1-onHit);assert.equal(e.statuses.slow.time,s.slowDuration||2);
  e.boss=true;g.tick(0);close(e.currentSpeed,1-onHit*.5);
  delete e.statuses.slow;t.attackPaused=true;g.tick(0);close(e.currentSpeed,1);
  t.attackPaused=false;e.physicalImmune=true;g.tick(0);close(e.currentSpeed,1);
  e.physicalImmune=false;e.flying=false;e.boss=false;g.tick(0);close(e.currentSpeed,1-amount);
});

test('B05: Archdruid +1, Nature Spirit +3 and Mother Nature +3 affect targeting only, reach exactly five and never sum',()=>{
  const g=arena(),target=unit(g,'thunderheart'),arch=unit(g,'eldergrove',{z:17}),spirit=unit(g,'rangermentor',{z:17}),mother=unit(g,'mothernature',{z:17});
  assert.equal(supportBonuses(target,[target,arch],data).range,1);
  assert.equal(supportBonuses(target,[target,spirit],data).range,3);assert.equal(supportBonuses(target,[target,mother],data).range,3);
  assert.equal(supportBonuses(target,g.towers,data).range,3);assert.equal(combatTowerStats(target,g.towers,data).stats.range,9.5);
  assert.equal(combatTowerStats(target,g.towers,data).stats.burnAuraRange,5.5);
  const e=foe(g,{speed:0});e.z=17.5;g.tick(.1);close(e.maxHp-e.hp,120);
  e.z=17.501;const hp=e.hp;g.tick(.1);close(e.hp,hp);
  for(const source of [arch,spirit,mother])source.z=17.001;
  assert.equal(supportBonuses(target,g.towers,data).range,0);
  const areas=supportSourceAreas(target,data,{towers:g.towers});assert.equal(areas.find(a=>a.key==='burn').radius,5.5);
  for(const [family,radius]of [['embercrown',4.5],['worldfire',5],['phoenix',6.5]]){const fire=unit(g,family);mother.z=12;assert.equal(supportSourceAreas(fire,data,{towers:g.towers}).find(a=>a.key==='burn').radius,radius);if(towerStats(fire,data).damage===0)assert.equal(combatTowerStats(fire,g.towers,data).stats.range,radius);}
  for(const [family,radius]of [['winterhold',4.5],['dawnspire',5],['archangel',4]])assert.equal(supportSourceAreas(unit(g,family),data).find(a=>a.key==='slow').radius,radius);
  assert.equal(towerStats({family:'emeraldgolem',tier:1},data).stoneGazeRange,7);assert.equal(towerStats({family:'ladyclaire',tier:1},data).chainRange,6);
});

test('B06: the bomber branch applies the strongest fixed armor reduction within its own footprint, preserves hit shred, immunity and zero floor',()=>{
  const g=arena(),small=unit(g,'royalmarshal'),griffin=unit(g,'griffinbomber'),ship=unit(g,'mechanicalgolem'),e=foe(g,{armor:48,physicalImmune:true,magicImmune:true});unit(g,'mothernature');
  assert.deepEqual([towerStats(small,data).armorShredAura,towerStats(griffin,data).armorShredAura,towerStats(ship,data).armorShredAura],[20,35,45]);
  for(const [z,shred]of [[16,45],[16.5,45],[17.5,45],[17.501,0]]){e.z=z;g.combat.prepareArmor(e);assert.equal(e.armorShred,shred);}
  e.z=13;g.combat.prepareArmor(e);close(damageAfterDefense(100,'holy',e,{},data.balance),100*30/33);
  g.combat.applyEffects(e,towerStats(ship,data),ship);assert.equal(e.statuses.shred.amount,64);assert.equal(e.statuses.shred.time,4);assert.equal(e.armorShred,64);close(damageAfterDefense(100,'holy',e,{},data.balance),100);
  e.statuses={};ship.attackPaused=true;g.combat.prepareArmor(e);assert.equal(e.armorShred,35);griffin.attackPaused=true;g.combat.prepareArmor(e);assert.equal(e.armorShred,20);small.attackPaused=true;g.combat.prepareArmor(e);assert.equal(e.armorShred,0);
});

test('B04 overlapping real ranger auras choose one strongest slow and switch immediately when that source pauses or leaves',()=>{
  const g=arena(),master=unit(g,'royalranger'),dark=unit(g,'kingsrangerguard'),oath=unit(g,'elvenking'),e=foe(g);
  g.tick(0);close(e.currentSpeed,.6);assert.equal(e.statuses.slow,undefined);
  oath.attackPaused=true;g.tick(0);close(e.currentSpeed,.7);
  dark.z=17;g.tick(0);close(e.currentSpeed,.75);
  master.state='ruin';g.tick(0);close(e.currentSpeed,1);
  assert.equal(enemyStatusState(e,g.towers,data).some(row=>row.key==='slow'),false);
});

for(const [family,amount,radius]of [['royalmarshal',20,4],['griffinbomber',35,4.5],['mechanicalgolem',45,5.5]])test(`B06 ${family}: its real aura boundary stays fixed under +3 range support and disappears on pause`,()=>{
  const g=arena(),t=unit(g,family),e=foe(g,{armor:48}),support=unit(g,'mothernature');e.z=12+radius;
  assert.equal(combatTowerStats(t,g.towers,data).stats.range,towerStats(t,data).range+3);
  g.combat.prepareArmor(e);assert.equal(e.armorShred,amount);assert.equal(supportSourceAreas(t,data,{towers:g.towers}).find(a=>a.key==='armor').radius,radius);
  e.z+=.001;g.combat.prepareArmor(e);assert.equal(e.armorShred,0);
  e.z=13;t.attackPaused=true;g.combat.prepareArmor(e);assert.equal(e.armorShred,0);assert.equal(support.state,'active');
});

test('B03/B04 statistics credit only active, in-radius, eligible slow providers and preserve no false Holy immunity bypass',()=>{
  const g=arena(),winter=unit(g,'winterhold'),ranger=unit(g,'royalranger'),tracker=new RunStatistics(g,{id:'b046',clock:()=>0});g.emit('wave');
  const air=foe(g,{flying:true});tracker.sample(.25);assert.equal(tracker.waveUnits.get(winter.id).controlSeconds,0);assert.equal(tracker.waveUnits.get(ranger.id).controlSeconds,.25);
  air.physicalImmune=true;tracker.sample(.25);assert.equal(tracker.waveUnits.get(ranger.id).controlSeconds,.25);
  air.physicalImmune=false;ranger.attackPaused=true;tracker.sample(.25);assert.equal(tracker.waveUnits.get(ranger.id).controlSeconds,.25);
  air.flying=false;air.z=16.501;tracker.sample(.25);assert.equal(tracker.waveUnits.get(winter.id).controlSeconds,0);
  tracker.dispose();
});

test('historically owned VI setups and MVP levels remain loadable and use current approved personal bonuses',async()=>{
  const g=arena(),session=new DeveloperConsoleSession(g);await session.activate();g.phase='ready';
  session.importSetup({schemaVersion:1,mode:'Sandbox',seed:1,wave:2,resources:{gold:90,lives:30,commandPoints:3},towers:[{family:'archer',tier:6,x:12,z:12,mvpLevel:10,state:'active'}]});
  const t=g.towers.find(t=>t.state==='active');assert.equal(t.tier,6);assert.equal(t.mvpLevel,10);close(combatTowerStats(t,g.towers,g.data).stats.damage,towerStats(t,g.data).damage*1.5);
});

test('B07 observation events report only actual enemy healing gains at original deadlines, no full-HP/blocked labels and no extra RNG',()=>{
  const g=arena(),e=foe(g,{hp:100,regen:.2,recharge:.5}),events=[];e.hp=20;g.rng=()=>{throw new Error('Healing must not draw RNG');};g.on((type,p)=>{if(type==='enemy-heal')events.push({...p,hp:p.enemy.hp});});
  g.combat.updateEnemyHealing(e,4,1);close(e.hp,90);close(events.reduce((sum,p)=>sum+p.amount,0),70);assert.deepEqual(events.map(p=>p.cause),['regeneration','recharge']);assert.ok(events.every(p=>p.visible===true&&p.amount>0));
  e.hp=e.maxHp;events.length=0;g.combat.updateEnemyHealing(e,4,0);assert.deepEqual(events,[]);
  e.hp=20;events.length=0;g.combat.updateEnemyHealing(e,1,2);assert.deepEqual(events,[]);close(e.hp,20);
  // DOT HP loss is observed first; a full-heal tick must report the whole gain,
  // rather than the much smaller net HP difference over damage plus healing.
  e.regen=1;e.recharge=0;e.hp=100;e.statuses.burn={time:1,dps:10,damageType:'holy'};events.length=0;
  g.combat.update(1);close(e.hp,100);close(events.reduce((sum,p)=>sum+p.amount,0),10);
});

test('B07 recover event carries actual partial keep recovery and no full-keep label without changing recovery RNG draws',()=>{
  const g=arena(),t=unit(g,'royalranger'),events=[];let calls=0;g.rng=()=>{calls++;return 0;};g.on((type,p)=>{if(type==='recover')events.push(p);});
  g.combat.landedProcs({recoverChance:1,recoverLives:2},t);assert.equal(calls,1);assert.equal(events.length,0);
  g.lives=data.balance.startingLives-1;g.combat.landedProcs({recoverChance:1,recoverLives:2},t);assert.equal(calls,2);assert.equal(events.length,1);assert.equal(events[0].amount,1);assert.equal(events[0].source,t);
  g.combat.landedProcs({recoverChance:1,recoverLives:2},t,{landedDamage:false});assert.equal(calls,2);assert.equal(events.length,1);
});
