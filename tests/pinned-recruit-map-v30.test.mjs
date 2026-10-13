import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {DraftMarkers} from '../game/render/draft-markers.js';

const raw=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...raw,towers:campaignTowers(raw.towers),recipes:campaignRecipes(raw.recipes),enemies:campaignEnemies(raw.enemies),waves:campaignWaves(raw.waves)};
const pieces=[{family:'cleric',tier:1},{family:'druid',tier:1},{family:'soldier',tier:2},{family:'mage',tier:2},{family:'archer',tier:2}];
function ready({count=5,stock=pieces}={}){const game=new Game(data,{seed:731});for(let index=0;index<count;index++){game.draft.roundForced=stock[index];assert.equal(game.place(3+index,3),true);}game.draft.roundForced=null;game.select(null);game.pinned='thornwarden';return game;}
const snapshot=game=>JSON.stringify({towers:game.towers,draws:game.draft.draws,round:game.round,phase:game.phase,selected:game.selected,preview:game.previewRecipeId,cp:game.commandPoints.value,gold:game.economy.gold,grid:[...game.grid.occupied],resolved:game.draft.resolved,move:game.commandMove.active});
const pointer=(target,type='mouse',id=1,x=100,y=100)=>({target,pointerType:type,pointerId:id,button:0,clientX:x,clientY:y});
class Surface{
  constructor(){this.listeners=new Map();}
  addEventListener(type,callback){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(callback);}
  removeEventListener(type,callback){this.listeners.get(type)?.delete(callback);}
  emit(type,event={}){for(const callback of this.listeners.get(type)||[])callback({...event,type});}
}
class Element extends Surface{
  constructor(tag){super();this.tagName=tag.toUpperCase();this.children=[];this.dataset={};this.style={};this.attributes={};this.className='';this.hidden=false;this.disabled=false;this.clientWidth=1200;this.parent=null;this.isRoot=false;
    this.classList={contains:name=>this.className.split(/\s+/).includes(name),add:(...names)=>{this.className=[...new Set([...this.className.split(/\s+/).filter(Boolean),...names])].join(' ');},remove:(...names)=>{this.className=this.className.split(/\s+/).filter(name=>name&&!names.includes(name)).join(' ');},toggle:(name,force)=>{const active=force===undefined?!this.classList.contains(name):!!force;this.classList[active?'add':'remove'](name);return active;}};
  }
  get isConnected(){return this.isRoot||!!this.parent?.isConnected;}
  append(...children){for(const child of children){child.parent=this;this.children.push(child);}}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(child=>child!==this);this.parent=null;}
  setAttribute(name,value){this.attributes[name]=String(value);}
  closest(selector){return selector==='.recipe-map-badge'&&this.classList.contains('recipe-map-badge')?this:this.parent?.closest(selector)||null;}
  getContext(){return {beginPath(){},arc(){},fill(){},stroke(){},fillText(){}};}
}
function mapFixture(game){
  const saved={document:globalThis.document,window:globalThis.window,matchMedia:globalThis.matchMedia};let hit=null,now=1000;
  const outside=new Element('div');outside.isRoot=true;const window=new Surface();
  globalThis.document={createElement:tag=>new Element(tag),createElementNS:(_namespace,tag)=>new Element(tag),elementFromPoint:()=>hit};globalThis.window=window;globalThis.matchMedia=()=>({matches:false});
  const scene=new THREE.Scene(),container=new Element('div');container.isRoot=true;
  const markers=new DraftMarkers(scene,container),models=new Map();markers.gesture.now=()=>now;markers.activation.now=()=>now;markers.pinnedActivation.activation.now=()=>now;markers.sync(game,models);
  const off=game.on(type=>{if(type==='change')markers.sync(game,models);});
  return {markers,models,window,outside,advance(ms){now+=ms;},hit(value){hit=value;},
    down(target,type='mouse',id=1,x=100,y=100){hit=target;const event=pointer(target,type,id,x,y);markers.layer.emit('pointerdown',event);window.emit('pointerdown',event);},
    up(target,type='mouse',id=1,x=100,y=100,{capture=false}={}){const event=pointer(capture?outside:target,type,id,x,y);markers.layer.emit('pointerup',event);window.emit('pointerup',event);},
    tap(target,type='mouse',id=1,x=100,y=100){this.down(target,type,id,x,y);this.up(target,type,id,x,y);target.onclick?.({detail:1,pointerType:type});},
    cleanup(){off();markers.dispose();assert.equal(scene.children.length,0);for(const callbacks of window.listeners.values())assert.equal(callbacks.size,0);Object.assign(globalThis,saved);}
  };
}

test('production standalone pinned mouse/touch pair selects first then keeps the exact existing foundation once without RNG',()=>{
  for(const type of ['mouse','touch']){
    const game=ready(),control=ready(),tower=game.towers[0],id=tower.id,location=[tower.x,tower.z],family=tower.family,tier=tower.tier,occupied=game.grid.occupied.size,cp=game.commandPoints.value,gold=game.economy.gold,nextId=game.nextId;
    tower.kills=7;tower.mvpLevel=2;tower.priority='strongest';let kept=0;game.on(event=>{if(event==='keep')kept++;});
    const map=mapFixture(game);try{
      const badge=map.markers.pinnedBadges.get(id)?.el;assert.ok(badge);assert.equal(badge.dataset.role,'pinned');assert.match(badge.title,/Double-click or double-tap/);
      map.tap(badge,type);assert.equal(game.selected,id);assert.equal(game.phase,'select');assert.equal(kept,0);
      map.advance(200);map.tap(badge,type,2,103,102);assert.equal(game.phase,'ready');assert.equal(game.selection,tower);assert.equal(tower.state,'active');assert.equal(kept,1);
      assert.deepEqual([tower.x,tower.z],location);assert.equal(tower.family,family);assert.equal(tower.tier,tier);assert.equal(tower.kills,7);assert.equal(tower.mvpLevel,2);assert.equal(tower.priority,'strongest');
      assert.equal(game.towers.filter(t=>t.state==='ruin').length,4);assert.equal(game.grid.occupied.size,occupied);assert.equal(game.nextId,nextId);assert.equal(game.commandPoints.value,cp);assert.equal(game.economy.gold,gold);assert.equal(game.rng(),control.rng());
      const completed=snapshot(game);map.advance(100);map.tap(badge,type,3);badge.onclick({detail:2,pointerType:type});assert.equal(snapshot(game),completed);assert.equal(kept,1);
    }finally{map.cleanup();}
  }
});

test('three-placement pinned pairs select revealed candidates while keeping all five draft slots unresolved',()=>{
  const game=ready({count:3}),control=ready({count:3}),map=mapFixture(game);try{
    const badge=map.markers.pinnedBadges.get(game.towers[0].id).el;map.tap(badge,'touch');map.advance(100);map.tap(badge,'touch',2);
    assert.equal(game.selected,game.towers[0].id);assert.equal(game.phase,'build');assert.equal(game.draft.draws.length,5);assert.equal(game.draft.draws.filter(draw=>draw.placed).length,3);assert.equal(game.draft.resolved,false);assert.ok(game.towers.every(t=>t.state==='draft'));assert.equal(game.rng(),control.rng());
  }finally{map.cleanup();}
});

test('keyboard Enter-style click-only pinned activation selects and never confirms a keeper pair',()=>{
  const game=ready(),map=mapFixture(game);try{
    const badge=map.markers.pinnedBadges.get(game.towers[0].id).el;map.tap(badge);map.advance(100);badge.onclick({detail:0});badge.onclick({detail:0});assert.equal(game.phase,'select');assert.equal(game.selected,game.towers[0].id);
    map.advance(100);map.tap(badge);assert.equal(game.phase,'select');
  }finally{map.cleanup();}
});

test('normal implicit pointer capture loss preserves a completed first pinned tap and touch release hit-tests the badge',()=>{
  const game=ready(),map=mapFixture(game);try{
    const badge=map.markers.pinnedBadges.get(game.towers[0].id).el;map.down(badge,'touch');map.up(badge,'touch',1,100,100,{capture:true});map.markers.layer.emit('lostpointercapture',pointer(badge,'touch'));
    assert.equal(game.selected,game.towers[0].id);map.advance(150);map.tap(badge,'touch',2);assert.equal(game.phase,'ready');
  }finally{map.cleanup();}
});

test('late, distant and mixed-pointer pinned activations require a fresh matching pair',()=>{
  for(const variant of ['late','distance','mixed']){
    const game=ready(),map=mapFixture(game);try{
      const badge=map.markers.pinnedBadges.get(game.towers[0].id).el;map.tap(badge);map.advance(variant==='late'?501:100);map.tap(badge,variant==='mixed'?'touch':'mouse',2,variant==='distance'?130:100);assert.equal(game.phase,'select');
    }finally{map.cleanup();}
  }
});

test('production pinned drag-return, cancel, capture loss, scroll, wheel and blur suppress the second release and compatibility click',()=>{
  for(const interruption of ['drag','cancel','capture','scroll','wheel','blur'])for(const type of ['mouse','touch']){
    const game=ready(),map=mapFixture(game);try{
      const badge=map.markers.pinnedBadges.get(game.towers[0].id).el;map.tap(badge,type);map.advance(100);map.down(badge,type,2);
      if(interruption==='drag'){map.markers.layer.emit('pointermove',pointer(badge,type,2,135));map.markers.layer.emit('pointermove',pointer(badge,type,2));}
      if(interruption==='cancel')map.markers.layer.emit('pointercancel',pointer(badge,type,2));
      if(interruption==='capture')map.markers.layer.emit('lostpointercapture',pointer(badge,type,2));
      if(interruption==='scroll')map.window.emit('scroll');if(interruption==='wheel')map.markers.layer.emit('wheel');if(interruption==='blur')map.window.emit('blur');
      const before=snapshot(game);map.up(badge,type,2);badge.onclick({detail:1,pointerType:type});assert.equal(snapshot(game),before);assert.equal(game.phase,'select');
      map.advance(100);map.tap(badge,type,3);assert.equal(game.phase,'select','the interrupted pair must be forgotten');
    }finally{map.cleanup();}
  }
});

test('captured touch release outside the pinned badge does not select or preserve a pair',()=>{
  const game=ready(),map=mapFixture(game);try{
    const badge=map.markers.pinnedBadges.get(game.towers[0].id).el,before=snapshot(game);map.down(badge,'touch');map.hit(map.outside);map.up(badge,'touch',1,100,100,{capture:true});badge.onclick({detail:1,pointerType:'touch'});assert.equal(snapshot(game),before);
  }finally{map.cleanup();}
});

test('two fingers on badges or a badge plus battlefield in either order cannot select or Keep',()=>{
  for(const second of ['badge','battlefield','battlefield-first']){
    const game=ready(),map=mapFixture(game);try{
      const badge=map.markers.pinnedBadges.get(game.towers[0].id).el,other=map.markers.pinnedBadges.get(game.towers[1].id).el,before=snapshot(game);
      if(second==='battlefield-first')map.window.emit('pointerdown',pointer(map.outside,'touch',2));map.down(badge,'touch');
      if(second==='badge')map.down(other,'touch',2);else map.window.emit('pointerdown',pointer(map.outside,'touch',2));
      map.hit(badge);map.up(badge,'touch');if(second==='badge'){map.hit(other);map.up(other,'touch',2);}else map.window.emit('pointerup',pointer(map.outside,'touch',2));
      badge.onclick({detail:1,pointerType:'touch'});assert.equal(snapshot(game),before);
    }finally{map.cleanup();}
  }
});

test('reroll, reserve, Move, phase, pin, tower and draw changes after pointerdown reject stale pinned releases',()=>{
  for(const mutation of ['reroll','reserve','move','phase','pin','tower','hidden','round','unplaced']){
    const game=ready();if(mutation==='move'){game.towers[3].state='active';game.towers[4].state='ruin';}
    const map=mapFixture(game);try{
      const badge=map.markers.pinnedBadges.get(game.towers[0].id).el;map.tap(badge);map.advance(100);map.down(badge,'mouse',2);
      if(mutation==='reroll')assert.equal(game.reroll(),true);
      if(mutation==='reserve'){game.select(game.towers[2].id);assert.equal(game.reserve(),true);}
      if(mutation==='move')assert.equal(game.beginMove(),true);
      if(mutation==='phase')game.phase='combat';if(mutation==='pin')game.pinned=null;if(mutation==='tower')game.towers[0].tier++;
      if(mutation==='hidden')game.draft.draws[0].placed=false;if(mutation==='round')game.round++;if(mutation==='unplaced')game.towers[0].placed=false;
      const before=snapshot(game);map.hit(badge);map.up(badge,'mouse',2);badge.onclick({detail:1});assert.equal(snapshot(game),before);
    }finally{map.cleanup();}
  }
});

test('a new Game with reused IDs rejects a pending badge press from the previous run',()=>{
  const game=ready(),next=ready(),map=mapFixture(game);try{
    const badge=map.markers.pinnedBadges.get(game.towers[0].id).el;map.down(badge);map.markers.sync(next,map.models);const before=snapshot(next);map.hit(badge);map.up(badge);badge.onclick({detail:1});assert.equal(snapshot(next),before);
  }finally{map.cleanup();}
});

test('hidden, disabled, detached, reserved, wall and combat pinned controls are no-ops',()=>{
  for(const invalid of ['hidden','disabled','detached','reserved','wall','combat']){
    const game=ready(),map=mapFixture(game);try{
      const badge=map.markers.pinnedBadges.get(game.towers[0].id).el;
      if(invalid==='hidden')badge.hidden=true;if(invalid==='disabled')badge.disabled=true;if(invalid==='detached')badge.remove();
      if(invalid==='reserved'){game.select(game.towers[0].id);assert.equal(game.reserve(),true);}if(invalid==='wall')game.towers[0].state='ruin';if(invalid==='combat')game.phase='combat';
      const before=snapshot(game);map.tap(badge);map.advance(100);map.tap(badge,'mouse',2);assert.equal(snapshot(game),before);
      badge.onclick({detail:0});assert.equal(snapshot(game),before);
    }finally{map.cleanup();}
  }
});

test('pinned CSS on an actual recipe-result badge still crafts; it does not run standalone pinned Keep',()=>{
  const target=data.recipes.find(row=>row.id==='thornwarden'),game=ready({stock:[...target.ingredients,{family:'soldier',tier:2},{family:'mage',tier:2}]}),map=mapFixture(game);try{
    const tower=game.towers[0];game.select(tower.id);game.previewRecipe(target.id);map.markers.sync(game,map.models);const badge=map.markers.badges.get(tower.id).el;
    assert.equal(badge.dataset.role,'result');assert.ok(badge.classList.contains('pinned-recruit-map-badge'));let kept=0,combined=0;game.on(type=>{if(type==='keep')kept++;if(type==='combine')combined++;});
    map.tap(badge);map.advance(150);map.tap(badge,'mouse',2);assert.equal(tower.family,'thornwarden');assert.equal(game.phase,'ready');assert.equal(kept,0);assert.equal(combined,1);
  }finally{map.cleanup();}
});

test('another recipe portrait interaction clears the standalone pinned candidate confirmation',()=>{
  const game=ready();for(const [index,piece]of data.recipes.find(row=>row.id==='rimewatch').ingredients.entries()){const tower={id:game.nextId++,...piece,state:'active',round:0,x:20+index,z:20,kills:0,cooldown:0};assert.equal(game.grid.occupy(tower.x,tower.z,tower.id).ok,true);game.towers.push(tower);}const map=mapFixture(game);try{
    const badge=map.markers.pinnedBadges.get(game.towers[0].id).el,recipeBadge=map.markers.badges.get(game.towers[5].id).el;map.tap(badge);map.advance(100);map.tap(recipeBadge);map.advance(100);map.tap(badge);assert.equal(game.phase,'select');assert.equal(game.selected,game.towers[0].id);
  }finally{map.cleanup();}
});
