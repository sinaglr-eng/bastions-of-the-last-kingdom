import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {Game} from '../game/core/game.js';
import {DefenderPauseMarkers} from '../game/render/defender-pause-markers.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL('../data/'+key+'.json',import.meta.url)))]));
function container(){
  class Element{
    constructor(){this.ownerDocument=document;this.children=[];this.attributes=new Map();this.style={};this.hidden=false;this.clientWidth=800;this.clientHeight=600;}
    append(node){node.parent=this;this.children.push(node);}
    remove(){if(this.parent)this.parent.children=this.parent.children.filter(node=>node!==this);this.parent=null;}
    setAttribute(name,value){this.attributes.set(name,String(value));}
    getAttribute(name){return this.attributes.get(name)??null;}
  }
  const document={createElement:()=>new Element()};return new Element();
}
function model(tower){const object=new THREE.Group(),actor=new THREE.Mesh(new THREE.BoxGeometry(.5,2,.5),new THREE.MeshBasicMaterial());actor.position.y=1.2;object.position.set(tower.x,0,tower.z);object.add(actor);return {tower,actor,object,modelStatus:'ready'};}
function camera(){const camera=new THREE.OrthographicCamera(-10,10,10,-10,.1,100);camera.position.set(0,10,10);camera.lookAt(0,1,0);camera.updateProjectionMatrix();camera.updateMatrixWorld();return camera;}
function add(game,family,x=0){const tower={id:game.nextId++,family,tier:1,state:'active',round:0,x,z:0,attackPaused:false,kills:0,mvpLevel:0};game.towers.push(tower);return tower;}
const snapshot=game=>JSON.stringify({towers:game.towers,phase:game.phase,round:game.round,paused:game.paused,selected:game.selected,gold:game.economy.gold,cp:game.commandPoints.value,draws:game.draft.draws});

test('actual per-defender attack pause creates its red badge independently of global pause and selection without mutation or RNG',()=>{
  const game=new Game(data,{seed:281}),control=new Game(data,{seed:281}),first=add(game,'archer',-2),second=add(game,'soldier',2),host=container(),markers=new DefenderPauseMarkers(host,{name:tower=>game.data.towers[tower.family].name}),view=camera(),models=new Map([first,second].map(tower=>[tower.id,model(tower)]));
  game.phase='combat';game.paused=true;markers.update(models,view);assert.equal(markers.items.size,0,'Global pause does not imply individual attack pause');
  assert.equal(game.setTowerAttackPaused(second.id,true),true);game.selected=first.id;const before=snapshot(game);markers.update(models,view);assert.equal(markers.items.size,1);const badge=markers.items.get(second.id);assert.ok(badge);assert.equal(badge.hidden,false);assert.equal(badge.getAttribute('role'),'img');assert.match(badge.getAttribute('aria-label'),/Soldier · attacks paused/);assert.match(badge.innerHTML,/M7 5h4v14/);
  game.paused=false;const unpaused=snapshot(game);markers.update(models,view);assert.equal(markers.items.get(second.id),badge);assert.equal(snapshot(game),unpaused);
  game.paused=true;assert.equal(snapshot(game),before);assert.equal(game.setTowerAttackPaused(second.id,false),true);markers.update(models,view);assert.equal(markers.items.size,0);assert.equal(badge.parent,null);assert.equal(game.rng(),control.rng());markers.dispose();
  for(const value of models.values()){value.actor.geometry.dispose();value.actor.material.dispose();}
});

test('pause badges follow current model bounds and camera, remain fixed in pixel size and clean up offscreen, removed and disposed defenders',()=>{
  const tower={id:9,family:'archer',state:'active',attackPaused:true,x:0,z:0},value=model(tower),models=new Map([[9,value]]),host=container(),markers=new DefenderPauseMarkers(host),view=camera();markers.update(models,view);const badge=markers.items.get(9),first=badge.style.transform;
  value.object.position.x=3;markers.update(models,view);assert.notEqual(badge.style.transform,first);const moved=badge.style.transform;value.actor.scale.y=2;markers.update(models,view);assert.notEqual(badge.style.transform,moved,'The badge stays above the actual visible model');assert.equal(markers.items.get(9),badge);
  value.object.position.x=100;markers.update(models,view);assert.equal(badge.hidden,true);value.object.position.x=0;markers.update(models,view);assert.equal(badge.hidden,false);
  models.delete(9);markers.update(models,view);assert.equal(markers.items.size,0);assert.equal(badge.parent,null);models.set(9,value);markers.update(models,view);assert.equal(markers.items.size,1);markers.dispose();markers.dispose();assert.equal(host.children.length,0);markers.update(models,view);assert.equal(host.children.length,0);assert.equal(markers.items.size,0);value.actor.geometry.dispose();value.actor.material.dispose();
});

test('real champion creation removes paused consumed ingredients while an unpaused result receives no badge',()=>{
  const game=new Game(data,{seed:723}),host=container(),markers=new DefenderPauseMarkers(host),view=camera(),archer=add(game,'archer'),cleric=add(game,'cleric',-2),druid=add(game,'druid',2);game.phase='ready';game.economy.setConstructionRound(25);game.selected=archer.id;
  game.setTowerAttackPaused(cleric.id,true);game.setTowerAttackPaused(druid.id,true);const models=new Map(game.towers.map(tower=>[tower.id,model(tower)]));markers.update(models,view);assert.equal(markers.items.size,2);
  assert.equal(game.craft('thornwarden'),true);assert.equal(archer.family,'thornwarden');assert.equal(cleric.state,'ruin');assert.equal(druid.state,'ruin');markers.update(models,view);assert.equal(markers.items.size,0);assert.equal(markers.layer.children.length,0);markers.dispose();for(const value of models.values()){value.actor.geometry.dispose();value.actor.material.dispose();}
});
