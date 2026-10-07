import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../game/core/campaign-roster.js';
import {recipeFamily} from '../game/core/recipes.js';
import {cellKey} from '../game/core/grid.js';

const source=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const data={...source,towers:campaignTowers(source.towers),recipes:campaignRecipes(source.recipes),enemies:campaignEnemies(source.enemies),waves:campaignWaves(source.waves)};
const basics=Object.keys(data.towers).filter(family=>!data.towers[family].advanced);
const randomness=new WeakMap();
function fresh(seed=312){
  const game=new Game(data,{seed}),state={calls:0},native=game.rng;
  game.rng=()=>{state.calls++;return native();};game.draft.rng=game.rng;randomness.set(game,state);return game;
}
const calls=game=>randomness.get(game).calls;
function observe(game){
  const events=[],commits=[];
  game.on((type,payload)=>{
    const event={type,payload:structuredClone(payload),tower:payload.tower,phase:game.phase,round:game.round,selected:game.selected,state:payload.tower?.state,cp:game.commandPoints.value,gold:game.economy.gold,randomCalls:calls(game)};
    events.push(event);if(type==='defender-committed')commits.push({...event,previousType:events.at(-2)?.type});
  });return {events,commits};
}
function placeFive(game,{family=null,tier=1,z=10}={}){
  if(family){game.draft.forced={family,tier};game.draft.roll(game.economy.mastery);}
  for(let x=10;x<15;x++)assert.equal(game.place(x,z),true);
  assert.equal(game.phase,'select');return game.roundCandidates.map(row=>row.tower);
}
function assignCandidate(game,index,ingredient){
  const tower=game.roundCandidates[index].tower;Object.assign(tower,ingredient);const draw=game.draft.draws.find(draw=>draw.towerId===tower.id);Object.assign(draw,ingredient);return tower;
}
function retainedPieces(game,recipe){
  game.economy.xp=data.balance.xpPerLevel*100;
  const pieces=recipe.ingredients.map((ingredient,index)=>({id:101+index,...ingredient,x:19+index,z:20,state:'active',round:0,kills:index+1,priority:'strongest',cooldown:0,upgrades:2}));
  for(const tower of pieces){assert.equal(game.grid.occupy(tower.x,tower.z,tower.id).ok,true);game.towers.push(tower);}game.nextId=104;return pieces;
}
function board(game){
  return structuredClone({towers:game.towers,occupied:[...game.grid.occupied],route:game.grid.route,revision:game.grid.revision,phase:game.phase,round:game.round,selected:game.selected,nextId:game.nextId,gold:game.economy.gold,cp:game.commandPoints.value,draws:game.draft.draws,resolved:game.draft.resolved,finalSelection:game.draft.finalSelection,finalDefender:game.draft.finalDefender,reserveSelection:game.draft.reserveSelection,reservedDefender:game.draft.reservedDefender,discoveries:[...game.discoveries]});
}
function committed(game,observed,tower,action,{count=1,phase='ready'}={}){
  assert.equal(observed.commits.length,count,'one commitment for each successful final action');const event=observed.commits.at(-1);
  assert.deepEqual(Object.keys(event.payload).sort(),['action','round','tower']);assert.equal(event.payload.action,action);assert.equal(event.payload.round,game.round);
  assert.equal(event.tower,tower,'payload carries the actual resulting board identity');assert.equal(event.payload.tower.id,tower.id);assert.equal(event.payload.tower.family,tower.family);assert.equal(event.payload.tower.tier,tower.tier);assert.equal(event.payload.tower.state,'active');
  assert.equal(event.phase,phase,'listeners see the completed action state');assert.equal(event.selected,tower.id);assert.equal(event.state,'active');assert.equal(event.previousType,['keep','downgrade'].includes(action)?'keep':'combine','existing synthetic sound precedes the voice event');
  assert.ok(game.towers.includes(tower));assert.equal(game.selection,tower);assert.equal(tower.state,'active');return event;
}
function silentFailure(game,observed,action){
  const before=board(game),count=observed.commits.length,randomBefore=calls(game);assert.equal(action(),false);assert.deepEqual(board(game),before,'rejected actions preserve committed board/CP/gold/draft state');assert.equal(observed.commits.length,count);assert.equal(calls(game),randomBefore);
}

test('mystery cards, successful/failed placements, inspection and recipe previews never commit a defender',()=>{
  const game=fresh(),observed=observe(game);assert.ok(game.draft.draws.every(draw=>!draw.family&&!draw.tier));
  for(let repeat=0;repeat<5;repeat++){void game.roundCandidates;void game.recipePreview;void game.combinationHints;game.select(null);game.select(999);}
  assert.equal(game.place(-1,10),false);assert.equal(calls(game),0);assert.equal(game.place(10,10),true);assert.equal(calls(game),2);
  assert.equal(game.place(10,10),false);assert.equal(calls(game),2);for(let x=11;x<15;x++)assert.equal(game.place(x,10),true);assert.equal(calls(game),10);
  for(const tower of game.towers){game.select(tower.id);game.select(tower.id);void game.recipePreview;void game.availableRecipes();}assert.equal(observed.commits.length,0);
  const secret=data.recipes.find(recipe=>recipeFamily(recipe)==='ladyclaire');game.economy.xp=data.balance.xpPerLevel*100;
  secret.ingredients.forEach((ingredient,index)=>assignCandidate(game,index,ingredient));game.select(game.towers[0].id);
  const randomBefore=calls(game);assert.equal(game.previewRecipe(secret.id),true);assert.equal(game.recipePreview.recipe,secret);void game.combinationHints;assert.equal(game.previewRecipe('stale-recipe-id'),false);
  assert.equal(calls(game),randomBefore);assert.equal(observed.commits.length,0);assert.equal(game.phase,'select');assert.ok(game.towers.every(tower=>tower.state==='draft'));
});

test('all 48 ordinary family/rank keep actions emit once after the final identity and draft state are committed',()=>{
  assert.equal(basics.length,8);let exercised=0;
  for(const [familyIndex,family] of basics.entries())for(let tier=1;tier<=6;tier++){
    const game=fresh(),observed=observe(game),candidates=placeFive(game,{family,tier}),index=(familyIndex+tier)%5,tower=candidates[index];game.select(tower.id);Object.assign(tower,{kills:19,priority:'strongest'});
    const prior=structuredClone(tower),occupied=[...game.grid.occupied],route=structuredClone(game.grid.route),cp=game.commandPoints.value,gold=game.economy.gold,nextId=game.nextId,randomBefore=calls(game);
    assert.equal(game.keep(),true);committed(game,observed,tower,'keep');assert.deepEqual(tower,{...prior,state:'active'});assert.equal(game.draft.resolved,true);assert.equal(game.draft.finalSelection,index);assert.equal(game.draft.finalDefender.id,tower.id);
    assert.deepEqual([...game.grid.occupied],occupied);assert.deepEqual(game.grid.route,route);assert.equal(game.nextId,nextId);assert.equal(game.commandPoints.value,cp);assert.equal(game.economy.gold,gold);assert.equal(calls(game),randomBefore);assert.equal(game.towers.filter(t=>t.state==='ruin').length,4);
    game.select(tower.id);game.select(tower.id);game.emit('change');silentFailure(game,observed,()=>game.keep());assert.equal(observed.commits.length,1);exercised++;
  }assert.equal(exercised,48);
});

test('all 40 valid downgrades announce the paid lower rank once rather than the originally placed rank',()=>{
  let exercised=0;for(const family of basics)for(let tier=2;tier<=6;tier++){
    const game=fresh(),observed=observe(game),[tower]=placeFive(game,{family,tier});game.select(tower.id);game.economy.gold=450;
    const cp=game.commandPoints.value,randomBefore=calls(game),tile=[tower.x,tower.z],id=tower.id;
    assert.equal(game.downgrade(),true);const event=committed(game,observed,tower,'downgrade');assert.equal(tower.tier,tier-1);assert.equal(event.gold,450-data.balance.downgradeCost);assert.equal(game.economy.gold,250);assert.equal(game.commandPoints.value,cp);assert.equal(calls(game),randomBefore);assert.equal(tower.id,id);assert.deepEqual([tower.x,tower.z],tile);assert.equal(game.grid.occupied.size,5);assert.equal(game.draft.finalDefender.tier,tier-1);silentFailure(game,observed,()=>game.downgrade());exercised++;
  }assert.equal(exercised,40);
});

test('all 40 basic rank merges announce the actual higher-rank survivor once after combine',()=>{
  let exercised=0;for(const family of basics)for(let tier=1;tier<=5;tier++){
    const game=fresh(),observed=observe(game),[tower,partner]=placeFive(game,{family,tier});tower.kills=3;partner.kills=7;game.select(tower.id);const randomBefore=calls(game),cp=game.commandPoints.value,gold=game.economy.gold,id=tower.id,tile=[tower.x,tower.z];
    assert.equal(game.merge(),true);committed(game,observed,tower,'merge');assert.equal(tower.tier,tier+1);assert.equal(tower.kills,10);assert.equal(partner.state,'ruin');assert.equal(tower.id,id);assert.deepEqual([tower.x,tower.z],tile);assert.equal(game.commandPoints.value,cp);assert.equal(game.economy.gold,gold);assert.equal(calls(game),randomBefore);assert.equal(game.grid.occupied.size,5);assert.equal(game.draft.finalDefender.tier,tier+1);assert.equal(observed.events.find(event=>event.type==='combine').payload.crafted,undefined);silentFailure(game,observed,()=>game.merge());exercised++;
  }assert.equal(exercised,40);
});

test('every obtainable nonsecret champion crafts from retained ingredients and announces its resulting identity',()=>{
  const recipes=data.recipes.filter(recipe=>!recipe.currentRoundOnly);assert.equal(recipes.length,37);const produced=new Set();
  for(const [index,recipe] of recipes.entries()){
    const game=fresh(),observed=observe(game),pieces=retainedPieces(game,recipe),tower=pieces[index%pieces.length];game.phase='ready';game.select(tower.id);
    const cp=game.commandPoints.value,gold=game.economy.gold,randomBefore=calls(game),occupied=[...game.grid.occupied],tile=[tower.x,tower.z],id=tower.id,draft=structuredClone(game.draft.draws),before= tower.family;
    assert.equal(game.craft(recipe.id),true);committed(game,observed,tower,'craft');const family=recipeFamily(recipe);assert.equal(tower.family,family);assert.equal(tower.tier,1);assert.equal(tower.upgrades,0);assert.equal(tower.kills,6);assert.equal(tower.id,id);assert.deepEqual([tower.x,tower.z],tile);assert.equal(game.discoveries.has(family),true);assert.equal(game.towers.filter(t=>t.state==='active').length,1);assert.deepEqual([...game.grid.occupied],occupied);
    assert.deepEqual(game.draft.draws,draft);assert.equal(game.draft.resolved,false);assert.equal(game.commandPoints.value,cp);assert.equal(game.economy.gold,gold);assert.equal(calls(game),randomBefore);const combine=observed.events.find(e=>e.type==='combine');assert.equal(combine.payload.previousFamily,before);assert.equal(combine.payload.crafted,true);silentFailure(game,observed,()=>game.craft(recipe.id));produced.add(family);
  }assert.equal(produced.size,37);
});

test('each real Lady Claire ingredient can anchor the once-only current-draft secret commitment',()=>{
  const recipe=data.recipes.find(recipe=>recipeFamily(recipe)==='ladyclaire');assert.ok(recipe.currentRoundOnly);
  for(let index=0;index<3;index++){
    const game=fresh(),observed=observe(game);placeFive(game,{family:'archer',tier:2});game.economy.xp=data.balance.xpPerLevel*100;recipe.ingredients.forEach((ingredient,index)=>assignCandidate(game,index,ingredient));const tower=game.towers[index];game.select(tower.id);
    const id=tower.id,tile=[tower.x,tower.z],randomBefore=calls(game),cp=game.commandPoints.value;assert.equal(game.previewRecipe(recipe.id),true);assert.equal(observed.commits.length,0);assert.equal(game.craft(recipe.id),true);committed(game,observed,tower,'craft');assert.equal(tower.family,'ladyclaire');assert.equal(tower.tier,1);assert.equal(tower.id,id);assert.deepEqual([tower.x,tower.z],tile);assert.equal(game.draft.resolved,true);assert.equal(game.draft.finalSelection,index);assert.equal(game.draft.finalDefender.family,'ladyclaire');assert.equal(game.grid.occupied.size,5);assert.equal(game.towers.filter(t=>t.state==='ruin').length,4);assert.equal(game.commandPoints.value,cp);assert.equal(calls(game),randomBefore);silentFailure(game,observed,()=>game.craft(recipe.id));silentFailure(game,observed,()=>game.keep());
  }
});

test('retained-only crafting leaves an open draft intact, and mixed crafting commits the retained result foundation',()=>{
  const recipe=data.recipes.find(recipe=>!recipe.currentRoundOnly&&recipe.ingredients.every(piece=>!data.towers[piece.family].advanced));assert.ok(recipe);
  for(const phase of ['build','select','reward']){
    const game=fresh(),observed=observe(game);if(phase==='select')placeFive(game,{family:'archer',tier:2});const [tower]=retainedPieces(game,recipe);game.phase=phase;game.select(tower.id);const draft=structuredClone(game.draft.draws),randomBefore=calls(game);
    assert.equal(game.craft(recipe.id),true);committed(game,observed,tower,'craft',{phase});assert.equal(game.phase,phase);assert.deepEqual(game.draft.draws,draft);assert.equal(game.draft.resolved,false);assert.equal(calls(game),randomBefore);
    if(phase==='select'){const candidate=game.roundCandidates.at(-1).tower;game.select(candidate.id);assert.equal(observed.commits.length,1);assert.equal(game.keep(),true);committed(game,observed,candidate,'keep',{count:2});}
  }
  const game=fresh(),observed=observe(game);placeFive(game,{family:'archer',tier:2});const retained=retainedPieces(game,recipe);game.towers=game.towers.filter(t=>!retained.slice(1).includes(t));for(const piece of retained.slice(1))game.grid.remove(piece.x,piece.z);
  recipe.ingredients.slice(1).forEach((piece,index)=>assignCandidate(game,index,piece));const tower=retained[0],reserved=game.roundCandidates.at(-1).tower;game.select(reserved.id);assert.equal(game.reserve(),true);assert.equal(observed.commits.length,0);game.select(tower.id);const cp=game.commandPoints.value,randomBefore=calls(game),tile=[tower.x,tower.z];
  assert.equal(game.craft(recipe.id),true);committed(game,observed,tower,'craft');assert.equal(game.draft.finalDefender.id,tower.id);assert.ok(game.draft.draws.every(draw=>draw.towerId!==tower.id));assert.equal(game.draft.finalDefender.family,recipeFamily(recipe));assert.equal(game.draft.reservedDefender.id,reserved.id);assert.equal(reserved.state,'reserved');assert.deepEqual([tower.x,tower.z],tile);assert.equal(game.commandPoints.value,cp);assert.equal(calls(game),randomBefore);
});

test('reroll and fixed reservation stay silent until the final keeper, including the returning draft identity',()=>{
  const rerolled=fresh(42),rerollEvents=observe(rerolled);placeFive(rerolled);const ids=rerolled.towers.map(t=>t.id),cp=rerolled.commandPoints.value;assert.equal(rerolled.reroll(),true);assert.equal(rerolled.commandPoints.value,cp-data.balance.commandPoints.costs.reroll);assert.deepEqual(rerolled.towers.map(t=>t.id),ids);assert.equal(rerollEvents.commits.length,0);silentFailure(rerolled,rerollEvents,()=>rerolled.reroll());
  const rerolledTower=rerolled.towers[1];rerolled.select(rerolledTower.id);const family=rerolledTower.family,tier=rerolledTower.tier,randomBefore=calls(rerolled);assert.equal(rerolled.keep(),true);committed(rerolled,rerollEvents,rerolledTower,'keep');assert.equal(rerollEvents.commits[0].payload.tower.family,family);assert.equal(rerollEvents.commits[0].payload.tower.tier,tier);assert.equal(calls(rerolled),randomBefore);
  const game=fresh(41),observed=observe(game);placeFive(game);const reserved=game.towers[0];Object.assign(reserved,{kills:9,priority:'last'});game.select(reserved.id);const identity=structuredClone(reserved),points=game.commandPoints.value;assert.equal(game.reserve(),true);assert.equal(game.commandPoints.value,points-data.balance.commandPoints.costs.reserve);game.select(reserved.id);assert.equal(observed.commits.length,0);silentFailure(game,observed,()=>game.keep());
  const keeper=game.roundCandidates.at(-1).tower;game.select(keeper.id);assert.equal(game.keep(),true);committed(game,observed,keeper,'keep');assert.equal(game.startCombat(),true);game.combat.enemies=[];game.combat.spawnQueue=[];game.completeWave();assert.equal(game.round,2);assert.equal(game.phase,'build');assert.equal(game.towers.find(t=>t.id===reserved.id),reserved);assert.equal(reserved.state,'draft');assert.equal(game.draft.draws[0].origin,'reserve');assert.equal(game.draft.draws[0].fixedPosition,true);assert.equal(observed.commits.length,1);
  game.select(reserved.id);assert.equal(observed.commits.length,1);for(let x=10;x<14;x++)assert.equal(game.place(x,12),true);assert.equal(observed.commits.length,1);game.select(reserved.id);const nextPoints=game.commandPoints.value,nextRandom=calls(game);assert.equal(game.keep(),true);committed(game,observed,reserved,'keep',{count:2});assert.equal(observed.commits.at(-1).payload.round,2);assert.equal(reserved.family,identity.family);assert.equal(reserved.tier,identity.tier);assert.equal(reserved.kills,identity.kills);assert.equal(reserved.priority,identity.priority);assert.deepEqual([reserved.x,reserved.z],[identity.x,identity.z]);assert.equal(game.commandPoints.value,nextPoints);assert.equal(calls(game),nextRandom);silentFailure(game,observed,()=>game.keep());
});

test('move, active inspection, enemy inspection and pause never introduce another commitment',()=>{
  const game=fresh(),observed=observe(game);placeFive(game);assert.equal(game.keep(),true);const defender=game.selection,wall=game.towers.find(t=>t.state==='ruin');committed(game,observed,defender,'keep');const cp=game.commandPoints.value;
  game.select(wall.id);game.select(defender.id);assert.equal(game.beginMove(),true);game.select(defender.id);assert.equal(game.selectMove(999),false);assert.equal(game.selectMove(wall.id),true);assert.equal(game.commandPoints.value,cp-data.balance.commandPoints.costs.move);assert.equal(game.grid.occupied.get(cellKey(defender.x,defender.z)),defender.id);assert.equal(observed.commits.length,1);
  assert.equal(game.startCombat(),true);const enemy=game.combat.spawn('host_01');game.paused=true;const randomBefore=calls(game);game.select(defender.id);game.selectEnemy(enemy.id);game.select(defender.id);game.emit('change');game.tick(0);assert.equal(observed.commits.length,1);assert.equal(calls(game),randomBefore);
});

test('rejected, stale and competing actions emit no commitment and preserve board state and resources',()=>{
  for(const action of ['keep','downgrade','merge']){const game=fresh(),observed=observe(game);assert.equal(game.place(10,10),true);silentFailure(game,observed,()=>game[action]());}
  const cases=[
    {action:'downgrade',mutate:g=>g.economy.gold=199},
    {action:'downgrade',mutate:g=>g.selection.tier=1},
    {action:'downgrade',mutate:g=>g.selection.round--},
    {action:'merge',mutate:g=>g.selection.tier=6},
    {action:'merge',mutate:g=>g.selection.round--},
    {action:'keep',mutate:g=>g.towers=g.towers.filter(t=>t!==g.selection)},
    {action:'downgrade',mutate:g=>g.selected=999},
    {action:'merge',mutate:g=>g.selected=999},
  ];
  for(const {action,mutate} of cases){const game=fresh(),observed=observe(game);placeFive(game,{family:'soldier',tier:3});game.select(game.towers[0].id);mutate(game);silentFailure(game,observed,()=>game[action]());}
  const secret=data.recipes.find(recipe=>recipeFamily(recipe)==='ladyclaire');
  for(const invalidate of [g=>g.towers[1].round--,g=>g.draft.draws[1].towerId=999,g=>g.towers[1].tier++,g=>g.draft.draws[4].placed=false]){
    const game=fresh(),observed=observe(game);placeFive(game,{family:'archer',tier:2});game.economy.xp=data.balance.xpPerLevel*100;secret.ingredients.forEach((piece,index)=>assignCandidate(game,index,piece));game.select(game.towers[0].id);assert.equal(game.previewRecipe(secret.id),true);invalidate(game);silentFailure(game,observed,()=>game.craft(secret.id));assert.equal(observed.commits.length,0);
  }
  const game=fresh(),observed=observe(game);placeFive(game);assert.equal(game.keep(),true);const defender=game.selection;assert.equal(game.beginMove(),true);game.select(defender.id);for(const action of ['keep','downgrade','merge'])silentFailure(game,observed,()=>game[action]());silentFailure(game,observed,()=>game.craft('missing-recipe'));assert.equal(game.cancelMove(),true);assert.equal(observed.commits.length,1);
  for(const phase of ['combat','won','lost']){game.phase=phase;for(const action of ['keep','downgrade','merge'])silentFailure(game,observed,()=>game[action]());silentFailure(game,observed,()=>game.craft(secret.id));}
});
