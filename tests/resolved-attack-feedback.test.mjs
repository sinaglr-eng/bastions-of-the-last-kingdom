import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CombatEffects,attackVisualStyle} from '../game/render/combat-effects.js';
import {activeAttackStatuses,newAttackStatuses} from '../game/core/attack-feedback.js';
import {loadCurrentDatasets} from '../tools/current-datasets.mjs';
import {readTowerStats} from '../game/core/math.js';

const data=loadCurrentDatasets();
test('each primary contact keeps its own resolution across nested hits and misses',()=>{
  const fx=new CombatEffects(new THREE.Scene());
  const source={id:1,family:'runebreaker',tier:1,x:0,z:0},target={id:2,x:3,z:0};
  const stats=readTowerStats(source,data.crown);
  try{
    for(const [reason,symbol] of [['evasion','Glancing miss'],['shield','Shield face'],['physical-immunity','Sealed immunity ward']]){
      fx.event('damage-trace',{enemy:target,source,type:'holy',effectiveDamage:8});
      fx.event('impact',{target,source,stats,result:{type:'physical',effectiveDamage:0,blockReason:reason}});
      assert.ok(fx.effects.at(-1).object.getObjectByName(symbol));
    }
    fx.event('impact',{target,source,stats,result:{type:'physical',effectiveDamage:4,immunityMultiplier:.4,critical:true}});
    const impact=fx.effects.at(-1).object;
    assert.ok(impact.getObjectByName('Critical contact'));assert.ok(impact.getObjectByName('Broken ward'));
    const count=fx.effects.length;
    fx.event('impact',{target,source,stats,result:null});assert.equal(fx.effects.length,count);
    fx.event('impact',{target,source,stats,result:{visible:false,effectiveDamage:8}});assert.equal(fx.effects.length,count);
  }finally{fx.dispose();}
});
test('new status accents occur once per application period',()=>{
  const target={statuses:{poison:{time:2}}};
  const before=activeAttackStatuses(target);
  target.statuses.poison.time=5;target.statuses.slow={time:1};
  assert.deepEqual(newAttackStatuses(target,before),['slow']);
  assert.deepEqual(newAttackStatuses(target,activeAttackStatuses(target)),[]);
  target.dead=true;assert.deepEqual(newAttackStatuses(target,before),[]);
});
test('crook casters project embers and jade weapon contacts retain their material',()=>{
  for(const [faction,family,element] of [['grove','el_dragon_keeper','fire'],['crown','thunderheart','fire'],['grove','el_veilfire_hierophant','jade']]){
    const stats=readTowerStats({family,tier:1},data[faction]);
    assert.equal(attackVisualStyle(family,stats).element,element);assert.equal(stats.type,'magical');
  }
});
test('cone uses the actual world-space range when the first target is close',()=>{
  const fx=new CombatEffects(new THREE.Scene());
  try{
    const beam=fx.coneGeometry({source:{x:0,z:0},target:{x:1,z:0},stats:{range:6,continuousAttack:{angleDegrees:30}}});
    assert.equal(beam.end.x,6);assert.equal(beam.end.z,0);assert.ok(Math.abs(beam.width-6*Math.tan(Math.PI/12))<1e-10);
  }finally{fx.dispose();}
});