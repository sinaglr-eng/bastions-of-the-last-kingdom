import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {mergePartner} from '../game/core/recipes.js';
import {mergeTowerKey,mergeTowerFromBadge} from '../ui/draft-input.js';
import {draftCardsMarkup} from '../ui/draft-cards.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const families=Object.entries(data.towers).filter(([,tower])=>!tower.advanced).map(([family])=>family);
const piece=(family,tier=1)=>({family,tier});
function placeRound(game,pieces){
  const placed=[];
  for(const entry of pieces){game.draft.roundForced=entry;const index=game.draft.draws.findIndex(draw=>!draw.placed);assert.ok(index>=0);assert.equal(game.place(3+index,2+game.round),true);placed.push(game.selection);}
  return placed;
}
function fillRound(game,family,tier=5){return placeRound(game,[piece(family,tier),...Array.from({length:4},()=>piece(families.find(other=>other!==family)))]);}
function advance(game){assert.equal(game.startCombat(),true);game.completeWave();}
function retainedPair(family='archer',tier=5){
  const game=new Game(data,{seed:723}),pair=[];
  for(let round=1;round<=2;round++){
    const [tower]=fillRound(game,family,tier);game.select(tower.id);assert.equal(game.keep(),true);pair.push(tower);if(round===1)advance(game);
  }
  assert.deepEqual(pair.map(tower=>tower.round),[1,2]);return {game,pair};
}
const draftState=game=>JSON.stringify({draws:game.draft.draws,resolved:game.draft.resolved,finalSelection:game.draft.finalSelection,finalDefender:game.draft.finalDefender,reserveSelection:game.draft.reserveSelection,phase:game.phase,activeDraw:game.activeDraw});
const state=game=>JSON.stringify({towers:game.towers,selected:game.selected,round:game.round,phase:game.phase,draft:draftState(game),gold:game.economy.gold,cp:game.commandPoints.value,occupied:[...game.grid.occupied]});

for(const family of families)for(const phase of ['ready','build','select'])test(`B02 ${family}: retained V pair is rejected during ${phase} without mutation`,()=>{
  const {game,pair:[tower,partner]}=retainedPair(family),control=retainedPair(family).game;
  if(phase!=='ready'){advance(game);advance(control);if(phase==='select'){fillRound(game,family,1);fillRound(control,family,1);}}
  game.select(tower.id);const before=state(game),events=[];game.on(type=>{if(['combine','defender-committed'].includes(type))events.push(type);});
  assert.equal(game.phase,phase);assert.equal(game.mergePartner(),null);assert.equal(mergePartner(tower,[tower,partner],data),null);assert.equal(game.merge(),false);assert.equal(mergeTowerKey(game,tower.id),null);assert.equal(state(game),before);assert.deepEqual(events,[]);assert.equal(game.rng(),control.rng());
});

test('B02 retained V pair is rejected during the actual reward transition and does not affect the next draft',()=>{
  const {game,pair:[tower]}=retainedPair();game.select(tower.id);let checked=false;
  game.on(type=>{if(type!=='reward')return;const before=state(game);assert.equal(game.phase,'reward');assert.equal(game.merge(),false);assert.equal(state(game),before);checked=true;});
  advance(game);assert.equal(checked,true);assert.equal(game.round,3);assert.equal(tower.tier,5);assert.ok(game.draft.draws.every(draw=>!draw.placed));
});

for(const anchor of ['retained','draft'])test(`B02 retained V plus current V is rejected from ${anchor} foundation`,()=>{
  const game=new Game(data,{seed:723}),[old]=fillRound(game,'archer');game.select(old.id);game.keep();advance(game);
  const [current]=fillRound(game,'archer');game.select(anchor==='retained'?old.id:current.id);const before=state(game);
  assert.equal(game.mergePartner(),null);assert.equal(game.merge(),false);assert.equal(state(game),before);assert.equal(mergeTowerKey(game,game.selected),null);assert.doesNotMatch(draftCardsMarkup(game,data,{}),new RegExp(`data-action="merge-tower"[^>]*data-tower-id="${current.id}"`));
});

for(const family of families)test(`B02 ${family}: two fresh V rolls resolve one keeper at its foundation, max MVP, no RNG/resources`,()=>{
  const game=new Game(data,{seed:723}),control=new Game(data,{seed:723}),pieces=[piece(family,5),piece(family,5),piece(families.find(x=>x!==family)),piece(family,1),piece(family,2)];
  const [left,right,...others]=placeRound(game,pieces);placeRound(control,pieces);game.mvp.setLevel(left,2);game.mvp.setLevel(right,10);right.kills=4;left.kills=9;right.attackPaused=true;right.priority='last';game.select(right.id);
  const foundations=[...game.grid.occupied],position=[right.x,right.z],cp=game.commandPoints.value,gold=game.economy.gold,key=mergeTowerKey(game,right.id);
  assert.ok(key);assert.equal(mergeTowerFromBadge(game,right.id,key),true);assert.equal(right.tier,6);assert.equal(right.mvpLevel,10);assert.equal(right.kills,13);assert.equal(right.attackPaused,true);assert.equal(right.priority,'last');assert.equal(left.state,'ruin');assert.ok(others.every(t=>t.state==='ruin'));assert.deepEqual([...game.grid.occupied],foundations);assert.deepEqual([right.x,right.z],position);assert.equal(game.phase,'ready');assert.equal(game.draft.resolved,true);assert.equal(game.draft.finalSelection,1);assert.equal(game.draft.finalDefender.id,right.id);assert.equal(game.commandPoints.value,cp);assert.equal(game.economy.gold,gold);assert.equal(game.rng(),control.rng());
  const before=state(game);assert.equal(mergeTowerFromBadge(game,right.id,key),false);assert.equal(game.merge(),false);assert.equal(state(game),before);
});

test('B02 eligibility requires complete distinct actual slots, unresolved phase, current round and exact rolled identities',()=>{
  const changes=[g=>g.draft.draws[4].placed=false,g=>g.draft.draws[4].towerId=g.draft.draws[0].towerId,g=>g.draft.resolved=true,g=>g.round++,g=>g.towers[0].round--,g=>g.draft.draws[0].reservedForNextDraft=true,g=>g.draft.draws[0].family='mage',g=>g.draft.draws[0].tier=4,g=>g.draft.draws[0].origin='reserve',g=>g.phase='combat',g=>g.phase='won',g=>g.phase='lost'];
  for(const change of changes){const game=new Game(data,{seed:723}),[a]=placeRound(game,[piece('archer',5),piece('archer',5),piece('mage'),piece('soldier'),piece('druid')]);game.select(a.id);assert.ok(game.mergePartner());assert.equal(game.mergePartner({...a}),null);change(game);const before=state(game);assert.equal(game.mergePartner(),null);assert.equal(game.merge(),false);assert.equal(state(game),before);assert.equal(mergeTowerKey(game,a.id),null);}
});

test('B02 returning reserved V cannot combine with a fresh V even after reroll; other fresh pairs remain valid',()=>{
  const game=new Game(data,{seed:723}),[reserved,keeper]=placeRound(game,[piece('archer',5),piece('soldier'),piece('mage'),piece('druid'),piece('cleric')]);game.select(reserved.id);assert.equal(game.reserve(),true);game.select(keeper.id);game.keep();advance(game);
  assert.equal(game.draft.draws[0].origin,'reserve');assert.equal(game.draft.draws[0].towerId,reserved.id);
  const [fresh]=placeRound(game,[piece('archer',5),piece('mage'),piece('druid'),piece('cleric')]);game.select(fresh.id);assert.equal(game.mergePartner(),null);game.select(reserved.id);assert.equal(game.mergePartner(),null);
  game.draft.roundForced=piece('archer',5);assert.equal(game.reroll(),true);game.select(reserved.id);assert.equal(game.mergePartner(),null);assert.equal(game.merge(),false);
  const current=game.roundCandidates.map(c=>c.tower).filter(t=>t!==reserved);game.select(current[0].id);assert.ok(game.mergePartner());assert.equal(game.merge(),true);assert.equal(current[0].tier,6);assert.equal(reserved.state,'ruin');
});

test('B02 inactive reserve cannot merge while another fresh pair resolves the draft and carries that reserve',()=>{
  const game=new Game(data,{seed:723}),[a,b,reserved]=placeRound(game,[piece('archer',5),piece('archer',5),piece('archer',5),piece('druid'),piece('cleric')]);game.select(reserved.id);assert.equal(game.reserve(),true);game.select(a.id);assert.equal(game.mergePartner(),b);assert.equal(game.merge(),true);assert.equal(reserved.state,'reserved');assert.equal(game.draft.reservedDefender.id,reserved.id);advance(game);assert.equal(game.draft.draws[0].origin,'reserve');assert.equal(game.draft.draws[0].towerId,reserved.id);
});

test('B02 reroll uses resulting current profiles and invalidates pre-reroll merge tokens',()=>{
  const game=new Game(data,{seed:723}),[a,b]=placeRound(game,[piece('archer',5),piece('archer',5),piece('mage'),piece('soldier'),piece('druid')]);game.select(a.id);const key=mergeTowerKey(game,a.id);assert.ok(key);game.draft.roundForced=piece('mage',1);assert.equal(game.reroll(),true);assert.equal(mergeTowerFromBadge(game,a.id,key),false);assert.equal(a.family,'mage');assert.equal(b.tier,1);assert.equal(game.towers.some(t=>t.family==='archer'&&t.tier===5),false);
  const second=new Game(data,{seed:723});placeRound(second,[piece('archer'),piece('archer'),piece('mage'),piece('soldier'),piece('druid')]);second.draft.roundForced=piece('archer',5);assert.equal(second.reroll(),true);second.select(second.towers[0].id);assert.equal(second.merge(),true);assert.equal(second.selection.tier,6);
});

test('B02 current V badges reject changed eligibility after selection and stale identities, foundation, MVP or another game',()=>{
  const fresh=()=>{const g=new Game(data,{seed:723});placeRound(g,[piece('archer',5),piece('archer',5),piece('mage'),piece('soldier'),piece('druid')]);return g;};
  const changes=[g=>g.towers[1].family='mage',g=>g.towers[1].tier=6,g=>g.towers[1].state='ruin',g=>g.towers[0].x++,g=>g.towers[1].mvpLevel=7,g=>g.phase='build',g=>g.round++];
  for(const change of changes){const g=fresh(),key=mergeTowerKey(g,g.towers[0].id);assert.ok(key);change(g);const before=state(g);assert.equal(mergeTowerFromBadge(g,g.towers[0].id,key),false);assert.equal(state(g),before);}
  const g=fresh(),a=g.towers[0],key=mergeTowerKey(g,a.id),other=fresh();assert.equal(mergeTowerFromBadge(other,other.towers[0].id,key),false);g.on(type=>{if(type==='change')g.phase='combat';});assert.equal(mergeTowerFromBadge(g,a.id,key),false);assert.equal(a.tier,5);
});

test('B02 lower ranks retain their prior same-draft rules and cannot borrow retained lower ranks',()=>{
  for(let tier=1;tier<=4;tier++){const {game,pair:[old]}=retainedPair('archer',tier);game.select(old.id);assert.equal(game.merge(),false);advance(game);const [current]=fillRound(game,'archer',tier);game.select(current.id);assert.equal(game.mergePartner(),null);}
});
