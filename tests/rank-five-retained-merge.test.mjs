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

for(const family of families)for(const phase of ['ready','build','select'])test(`${family}: retained Rank V pair merges at its chosen foundation in ${phase}, preserving the current draft`,()=>{
  const {game,pair:[tower,partner]}=retainedPair(family),control=retainedPair(family).game;
  if(phase!=='ready'){advance(game);advance(control);if(phase==='select'){fillRound(game,families.find(other=>other!==family),1);fillRound(control,families.find(other=>other!==family),1);}}
  assert.equal(game.phase,phase);game.select(tower.id);game.mvp.setLevel(tower,3);game.mvp.setLevel(partner,8);tower.kills=4;partner.kills=9;tower.attackPaused=true;tower.priority='last';
  const foundations=[...game.grid.occupied],route=game.grid.route,positions=game.towers.map(t=>[t.id,t.x,t.z]),draft=draftState(game),gold=game.economy.gold,cp=game.commandPoints.value,others=game.towers.filter(t=>t!==tower&&t!==partner).map(t=>structuredClone(t));
  const events=[];game.on((type,event)=>{if(['combine','defender-committed'].includes(type))events.push({type,event,tier:event.tower.tier,state:event.tower.state});});
  assert.equal(game.mergePartner(),partner);assert.equal(game.merge(),true);
  assert.equal(game.selection,tower);assert.equal(tower.state,'active');assert.equal(tower.tier,6);assert.equal(tower.mvpLevel,8);assert.equal(tower.kills,13);assert.equal(tower.attackPaused,true);assert.equal(tower.priority,'last');assert.equal(partner.state,'ruin');
  assert.deepEqual(game.towers.map(t=>[t.id,t.x,t.z]),positions);assert.deepEqual([...game.grid.occupied],foundations);assert.equal(game.grid.route,route);assert.equal(draftState(game),draft);assert.deepEqual(game.towers.filter(t=>t!==tower&&t!==partner),others);
  assert.equal(game.economy.gold,gold);assert.equal(game.commandPoints.value,cp);assert.equal(game.rng(),control.rng(),'Merging consumes no RNG');
  assert.deepEqual(events.map(({type,tier,state})=>[type,tier,state]),[['combine',6,'active'],['defender-committed',6,'active']]);assert.equal(events[1].event.action,'merge');
  const after=state(game);assert.equal(game.merge(),false);assert.equal(state(game),after,'Rank VI cannot be merged again');
});

test('a retained pair may merge during the real reward transition without resolving or clearing another draft',()=>{
  const {game,pair:[tower,partner]}=retainedPair();game.select(tower.id);let checked=false;
  game.on(type=>{if(type!=='reward')return;assert.equal(game.phase,'reward');const before=draftState(game),foundations=[...game.grid.occupied];assert.equal(game.merge(),true);assert.equal(draftState(game),before);assert.deepEqual([...game.grid.occupied],foundations);checked=true;});
  advance(game);assert.equal(checked,true);assert.equal(game.phase,'build');assert.equal(game.round,3);assert.equal(tower.tier,6);assert.equal(partner.state,'ruin');assert.ok(game.draft.draws.every(draw=>!draw.placed));
});

for(const anchor of ['retained','draft'])test(`mixed Rank V pair requires all five placements and keeps the selected ${anchor} foundation`,()=>{
  const game=new Game(data,{seed:723}),[old]=fillRound(game,'archer');game.select(old.id);game.keep();advance(game);
  const [current]=placeRound(game,[piece('archer',5)]);game.select(old.id);const partial=state(game);assert.equal(game.mergePartner(),null);assert.equal(game.merge(),false);assert.equal(state(game),partial);assert.equal(mergeTowerKey(game,old.id),null);
  const remaining=placeRound(game,[piece('cleric'),piece('druid'),piece('mage'),piece('runebreaker')]);assert.equal(game.phase,'select');
  game.mvp.setLevel(old,4);game.mvp.setLevel(current,9);old.kills=2;current.kills=6;
  const tower=anchor==='retained'?old:current,partner=tower===old?current:old,position=[tower.x,tower.z],wallPosition=[partner.x,partner.z],foundations=[...game.grid.occupied],oldWalls=game.towers.filter(t=>t.round===1&&t!==old).map(t=>structuredClone(t));
  game.select(tower.id);assert.equal(game.mergePartner(),partner);assert.equal(game.merge(),true);
  assert.equal(game.selection,tower);assert.equal(tower.tier,6);assert.equal(tower.mvpLevel,9);assert.equal(tower.kills,8);assert.deepEqual([tower.x,tower.z],position);assert.equal(partner.state,'ruin');assert.deepEqual([partner.x,partner.z],wallPosition);
  assert.ok(remaining.every(t=>t.state==='ruin'));assert.deepEqual(game.towers.filter(t=>t.round===1&&t!==old),oldWalls);assert.deepEqual([...game.grid.occupied],foundations);
  assert.equal(game.phase,'ready');assert.equal(game.draft.resolved,true);assert.equal(game.draft.finalSelection,0);assert.equal(game.draft.finalDefender.id,tower.id);assert.equal(game.draft.finalDefender.tier,6);
});

test('mixed Rank V merge preserves a paid reserve and reuses its fixed foundation in the next draft',()=>{
  const game=new Game(data,{seed:723}),[old]=fillRound(game,'archer');game.select(old.id);game.keep();advance(game);
  const [current,reserved]=placeRound(game,[piece('archer',5),piece('soldier',3),piece('mage'),piece('druid'),piece('cleric')]);
  game.select(reserved.id);assert.equal(game.reserve(),true);const fixed=[reserved.x,reserved.z],cp=game.commandPoints.value;
  game.select(old.id);assert.equal(game.mergePartner(),current);assert.equal(game.merge(),true);assert.equal(reserved.state,'reserved');assert.equal(game.draft.reservedDefender.id,reserved.id);assert.equal(game.commandPoints.value,cp);
  advance(game);assert.equal(game.draft.draws[0].towerId,reserved.id);assert.equal(game.draft.draws[0].placed,true);assert.equal(game.draft.draws[0].fixedPosition,true);assert.equal(reserved.state,'draft');assert.deepEqual([reserved.x,reserved.z],fixed);assert.equal(old.tier,6);
});

test('two current Rank V candidates still resolve exactly one keeper and inherit the maximum MVP level',()=>{
  const game=new Game(data,{seed:723}),[left,right,...others]=placeRound(game,[piece('archer',5),piece('archer',5),piece('mage'),piece('soldier'),piece('druid')]);
  game.mvp.setLevel(left,2);game.mvp.setLevel(right,10);game.select(right.id);const foundations=[...game.grid.occupied];assert.equal(game.merge(),true);assert.equal(right.tier,6);assert.equal(right.mvpLevel,10);assert.equal(left.state,'ruin');assert.ok(others.every(t=>t.state==='ruin'));assert.deepEqual([...game.grid.occupied],foundations);assert.equal(game.draft.finalSelection,1);assert.equal(game.draft.finalDefender.id,right.id);
});

test('Ranks I–IV remain limited to matching candidates of the current draft',()=>{
  for(let tier=1;tier<=4;tier++){
    const {game,pair}=retainedPair('archer',tier);game.select(pair[0].id);const before=state(game);assert.equal(game.mergePartner(),null);assert.equal(game.merge(),false);assert.equal(state(game),before);advance(game);
    const [current]=fillRound(game,'archer',tier);game.select(current.id);assert.equal(game.mergePartner(),null);assert.equal(mergeTowerKey(game,current.id),null,'Retained lower rank cannot satisfy a draft merge');
  }
});

test('Rank V merge rejects inactive, mismatched, foreign, capped, combat and Move selections without consuming anything',()=>{
  const mutations=[g=>g.towers.find(t=>t.id===6).family='mage',g=>g.towers.find(t=>t.id===6).tier=4,g=>g.towers.find(t=>t.id===6).state='reserved',g=>g.towers.find(t=>t.id===6).state='ruin',g=>g.towers.filter(t=>t.state==='active').forEach(t=>t.tier=6),g=>g.towers.filter(t=>t.state==='active').forEach(t=>t.family='highking'),g=>g.phase='combat',g=>g.phase='won',g=>g.phase='lost',g=>g.beginMove()];
  for(const mutate of mutations){const {game,pair:[tower]}=retainedPair();game.select(tower.id);mutate(game);const before=state(game);assert.equal(game.mergePartner(tower),null);assert.equal(game.merge(),false);assert.equal(state(game),before);assert.equal(mergeTowerKey(game,tower.id),null);}
  const {game,pair:[tower]}=retainedPair();assert.equal(game.mergePartner({...tower}),null,'A copied identity cannot be used as a result foundation');assert.equal(game.mergePartner(null),null);
  assert.equal(mergePartner({...tower,state:'reserved'},game.towers,data),null);assert.equal(mergePartner({...tower,tier:0},game.towers,data),null);
});

test('a current Rank V ingredient requires authoritative, complete and unresolved draft identities',()=>{
  const changes=[g=>g.draft.draws[4].placed=false,g=>g.draft.draws[4].towerId=g.draft.draws[0].towerId,g=>g.draft.resolved=true,g=>g.round++,g=>g.towers.find(t=>t.state==='draft'&&t.family==='archer').round--,g=>g.draft.draws[0].reservedForNextDraft=true];
  for(const change of changes){const game=new Game(data,{seed:723}),[old]=fillRound(game,'archer');game.select(old.id);game.keep();advance(game);fillRound(game,'archer');game.select(old.id);assert.ok(game.mergePartner());change(game);const before=state(game);assert.equal(game.mergePartner(),null);assert.equal(game.merge(),false);assert.equal(state(game),before);}
});

test('retained Rank V UI tokens execute only the exact pair and reject stale phase, foundation, MVP, identity or new-game inventory',()=>{
  const changes=[g=>g.towers[5].family='mage',g=>g.towers[5].tier=6,g=>g.towers[5].state='ruin',g=>g.towers[0].x++,g=>g.towers[5].mvpLevel=7,g=>g.phase='build',g=>g.round++,g=>g.beginMove()];
  for(const change of changes){const {game,pair:[tower]}=retainedPair();const key=mergeTowerKey(game,tower.id);assert.ok(key);change(game);const before=state(game);assert.equal(mergeTowerFromBadge(game,tower.id,key),false);assert.equal(state(game),before);}
  const old=retainedPair().game,{game,pair:[tower]}=retainedPair(),oldKey=mergeTowerKey(old,old.towers[0].id),before=state(game);assert.equal(mergeTowerFromBadge(game,tower.id,oldKey),false);assert.equal(state(game),before);
  const key=mergeTowerKey(game,tower.id);assert.equal(mergeTowerFromBadge(game,tower.id,key),true);assert.equal(game.selection,tower);assert.equal(tower.tier,6);assert.equal(mergeTowerFromBadge(game,tower.id,key),false);
});

test('current Rank V card merge buttons include retained partners and still reject a selection notification that changes eligibility',()=>{
  const game=new Game(data,{seed:723}),[old]=fillRound(game,'archer');game.select(old.id);game.keep();advance(game);const [current]=fillRound(game,'archer');
  const html=draftCardsMarkup(game,data,{}),button=html.match(new RegExp(`<button[^>]*data-action="merge-tower"[^>]*data-tower-id="${current.id}"[^>]*>`))?.[0];assert.ok(button);assert.match(button,/aria-label="Merge .* into rank VI here"/);const key=button.match(/data-merge-key="([^"]+)"/)[1];assert.equal(key,mergeTowerKey(game,current.id));
  let combined=0;game.on(type=>{if(type==='change')game.phase='combat';if(type==='combine')combined++;});assert.equal(mergeTowerFromBadge(game,current.id,key),false);assert.equal(current.tier,5);assert.equal(old.state,'active');assert.equal(current.state,'draft');assert.equal(combined,0);
});
