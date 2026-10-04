import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Group,Mesh,BoxGeometry,MeshStandardMaterial,NormalBlending,Vector3} from 'three';
import {createEnemyAura,animateEnemyAura,enemyAuraStage} from '../game/render/enemy-aura.js';
import {enemyFigure,installEnemyTemplate,animateEnemyCues,disposeEnemyFigure} from '../game/render/enemy-assets.js';
import {CombatManager} from '../game/core/combat.js';
import {EnemyAbilityEffects,enemyDefenseVisualState,hasEnemySpecialMechanic} from '../game/render/geometric-enemy-effects.js';
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
test('five visual stages apply only to real special mechanics, with the first ten waves still bare',()=>{
  for(let wave=1;wave<=50;wave++){
    const type=`host_${String(wave).padStart(2,'0')}`;
    assert.equal(enemyAuraStage({type,armor:100}),0,'wave rank and armor alone do not create an aura');
    assert.equal(enemyAuraStage({type,regen:1}),Math.floor((wave-1)/10));
  }
  assert.equal(createEnemyAura({type:'host_10',boss:true},body()),null);
  for(const wave of [11,21,31,41,50]){
    const enemy={type:`host_${wave}`,boss:wave===50,flying:wave===50,hp:120,speed:1,regen:1},snapshot=structuredClone(enemy);
    const aura=createEnemyAura(enemy,body());assert.ok(aura);assert.deepEqual(enemy,snapshot);
    animateEnemyAura(aura,10);assert.equal(aura.userData.uniforms.time.value,10);
    animateEnemyAura(aura,20,{reducedMotion:true});assert.equal(aura.userData.uniforms.time.value,0);
    assert.equal(aura.children[0].material.blending,NormalBlending,'black smoke must actually darken');
    assert.ok(aura.children.length<=4);assert.equal(aura.userData.vortex!==undefined,wave===50);
  }
});

test('actual armor-only campaign spawns have no aura, shield, ring or glyph while special variants keep their protection',()=>{
  const definitions=JSON.parse(readFileSync(new URL('../data/enemies.json',import.meta.url)));
  const route=[{x:0,z:0},{x:10,z:0}],game={data:{enemies:definitions},grid:{route,checkpoints:route},emit(){}},combat=new CombatManager(game);
  const scene=new Group(),effects=new EnemyAbilityEffects(scene);
  const ordinary=['host_01','host_02','host_03','host_04','host_05','host_07','host_10','host_11','host_13','host_20','host_22','host_25','host_30'].map(type=>combat.spawn(type));
  const plainBefore=structuredClone(ordinary),shape=body();
  try{
    assert.equal(ordinary.find(e=>e.type==='host_02').armor,1,'the reported wave-two armor value is exercised');
    for(const enemy of ordinary){
      assert.equal(hasEnemySpecialMechanic(enemy),false,enemy.type+' armor alone is ordinary');
      assert.equal(enemyAuraStage(enemy),0);
      assert.equal(createEnemyAura(enemy,shape),null);
      assert.deepEqual(enemyDefenseVisualState(enemy),[]);
      assert.equal(createEnemyAura({...enemy,auraStage:4},shape),null,'an authored wave color cannot bypass the no-ability rule');
    }
    effects.sync(ordinary);
    assert.equal(effects.batches.size,0,'no rings, floating shields, glyphs or crystals are allocated');
    assert.equal(effects.group.children.length,0);
    assert.deepEqual(ordinary,plainBefore,'appearance does not change defenses or spawn data');
    const special=[
      combat.spawn('host_35',{variant:definitions.host_35.variants[0]}),
      combat.spawn('host_35',{variant:definitions.host_35.variants[1]}),
      combat.spawn('host_14'),combat.spawn('host_24'),
      combat.spawn('host_02',{resists:{fire:.35}}),
    ];
    assert.equal(enemyAuraStage(special[0]),3);assert.equal(enemyAuraStage(special[1]),3);
    assert.deepEqual(enemyDefenseVisualState(special[0]).map(s=>s.kind),['magicImmune']);
    assert.deepEqual(enemyDefenseVisualState(special[1]).map(s=>s.kind),['physicalImmune']);
    assert.deepEqual(enemyDefenseVisualState(special[2]).map(s=>s.kind),['refraction']);
    assert.deepEqual(enemyDefenseVisualState(special[3]),[],'reactive armor is not active before a direct hit');
    special[3].reactiveStacks=1;
    assert.deepEqual(enemyDefenseVisualState(special[3]).map(s=>s.kind),['reactive']);
    assert.deepEqual(enemyDefenseVisualState(special[4]).map(s=>s.kind),['fire'],'an actual typed modifier retains its symbol');
    effects.sync([...ordinary,...special]);
    assert.equal(effects.batches.has('armor'),false);
    for(const kind of ['magicImmune','physicalImmune','refraction','reactive','fire']){assert.equal(effects.batches.get(kind).glyph.count,3,kind+' keeps several small symbols');assert.equal(effects.batches.get(kind).dots.count,6,kind+' keeps matching colored dots');}
    assert.equal(effects.batches.get('refraction').crystals.count,3);
    special[2].shields=0;special[3].reactiveStacks=0;special[4].magicShred=.5;
    effects.sync([...ordinary,...special]);
    for(const kind of ['refraction','reactive','fire'])assert.equal(effects.batches.get(kind).glyph.count,0,kind+' disappears when its real protection is depleted');
    assert.deepEqual(enemyDefenseVisualState({...ordinary[1],reactiveStacks:5}),[],'stale stack markers do not invent a reactive ability');
  }finally{effects.dispose();shape.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});}
});

test('aura fits the actor once in its parent coordinates through battlefield scale, heading and flight lift',()=>{
  const template=new Group(),parts=new Group(),mesh=new Mesh(new BoxGeometry(2,3,1),new MeshStandardMaterial());
  parts.position.set(.11,.2,-.07);parts.rotation.y=.18;parts.scale.set(.9,1.1,.85);mesh.position.set(-.11,1.5,.07);parts.add(mesh);template.add(parts);
  const disposeAura=aura=>aura.traverse(node=>{node.geometry?.dispose();node.material?.dispose();});
  try{
    for(const flying of [false,true]){
      // These are the actual exhibition/game lifts; neither belongs in the
      // sibling aura's local geometry or gets multiplied into its placement.
      const enemy={type:'host_50',visualAsset:'host_50-tyrant',auraStage:4,boss:true,flying,krakenShell:83},snapshot=structuredClone(enemy);
      const nativeActor=new Group(),nativeBody=template.clone(true);nativeActor.add(nativeBody);
      const nativeAura=createEnemyAura(enemy,nativeBody);nativeActor.add(nativeAura);
      const expected=nativeAura.children.map(child=>({position:child.position.clone(),scale:child.scale.clone(),height:child.geometry?.parameters?.height,radius:child.geometry?.parameters?.radiusBottom}));
      for(const [scale,lift] of [[1,flying?.65:0],[.88,flying?.8:0]]){
        const container=new Group(),actor=new Group(),actualBody=template.clone(true);
        container.position.set(-5,2,7);container.rotation.y=-.47;container.scale.setScalar(1.15);
        actor.scale.setScalar(scale);actor.rotation.set(.13,.73,-.11);actor.position.set(9,lift,-4);actor.add(actualBody);container.add(actor);
        // The real UI bar is a sibling and must never enlarge body bounds.
        const bar=new Mesh(new BoxGeometry(100,100,100),mesh.material);bar.position.y=50;actor.add(bar);
        const nativeTransform=actualBody.position.clone(),aura=createEnemyAura(enemy,actualBody);actor.add(aura);container.updateMatrixWorld(true);
        assert.equal(aura.userData.stage,enemy.auraStage,'the actual variant stage is preserved');
        assert.ok(aura.userData.vortex,'host_50 variants retain the final-boss vortex');
        for(const [index,child] of aura.children.entries()){
          const reference=expected[index];assert.ok(child.position.distanceTo(reference.position)<1e-9);assert.ok(child.scale.distanceTo(reference.scale)<1e-12);
          if(reference.height!==undefined)assert.ok(Math.abs(child.geometry.parameters.height-reference.height)<1e-9);
          if(reference.radius!==undefined)assert.ok(Math.abs(child.geometry.parameters.radiusBottom-reference.radius)<1e-9);
          const expectedWorld=actor.localToWorld(reference.position.clone());assert.ok(child.getWorldPosition(new Vector3()).distanceTo(expectedWorld)<1e-9,'flight lift and actor transform apply once');
        }
        assert.ok(Math.abs(aura.children[0].getWorldScale(new Vector3()).x-scale*1.15)<1e-12);
        assert.deepEqual(actualBody.position,nativeTransform);assert.deepEqual(enemy,snapshot);
        disposeAura(aura);bar.geometry.dispose();
      }
      disposeAura(nativeAura);
    }
  }finally{mesh.geometry.dispose();mesh.material.dispose();}
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
