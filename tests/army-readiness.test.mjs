import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ArmyReadiness,READINESS_SCOPE} from '../game/core/army-readiness.js';
import {WaveThreatAnalyzer} from '../game/core/wave-threats.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))]));
const tower=(family,tier=1,state='active',extra={})=>({family,tier,state,x:10,z:10,...extra});
function analysis(ids,raw={},count=10,variants=null){
  const enemies=variants||[{hp:1000,armor:0,speed:2,...raw}];
  return {number:20,name:'Fixture wave',totalCount:count,threats:ids.map(id=>({id,label:id})),enemies:[{type:raw.type||'fixture',count,boss:!!raw.boss,variants:enemies.map(enemy=>({enemy,maxHp:enemy.hp,armor:enemy.armor,speed:enemy.speed,flying:!!enemy.flying,threatIds:ids}))}]};
}
const row=(result,id)=>result.rows.find(r=>r.threatId===id);
function custom(definitions){const fixture=structuredClone(data);Object.assign(fixture.towers,definitions);return fixture;}
const stats=(extra={})=>({advanced:true,type:'physical',damage:20,interval:1,range:6,...extra});

test('no army is explicitly empty and every meaningful threat is weak',()=>{
  const preview=analysis(['heavyArmor','flying'],{armor:70,flying:true});
  const result=new ArmyReadiness(data).evaluate(preview,[]);
  assert.equal(result.empty,true);assert.equal(result.activeCount,0);assert.equal(result.scope,READINESS_SCOPE);
  assert.ok(result.rows.every(r=>r.level==='weak'&&r.ordinal===0&&r.response==='No active defenders yet.'));
});

test('only current active defenders enter the composition',()=>{
  const engine=new ArmyReadiness(data),preview=analysis(['boss'],{boss:true,hp:10000});
  const active=tower('soldier',1),baseline=engine.evaluate(preview,[active]);
  const result=engine.evaluate(preview,[active,...['draft','reserved','ruin'].map(state=>tower('royalarsenal',6,state))]);
  assert.equal(result,baseline);assert.equal(result.activeCount,1);
});

test('actual basic tier statistics update the directional rating',()=>{
  const engine=new ArmyReadiness(data),preview=analysis(['highHealth'],{hp:3000}),defender=tower('archer');
  const first=engine.evaluate(preview,[defender]);defender.tier=5;const upgraded=engine.evaluate(preview,[defender]);
  assert.notEqual(first,upgraded);assert.ok(upgraded.rows[0].ordinal>first.rows[0].ordinal);
});

test('family changes and newly active defenders invalidate composition cache',()=>{
  const engine=new ArmyReadiness(data),preview=analysis(['highHealth'],{hp:3000}),defender=tower('soldier');
  const first=engine.evaluate(preview,[defender]);defender.family='royalarsenal';const combined=engine.evaluate(preview,[defender]);
  assert.notEqual(first,combined);assert.ok(combined.rows[0].ordinal>first.rows[0].ordinal);
  assert.notEqual(engine.evaluate(preview,[defender,tower('archer')]),combined);
});

test('Move, identity, ordering, kills and targeting preference do not recompute readiness',()=>{
  const engine=new ArmyReadiness(data),preview=analysis(['boss'],{hp:10000,boss:true}),army=[tower('mage',3),tower('cleric',2)];
  const first=engine.evaluate(preview,army);
  Object.assign(army[0],{x:100,z:-100,id:500,kills:900,priority:'strongest'});army.reverse();
  assert.equal(engine.evaluate(preview,army),first);
});

test('melee cannot respond to flying targets while real ranged and burn auras can',()=>{
  const engine=new ArmyReadiness(data),preview=analysis(['flying'],{flying:true,hp:500});
  assert.equal(row(engine.evaluate(preview,[tower('soldier',6)]),'flying').level,'weak');
  assert.ok(row(engine.evaluate(preview,[tower('archer',3)]),'flying').ordinal>0);
  assert.ok(row(engine.evaluate(preview,[tower('embercrown')]),'flying').ordinal>0);
});

test('magical damage and magical control do not bypass magic immunity',()=>{
  const engine=new ArmyReadiness(data),preview=analysis(['magicImmune','fast'],{magicImmune:true,hp:1000});
  const result=engine.evaluate(preview,[tower('frostwarden',6),tower('druid',6)]);
  assert.equal(row(result,'magicImmune').level,'weak');assert.equal(row(result,'fast').level,'weak');
  assert.match(row(result,'fast').response,/No applicable slowing/);
  assert.ok(row(engine.evaluate(preview,[tower('archer',6)]),'magicImmune').ordinal>0);
});

test('physical immunity rejects physical/piercing but allows real magical aura damage',()=>{
  const engine=new ArmyReadiness(data),preview=analysis(['physicalImmune'],{physicalImmune:true,hp:1000});
  assert.equal(engine.evaluate(preview,[tower('royalarsenal')]).rows[0].level,'weak');
  const magical=engine.evaluate(preview,[tower('worldfire')]).rows[0];assert.equal(magical.level,'strong');assert.match(magical.response,/Magical/);
});

test('an isolated magic-immune boss cannot be damaged by a mage pure secondary cleave',()=>{
  const preview=analysis(['magicImmune','boss'],{hp:1000,magicImmune:true,boss:true},1);
  const result=new ArmyReadiness(data).evaluate(preview,[tower('mage',6)]);
  assert.ok(result.rows.every(r=>r.level==='weak'));
  assert.match(row(result,'magicImmune').response,/No applicable damage/);
});

test('effective armor, penetration and on-hit shredding affect actual damage capability',()=>{
  const fixture=custom({plain:stats({damage:100}),piercing:stats({damage:100,penetration:1}),shredding:stats({damage:100,shred:120})});
  const engine=new ArmyReadiness(fixture),preview=analysis(['heavyArmor'],{hp:5000,armor:120});
  const normal=engine.evaluate(preview,[tower('plain')]).rows[0];
  for(const family of ['piercing','shredding']){const improved=engine.evaluate(preview,[tower(family)]).rows[0];assert.ok(improved.ordinal>normal.ordinal);assert.match(improved.response,/reduction or penetration/);}
});

test('reactive armor is evaluated at its real maximum stacks and cannot inflate magical armor',()=>{
  const fixture=custom({plain:stats({damage:100}),magic:stats({damage:100,type:'arcane'})});
  const engine=new ArmyReadiness(fixture),plain=analysis(['reactiveArmor'],{hp:5000,reactiveArmor:8});
  assert.ok(engine.evaluate(plain,[tower('magic')]).rows[0].ordinal>engine.evaluate(plain,[tower('plain')]).rows[0].ordinal);
  assert.match(engine.evaluate(plain,[tower('plain')]).rows[0].response,/Maximum reactive stacks/);
});

test('healing block requires a landed hit and never inherits aura immunity piercing',()=>{
  const engine=new ArmyReadiness(data),ordinary=analysis(['regeneration'],{hp:10000,regen:.05}),immune=analysis(['regeneration'],{hp:10000,regen:.05,magicImmune:true});
  assert.match(engine.evaluate(ordinary,[tower('mechanicalgolem')]).rows[0].response,/Applicable healing block/);
  assert.match(engine.evaluate(immune,[tower('mechanicalgolem')]).rows[0].response,/no applicable healing block/);
  const physical=analysis(['regeneration'],{hp:10000,regen:.05,physicalImmune:true,magicImmune:true});
  assert.equal(engine.evaluate(physical,[tower('mechanicalgolem')]).rows[0].level,'weak');
});

test('regeneration pressure uses modified maximum health and the real percentage rate',()=>{
  const fixture=custom({plain:stats({damage:100})}),engine=new ArmyReadiness(fixture);
  const weakHeal=analysis(['regeneration'],{hp:2000,regen:.01}),strongHeal=analysis(['regeneration'],{hp:2000,regen:.2});
  assert.ok(engine.evaluate(weakHeal,[tower('plain')]).rows[0].ordinal>engine.evaluate(strongHeal,[tower('plain')]).rows[0].ordinal);
  assert.match(engine.evaluate(analysis(['recharge'],{hp:2000,recharge:.12}),[tower('plain')]).rows[0].response,/missing-health recharge/);
});

test('poison and other same-status damage over time use strongest application rather than stacking',()=>{
  const fixture=custom({venom:stats({type:'poison',damage:1,poisonDps:100})}),engine=new ArmyReadiness(fixture),preview=analysis(['highHealth'],{hp:6000});
  const single=engine.evaluate(preview,[tower('venom')]).rows[0],double=engine.evaluate(preview,[tower('venom'),tower('venom')]).rows[0];
  assert.equal(single.level,'fair');assert.equal(double.level,'fair');
});

test('direct hit shell can prevent effect application while independent aura damage bypasses it',()=>{
  const fixture=custom({tiny:stats({damage:5,interval:.1,type:'poison',poisonDps:500}),fire:stats({damage:0,type:'fire',burnAura:100})});
  const engine=new ArmyReadiness(fixture),preview=analysis(['shell'],{hp:1000,krakenShell:10});
  assert.equal(engine.evaluate(preview,[tower('tiny')]).rows[0].level,'weak');
  assert.equal(engine.evaluate(preview,[tower('fire')]).rows[0].level,'strong');
});

test('shield response distinguishes blocked on-hit poison from independent damage aura',()=>{
  const fixture=custom({slowVenom:stats({damage:5,interval:10,type:'poison',poisonDps:500}),fire:stats({damage:0,type:'fire',burnAura:100}),rapid:stats({damage:100,interval:.1})});
  const engine=new ArmyReadiness(fixture),preview=analysis(['shield'],{hp:1000,refraction:3});
  assert.equal(engine.evaluate(preview,[tower('slowVenom')]).rows[0].level,'weak');
  assert.equal(engine.evaluate(preview,[tower('fire')]).rows[0].level,'strong');
  assert.equal(engine.evaluate(preview,[tower('rapid')]).rows[0].level,'strong');
});

test('real multishot improves grouped response without multiplying isolated boss damage',()=>{
  const fixture=custom({one:stats({damage:100}),many:stats({damage:100,multishot:5})}),engine=new ArmyReadiness(fixture);
  const swarm=analysis(['swarm'],{hp:5000},10),boss=analysis(['boss'],{hp:5000,boss:true},1);
  assert.ok(engine.evaluate(swarm,[tower('many')]).rows[0].ordinal>engine.evaluate(swarm,[tower('one')]).rows[0].ordinal);
  assert.equal(engine.evaluate(boss,[tower('many')]).rows[0].ordinal,engine.evaluate(boss,[tower('one')]).rows[0].ordinal);
});

test('forked attacks that hit the original target count, while chains require another enemy',()=>{
  const fixture=custom({one:stats({damage:20,type:'arcane'}),fork:stats({damage:20,type:'arcane',forkedTargets:5,forkedChance:.5,forkedDamage:1000}),chain:stats({damage:20,type:'arcane',chain:5,chainDamage:1000})}),engine=new ArmyReadiness(fixture),preview=analysis(['boss'],{hp:5000,boss:true},1);
  const baseline=engine.evaluate(preview,[tower('one')]).rows[0].ordinal;
  assert.equal(engine.evaluate(preview,[tower('chain')]).rows[0].ordinal,baseline);
  assert.ok(engine.evaluate(preview,[tower('fork')]).rows[0].ordinal>baseline);
});

test('self haste is real but allied support is not globally applied or dependent on coordinates',()=>{
  const fixture=custom({one:stats({damage:100}),self:stats({damage:100,aura:{range:3,haste:1}})}),preview=analysis(['highHealth'],{hp:5000});
  assert.ok(new ArmyReadiness(fixture).evaluate(preview,[tower('self')]).rows[0].ordinal>new ArmyReadiness(fixture).evaluate(preview,[tower('one')]).rows[0].ordinal);
  const near=[tower('one'),tower('archbishop')],far=structuredClone(near);far[1].x=100;
  assert.deepEqual(new ArmyReadiness(fixture).evaluate(preview,near),new ArmyReadiness(fixture).evaluate(preview,far));
});

test('control protection and actual extended detection are reported as placement-dependent capabilities',()=>{
  const engine=new ArmyReadiness(data),debuff=analysis(['debuffer'],{hp:1000,disarm:true}),stealth=analysis(['stealth'],{hp:1000,stealth:true});
  assert.match(engine.evaluate(debuff,[tower('kingdomprotector')]).rows[0].response,/within a support radius/);
  assert.match(engine.evaluate(stealth,[tower('cleric',6)]).rows[0].response,/Extended detection/);
  assert.match(engine.evaluate(stealth,[tower('archer',6)]).rows[0].response,/nearby cloaked/);
});

test('real anti-air immunity piercing affects its slow but never makes magical damage pierce immunity',()=>{
  const engine=new ArmyReadiness(data),preview=analysis(['fast'],{hp:1000,flying:true,magicImmune:true});
  assert.match(engine.evaluate(preview,[tower('kingsrangerguard')]).rows[0].response,/Applicable slowing/);
  assert.match(engine.evaluate(preview,[tower('wyvernhunter')]).rows[0].response,/No applicable slowing/);
});

test('possible variants use the weakest matching case instead of assuming the favorable roll',()=>{
  const engine=new ArmyReadiness(data),preview=analysis(['boss'],{},1,[{hp:1000,armor:0,boss:true},{hp:1000,armor:0,boss:true,physicalImmune:true}]);
  assert.equal(engine.evaluate(preview,[tower('royalarsenal')]).rows[0].level,'weak');
  assert.ok(engine.evaluate(preview,[tower('royalarsenal'),tower('mage',6)]).rows[0].ordinal>0);
});

test('unknown towers, incomplete enemies and empty analyses are safe and conservative',()=>{
  const engine=new ArmyReadiness(data);assert.deepEqual(engine.evaluate(null,[]).rows,[]);
  const unknown=engine.evaluate(analysis(['boss'],{boss:true}),[tower('missing')]);assert.equal(unknown.activeCount,1);assert.equal(unknown.rows[0].level,'weak');
  const invalid=analysis(['boss'],{boss:true});invalid.enemies[0].variants[0].maxHp=null;invalid.enemies[0].variants[0].enemy.hp=null;
  assert.match(engine.evaluate(invalid,[tower('mage')]).rows[0].response,/Insufficient enemy data/);
  assert.equal(engine.evaluate(analysis(['boss'],{boss:true}),[tower('mage',999)]).rows[0].level,'weak');
});

test('evaluation never draws randomness, mutates inputs or produces numeric outcome predictions',()=>{
  const engine=new ArmyReadiness(data),preview=analysis(['boss','swarm','evasion'],{hp:5000,boss:true,evasion:.3},5),army=[tower('ladyclaire'),tower('roseguard'),tower('archangel')];
  const before=JSON.stringify({preview,army,data}),old=Math.random;Math.random=()=>{throw new Error('Readiness consumed RNG');};
  let result;try{result=engine.evaluate(preview,army);}finally{Math.random=old;}
  assert.equal(JSON.stringify({preview,army,data}),before);assert.ok(Object.isFrozen(result)&&Object.isFrozen(result.rows)&&result.rows.every(Object.isFrozen));
  assert.ok(result.rows.every(r=>!/%|win|lose|best|must build|recommended/i.test(r.response)));assert.equal(Object.hasOwn(result,'winProbability'),false);
});

test('configured relative-health and ordinal thresholds are honored without changing combat data',()=>{
  const fixture=structuredClone(data),preview=analysis(['highHealth'],{hp:3000});
  fixture.balance.wavePreview={readiness:{damageWindowSeconds:1,burstHealthFraction:1,minFairCoverage:.9,minGoodCoverage:.95,minStrongCoverage:1}};
  assert.equal(new ArmyReadiness(fixture).evaluate(preview,[tower('archer',5)]).rows[0].level,'weak');
  assert.equal(new ArmyReadiness(data).evaluate(preview,[tower('archer',5)]).rows[0].level,'strong');
});

test('the analyzer primary threats bound readiness rows without changing the full intelligence details',()=>{
  const preview=analysis(['highHealth','heavyArmor','swarm'],{hp:5000,armor:30});preview.primaryThreats=preview.threats.slice(0,1);
  const result=new ArmyReadiness(data).evaluate(preview,[tower('mage',6)]);
  assert.deepEqual(result.rows.map(r=>r.threatId),['highHealth']);assert.equal(preview.threats.length,3);
});

test('conditional petrification is described truthfully for blink without assuming enemy facing',()=>{
  const preview=analysis(['blink'],{hp:5000,blink:5}),engine=new ArmyReadiness(data);
  assert.match(engine.evaluate(preview,[tower('emeraldgolem')]).rows[0].response,/requires an attack proc and sustained facing/);
  assert.match(engine.evaluate(analysis(['blink'],{hp:5000,blink:5,magicImmune:true}),[tower('emeraldgolem')]).rows[0].response,/Ordinary slowing does not prevent/);
});

test('all actual campaign previews evaluate deterministically with canonical classified variant IDs',()=>{
  const analyzer=new WaveThreatAnalyzer(data),engine=new ArmyReadiness(data),army=[tower('archer',5),tower('mage',4),tower('cleric',3),tower('mechanicalgolem'),tower('wyvernhunter')];
  const original=JSON.stringify(data),old=Math.random;Math.random=()=>{throw new Error('Campaign readiness consumed RNG');};
  try{for(let index=0;index<data.waves.length;index++){
    const preview=analyzer.analyze(index),result=engine.evaluate(preview,army);
    assert.equal(result.rows.length,preview.primaryThreats.length||1);assert.ok(result.rows.every(r=>['weak','fair','good','strong'].includes(r.level)&&r.ordinal>=0&&r.ordinal<=3));
    assert.equal(engine.evaluate(preview,army),result);
  }}finally{Math.random=old;}
  assert.equal(JSON.stringify(data),original);
});

test('real untagged opening wave has a conservative damage response before and after keeping a defender',()=>{
  const preview=new WaveThreatAnalyzer(data).analyze(0);assert.deepEqual(preview.primaryThreats,[]);
  const engine=new ArmyReadiness(data),empty=engine.evaluate(preview,[]),kept=engine.evaluate(preview,[tower('archer')]);
  assert.equal(empty.rows[0].threatId,'standard');assert.equal(empty.rows[0].label,'Focused damage');assert.equal(empty.rows[0].level,'weak');
  assert.equal(kept.activeCount,1);assert.ok(kept.rows[0].ordinal>0);assert.match(kept.rows[0].response,/actual enemy health and defenses/);
  assert.deepEqual(engine.evaluate({primaryThreats:[],enemies:[],totalCount:0},[tower('archer')]).rows,[]);
});

test('an explicitly nonboss variant does not inherit its aggregate group boss flag',()=>{
  const fixture=custom({ordinary:stats({damage:100}),specialist:stats({damage:100,bossBonus:10})}),preview=analysis(['highHealth'],{hp:5000,boss:false},1);preview.enemies[0].boss=true;
  const engine=new ArmyReadiness(fixture);
  assert.equal(engine.evaluate(preview,[tower('specialist')]).rows[0].ordinal,engine.evaluate(preview,[tower('ordinary')]).rows[0].ordinal);
});
