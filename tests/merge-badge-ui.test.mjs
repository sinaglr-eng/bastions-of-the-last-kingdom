import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {Game} from '../game/core/game.js';
import {mergeTowerKey,mergeTowerFromBadge} from '../ui/draft-input.js';
import {draftCardsMarkup} from '../ui/draft-cards.js';
import {DraftMarkers} from '../game/render/draft-markers.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
function ready(){
  const game=new Game(data,{seed:42});for(let x=10;x<15;x++)assert.ok(game.place(x,10));
  ['archer','archer','soldier','druid','runebreaker'].forEach((family,index)=>Object.assign(game.towers[index],{family,tier:1}));
  game.selected=null;return game;
}
const state=game=>JSON.stringify({phase:game.phase,selected:game.selected,round:game.round,towers:game.towers,draws:game.draft.draws,economy:game.economy,occupied:[...game.grid.occupied]});

test('each available card has a real sibling merge button which keeps its exact foundation through Game.merge once',()=>{
  for(const index of [0,1]){
    const game=ready(),control=ready(),tower=game.towers[index],partner=game.towers[1-index],location=[tower.x,tower.z],gold=game.economy.gold;
    tower.kills=2;partner.kills=3;let combined=0;game.on(type=>{if(type==='combine')combined++;});
    const before=state(game),html=draftCardsMarkup(game,data,{});assert.equal(state(game),before,'Rendering is read-only');
    const buttons=[...html.matchAll(/<button\b[^>]*data-action="merge-tower"[^>]*>/g)].map(match=>match[0]);
    assert.equal(buttons.length,2);const button=buttons.find(button=>button.includes(`data-tower-id="${tower.id}"`));assert.ok(button);
    const key=button.match(/data-merge-key="([^"]+)"/)[1];assert.equal(key,mergeTowerKey(game,tower.id));
    let depth=0;for(const tag of html.matchAll(/<button\b[^>]*>|<\/button>/g)){depth+=tag[0].startsWith('</')?-1:1;assert.ok(depth>=0&&depth<=1,'Interactive merge badges cannot be nested inside draw buttons');}assert.equal(depth,0);
    assert.equal(mergeTowerFromBadge(game,tower.id,key),true);assert.equal(game.selection,tower);assert.equal(tower.tier,2);assert.equal(tower.kills,5);assert.deepEqual([tower.x,tower.z],location);
    assert.equal(game.phase,'ready');assert.equal(partner.state,'ruin');assert.equal(game.towers.filter(t=>t.state==='active').length,1);assert.equal(game.towers.filter(t=>t.state==='ruin').length,4);assert.equal(game.grid.occupied.size,5);
    assert.equal(game.economy.gold,gold);assert.equal(game.rng(),control.rng(),'The UI action does not consume a random draw');assert.equal(combined,1);
    const completed=state(game);assert.equal(mergeTowerFromBadge(game,tower.id,key),false);assert.equal(state(game),completed);assert.equal(combined,1);
    assert.doesNotMatch(draftCardsMarkup(game,data,{}),/data-action="merge-tower"/);
  }
});

test('stale cards reject changed pairs, inventory, foundations, rounds, phases and a restarted game without mutation',()=>{
  const changes=[g=>g.towers[1].tier++,g=>g.towers[1].family='mage',g=>g.towers[1].state='ruin',g=>g.towers[0].x++,g=>g.towers[3].tier++,g=>g.round++,g=>g.phase='combat',g=>g.draft.draws[4].placed=false,g=>g.draft.draws[4].towerId=g.towers[0].id];
  for(const change of changes){const game=ready(),tower=game.towers[0],key=mergeTowerKey(game,tower.id);assert.ok(key);change(game);const before=state(game);assert.equal(mergeTowerFromBadge(game,tower.id,key),false);assert.equal(state(game),before);}
  const old=ready(),game=ready(),key=mergeTowerKey(old,old.towers[0].id),before=state(game);assert.equal(mergeTowerFromBadge(game,game.towers[0].id,key),false);assert.equal(state(game),before);
  assert.equal(mergeTowerFromBadge(game,game.towers[0].id,''),false);assert.equal(mergeTowerFromBadge(game,999,key),false);
});

test('unavailable ranks, champions, retained units, hidden draws and all non-selection phases expose no merge action',()=>{
  for(const mutate of [g=>g.towers.slice(0,2).forEach(t=>t.tier=6),g=>g.towers.slice(0,2).forEach(t=>t.family='highking'),g=>g.towers[0].state='active']){
    const game=ready();mutate(game);assert.equal(mergeTowerKey(game,game.towers[0].id),null);assert.doesNotMatch(draftCardsMarkup(game,data,{}),/data-action="merge-tower"/);
  }
  for(const phase of ['build','ready','reward','combat','won','lost']){const game=ready();game.phase=phase;assert.doesNotMatch(draftCardsMarkup(game,data,{}),/data-action="merge-tower"/);}
  const hidden=new Game(data,{seed:1}),before=state(hidden);assert.doesNotMatch(draftCardsMarkup(hidden,data,{}),/merge-tower|data-merge-key/);assert.equal(state(hidden),before);
});

test('a state change during selection notification cannot reach the core merge mutation',()=>{
  const game=ready(),tower=game.towers[0],key=mergeTowerKey(game,tower.id);let combined=0;
  game.on(type=>{if(type==='change')game.phase='combat';if(type==='combine')combined++;});
  assert.equal(mergeTowerFromBadge(game,tower.id,key),false);assert.equal(tower.tier,1);assert.ok(game.towers.every(t=>t.state==='draft'));assert.equal(combined,0);
});

class Element {
  constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.listeners=new Map();this.dataset={};this.style={};this.attributes={};this.className='';this.hidden=false;this.clientWidth=1200;
    this.classList={add:name=>this.className+=(this.className?' ':'')+name};}
  append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}
  setAttribute(name,value){this.attributes[name]=String(value);}
  addEventListener(name,callback){this.listeners.set(name,callback);}
  emit(name,event){this.listeners.get(name)?.(event);}
  closest(selector){return selector==='.recipe-map-badge'&&this.className.split(' ').includes('recipe-map-badge')?this:null;}
  getContext(){return {beginPath(){},arc(){},fill(){},stroke(){},fillText(){}};}
}
function mapFixture(game){
  const saved={document:globalThis.document,window:globalThis.window,matchMedia:globalThis.matchMedia};
  globalThis.document={createElement:tag=>new Element(tag),createElementNS:(_namespace,tag)=>new Element(tag)};
  globalThis.window=new EventTarget();globalThis.matchMedia=()=>({matches:false});
  const scene=new THREE.Scene(),container=new Element('div'),markers=new DraftMarkers(scene,container),models=new Map();
  for(const tower of game.towers){const object=new THREE.Mesh(new THREE.BoxGeometry(.5,6,.5),new THREE.MeshBasicMaterial());object.position.set(tower.x-18,3,tower.z-18);models.set(tower.id,{object});}
  markers.sync(game,models);
  return {scene,container,markers,models,cleanup(){markers.dispose();for(const {object}of models.values()){object.geometry.dispose();object.material.dispose();}Object.assign(globalThis,saved);}};
}
const pointer=(target,pointerType='mouse',x=100)=>({target,pointerType,pointerId:1,button:0,clientX:x,clientY:100});

test('world merge icons project above every eligible unit, coexist with recipes and perform one accepted tap or keyboard action',()=>{
  for(const type of ['mouse','touch','keyboard']){
    const game=ready(),recipe=game.recipes[0];recipe.ingredients.forEach((piece,index)=>Object.assign(game.towers[index],piece));Object.assign(game.towers[3],recipe.ingredients[0]);
    const map=mapFixture(game);try{
      const {markers}=map,tower=game.towers[0],badge=markers.mergeBadges.get(tower.id);assert.ok(badge);assert.ok(markers.badges.has(tower.id),'Available recipe remains separately actionable');
      const eligible=game.roundCandidates.filter(({tower})=>mergeTowerKey(game,tower.id));assert.equal(markers.mergeBadges.size,eligible.length);
      assert.equal(badge.height,6);assert.match(badge.el.attributes['aria-label'],/Merge .* into rank .* here/);assert.match(badge.el.innerHTML,/MERGE/);
      const camera=new THREE.PerspectiveCamera(45,1.5,.1,100);camera.position.set(-6,15,18);camera.lookAt(-6,2,-8);camera.updateMatrixWorld();markers.update(0,camera,800);
      assert.equal(badge.el.hidden,false);assert.match(badge.el.style.transform,/translate\([\d.e-]+px,[\d.e-]+px\)/);assert.notEqual(badge.el.style.transform,markers.badges.get(tower.id).el.style.transform);
      let combined=0;game.on(event=>{if(event==='combine')combined++;});
      if(type==='keyboard')badge.el.onclick({detail:0});else{markers.layer.emit('pointerdown',pointer(badge.el,type));markers.layer.emit('pointerup',pointer(badge.el,type));badge.el.onclick({detail:1,pointerType:type});}
      assert.equal(game.phase,'ready');assert.equal(game.selection,tower);assert.equal(combined,1);markers.sync(game,map.models);assert.equal(markers.mergeBadges.size,0);assert.equal(badge.el.parent,null);
    }finally{map.cleanup();assert.equal(map.scene.children.length,0);}
  }
});

test('map drag, cancellation and an inventory change between pointerdown and pointerup cannot merge',()=>{
  for(const interruption of ['drag','cancel','stale']){
    const game=ready(),map=mapFixture(game);try{
      const {markers}=map,badge=markers.mergeBadges.get(game.towers[0].id);markers.layer.emit('pointerdown',pointer(badge.el));
      if(interruption==='drag')markers.layer.emit('pointermove',pointer(badge.el,'mouse',130));
      if(interruption==='cancel')markers.layer.emit('pointercancel',pointer(badge.el));
      if(interruption==='stale'){game.towers[3].tier++;markers.sync(game,map.models);}
      const before=state(game);markers.layer.emit('pointerup',pointer(badge.el,'mouse',interruption==='drag'?130:100));badge.el.onclick({detail:1});assert.equal(state(game),before);
    }finally{map.cleanup();}
  }
});
