import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {CommanderEffects} from '../game/render/commander-effects.js';
import {AudioManager} from '../game/audio/audio.js';

test('simultaneous command strike batches actual airborne head positions and never reveals concealed targets',()=>{
  const scene=new THREE.Scene(),calls=[];
  const effects=new CommanderEffects(scene,{maxTargets:3,createLabel:null,targetPoint:target=>{calls.push(target.id);return new THREE.Vector3(target.x,target.flying?7:2,target.z);}});
  effects.event('general-strike',{targets:[{id:1,x:4,z:5,flying:true,visible:true},{id:2,x:9,z:9,visible:false},{id:3,x:6,z:7,visible:true},{id:4,x:8,z:9,visible:true},{id:5,x:11,z:12,visible:true}]});
  assert.deepEqual(calls,[1,3,4]);assert.equal(effects.marks.count,3);assert.equal(scene.children.length,3);
  const matrix=new THREE.Matrix4();effects.marks.getMatrixAt(0,matrix);assert.ok(Math.abs(matrix.elements[13]-7.3)<1e-5);
  const positions=effects.marks.instanceMatrix.array.slice();effects.update(0);assert.deepEqual(effects.marks.instanceMatrix.array,positions,'A paused cosmetic clock cannot move the impact');
  effects.update(.81);assert.equal(effects.marks.count,0);assert.equal(effects.beams.visible,false);assert.equal(effects.strike,null);
  effects.dispose();assert.equal(scene.children.length,0);
});

test('promotion shows only real +1 changes, expires without pedestal rings and uses no random source',()=>{
  const scene=new THREE.Scene(),effects=new CommanderEffects(scene,{createLabel:null});
  const entries=[{tower:{x:1,z:2},from:1,to:2},{tower:{x:3,z:4},from:5,to:5},{tower:{x:5,z:6},from:5,to:6}];
  assert.equal(effects.event('general-promoted',{upgrades:entries}),true);assert.equal(effects.promotions.length,2);
  const geometries=[];for(const row of effects.promotions)row.group.traverse(object=>{if(object.geometry)geometries.push(object.geometry.type);});assert.ok(geometries.every(type=>type==='ShapeGeometry'));
  const original=effects.promotions[0].group.position.clone();effects.update(.4);assert.ok(effects.promotions[0].group.position.y>original.y);
  effects.update(.5);assert.equal(effects.promotions.length,0);assert.equal(scene.children.length,3);effects.dispose();
});

test('reduced motion uses static target marks and keep flourish while preserving expiry and disposal',()=>{
  const scene=new THREE.Scene(),effects=new CommanderEffects(scene,{createLabel:null,reducedMotion:()=>true});
  effects.event('general-strike',{targets:[{id:1,x:1,z:2,visible:true}]});assert.equal(effects.beams.visible,false);assert.equal(effects.glows.visible,false);assert.equal(effects.marks.visible,true);
  effects.event('general-fortified',{amount:10,maxLives:40});const point=effects.fortified.group.position.clone();effects.update(.3);assert.deepEqual(effects.fortified.group.position,point);
  const disposed=[];for(const mesh of [effects.beams,effects.glows,effects.marks])mesh.geometry.addEventListener('dispose',()=>disposed.push(mesh.name));
  effects.update(1.2);assert.equal(effects.fortified,null);assert.equal(effects.strike,null);effects.dispose();effects.dispose();assert.equal(disposed.length,3);assert.equal(scene.children.length,0);
  assert.equal(effects.event('general-fortified',{amount:5}),false);
});

test('one command sound is bounded independently of victim count and respects sound categories',()=>{
  const audio=new AudioManager(),calls=[];audio.context={currentTime:0};audio.tone=(...args)=>calls.push(['tone',args]);audio.noise=(...args)=>calls.push(['noise',args]);
  audio.play('general-strike',{targets:Array.from({length:500},(_,id)=>({id}))});assert.equal(calls.length,4);assert.ok(calls.every(([,args])=>args.at(-1).category==='sounds'));
  audio.play('general-strike',{targets:[]});assert.equal(calls.length,4,'Duplicate event is not a sound storm');
  audio._muted=true;audio.play('general-fortified',{amount:10});assert.equal(calls.length,4);
  audio._muted=false;audio.play('general-fortified',{amount:10});assert.equal(calls.length,7);
  audio.play('general-promoted',{upgrades:[{from:1,to:2}]});assert.equal(calls.length,11);audio.play('general-promoted',{upgrades:[]});assert.equal(calls.length,11);
});

test('range activation gives one short keep cue, with no persistent defender rings',()=>{
  const scene=new THREE.Scene(),effects=new CommanderEffects(scene,{createLabel:null,reducedMotion:()=>true});
  assert.equal(effects.event('general-range',{bonus:3}),false);
  assert.equal(effects.event('general-range',{bonus:1.5}),true);const first=effects.range.group;
  assert.equal(first.children.length,2);const point=first.position.clone();effects.update(.2);assert.deepEqual(first.position,point);
  effects.event('general-range',{bonus:2});assert.equal(first.parent,null);assert.equal(scene.children.length,4);
  effects.update(1.21);assert.equal(effects.range,null);assert.equal(scene.children.length,3);
  effects.event('general-range',{bonus:1});effects.dispose();assert.equal(scene.children.length,0);
  const audio=new AudioManager(),calls=[];audio.context={currentTime:0};audio.tone=(...args)=>calls.push(args);audio.noise=(...args)=>calls.push(args);
  audio.play('general-range',{bonus:1.5});assert.equal(calls.length,3);assert.ok(calls.every(args=>args.at(-1).category==='sounds'));
  audio.play('general-range',{bonus:1.5});assert.equal(calls.length,3);
});
