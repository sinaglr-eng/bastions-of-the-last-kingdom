import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {MvpHalos} from '../game/render/mvp-halo.js';
import {mvpDetailsMarkup} from '../ui/mvp-details.js';
test('MAX MVP halo follows an unselected active model, leaves classification geometry alone and disposes on rank/state/replacement changes',()=>{
 const actor=new THREE.Mesh(new THREE.BoxGeometry(.5,1.8,.5),new THREE.MeshBasicMaterial()),object=new THREE.Group();object.add(actor);actor.position.y=1.2;object.position.set(3,0,4);
 const tower={id:7,state:'active',mvpLevel:10},models=new Map([[7,{tower,actor,object,modelStatus:'ready'}]]),halos=new MvpHalos();
 halos.sync(models,1);assert.equal(halos.halos.size,1);assert.equal(actor.children.length,0);const group=halos.halos.get(7).group;assert.equal(group.parent,object);assert.ok(group.position.y>2.1);assert.equal(group.children.length,9);
 const before=group.children[1].position.clone();halos.sync(models,2);assert.notDeepEqual(group.children[1].position,before);const frozen=group.children[1].position.clone();halos.sync(models,5,{reducedMotion:true});const reduced=group.children[1].position.clone();halos.sync(models,9,{reducedMotion:true});assert.deepEqual(group.children[1].position,reduced);
 let disposed=0;group.children[0].geometry.addEventListener('dispose',()=>disposed++);tower.mvpLevel=9;halos.sync(models,3);assert.equal(halos.halos.size,0);assert.equal(disposed,1);assert.equal(group.parent,null);
 tower.mvpLevel=10;tower.state='reserved';halos.sync(models,3);assert.equal(halos.halos.size,0);tower.state='active';halos.sync(models,3);halos.dispose();assert.equal(halos.halos.size,0);assert.equal(object.children.length,1);actor.geometry.dispose();actor.material.dispose();
});
test('selected MVP detail displays actual level and individual attack pause without inventing bonuses for drafts or walls',()=>{
 assert.match(mvpDetailsMarkup({state:'active',mvpLevel:4}),/MVP Level: 4 \/ 10/);assert.match(mvpDetailsMarkup({state:'active',mvpLevel:4}),/Own damage \+40%/);
 const max=mvpDetailsMarkup({state:'active',mvpLevel:10,attackPaused:true});assert.match(max,/MAX MVP/);assert.match(max,/\+75%/);assert.match(max,/Resume this defender/);assert.match(max,/aria-pressed="true"/);
 assert.equal(mvpDetailsMarkup({state:'draft',mvpLevel:10}),'');assert.equal(mvpDetailsMarkup({state:'ruin',mvpLevel:10}),'');
});
