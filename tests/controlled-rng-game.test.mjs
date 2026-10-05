import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {cellKey} from '../game/core/grid.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {supportBonuses} from '../game/core/math.js';
const original=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const make=(data=original)=>new Game(data,{seed:42,waveLimit:data.waves.length});
function placeFive(g,choices=null){
  let slot=g.draft.draws.filter(draw=>draw.placed).length;for(let z=8;z<30&&g.phase==='build';z++)for(let x=8;x<30&&g.phase==='build';x++){
    if(choices)g.draft.roundForced=choices[slot];
    if(g.place(x,z))slot++;
  }g.draft.roundForced=null;assert.equal(g.phase,'select');assert.equal(g.draft.draws.length,5);return g.roundCandidates.map(c=>c.tower);
}
function next(g){assert.equal(g.startCombat(),true);g.combat.spawnQueue=[];g.combat.enemies=[];g.completeWave();assert.equal(g.phase,'build');}
test('real reroll keeps foundations and IDs, consumes CP rather than gold and resets only with the next draft',()=>{
  const g=make();assert.equal(g.commandPoints.value,3);assert.equal(g.reroll(),false);
  const towers=placeFive(g),before=towers.map(t=>({id:t.id,x:t.x,z:t.z})),gold=g.economy.gold,route=g.grid.route;
  assert.equal(g.reroll(),true);assert.equal(g.commandPoints.value,2);assert.equal(g.economy.gold,gold);assert.equal(g.grid.route,route);
  assert.deepEqual(g.roundCandidates.map(({tower:t})=>({id:t.id,x:t.x,z:t.z})),before);assert.equal(g.reroll(),false);assert.equal(g.commandPoints.value,2);
  assert.equal(g.keep(),true);next(g);assert.equal(g.draft.rerollsUsed,0);placeFive(g);assert.equal(g.reroll(),true);assert.equal(g.commandPoints.value,1);
});
test('paid Reserve keeps its fixed blocker and leaves one keeper plus three walls and one inactive defender',()=>{
  const g=make(),candidates=placeFive(g),reserved=candidates[1],tile=cellKey(reserved.x,reserved.z);
  const route=g.grid.route,revision=g.grid.revision;
  g.select(reserved.id);assert.equal(g.reserve(),true);assert.equal(g.commandPoints.value,2);assert.equal(g.grid.occupied.get(tile),reserved.id);
  assert.equal(g.grid.route,route);assert.equal(g.grid.revision,revision);assert.equal(g.towers.find(t=>t.id===reserved.id),reserved);assert.equal(reserved.state,'reserved');assert.equal(g.roundCandidates.length,4);assert.equal(g.draft.draws.length,5);
  assert.equal(g.reserve(),false);assert.equal(g.reroll(),false);assert.equal(g.commandPoints.value,2);
  g.select(candidates[0].id);assert.equal(g.keep(),true);assert.equal(g.towers.filter(t=>t.state==='active').length,1);assert.equal(g.towers.filter(t=>t.state==='ruin').length,3);assert.equal(g.grid.occupied.size,5);
  assert.deepEqual(supportBonuses(g.selection,g.towers,g.data),supportBonuses(g.selection,[g.selection],g.data));
  assert.equal(g.startCombat(),true);assert.equal(g.towers.find(t=>t.id===reserved.id),reserved);assert.equal(g.draft.reservedDefender.id,reserved.id);
});
test('carried Slot 1 stays unchanged on reroll, renewal costs again, and ignored carry becomes a normal wall',()=>{
  const g=make(),first=placeFive(g),saved=first[1];g.select(saved.id);g.reserve();g.select(first[0].id);g.keep();next(g);
  const draw=g.draft.draws[0];assert.equal(draw.origin,'reserve');assert.equal(draw.family,saved.family);assert.equal(draw.tier,saved.tier);assert.equal(draw.placed,true);assert.equal(draw.fixedPosition,true);assert.equal(draw.towerId,saved.id);assert.equal(g.activeDraw,1);assert.equal(g.draft.draws.filter(d=>!d.family).length,4);
  placeFive(g);const returned=g.towers.find(t=>t.id===saved.id);assert.ok(returned);assert.equal(g.reroll(),true);assert.equal(returned.family,saved.family);assert.equal(returned.tier,saved.tier);
  g.select(returned.id);assert.equal(g.reserve(),true);assert.equal(g.commandPoints.value,0);g.select(g.roundCandidates[0].tower.id);g.keep();next(g);
  assert.equal(g.draft.draws[0].identity.id,saved.id);placeFive(g);g.select(saved.id);assert.equal(g.reserve(),false);assert.equal(g.reroll(),false);
  g.select(g.roundCandidates.find(c=>c.tower.id!==saved.id).tower.id);assert.equal(g.keep(),true);assert.equal(g.towers.find(t=>t.id===saved.id).state,'ruin');assert.equal(g.draft.reservedDefender,null);next(g);assert.equal(g.draft.draws.some(d=>d.origin==='reserve'),false);assert.equal(g.commandPoints.value,0);
});
test('returned reserve is already on its original tile, cannot relocate, and activates only after all five choices are ready',()=>{
  const g=make(),first=placeFive(g),saved=first[1],position={x:saved.x,z:saved.z},tile=cellKey(saved.x,saved.z);let placements=0;
  g.on(type=>{if(type==='place')placements++;});g.select(saved.id);g.reserve();g.select(first[0].id);g.keep();next(g);
  assert.equal(placements,0);assert.equal(g.towers.find(t=>t.id===saved.id),saved);assert.deepEqual({x:saved.x,z:saved.z},position);assert.equal(saved.state,'draft');assert.equal(saved.round,2);assert.equal(g.grid.occupied.get(tile),saved.id);
  g.select(saved.id);assert.equal(g.keep(),false);g.activeDraw=0;assert.equal(g.place(20,20),false);assert.equal(placements,0);g.activeDraw=1;placeFive(g);assert.equal(placements,4);
  g.select(saved.id);assert.equal(g.keep(),true);assert.equal(saved.state,'active');assert.deepEqual({x:saved.x,z:saved.z},position);assert.equal(g.commandPoints.value,2);assert.equal(g.towers.filter(t=>t.id===saved.id).length,1);
});
test('reserved blocker cannot be demolished or used in a recipe and performs no attacks or support',()=>{
  const g=make(),first=placeFive(g,Array(5).fill({family:'cleric',tier:2})),saved=first[1];g.select(saved.id);g.reserve();g.select(saved.id);
  assert.equal(g.remove(),false);assert.equal(g.canCombine(saved),false);assert.deepEqual(g.availableRecipes(saved),[]);assert.equal(g.commandMove.eligibleDefenders.includes(saved),false);assert.equal(g.commandMove.wallCandidates.includes(saved),false);
  g.select(first[0].id);g.keep();assert.deepEqual(supportBonuses(g.selection,g.towers,g.data),supportBonuses(g.selection,[g.selection],g.data));
  g.startCombat();const attacks=[];g.on((type,payload)=>{if(type==='attack')attacks.push(payload.tower?.id);});const cooldown=saved.cooldown;g.combat.update(.3);assert.equal(saved.cooldown,cooldown);assert.equal(attacks.includes(saved.id),false);assert.equal(saved.state,'reserved');
});
for(const keepOld of [true,false])test(`a different Reserve replaces previous carry, whose ordinary fate is ${keepOld?'keeper':'wall'}`,()=>{
  const g=make(),first=placeFive(g),old=first[0];g.select(old.id);g.reserve();g.select(first[1].id);g.keep();next(g);
  const choices=placeFive(g),replacement=choices[1];g.select(replacement.id);assert.equal(g.reserve(),true);assert.equal(g.draft.draws[0].protectedFromReroll,false);assert.equal(g.draft.draws.filter(d=>d.reservedForNextDraft).length,1);
  g.select(keepOld?old.id:choices[2].id);g.keep();assert.equal(g.towers.find(t=>t.id===old.id).state,keepOld?'active':'ruin');next(g);assert.equal(g.draft.draws.length,5);assert.equal(g.draft.draws[0].identity.id,replacement.id);
});
test('actual boss death awards five once, while boss escape and repeated completion cannot earn CP',()=>{
  const g=make(),bossType=Object.keys(original.enemies).find(k=>original.enemies[k].boss);assert.ok(bossType);placeFive(g);g.keep();g.startCombat();
  const boss=g.combat.spawn(bossType);assert.equal(g.commandPoints.value,3);g.combat.damage(boss,1e9,'pure',{},null);assert.equal(g.commandPoints.value,8);
  g.combat.damage(boss,1e9,'pure',{},null);assert.equal(g.rewardBossCommandPoints({...boss}),0);assert.equal(g.commandPoints.value,8);
  const escaped=g.combat.spawn(bossType);escaped.dead=true;g.emit('leak',{enemy:escaped});assert.equal(g.commandPoints.value,8);assert.equal(g.rewardBossCommandPoints(escaped),0);
  g.combat.enemies=[];g.combat.spawnQueue=[];g.completeWave();g.completeWave();assert.equal(g.commandPoints.value,8);
});
test('ended runs discard Reserve and new runs clear CP, reserve, reroll and movement state',()=>{
  for(const won of [false,true]){const g=make(),choices=placeFive(g);g.reroll();g.select(choices[1].id);g.reserve();assert.equal(g.commandPoints.value,1);g.end(won);assert.equal(g.draft.reserveSelection,null);assert.equal(g.draft.reservedDefender,null);assert.equal(g.draft.carriedReserve,null);assert.equal(g.commandActions.reroll.available,false);assert.equal(g.commandActions.reserve.available,false);}
  const fresh=make();assert.equal(fresh.commandPoints.value,3);assert.equal(fresh.draft.rerollsUsed,0);assert.equal(fresh.draft.reservedDefender,null);assert.equal(fresh.draft.reserveSelection,null);assert.equal(fresh.commandMove.active,false);
});
test('a secret recipe may use the four available choices but cannot consume the inactive reserved choice',()=>{
  const data={...original,towers:campaignTowers(original.towers),recipes:campaignRecipes(original.recipes),enemies:campaignEnemies(original.enemies),waves:campaignWaves(original.waves)},g=make(data),recipe=g.recipes.find(r=>r.currentRoundOnly);
  assert.ok(recipe);g.economy.xp=10000;
  const choices=placeFive(g,[...recipe.ingredients,{family:'archer',tier:1},{family:'cleric',tier:1}]);g.select(choices[4].id);assert.equal(g.reserve(),true);g.select(choices[0].id);
  assert.ok(g.availableRecipes().some(r=>r.id===recipe.id));assert.equal(g.craft(recipe.id),true);assert.equal(g.draft.finalDefender.family,recipe.id);assert.equal(g.draft.reservedDefender.id,choices[4].id);assert.equal(g.towers.filter(t=>t.state==='active').length,1);assert.equal(g.towers.filter(t=>t.state==='ruin').length,3);
  const h=make(data);h.economy.xp=10000;const other=placeFive(h,[...recipe.ingredients,{family:'archer',tier:1},{family:'cleric',tier:1}]);h.select(other[1].id);h.reserve();h.select(other[0].id);assert.equal(h.availableRecipes().some(r=>r.id===recipe.id),false);assert.equal(h.craft(recipe.id),false);assert.equal(h.phase,'select');
});
test('crafting with a retained result foundation resolves and carries Reserve into the next actual draft',()=>{
  const g=make(),recipe={id:'custom-cp-recipe',name:'CP test champion',level:1,ingredients:[{family:'soldier',tier:1},{family:'archer',tier:1},{family:'mage',tier:1}]};
  g.data={...original,towers:{...original.towers,[recipe.id]:{...original.towers.soldier,advanced:true}},recipes:[...original.recipes,recipe]};g.draft.data=g.data;
  const first=placeFive(g,Array(5).fill({family:'soldier',tier:1}));g.select(first[0].id);g.keep();next(g);
  const second=placeFive(g,[{family:'archer',tier:1},{family:'mage',tier:1},{family:'druid',tier:1},{family:'cleric',tier:1},{family:'archer',tier:2}]);g.select(second[4].id);g.reserve();g.select(first[0].id);
  assert.equal(g.craft(recipe.id),true);assert.equal(g.phase,'ready');assert.equal(g.draft.resolved,true);assert.equal(g.draft.finalDefender.id,first[0].id);next(g);assert.equal(g.draft.draws[0].identity.id,second[4].id);
});
