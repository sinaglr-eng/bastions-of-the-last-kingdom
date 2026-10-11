import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignEnemies,campaignWaves,campaignRecipes} from '../game/core/campaign-roster.js';
import {towerStats} from '../game/core/math.js';
import {ENEMY_RULES,defenderDreadState} from '../game/core/enemy-rules.js';
import {towerSupportState,enemyStatusState} from '../game/render/support-effects.js';
import {selectedEnemyMarkup,selectedEnemyView} from '../ui/selected-enemy.js';
import {DeveloperConsoleSession} from '../game/core/developer-console.js';

const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves),recipes:campaignRecipes(raw.recipes)};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
function arena(roster=data){const g=new Game(roster,{seed:91});g.phase='combat';g.combat.start(g.wave);g.combat.spawnQueue=[{time:1e9,type:'host_01',modifiers:{}}];return g;}
function tower(g,family='soldier',extra={}){const t={id:g.nextId++,family,tier:1,state:'active',x:12,z:12,kills:0,cooldown:1e6,...extra};g.towers.push(t);return t;}
function foe(g,extra={}){const e=g.combat.spawn('host_01',{variant:{hp:1e6,armor:0,speed:0,...extra}});e.x=12;e.z=13;return e;}
const effects={type:'holy',damage:100,slow:.5,freeze:1,freezeDuration:2,poisonDps:10,burnDps:12,healingBlockDuration:3};

test('actual Holy impacts bypass damage immunity but every companion effect obeys its normal immunity category',()=>{
  for(const [physicalImmune,magicImmune]of [[true,true],[true,false],[false,true],[false,false]]){
    const g=arena(),t=tower(g,'winterhold'),e=foe(g,{physicalImmune,magicImmune});g.rng=()=>0;
    g.combat.impact({source:t,target:e,stats:effects});close(e.maxHp-e.hp,100);
    for(const key of ['slow','freeze'])assert.equal(!!e.statuses[key],!physicalImmune,`${key}: physical=${physicalImmune}`);
    for(const key of ['poison','burn','healBlock'])assert.equal(!!e.statuses[key],!magicImmune,`${key}: magical=${magicImmune}`);
    g.combat.applyEffects(e,{...effects,effectsIgnoreImmunity:true},t);
    for(const key of ['slow','freeze'])assert.equal(!!e.statuses[key],!physicalImmune);
    for(const key of ['poison','burn','healBlock'])assert.equal(!!e.statuses[key],!magicImmune);
  }
});

test('actual Frozen Celestial aura and Holy frost bounce cannot slow Physical-immune enemies; Golem alone retains explicit petrification bypass',()=>{
  const g=arena(),frost=tower(g,'winterhold'),e=foe(g,{physicalImmune:true,speed:1});
  e.route=[{x:12,z:13},{x:12,z:30}];e.pathIndex=1;g.tick(.1);close(e.currentSpeed,1);assert.equal(enemyStatusState(e,g.towers,data).some(s=>s.key==='slow'),false);
  e.dead=true;const angel=tower(g,'archangel'),origin=foe(g),target=foe(g,{physicalImmune:true});target.x=13;
  const stats={...towerStats(angel,data),bouncingFrost:1,slow:.5,freeze:1};g.rng=()=>0;g.combat.bounceFrost(origin,stats,angel);
  close(target.maxHp-target.hp,250);assert.equal(target.statuses.slow,undefined);assert.equal(target.statuses.freeze,undefined);
  const golem=tower(g,'emeraldgolem'),both=foe(g,{physicalImmune:true,magicImmune:true});both.route=[{x:12,z:13},{x:12,z:12}];both.pathIndex=1;
  g.combat.impact({source:golem,target:both,stats:towerStats(golem,data)});close(both.hp,both.maxHp);g.combat.updateStoneGazes(2);
  assert.equal(both.statuses.petrify.time,3);assert.equal(both.statuses.gazeSlow,undefined);
});

test('changing an active target to an immune profile cannot preserve an obsolete Holy status bypass',()=>{
  const g=arena(),t=tower(g,'winterhold'),e=foe(g);g.rng=()=>0;g.combat.applyEffects(e,effects,t);
  assert.ok(e.statuses.poison&&e.statuses.freeze);e.magicImmune=e.physicalImmune=true;const hp=e.hp;g.tick(.1);
  close(e.hp,hp);for(const key of ['poison','burn','healBlock','slow','freeze'])assert.equal(e.statuses[key],undefined);
});

test('Dread requires real owned HP damage, has no proximity trigger and excludes shield/evasion/immunity/Shell blocks and phantom sources',()=>{
  for(const defense of [{refraction:3},{evasion:1},{physicalImmune:true},{krakenShell:100}]){
    const g=arena(),t=tower(g),e=foe(g,{untouchable:.75,...defense});g.rng=()=>0;g.tick(.01);assert.equal(t.dread,undefined);
    const hit=g.combat.resolveDamage(e,10,'physical',{directHit:true},t);assert.equal(hit.effectiveDamage,0);assert.equal(t.dread,undefined);
  }
  const g=arena(),t=tower(g,'soldier',{x:0,z:0}),other=tower(g,'archer'),e=foe(g,{untouchable:.75});
  g.combat.damage(e,1,'holy',{},structuredClone(t));assert.equal(t.dread,undefined);
  g.combat.damage(e,1,'holy',{},t);assert.equal(t.dread.amount,.75);assert.equal(t.dread.until,3);assert.equal(t.dread.source,e);assert.equal(other.dread,undefined);
  t.state='ruin';delete t.dread;g.combat.damage(e,1,'holy',{},t);assert.equal(t.dread,undefined);
});

test('Dread refreshes three game seconds without stacking and survives the provoking enemy death, while pause freezes its expiry',()=>{
  const g=arena(),t=tower(g),a=foe(g,{untouchable:.75}),b=foe(g,{untouchable:.25});
  g.combat.damage(a,1,'holy',{},t);g.tick(1.5);g.combat.damage(b,1,'holy',{},t);assert.equal(t.dread.amount,.75);close(t.dread.until,4.5);assert.equal(t.dread.source,a);
  g.paused=true;g.tick(100);close(g.combat.elapsed,1.5);close(defenderDreadState(t,g.combat.elapsed).remaining,3);g.paused=false;
  g.combat.damage(a,a.hp+100,'holy',{},t);assert.equal(a.dead,true);g.tick(2.999);assert.ok(defenderDreadState(t,g.combat.elapsed).amount>0);g.tick(.001);assert.equal(defenderDreadState(t,g.combat.elapsed).amount,0);
});

test('Dread cooldown integrates only its three-second interval equally for coarse/fine ticks and partial control protection',()=>{
  for(const resistance of [0,.5,1]){
    const run=step=>{const roster=structuredClone(data);roster.towers.soldier.aura={range:1,controlResistance:resistance};const g=arena(roster),t=tower(g,'soldier',{cooldown:10}),e=foe(g,{untouchable:.75});g.combat.damage(e,1,'holy',{},t);for(let remain=4;remain>1e-9;){const dt=Math.min(step,remain);g.tick(dt);remain-=dt;}return t.cooldown;};
    const expected=10-(4-3*.75*(1-resistance));close(run(4),expected);close(run(.03),expected);
  }
});

test('owned DOT and launched projectiles refresh paused-source Dread at any range, while actual support can suppress its attack penalty',()=>{
  const g=arena(),t=tower(g,'druid'),e=foe(g,{untouchable:.75});
  g.combat.impact({source:t,target:e,stats:towerStats(t,data)});t.attackPaused=true;g.tick(.25);close(t.dread.until,3.25);
  t.x=0;t.z=0;g.combat.projectiles.push({source:t,target:e,stats:{damage:100,type:'holy'},start:{x:12,z:12},progress:0,duration:.1});g.tick(.1);close(t.dread.until,3.35);
  const paladin=tower(g,'kingdomprotector',{x:0,z:0,attackPaused:true});assert.equal(towerSupportState(t,g.towers,data,{combat:g.combat}).byKey.dread,undefined);
  paladin.state='ruin';assert.equal(towerSupportState(t,g.towers,data,{combat:g.combat}).byKey.dread.value,.75);
  g.combat.start(g.wave);assert.equal(t.dread,undefined);assert.equal(towerSupportState(t,g.towers,data,{combat:g.combat}).byKey.dread,undefined);
});

test('actual secondary chains and damage auras provoke their real owner; consumed projectile sources cannot gain active-defender Dread',()=>{
  const g=arena(),caster=tower(g,'starfall'),primary=foe(g),secondary=foe(g,{untouchable:.75});secondary.x=13;
  g.combat.impact({source:caster,target:primary,stats:{damage:1,type:'holy',chain:1,chainDamage:2,chainRange:4,chainSequential:true}});
  assert.equal(caster.dread.source,secondary);assert.equal(caster.dread.amount,.75);
  const aura=tower(g,'phoenix'),ownTarget=foe(g,{untouchable:.5});secondary.dead=primary.dead=true;g.tick(.1);assert.equal(aura.dread.source,ownTarget);close(aura.dread.until,3.1);
  const consumed=tower(g,'soldier');consumed.state='ruin';const hp=ownTarget.hp;
  g.combat.projectiles.push({source:consumed,target:ownTarget,stats:{damage:100,type:'holy'},start:{x:12,z:12},progress:0,duration:.1});g.tick(.1);
  assert.ok(ownTarget.hp<hp,'An already launched projectile can still hit after consumption');assert.equal(consumed.dread,undefined);
});

test('all current Refraction profiles use three charges and live charges never reset periodically',()=>{
  let profiles=0;for(const definition of Object.values(data.enemies))for(const p of [definition,...definition.variants||[]])if(p.refraction){assert.equal(p.refraction,3);profiles++;}assert.ok(profiles>0);
  const g=arena(),t=tower(g),e=foe(g,{refraction:3});g.combat.damage(e,1,'holy',{directHit:true},t);assert.equal(e.shields,2);assert.equal(e.shieldReadyAt,null);
  g.tick(20);assert.equal(e.shields,2);assert.equal(e.shieldClock,null);g.combat.damage(e,1,'holy',{directHit:true},t);assert.equal(e.shields,1);g.tick(7);assert.equal(e.shields,1);
  g.combat.damage(e,1,'holy',{directHit:true},t);assert.equal(e.shields,0);close(e.shieldReadyAt,29);
  g.tick(1.999);assert.equal(e.shields,0);close(e.shieldClock,.001);g.tick(.001);assert.equal(e.shields,3);assert.equal(e.shieldReadyAt,null);
});

test('depleting the final shield during one two-second projectile tick does not recharge it in that same tick',()=>{
  const g=arena(),t=tower(g),e=foe(g,{refraction:3});for(let i=0;i<2;i++)g.combat.damage(e,1,'holy',{directHit:true},t);
  g.combat.projectiles.push({source:t,target:e,stats:{damage:100,type:'holy'},start:{x:12,z:12},progress:0,duration:2});g.tick(2);
  assert.equal(e.shields,0);assert.equal(e.shieldReadyAt,4);assert.equal(e.shieldClock,2);g.paused=true;g.tick(10);assert.equal(e.shields,0);g.paused=false;
  g.tick(1.999);assert.equal(e.shields,0);g.tick(.001);assert.equal(e.shields,3);
});

test('actual enemy inspection shows depletion-only shield countdown and continues to distinguish Holy damage from blocked effects',()=>{
  const g=arena(),t=tower(g),e=foe(g,{refraction:3,magicImmune:true,physicalImmune:true});assert.ok(g.selectEnemy(e.id));
  const options={data,combat:g.combat};let view=selectedEnemyView(e,options);assert.equal(view.shieldRechargeRemaining,null);
  for(let i=0;i<3;i++)g.combat.damage(e,1,'holy',{directHit:true},t);view=selectedEnemyView(e,options);close(view.shieldRechargeRemaining,2);
  const html=selectedEnemyMarkup(e,options);assert.match(html,/Shields return in 2 game seconds/);assert.match(html,/Only Holy damage bypasses immunity; companion effects remain blocked/);
  g.tick(.5);close(selectedEnemyView(e,options).shieldRechargeRemaining,1.5);
});

test('actual recharge uses four-second deadlines and blink advances six route tiles every five seconds across large ticks',()=>{
  const g=arena(),e=foe(g,{recharge:.5});e.hp=e.maxHp*.5;g.tick(3.999);close(e.hp,e.maxHp*.5);g.tick(.001);close(e.hp,e.maxHp*.75);g.tick(8);close(e.hp,e.maxHp*.9375);
  const blink=foe(g,{blink:6});blink.route=[{x:0,z:0},{x:80,z:0}];blink.pathIndex=1;blink.x=blink.z=0;
  g.tick(4.999);close(blink.traveled,0);g.tick(.001);close(blink.traveled,6);g.tick(10);close(blink.traveled,18);close(blink.blinkClock,5);
});

test('all current regeneration profiles use twenty percent, wave38 forty percent, and actual modified maxHP/healing-block expiry set recovery',()=>{
  const before=JSON.stringify(raw);let profiles=0;
  for(const [id,d]of Object.entries(data.enemies))for(const p of [d,...d.variants||[]])if(p.regen){assert.equal(p.regen,id==='host_38'?.4:.2);profiles++;}assert.ok(profiles>0);
  const g=arena(),e=g.combat.spawn('host_38',{hp:2,variant:data.enemies.host_38.variants.find(v=>v.regen>0)});e.speed=0;e.hp=e.maxHp*.1;
  g.combat.applyEffects(e,{healingBlockDuration:1});g.tick(1.5);close(e.hp,e.maxHp*.3);assert.equal(e.statuses.healBlock,undefined);g.tick(20);close(e.hp,e.maxHp);
  assert.equal(JSON.stringify(raw),before);
});

test('Console timing overrides are run-private, expose Dread duration and retain explicit old Refraction periods as depletion delays',async()=>{
  const g=new Game(data,{seed:91}),session=new DeveloperConsoleSession(g);await session.activate();
  session.setTimingRules('dread',{duration:1});session.setTimingRules('refraction',{period:5});assert.equal(g.combat.rules.dread.duration,1);assert.equal(g.combat.rules.refraction.period,5);
  assert.throws(()=>session.setTimingRules('dread',{radius:4}),/Unsupported/);assert.equal(ENEMY_RULES.dread.duration,3);assert.equal(ENEMY_RULES.refraction.period,2);
  assert.equal(ENEMY_RULES.recharge.period,4);assert.equal(ENEMY_RULES.blink.period,5);session.dispose();
});
