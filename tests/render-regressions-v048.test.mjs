import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {NativeTestGLTFLoader} from './helpers/native-gltf.mjs';
import {enemyTemplateKey,enemyAssetKey,enemyFigure,disposeEnemyFigure} from '../game/render/enemy-assets.js';
import {neededEnemyModelKeys,retainedEnemyModelKeys,EnemyModelLoader} from '../game/render/enemy-model-loader.js';
import {prepareApprovedMotionTemplate,approvedMotionController,approvedMotionAnchor,sampleApprovedAttack} from '../game/render/approved-model-motion.js';
import {cloneDefenderTemplate,disposeDefenderInstance,installDefenderTemplate} from '../game/render/defender-assets.js';
import {disposeDecodedGeometricAsset} from '../game/render/geometric-resources.js';
import {attackRig,attackMuzzle,disposeAttack} from '../game/render/battle-animation.js';
import {CombatEffects,attackVisualKind} from '../game/render/combat-effects.js';
import {animateEnemyMotion} from '../game/render/enemy-motion.js';

const assetRoot=new URL('../public/assets/geometric/',import.meta.url);
const readJSON=url=>JSON.parse(readFileSync(url,'utf8'));
const enemies=readJSON(new URL('../data/enemies.json',import.meta.url));
const waves=readJSON(new URL('../data/waves.json',import.meta.url));
const entries=readJSON(new URL('geometric-enemies.json',assetRoot)).entries;
async function load(entry){const b=readFileSync(new URL(entry.file,assetRoot));return new NativeTestGLTFLoader().parseAsync(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'');}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function sourceDigest(scene){
  const hash=createHash('sha256');scene.traverse(node=>{
    if(!node.isMesh)return;
    for(const attribute of Object.values(node.geometry.attributes))hash.update(Buffer.from(attribute.array.buffer,attribute.array.byteOffset,attribute.array.byteLength));
    for(const material of Array.isArray(node.material)?node.material:[node.material])hash.update(JSON.stringify(material.toJSON()));
  });return hash.digest('hex');
}

test('every real campaign and queued variant resolves to one of the 54 approved model identities without RNG',()=>{
  const installed=new Map(entries.map(entry=>[entry.id,{}]));
  for(let i=0;i<50;i++){
    const game={data:{enemies,waves},round:i+1,phase:'building',combat:{enemies:[],spawnQueue:[]}};
    const keys=neededEnemyModelKeys(game);assert.ok(keys.length>0);
    for(const key of keys)assert.ok(installed.has(key),`wave ${i+1} must request an actual approved file: ${key}`);
    for(const group of waves[i].groups){const base=enemies[group.type];
      for(const variant of Object.hasOwn(group,'variant')?[group.variant]:base.variants||[{}]){
        const enemy={...base,...variant,type:group.type};
        assert.ok(keys.includes(enemyAssetKey(enemy,installed)),'the cache protects the exact figure template, including solid aliases');
        game.combat.enemies=[enemy];game.combat.spawnQueue=[{type:group.type,modifiers:{variant}}];
        assert.ok(neededEnemyModelKeys(game).includes(enemyTemplateKey(enemy)));
      }
    }
  }
  for(const [alias,source]of [['host_31-ember','host_31'],['host_35-ember','host_35'],['host_36-ember','host_36'],['host_50-tyrant','host_50'],['host_50-devourer','host_50']])assert.equal(enemyTemplateKey({type:source,visualAsset:alias}),source);
  assert.equal(enemyTemplateKey({type:'host_35',visualAsset:'host_35-wraith'}),'host_35-wraith','spectral geometry must remain distinct');
});

test('late-wave solid and spectral models remain protected with their actual texture/material resources during cache pressure',async()=>{
  const chosen=['host_34','host_35','host_35-wraith','host_36','host_36-wraith'].map(id=>entries.find(entry=>entry.id===id));
  const figures=new Map(),templates=new Map(),sources=new Map(),released=[],events=[];
  let game={data:{enemies,waves},round:35,phase:'building',combat:{enemies:[],spawnQueue:[]}};
  const loader=new EnemyModelLoader({cacheSize:1,concurrency:2,
    load:async entry=>{const decoded=await load(entry);sources.set(entry.id,decoded);decoded.scene.traverse(node=>{
      for(const material of Array.isArray(node.material)?node.material:[node.material])if(material)for(const resource of [material,...Object.values(material).filter(value=>value?.isTexture)])resource.addEventListener('dispose',()=>events.push(entry.id));
    });return decoded;},
    install:(entry,decoded)=>{prepareApprovedMotionTemplate(decoded.scene,entry);templates.set(entry.id,decoded.scene);return true;},
    protectedKeys:()=>retainedEnemyModelKeys(game,{figures:figures.values()}),
    release:(key,decoded)=>{released.push(key);templates.delete(key);disposeDecodedGeometricAsset(decoded);},
  });
  loader.index(chosen);loader.request(['host_35','host_35-wraith']);
  while(loader.pending.size)await tick();
  const states=enemies.host_35.variants.map((variant,i)=>({...enemies.host_35,...variant,id:i+1,type:'host_35',statuses:{}}));
  const hashes=new Map([...sources].map(([id,decoded])=>[id,sourceDigest(decoded.scene)]));
  for(const state of states){const figure=enemyFigure(state,templates);figures.set(state.id,figure);assert.equal(figure.userData.sharedAsset,true);assert.equal(figure.userData.assetKey,enemyTemplateKey(state));}
  game={...game,round:36};loader.request(['host_34','host_36','host_36-wraith']);while(loader.pending.size)await tick();
  assert.ok(!released.includes('host_35')&&!released.includes('host_35-wraith'),'a borrower holds both real variants even after the wave queue advances');
  assert.ok(!events.includes('host_35')&&!events.includes('host_35-wraith'),'no live PBR map/material may be released');
  for(const state of states){
    const figure=figures.get(state.id);
    for(const clock of [0,.3,1600,1600.1]){
      animateEnemyMotion(figure,state,clock);let normals=0,litNormals=0;
      figure.userData.body.traverse(node=>{if(!node.isMesh)return;
        for(const name of ['position','normal'])assert.ok(node.geometry.attributes[name].array.every(Number.isFinite),state.visualAsset+' finite private '+name+' at a late combat clock');
        const attribute=node.geometry.attributes.normal;normals+=attribute.count;
        for(let i=0;i<attribute.count;i++)if(Math.hypot(attribute.getX(i),attribute.getY(i),attribute.getZ(i))>.5)litNormals++;
      });
      assert.ok(litNormals>normals*.95,'late-clock deformation keeps the authored lighting normals usable');
    }
    assert.equal(sourceDigest(sources.get(figure.userData.assetKey).scene),hashes.get(figure.userData.assetKey),'late combat clocks preserve original source maps, PBR colours and rest normals');disposeEnemyFigure(figure);
  }
  figures.clear();loader.trim();assert.ok(released.includes('host_35')&&released.includes('host_35-wraith'),'obsolete templates release after their last actor is gone');
  loader.dispose();
});

test('scene retention includes preview and settled corpse borrowers after combat queues advance',()=>{
  const game={data:{enemies,waves},round:40,phase:'building',combat:{enemies:[],spawnQueue:[]}};
  const keys=retainedEnemyModelKeys(game,{figures:[{userData:{assetKey:'host_35'}}],corpses:[{userData:{assetKey:'host_35-wraith'}}],preview:{userData:{assetKey:'host_34'}}});
  assert.deepEqual([...keys].sort(),['host_34','host_35','host_35-wraith','host_40']);
});

const defenderEntries=[...readJSON(new URL('geometric-defenders.json',assetRoot)).entries,...readJSON(new URL('geometric-champions.json',assetRoot)).entries];
for(const id of [...Array.from({length:6},(_,i)=>`stormcaller-${i+1}`),'tempest','stormcitadel'])test(`${id} sends a connected lightning discharge from its actual posed casting palm`,async()=>{
  const entry=defenderEntries.find(entry=>entry.id===id),source=await load(entry),before=sourceDigest(source.scene);
  installDefenderTemplate({disposed:false,imported:new Map(),game:{towers:[],data:{towers:{}}}},entry,source.scene,source.animations);
  const actor=cloneDefenderTemplate(source.scene),rig=attackRig(actor,entry.family),controller=approvedMotionController(actor);
  actor.position.set(3,.85,-2);actor.rotation.y=.67;actor.scale.setScalar(.704);
  const sourceUnit={id:1,family:entry.family,x:5,z:8},target={id:2,x:10,z:11},shot={id:1,source:sourceUnit,target,progress:.5,stats:{type:'arcane'},duration:.5};
  const original=structuredClone(shot),fx=new CombatEffects(new THREE.Scene(),{getMuzzle:(_unit,out,options)=>attackMuzzle(rig,out,options)});
  const handPositions=[];
  try{
    assert.equal(attackVisualKind(entry.family,shot.stats),'lightning');
    for(const phase of [.1,.35,.55,.8]){
      sampleApprovedAttack(controller,phase);const hand=approvedMotionAnchor(actor,new THREE.Vector3(),{kind:'hand'});assert.ok(hand,'an actual hand surface exists');
      const anchor=controller.anchors.get('hand'),labels=[anchor.mesh.name,...function*(node){for(let parent=node.parent;parent;parent=parent.parent)yield parent.userData.semanticPart||parent.userData.name||parent.name;}(anchor.mesh)].join(' ');
      assert.match(labels,id.startsWith('stormcaller')?/right.*(?:palm|hand)|hand.*right/i:/LEFT.casting.arm.hand/i,'the source casting palm is selected rather than the staff, held lightning tip or another limb');
      handPositions.push(hand.clone());fx.syncProjectiles([shot],phase);
      const visual=fx.projectiles.get(1);assert.equal(visual.object.isLine,true);assert.equal(visual.object.children.length,0,'electrical primary attacks contain no travelling sphere/orbit');assert.equal(fx.effects.length,0,'electrical release does not add an arcane orb/wave');
      assert.ok(new THREE.Vector3().fromBufferAttribute(visual.object.geometry.attributes.position,0).distanceTo(hand)<1e-6,'the first electrical vertex stays attached to the current palm');
      const positions=Array.from(visual.object.geometry.attributes.position.array);fx.syncProjectiles([shot],phase);assert.deepEqual(Array.from(visual.object.geometry.attributes.position.array),positions,'pause preserves the exact visible discharge');
    }
    assert.ok(handPositions.some(point=>point.distanceTo(handPositions[0])>1e-4),'the regression exercises actual palm motion');
    fx.clear();fx.maxDetailed=1;fx.maxProjectiles=1;
    fx.syncProjectiles([shot,{...shot,id:2}],.8);assert.equal(fx.paths.records.length,1);const hand=approvedMotionAnchor(actor,new THREE.Vector3(),{kind:'hand'});assert.ok(fx.paths.records[0].from.distanceTo(hand)<1e-8,'bounded fallback uses the same posed hand');
    assert.deepEqual(shot,original,'visual style, anchors and reduced capacity do not mutate combat packets');assert.equal(sourceDigest(source.scene),before,'the original approved source and its PBR finish remain exact');
  }finally{fx.dispose();disposeAttack(rig);disposeDefenderInstance(actor);disposeDecodedGeometricAsset(source);}
});
