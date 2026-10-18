import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MvpHalos,MvpAwardEffects} from '../game/render/mvp-halo.js';
import {mvpDetailsMarkup} from '../ui/mvp-details.js';
test('MAX MVP halo follows an unselected active model, leaves classification geometry alone and disposes on rank/state/replacement changes',()=>{
 const actor=new THREE.Mesh(new THREE.BoxGeometry(.5,1.8,.5),new THREE.MeshBasicMaterial()),object=new THREE.Group();object.add(actor);actor.position.y=1.2;object.position.set(3,0,4);
 const tower={id:7,state:'active',mvpLevel:10},models=new Map([[7,{tower,actor,object,modelStatus:'ready'}]]),halos=new MvpHalos();
 halos.sync(models,1);assert.equal(halos.halos.size,1);assert.equal(actor.children.length,0);const group=halos.halos.get(7).group;assert.equal(group.parent,object);assert.ok(group.position.y>2.1);assert.equal(group.children.length,9);
 const before=group.children[1].position.clone();halos.sync(models,2);assert.notDeepEqual(group.children[1].position,before);const frozen=group.children[1].position.clone();halos.sync(models,5,{reducedMotion:true});const reduced=group.children[1].position.clone();halos.sync(models,9,{reducedMotion:true});assert.deepEqual(group.children[1].position,reduced);
 let disposed=0;group.children[0].geometry.addEventListener('dispose',()=>disposed++);tower.mvpLevel=9;halos.sync(models,3);assert.equal(halos.halos.size,0);assert.equal(disposed,1);assert.equal(group.parent,null);
 tower.mvpLevel=10;tower.state='reserved';halos.sync(models,3);assert.equal(halos.halos.size,0);tower.state='active';halos.sync(models,3);halos.dispose();assert.equal(halos.halos.size,0);assert.equal(object.children.length,1);actor.geometry.dispose();actor.material.dispose();
});
test('only an actual new MVP award creates brief confetti and stars around its recipient, without any beam or light',()=>{
 const scene=new THREE.Scene(),tower={id:8,state:'active',mvpLevel:1,x:12,z:15},awards=new MvpAwardEffects(scene,{position:(x,y,z)=>new THREE.Vector3(x-16,y,z-16),createLabel:()=>new THREE.Sprite(new THREE.SpriteMaterial())}),payload={tower,round:4,level:1},before=JSON.stringify(tower);
 assert.equal(awards.awards.size,0);assert.equal(awards.award(payload,10),true);assert.equal(awards.award(payload,10),false,'The same event cannot duplicate its visual');
 const row=awards.awards.get(8),group=row.group,label=group.children.find(child=>child.userData.mvpAwardLabel);
 assert.equal(group.name,'MVP award confetti and stars');assert.equal(group.parent,scene);assert.equal(group.children.length,35);assert.deepEqual(group.position.toArray(),[-4,.12,-1]);assert.ok(label);assert.equal(tower.mvpLevel,1);
 const particles=group.children.filter(child=>child.userData.mvpAwardParticle);assert.equal(particles.filter(p=>p.userData.mvpAwardParticle.kind==='confetti').length,24);assert.equal(particles.filter(p=>p.userData.mvpAwardParticle.kind==='star').length,10);assert.ok(particles.every(p=>Math.hypot(p.position.x,p.position.z)<=1.2));assert.ok(group.children.every(child=>!child.isLight&&!['CylinderGeometry','TorusGeometry'].includes(child.geometry?.type)));
 awards.update(10.5);assert.ok(group.children[0].material.opacity>0);const y=label.position.y,position=particles[0].position.clone();awards.update(11.5);assert.ok(label.position.y>y,'Label rises on the cosmetic clock');assert.notDeepEqual(particles[0].position,position,'Confetti drifts on cosmetic time');
 let geometryDisposals=0,materialDisposals=0;group.children[0].geometry.addEventListener('dispose',()=>geometryDisposals++);label.material.addEventListener('dispose',()=>materialDisposals++);
 awards.update(13.3);assert.equal(awards.awards.size,0);assert.equal(group.parent,null);assert.equal(geometryDisposals,1);assert.equal(materialDisposals,1);assert.equal(JSON.stringify(tower),before);
 assert.equal(awards.award({...payload,level:2,round:5},15),true);tower.state='ruin';awards.update(15.1);assert.equal(awards.awards.size,0);assert.equal(awards.award({...payload,level:3},16),false);awards.dispose();
});
test('reduced motion keeps award confetti, stars and label still while retaining a brief visible reward and cleaning resources',()=>{
 const scene=new THREE.Scene(),tower={id:2,state:'active',x:0,z:0,mvpLevel:1},awards=new MvpAwardEffects(scene,{reducedMotion:()=>true,createLabel:()=>new THREE.Sprite(new THREE.SpriteMaterial())});
 awards.award({tower,round:1,level:1},0);awards.update(.4);const group=awards.awards.get(2).group,label=group.children.find(c=>c.userData.mvpAwardLabel),y=label.position.y,transforms=group.children.map(child=>[...child.position,...child.rotation.toArray()]);
 awards.update(1.4);assert.equal(label.position.y,y);assert.deepEqual(group.children.map(child=>[...child.position,...child.rotation.toArray()]),transforms);assert.ok(group.children[0].material.opacity>0);awards.dispose();assert.equal(scene.children.length,0);assert.equal(awards.seen.size,0);
});
test('selected MVP detail displays actual level and individual attack pause without inventing bonuses for drafts or walls',()=>{
 assert.match(mvpDetailsMarkup({state:'active',mvpLevel:4}),/MVP Level: 4 \/ 10/);assert.match(mvpDetailsMarkup({state:'active',mvpLevel:4}),/Own damage \+40%/);
 const max=mvpDetailsMarkup({state:'active',mvpLevel:10,attackPaused:true});assert.match(max,/MAX MVP/);assert.match(max,/\+75%/);assert.match(max,/Resume this defender/);assert.match(max,/aria-pressed="true"/);
 assert.doesNotMatch(max,/<small>|Pauses new attacks|Support and MVP auras stay active/);assert.match(max,/data-action="tower-pause"/);
 assert.equal(mvpDetailsMarkup({state:'draft',mvpLevel:10}),'');assert.equal(mvpDetailsMarkup({state:'ruin',mvpLevel:10}),'');
});
