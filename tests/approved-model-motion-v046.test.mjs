import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {installDefenderTemplate,cloneDefenderTemplate,disposeDefenderInstance} from '../game/render/defender-assets.js';
import {attackRig,triggerAttack,animateAttack,attackMuzzle,disposeAttack,beginDeath,animateDeath} from '../game/render/battle-animation.js';
import {installEnemyTemplate,enemyFigure,disposeEnemyFigure,enemyTemplateKey} from '../game/render/enemy-assets.js';
import {animateEnemyMotion} from '../game/render/enemy-motion.js';
import {approvedMotionController,approvedMotionAnchor,sampleApprovedAttack} from '../game/render/approved-model-motion.js';
import {CombatEffects} from '../game/render/combat-effects.js';

const root=new URL('../public/assets/geometric/',import.meta.url);
const manifest=name=>JSON.parse(readFileSync(new URL(`geometric-${name}.json`,root)));
const hash=b=>createHash('sha256').update(b).digest('hex');
async function load(entry){const bytes=readFileSync(new URL(entry.file,root));return new NativeTestGLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');}
function digest(scene){const h=createHash('sha256');scene.traverse(n=>{if(n.isMesh){for(const key of ['position','normal']){const a=n.geometry.attributes[key]?.array;if(a)h.update(Buffer.from(a.buffer,a.byteOffset,a.byteLength));}for(const m of Array.isArray(n.material)?n.material:[n.material])h.update(m.uuid);}});return h.digest('hex');}
function pose(scene){const h=createHash('sha256');scene.updateWorldMatrix(true,true);scene.traverse(n=>{h.update(JSON.stringify([n.name,...n.matrixWorld.elements,n.visible]));if(n.geometry?.userData.motionOwned)h.update(Buffer.from(n.geometry.attributes.position.array.buffer));});return h.digest('hex');}
function finite(scene){scene.updateWorldMatrix(true,true);scene.traverse(n=>assert.ok(n.matrixWorld.elements.every(Number.isFinite),n.name+' finite world matrix'));}
function disposeSource(scene){const resources=new Set();scene.traverse(n=>{if(n.geometry)resources.add(n.geometry);for(const m of Array.isArray(n.material)?n.material:[n.material])if(m)resources.add(m);});for(const r of resources)r.dispose();}

test('approved enemy appearance has all 54 exact V6 files and four structural variants',()=>{
  const m=manifest('enemies');assert.equal(m.revision,'approved-enemies-v6');assert.equal(m.entries.length,54);
  const provenance=JSON.parse(readFileSync(new URL('approved-enemies-v6/provenance.json',root)));
  assert.equal(provenance.enemies.length,54);
  for(const entry of m.entries){const b=readFileSync(new URL(entry.file,root)),record=provenance.enemies.find(x=>x.id===entry.id);assert.equal(hash(b),entry.assetSha256,entry.id);assert.equal(hash(b),record.sha256,entry.id);assert.equal(b.length,record.bytes);assert.ok(b.length<100*1024*1024);}
  for(const id of ['host_31-wraith','host_35-wraith','host_36-wraith','host_38-wraith']){
    assert.ok(m.entries.some(e=>e.id===id));assert.equal(enemyTemplateKey({type:id.split('-')[0],visualAsset:id}),id);
  }
});

for(const kind of ['defenders','champions'])test(`all approved ${kind} bind real motion, preserve templates, release from posed geometry and freeze on zero dt`,async()=>{
  const entries=manifest(kind).entries;assert.equal(entries.length,kind==='defenders'?48:38);
  for(const entry of entries){
    const source=await load(entry),before=digest(source.scene);
    const view={disposed:false,imported:new Map(),game:{towers:[],data:{towers:{}}}};
    installDefenderTemplate(view,entry,source.scene,source.animations);
    const actor=cloneDefenderTemplate(source.scene),rig=attackRig(actor,entry.family,{damage:10});
    assert.ok(rig.approved,entry.id);assert.ok(rig.approved.motion.channels.length,entry.id);
    actor.position.set(1,.85,-2);actor.rotation.y=.4;actor.scale.setScalar(.704);
    const rest=pose(actor);sampleApprovedAttack(rig.approved,.4);assert.notEqual(pose(actor),rest,entry.id+' real articulation changes the actual figure');
    rig.approved.motion.reset();
    triggerAttack(rig,{stats:{interval:.8},combatTime:.4,visualRate:1});
    for(const dt of [.03,.1,.24]){animateAttack(rig,dt,.5,{combat:true,stamp:.5});finite(actor);}
    const posed=pose(actor);animateAttack(rig,0,200,{combat:true,stamp:200});assert.equal(pose(actor),posed,entry.id+' pause');
    assert.equal(digest(source.scene),before,entry.id+' original source buffers/materials');
    const anchor=attackMuzzle(rig,new THREE.Vector3());assert.ok(anchor,entry.id+' has an actual physical release surface');assert.ok(anchor.toArray().every(Number.isFinite),entry.id+' actual anchor');
    const c=approvedMotionController(actor);c.motion.reset();finite(actor);
    disposeAttack(rig);disposeDefenderInstance(actor);assert.equal(digest(source.scene),before,entry.id+' disposal preserves source');disposeSource(source.scene);
  }
});

test('all 54 approved enemy actors articulate, freeze independently and perform one persistent grounded death',async()=>{
  for(const entry of manifest('enemies').entries){
    const source=await load(entry),before=digest(source.scene);
    const view={disposed:false,enemyTemplates:new Map(),game:{combat:{enemies:[]}},updateCampPreview(){}};
    installEnemyTemplate(view,entry,source.scene);
    const enemy={id:1,type:entry.id.split('-')[0],visualAsset:entry.id,flying:entry.locomotion==='flying',speed:1,x:5,z:7,statuses:{}};
    const figure=enemyFigure(enemy,view.enemyTemplates),c=approvedMotionController(figure.userData.body);
    assert.ok(c?.motion.channels.length,entry.id);
    const rest=pose(figure);
    animateEnemyMotion(figure,enemy,.2);animateEnemyMotion(figure,enemy,.45);finite(figure);
    assert.notEqual(pose(figure),rest,entry.id+' living articulation changes the actual figure');
    const moved=pose(figure);animateEnemyMotion(figure,enemy,.45);assert.equal(pose(figure),moved,entry.id+' paused clock');
    figure.position.set(3,enemy.flying?.8:0,5);figure.rotation.y=.7;figure.scale.setScalar(.704);
    beginDeath(figure,enemy);const death=figure.userData.modelDeath;assert.ok(death,entry.id+' one-shot death');
    assert.ok(death.summary.supportPointCount<death.summary.renderedVertexCount,entry.id+' bounded contact budget');
    animateDeath(figure,.2);animateDeath(figure,5);finite(figure);assert.ok(death.finished);
    assert.ok(death.lastSample.supportMinY>=.0249,entry.id+' ground support');
    const settled=pose(figure);animateDeath(figure,10);animateEnemyMotion(figure,enemy,20);assert.equal(pose(figure),settled,entry.id+' corpse stays settled');
    assert.equal(digest(source.scene),before,entry.id+' source unchanged');disposeEnemyFigure(figure);disposeSource(source.scene);
  }
});

test('release identity is cosmetic and repeated multishot events do not restart the same cast',async()=>{
  const entry=manifest('defenders').entries.find(e=>e.id==='mage-1'),source=await load(entry);
  const view={disposed:false,imported:new Map(),game:{towers:[],data:{towers:{}}}};installDefenderTemplate(view,entry,source.scene,source.animations);
  const actor=cloneDefenderTemplate(source.scene),rig=attackRig(actor,entry.family),payload={stats:{interval:1},combatTime:2};
  const frozen=JSON.stringify(payload);triggerAttack(rig,payload);const atRelease=pose(actor),anchor=approvedMotionAnchor(actor,new THREE.Vector3(),{kind:'staff'});
  triggerAttack(rig,payload);assert.equal(pose(actor),atRelease);assert.equal(JSON.stringify(payload),frozen);assert.ok(anchor);
  animateAttack(rig,.1,2.1,{combat:true,stamp:2.1});assert.notEqual(pose(actor),atRelease);
  disposeAttack(rig);disposeDefenderInstance(actor);disposeSource(source.scene);
});

test('actual champion motion excludes runtime aura geometry added before attack binding',async()=>{
  const entry=manifest('champions').entries.find(e=>e.id==='embercrown'),source=await load(entry);
  const view={disposed:false,imported:new Map(),game:{towers:[],data:{towers:{}}}};installDefenderTemplate(view,entry,source.scene,source.animations);
  const actor=cloneDefenderTemplate(source.scene),ornament=new THREE.Mesh(new THREE.TorusGeometry(.7,.04,4,12),new THREE.MeshBasicMaterial({color:'#aadfff'}));
  ornament.name='Runtime champion aura';ornament.position.y=.15;actor.add(ornament);
  const before=pose(ornament),rig=attackRig(actor,entry.family);
  assert.equal(ornament.parent,actor,'live decorations remain outside source-coordinate transforms');
  assert.ok(!ornament.geometry.userData.motionOwned,'source model deformation never clones a runtime aura');
  sampleApprovedAttack(rig.approved,.4);assert.equal(pose(ornament),before,'all-part dragon motion leaves its live aura unchanged');
  assert.equal(ornament.parent,actor);disposeAttack(rig);disposeDefenderInstance(actor);ornament.geometry.dispose();ornament.material.dispose();disposeSource(source.scene);
});

test('production CombatEffects uses actual animated dragon and Thunderbird mouths and the Archangel staff',async()=>{
  for(const id of ['embercrown','worldfire','thunderheart','phoenix','starfall','archangel']){
    const entry=manifest('champions').entries.find(e=>e.id===id),source=await load(entry);
    const view={disposed:false,imported:new Map(),game:{towers:[],data:{towers:{}}}};installDefenderTemplate(view,entry,source.scene,source.animations);
    const actor=cloneDefenderTemplate(source.scene),rig=attackRig(actor,id),kind=id==='archangel'?'staff':'mouth';
    actor.position.set(3,.85,5);actor.rotation.y=.6;actor.scale.setScalar(.704);
    const effects=new CombatEffects(new THREE.Scene(),{getMuzzle:(_source,out,options)=>attackMuzzle(rig,out,options)}),unit={id:1,family:id,x:3,z:5};
    try{
      const before=effects.muzzle(unit);sampleApprovedAttack(rig.approved,.43);
      const actual=effects.muzzle(unit),expected=approvedMotionAnchor(actor,new THREE.Vector3(),{kind});
      assert.ok(expected,id+' required authored release surface exists');
      assert.ok(actual.distanceTo(expected)<1e-10,id+' production caller keeps the actual animated '+kind+' instead of a generic height');
      assert.ok(actual.distanceTo(new THREE.Vector3(3,1.5,5))>.05,id+' rejects the old height fallback');
      assert.ok(actual.distanceTo(before)>1e-5,id+' production release follows the actual animated surface');
      const anchor=rig.approved.anchors.get(kind);assert.ok(anchor,id+' correct caller anchor kind');
      if(kind==='mouth'){
        assert.match(anchor.mesh.name,/mandible|lower.*jaw|beak/i,id+' release belongs to the physical mouth');
        assert.ok(effects.muzzle(unit,unit,{breath:true}).distanceTo(expected)<1e-10,id+' ordinary and aura breath use the same physical mouth');
      }
    }finally{effects.dispose();disposeAttack(rig);disposeDefenderInstance(actor);disposeSource(source.scene);}
  }
});
