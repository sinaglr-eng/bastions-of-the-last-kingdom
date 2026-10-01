import test from 'node:test';
import assert from 'node:assert/strict';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,NormalBlending} from 'three';
import {createEnemyAura,animateEnemyAura,enemyAuraStage} from '../game/render/enemy-aura.js';
import {enemyFigure,installEnemyTemplate,animateEnemyCues,disposeEnemyFigure} from '../game/render/enemy-assets.js';
import {CombatManager} from '../game/core/combat.js';
const body=()=>{const root=new Group(),mesh=new Mesh(new BoxGeometry(.6,2,.6),new MeshStandardMaterial({emissive:'#553311',emissiveIntensity:.1}));mesh.position.y=1;root.add(mesh);return root;};
const cueFixture=kinds=>{
  const template=new Group();
  for(const kind of kinds){const mesh=body().children[0];mesh.userData.visualCue=kind;template.add(mesh);}
  const root=enemyFigure({type:'cue-test'},new Map([['cue-test',template]])),materials=new Map(root.userData.visualCues.map(cue=>[cue.kind,cue.materials[0]]));
  return {root,materials,dispose(){disposeEnemyFigure(root);template.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});}};
};
// Use the combat rules as the oracle, with a stationary, non-attacking observer.
const combatFixture=(time,traits={},dt=.005)=>{
  const tower={id:1,family:'observer',tier:1,state:'active',x:0,z:0,cooldown:0},game={
    data:{balance:{},towers:{observer:{advanced:true,damage:0,range:2}}},towers:[tower],lives:30,emit(){},
    completeWave(){assert.fail('the fixture route must stay in progress');},end(){assert.fail('the fixture cannot end');},
  };
  const enemy={id:1,type:'cue-test',hp:50,maxHp:100,speed:1,x:0,z:0,traveled:0,pathIndex:1,pathLength:1000,route:[{x:0,z:0},{x:1000,z:0}],statuses:{},dead:false,hit:0,reactiveStacks:0,...traits};
  const combat=new CombatManager(game);combat.enemies=[enemy];combat.elapsed=time-dt;combat.update(dt);
  return {enemy,tower,elapsed:combat.elapsed,dt};
};
test('five visual stages include bare first ten waves, even their boss',()=>{
  for(let wave=1;wave<=50;wave++)assert.equal(enemyAuraStage({type:`host_${String(wave).padStart(2,'0')}`}),Math.floor((wave-1)/10));
  assert.equal(createEnemyAura({type:'host_10',boss:true},body()),null);
  for(const wave of [11,21,31,41,50]){
    const enemy={type:`host_${wave}`,boss:wave===50,flying:wave===50,hp:120,speed:1},snapshot=structuredClone(enemy);
    const aura=createEnemyAura(enemy,body());assert.ok(aura);assert.deepEqual(enemy,snapshot);
    animateEnemyAura(aura,10);assert.equal(aura.userData.uniforms.time.value,10);
    animateEnemyAura(aura,20,{reducedMotion:true});assert.equal(aura.userData.uniforms.time.value,0);
    assert.equal(aura.children[0].material.blending,NormalBlending,'black smoke must actually darken');
    assert.ok(aura.children.length<=4);assert.equal(aura.userData.vortex!==undefined,wave===50);
  }
});
test('native variant selection refreshes a live fallback immediately and keeps unrelated actors',()=>{
  const live=new Group(),unrelated=new Group(),enemies=[{id:1,type:'host_31',visualAsset:'host_31-wraith'},{id:2,type:'host_01'}];
  live.userData.assetKey='host_31';unrelated.userData.assetKey='host_01';
  const view={enemyTemplates:new Map([['host_01',body()]]),game:{combat:{enemies}},enemies:new Map([[1,live],[2,unrelated]]),updateCampPreview(){this.previews=(this.previews||0)+1;}};
  assert.ok(installEnemyTemplate(view,{id:'host_31-wraith'},body()));assert.equal(view.enemies.has(1),false);assert.equal(view.enemies.get(2),unrelated);assert.equal(view.previews,1);
  view.disposed=true;assert.equal(installEnemyTemplate(view,{id:'host_45'},body()),false);assert.equal(view.enemyTemplates.has('host_45'),false);
});
test('actual cue state animates private materials and disposal leaves templates usable',()=>{
  const template=body(),mesh=template.children[0];mesh.userData.visualCue='reactiveArmor';
  const root=enemyFigure({type:'host_36'},new Map([['host_36',template]]));
  const cloned=root.userData.body.children[0];assert.notEqual(mesh.material,cloned.material);assert.equal(mesh.geometry,cloned.geometry);
  animateEnemyCues(root,{reactiveStacks:12},4);assert.ok(cloned.material.emissiveIntensity>.7);assert.equal(mesh.material.emissiveIntensity,.1);
  animateEnemyCues(root,{reactiveStacks:0},4);assert.equal(cloned.material.emissiveIntensity,.1);
  let sharedDisposed=false,ownedDisposed=false;mesh.geometry.addEventListener('dispose',()=>sharedDisposed=true);cloned.material.addEventListener('dispose',()=>ownedDisposed=true);
  disposeEnemyFigure(root);assert.equal(sharedDisposed,false);assert.equal(ownedDisposed,true);
});
test('reduced motion preserves rush and war-drum windows from actual combat movement',()=>{
  for(const [kind,trait] of [['rush',{rush:2}],['warDrums',{hasteAura:1.18}]]){
    const fixture=cueFixture([kind]);
    try{
      for(const time of [0,.5,1.999,2,2.999,3,5.999,6,7.999,8,8.999,9]){
        const {enemy,elapsed,dt}=combatFixture(time,trait),snapshot=structuredClone(enemy),active=enemy.traveled/dt>1.01;
        for(const reducedMotion of [false,true]){
          animateEnemyCues(fixture.root,enemy,elapsed,{reducedMotion});
          assert.equal(fixture.materials.get(kind).emissiveIntensity>.1+.15*.7+.01,active,`${kind} at ${elapsed}s, reducedMotion=${reducedMotion}`);
          if(kind==='warDrums'&&reducedMotion&&active)assert.equal(fixture.materials.get(kind).emissiveIntensity,.1+.45*.7,'an active drum stays steady under reduced motion');
          assert.deepEqual(enemy,snapshot,'drawing a cue must not change combat');
        }
      }
    }finally{fixture.dispose();}
  }
});
test('reduced motion preserves the real per-enemy disarm phase, including reactivation',()=>{
  const fixture=cueFixture(['disarm']);
  try{
    for(const id of [1,9])for(const time of [0,.5,.879,.88,1.25,4.66,4.67,5.2,6,7.75,8,9]){
      const {enemy,tower,elapsed}=combatFixture(time,{id,disarm:true}),snapshot=structuredClone(enemy);
      for(const reducedMotion of [false,true]){
        animateEnemyCues(fixture.root,enemy,elapsed,{reducedMotion});
        assert.equal(fixture.materials.get('disarm').emissiveIntensity>.5,tower.disarmed,`enemy ${id} at ${elapsed}s, reducedMotion=${reducedMotion}`);
        assert.deepEqual(enemy,snapshot);
      }
    }
  }finally{fixture.dispose();}
});
test('recharge and blink cues follow actual countdowns and healing block in either motion mode',()=>{
  const fixture=cueFixture(['recharge','blink','regen']);
  try{
    for(const countdown of [.001,4])for(const blocked of [false,true]){
      const {enemy,elapsed}=combatFixture(4,{recharge:.12,rechargeClock:countdown,blink:3,blinkClock:countdown,statuses:blocked?{healBlock:{time:10}}:{}}),snapshot=structuredClone(enemy);
      for(const reducedMotion of [false,true]){
        animateEnemyCues(fixture.root,enemy,elapsed,{reducedMotion});
        assert.equal(fixture.materials.get('recharge').emissiveIntensity>.5,enemy.hp>50,`recharge countdown=${countdown}, blocked=${blocked}, reducedMotion=${reducedMotion}`);
        assert.equal(fixture.materials.get('blink').emissiveIntensity>.5,enemy.traveled>1,'blink glow follows a real dash');
        assert.equal(fixture.materials.get('regen').emissiveIntensity===.1,blocked,'blocked healing never gains decorative glow');
        assert.deepEqual(enemy,snapshot);
      }
    }
  }finally{fixture.dispose();}
});
