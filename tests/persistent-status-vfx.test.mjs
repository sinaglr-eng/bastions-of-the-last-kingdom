import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Game} from '../game/core/game.js';
import {loadCurrentDatasets} from '../tools/current-datasets.mjs';
import {towerStats} from '../game/core/math.js';
import {fr002Impact,updateFr002Tower} from '../game/core/fr002-combat.js';
import {CombatStatusVfx} from '../game/render/combat-status-vfx.js';
import {SupportEffects,enemyStatusState} from '../game/render/support-effects.js';

const datasets=loadCurrentDatasets(),count=(fx,key)=>fx.batches.get(key)?.count||0;
function arena(faction,family,options={}){
  const data=datasets[faction],game=new Game(data,{seed:9201}),scene=new THREE.Scene();
  game.phase='combat';game.combat.spawnQueue=[{time:1e9,type:'host_01'}];game.rng=()=>.999999;
  const source={id:101,family,tier:1,state:'active',x:10,z:10,kills:0,cooldown:999,mvpLevel:0};game.towers=[source];
  const enemy=Object.assign(game.combat.spawn('host_01'),{x:11,z:10,hp:1e9,maxHp:1e9,speed:0,boss:false,armor:0,shields:0,refraction:0,evasion:0,krakenShell:0,magicImmune:false,physicalImmune:false,cloaked:false,statuses:{}});
  const support=new SupportEffects(scene,{isVisible:e=>game.combat.isRevealed(e)}),fx=new CombatStatusVfx(scene,{isVisible:e=>game.combat.isRevealed(e),getTime:()=>game.combat.elapsed,...options});
  game.on((type,payload)=>fx.event(type,payload));
  const sync=()=>{support.sync(game.towers,data,{combat:game.combat,phase:game.phase,time:game.combat.elapsed});fx.sync(game.phase==='combat'?game.combat.enemies:[],{states:support.enemyStates,time:game.combat.elapsed});};
  return {data,game,source,enemy,support,fx,sync,impact(){fr002Impact(game.combat,{source,target:enemy,stats:towerStats(source,data),firstPrimary:true,directTargets:[enemy],releaseCount:1,release:{}});},dispose(){fx.dispose();support.dispose();}};
}
const matrixSnapshot=fx=>[...fx.batches].map(([key,b])=>[key,b.count,Array.from(b.instanceMatrix.array.slice(0,b.count*16))]);

test('real current Human, Dwarf and Elf Burn contacts keep body flames for the entire actual duration',()=>{
  for(const [faction,family]of [['crown','fireballista'],['forge','dw_grenadier'],['grove','el_dragon_keeper']]){
    const h=arena(faction,family);try{
      h.impact();h.sync();assert.ok(h.enemy.statuses.burn?.time>0,faction+' established real Burn');assert.ok(count(h.fx,'burn')>=2);assert.equal(count(h.fx,'heat'),0);
      const duration=h.enemy.statuses.burn.time;h.game.combat.update(duration-.01);h.sync();assert.ok(count(h.fx,'burn')>0,'Fire remains on the final active fraction of a second');
      h.game.combat.update(.011);h.sync();assert.equal(h.enemy.statuses.burn,undefined);assert.equal(count(h.fx,'burn'),0);
    }finally{h.dispose();}
  }
});

test('all three current faction Fire Auras show flames only for actual continuous damage and immediately follow coverage',()=>{
  for(const [faction,family]of [['crown','embercrown'],['forge','dw_cinderhowitzer'],['grove','el_fire_dragon']]){
    const h=arena(faction,family);try{
      h.enemy.flying=true; // Isolate Fire Aura from the Elf dragon's ground-only cone and its Burn contact.
      const apply=()=>updateFr002Tower(h.game.combat,h.source,towerStats(h.source,h.data),.01,1),fire=towerStats(h.source,h.data).abilities.find(a=>a.familyId==='fire-aura');
      const hp=h.enemy.hp;apply();h.sync();assert.ok(h.enemy.hp<hp);assert.equal(h.enemy.statuses.burn,undefined);assert.ok(count(h.fx,'heat')>0,faction+' fire aura does not require a timed Burn');
      h.enemy.x=h.source.x+fire.radius+.001;h.sync();assert.equal(count(h.fx,'heat'),0);
      h.enemy.x=11;h.source.attackPaused=true;h.sync();assert.equal(count(h.fx,'heat'),0);h.source.attackPaused=false;
      h.enemy.magicImmune=true;const immuneHp=h.enemy.hp;apply();h.sync();assert.equal(h.enemy.hp,immuneHp);assert.equal(count(h.fx,'heat'),0,'Damage immunity is not painted as a burning victim');
      h.enemy.magicImmune=false;h.source.disarmed=true;h.sync();assert.equal(count(h.fx,'heat')>0,!towerStats(h.source,h.data).factionProfile,'Legacy Human fire aura continues under Disarm; faction ability updates do not');h.source.disarmed=false;
      h.sync();assert.ok(count(h.fx,'heat')>0);h.source.state='ruin';h.sync();assert.equal(count(h.fx,'heat'),0);
    }finally{h.dispose();}
  }
});

test('actual faction Root and Stun remain distinct from freezing and release immediately on expiry',()=>{
  const rooted=arena('grove','el_stag_knight');try{
    const root=towerStats(rooted.source,rooted.data).abilities.find(a=>a.familyId==='root');rooted.game.combat.elapsed=root.cooldown;
    updateFr002Tower(rooted.game.combat,rooted.source,towerStats(rooted.source,rooted.data),.01,1);rooted.sync();
    assert.ok(rooted.enemy.statuses.root?.time>0);assert.ok(count(rooted.fx,'root')>0);assert.equal(count(rooted.fx,'freeze'),0);assert.equal(count(rooted.fx,'stun'),0);
    rooted.game.combat.update(root.duration+.001);rooted.sync();assert.equal(count(rooted.fx,'root'),0);
  }finally{rooted.dispose();}
  const stunned=arena('forge','dw_deepdelve');try{
    stunned.game.rng=()=>0;stunned.impact();stunned.sync();assert.ok(stunned.enemy.statuses.stun?.time>0);assert.ok(count(stunned.fx,'stun')>0);assert.equal(count(stunned.fx,'freeze'),0);
    const geometry=stunned.fx.batches.get('stun').geometry;assert.equal(geometry.type,'ExtrudeGeometry','Stun has actual five-point stars rather than the ice silhouette');
    stunned.game.combat.update(stunned.enemy.statuses.stun.time+.001);stunned.sync();assert.equal(count(stunned.fx,'stun'),0);
  }finally{stunned.dispose();}
});

test('all remaining live status channels have independent body shapes and expired timers never produce a marker',()=>{
  const h=arena('crown','archer');try{
    const statuses={slow:{amount:.4,time:2},shred:{amount:12,time:2},freeze:{time:2},stun:{time:2},root:{time:2},petrify:{time:2},poison:{time:2,dps:5},burn:{time:2,dps:5},bleed:{time:2,dps:5},healBlock:{time:2},regenReduction:{time:2,amount:.5},breachPhysical:{time:2,multiplier:.4},breachMagic:{time:2,multiplier:.6}};
    h.enemy.physicalImmune=true;h.enemy.magicImmune=true;h.enemy.statuses=statuses;h.sync();
    for(const key of ['armor','freeze','stun','root','petrify','poison','burn','bleed','healBlock','regenReduction','physicalPass','magicalPass'])assert.ok(count(h.fx,key)>0,key+' has a persistent body cue');
    const signatures=['freeze','stun','root','healBlock','regenReduction','physicalPass','magicalPass'].map(key=>Array.from(h.fx.batches.get(key).geometry.attributes.position.array).join(','));assert.equal(new Set(signatures).size,signatures.length);
    const before=JSON.stringify(h.enemy.statuses);h.sync();assert.equal(JSON.stringify(h.enemy.statuses),before,'Rendering does not decrement or rewrite combat state');
    for(const status of Object.values(statuses))status.time=0;h.sync();assert.equal(h.fx.count,0);assert.equal(h.fx.targets.size,0);
  }finally{h.dispose();}
});

test('persistent state pauses on the authoritative clock, reduced motion stays still, and removal or concealment clears every channel',()=>{
  const h=arena('crown','druid');try{
    h.impact();h.sync();const first=matrixSnapshot(h.fx);h.game.paused=true;h.game.tick(10);h.sync();assert.deepEqual(matrixSnapshot(h.fx),first);
    h.game.paused=false;h.game.tick(.05);h.sync();assert.notDeepEqual(matrixSnapshot(h.fx),first,'Normal status motion follows an advancing simulation clock');
    h.fx.reducedMotion=true;h.sync();const still=matrixSnapshot(h.fx);h.game.tick(.05);h.sync();assert.deepEqual(matrixSnapshot(h.fx),still);
    h.enemy.x=0;h.enemy.z=0;h.enemy.cloaked=true;h.sync();assert.equal(h.fx.count,0);h.enemy.cloaked=false;h.sync();assert.ok(h.fx.count>0);
    h.fx.pulse('heal',h.enemy);h.game.combat.enemies=[];h.sync();assert.equal(h.fx.count,0);assert.equal(h.fx.pulses.size,0,'Detached actors cannot keep an orphaned healing cue');
    h.game.combat.enemies=[h.enemy];h.sync();assert.ok(h.fx.count>0);h.enemy.dead=true;h.sync();assert.equal(h.fx.count,0);
  }finally{h.dispose();}
});

test('crowds receive one actual-state cue before decorative particles and reuse a fixed owned GPU budget',()=>{
  const scene=new THREE.Scene(),fx=new CombatStatusVfx(scene,{maxInstances:20}),enemies=Array.from({length:20},(_,id)=>({id,x:id,z:0,statuses:{}})),states=new Map(enemies.map(e=>[e.id,[{key:'poison'}]]));
  try{
    fx.sync(enemies,{states,time:1});assert.equal(fx.count,20);assert.equal(count(fx,'poison'),20);const batch=fx.batches.get('poison'),positions=[];
    for(let i=0;i<batch.count;i++){const matrix=new THREE.Matrix4();batch.getMatrixAt(i,matrix);positions.push(new THREE.Vector3().setFromMatrixPosition(matrix).x);}
    assert.equal(new Set(positions.map(x=>Math.round(x))).size,20,'A first-target particle cluster cannot consume another target’s only marker');
    const geometry=batch.geometry,material=batch.material;for(let frame=2;frame<50;frame++)fx.sync(enemies,{states,time:frame});assert.equal(batch.geometry,geometry);assert.equal(batch.material,material);assert.equal(scene.children.length,1);assert.equal(batch.instanceMatrix.count,20);assert.equal(batch.material.depthWrite,false);
    for(const enemy of enemies)states.set(enemy.id,[{key:'poison'},{key:'burn'},{key:'armor'}]);fx.sync(enemies,{states,time:50});assert.equal(fx.count,20);assert.equal(count(fx,'poison'),20);assert.equal(count(fx,'burn'),0,'A second condition cannot consume a later target’s first marker under overload');
    let disposed=0;for(const resource of [batch,geometry,material])resource.addEventListener('dispose',()=>disposed++);fx.dispose();fx.dispose();assert.equal(disposed,3);assert.equal(scene.children.length,0);
  }finally{fx.dispose();}
});

test('timed immunity breaches display their actual multiplier and disappear when their own timer ends',()=>{
  const enemy={id:1,x:10,z:10,physicalImmune:true,magicImmune:true,statuses:{breachPhysical:{time:1,multiplier:.25},breachMagic:{time:2,multiplier:.5}}},data={balance:{},towers:{}};
  assert.deepEqual(enemyStatusState(enemy,[],data).map(e=>[e.key,e.value]),[['physicalPass',.25],['magicalPass',.5]]);
  enemy.statuses.breachPhysical.time=0;assert.deepEqual(enemyStatusState(enemy,[],data).map(e=>e.key),['magicalPass']);delete enemy.statuses.breachMagic;assert.deepEqual(enemyStatusState(enemy,[],data),[]);
});

test('native body bounds keep fire, poison, coils and overhead markers outside the model with an overview pixel floor',()=>{
  const scene=new THREE.Scene(),figure=new THREE.Group(),body=new THREE.Mesh(new THREE.BoxGeometry(1.6,2,1.3),new THREE.MeshBasicMaterial()),enemy={id:1,x:3,z:4};body.position.y=1;figure.add(body);figure.userData.body=body;figure.userData.barHeight=2.15;figure.position.set(3,1.8,4);scene.add(figure);
  const camera=new THREE.PerspectiveCamera(38,1,.1,250);camera.position.set(4,20,15);camera.lookAt(3,2,4);camera.updateMatrixWorld();const fx=new CombatStatusVfx(scene,{camera:()=>camera,getViewport:()=>({height:720})}),figures=new Map([[1,figure]]),states=new Map([[1,['burn','poison','slow','stun','healBlock'].map(key=>({key}))]]);
  try{
    const geometry=body.geometry,material=body.material,vertices=body.geometry.attributes.position.array.slice(),envelope=fx.envelope(enemy,figures);assert.ok(Math.abs(envelope.height-2)<1e-6);assert.ok(Math.abs(envelope.radius-.8)<1e-6);assert.ok(Math.abs(envelope.top-3.8)<1e-6);
    fx.sync([enemy],{figures,states,time:1});const matrix=new THREE.Matrix4(),position=new THREE.Vector3();for(const kind of ['stun','healBlock']){fx.batches.get(kind).getMatrixAt(0,matrix);position.setFromMatrixPosition(matrix);assert.ok(position.y>envelope.top,kind+' stays above the head rather than inside the torso');}
    const fire=fx.batches.get('burn');fire.getMatrixAt(0,matrix);const fireBounds=new THREE.Box3().setFromBufferAttribute(fire.geometry.attributes.position).applyMatrix4(matrix);assert.ok(fireBounds.getSize(new THREE.Vector3()).y>envelope.height*.65,'Layered flames cover legs and torso rather than a tiny impact fleck');assert.ok(fire.geometry.attributes.color,'Fire has its own orange/yellow/core colors');
    const poison=fx.batches.get('poison');poison.getMatrixAt(0,matrix);position.setFromMatrixPosition(matrix);assert.ok(Math.hypot(position.x-envelope.centre.x,position.z-envelope.centre.z)>=envelope.radius*.9,'Clouds sit at the outer silhouette');
    const nearFeature=fx.envelope(enemy,figures).feature;camera.position.set(80,80,80);camera.lookAt(3,2,4);camera.updateMatrixWorld();assert.ok(fx.envelope(enemy,figures).feature>nearFeature,'Normal overview raises the feature-size floor');
    fx.sync([enemy],{figures,states,time:1});assert.equal(body.geometry,geometry);assert.equal(body.material,material);assert.deepEqual(body.geometry.attributes.position.array,vertices);assert.ok(fx.count<=fx.maxInstances);
  }finally{fx.dispose();body.geometry.dispose();body.material.dispose();figure.removeFromParent();}
});
