import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {towerStats,supportBonuses} from '../game/core/math.js';
import {matchingIngredients,recipeProgress,expandedRecipeProgress,recipesUsing} from '../game/core/recipes.js';
import {championRecipeCard,abilityLines} from '../ui/grimoire.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(k=>[k,JSON.parse(readFileSync(new URL(`../data/${k}.json`,import.meta.url)))]));
const secrets=data.recipes.filter(r=>r.currentRoundOnly);
const unit=(family,id=1,x=10,z=10)=>({id,family,tier:1,x,z,state:'active',kills:0,cooldown:0});
function candidates(recipe){
  const g=new Game(data,{seed:31});
  for(let x=10;x<15;x++)assert.equal(g.place(x,10),true);
  recipe.ingredients.forEach((p,i)=>Object.assign(g.towers[i],p,{kills:i+1}));
  for(const t of g.towers.slice(3))Object.assign(t,{family:'archer',tier:2});
  g.select(g.towers[0].id);return g;
}
function unchangedFailure(g,id){
  const before=structuredClone(g.towers),positions=[...g.grid.occupied.entries()],gold=g.economy.gold,phase=g.phase;
  assert.equal(g.availableRecipes().some(r=>r.id===id),false);
  assert.notEqual(g.recipePreview?.recipe.id,id);
  assert.ok(g.combinationHints.every(h=>h.recipe.id!==id));
  assert.equal(g.craft(id),false);assert.deepEqual(g.towers,before);
  assert.deepEqual([...g.grid.occupied.entries()],positions);assert.equal(g.economy.gold,gold);assert.equal(g.phase,phase);
  assert.equal(g.discoveries.has(id),false);
}
function arena(family){
  const g=new Game(data,{seed:17});g.phase='combat';g.combat.spawnQueue=[{time:9999,type:'grunt'}];
  const source=unit(family);g.towers=[source];return {g,source};
}
function enemy(g,x,z=10){
  const e=g.combat.spawn('grunt');Object.assign(e,{x,z,hp:1e6,maxHp:1e6,speed:0,armor:0,resists:{}});return e;
}

test('two approved secret recipes use exactly the specified basic ranks',()=>{
  assert.deepEqual(secrets.map(r=>r.id),['ladyclaire','lordbernhard']);
  assert.deepEqual(secrets[0].ingredients,[{family:'mage',tier:5},{family:'druid',tier:5},{family:'frostwarden',tier:5}]);
  assert.deepEqual(secrets[1].ingredients,[{family:'soldier',tier:5},{family:'soldier',tier:4},{family:'soldier',tier:3}]);
  for(const r of secrets){assert.equal(r.ingredients.length,3);assert.equal(r.stage,'Secret');assert.equal(data.towers[r.id].secret,true);}
});

test('old retained units cannot satisfy secret recipes or report retained progress',()=>{
  for(const r of secrets){
    const g=candidates(r),old=g.towers.slice(0,3).map(t=>({...t,id:t.id+20,state:'active',round:0}));
    for(const t of g.towers.slice(0,3))Object.assign(t,{family:'archer',tier:2});g.towers.push(...old);
    g.select(old[0].id);unchangedFailure(g,r.id);
    assert.ok(recipeProgress(r,g.towers).every(p=>!p.owned&&!p.available));
    assert.ok(expandedRecipeProgress(r,g.towers,data).every(p=>p.ownedCount===0&&p.draftCount===0));
    assert.equal(recipesUsing(old[0],secrets).length,0);
    assert.equal(matchingIngredients(r,old,old[0]),null);
  }
});

test('mixing old retained ingredients with this round’s candidates never offers a secret recipe',()=>{
  for(const r of secrets){const g=candidates(r);g.towers[1].state='active';unchangedFailure(g,r.id);}
});

test('stale draft rounds and forged draw IDs cannot satisfy a secret recipe',()=>{
  for(const r of secrets){
    const stale=candidates(r);stale.towers[1].round--;unchangedFailure(stale,r.id);
    const forged=candidates(r);forged.draft.draws[1].towerId=9999;unchangedFailure(forged,r.id);
    const duplicate=candidates(r);duplicate.draft.draws[4].towerId=duplicate.draft.draws[3].towerId;unchangedFailure(duplicate,r.id);
  }
});

test('incomplete placement and every phase outside select reject secrets atomically',()=>{
  for(const r of secrets){
    const partial=candidates(r);partial.draft.draws[4].placed=false;unchangedFailure(partial,r.id);
    for(const phase of ['build','ready','reward','combat','won','lost']){const g=candidates(r);g.phase=phase;unchangedFailure(g,r.id);}
  }
});

test('a selected noningredient cannot anchor a secret result and does not create an automatic preview',()=>{
  for(const r of secrets){
    const g=candidates(r);g.select(g.towers[3].id);
    assert.equal(g.recipePreview,null);unchangedFailure(g,r.id);
    assert.equal(matchingIngredients(r,g.towers,null,{phase:'select',round:g.round}),null);
  }
});

test('exact ranks are required even when all three defenders share the Soldier family',()=>{
  for(const r of secrets){const g=candidates(r);g.towers[2].tier=6;unchangedFailure(g,r.id);}
  const g=candidates(secrets[1]);g.towers[1].tier=3;unchangedFailure(g,'lordbernhard');
});

test('each secret crafts from all three valid current-round anchors and closes ordinary selection once',()=>{
  for(const r of secrets)for(let anchor=0;anchor<3;anchor++){
    const g=candidates(r),chosen=g.towers[anchor],position=[chosen.x,chosen.z],gold=g.economy.gold,others=g.towers.slice(3),events=[];
    g.on((type,payload)=>events.push({type,payload}));g.select(chosen.id);
    assert.ok(g.availableRecipes().some(recipe=>recipe.id===r.id));assert.equal(g.previewRecipe(r.id),true);
    assert.equal(g.recipePreview.anchor,chosen);assert.equal(g.recipePreview.pieces.length,3);
    assert.deepEqual(g.recipePreview.discarded,others);
    assert.equal(g.craft(r.id),true);
    assert.equal(g.phase,'ready');assert.equal(g.selection,chosen);assert.equal(chosen.family,r.id);assert.equal(chosen.tier,1);
    assert.deepEqual([chosen.x,chosen.z],position);assert.equal(chosen.kills,6);assert.equal(g.economy.gold,gold);
    assert.equal(g.towers.filter(t=>t.state==='active').length,1);assert.equal(g.towers.filter(t=>t.state==='ruin').length,4);
    assert.ok(others.every(t=>t.state==='ruin'));assert.equal(g.grid.occupied.size,5);
    assert.equal(g.discoveries.has(r.id),true);assert.equal(events.filter(e=>e.type==='combine').length,1);
    assert.equal(events.find(e=>e.type==='discover').payload.id,r.id);
    assert.equal(g.craft(r.id),false);assert.equal(g.keep(),false);
  }
});

test('secret cards explain current-round restrictions and show recruitment only for valid anchored selection',()=>{
  for(const r of secrets){
    const g=candidates(r);
    const html=championRecipeCard(r,data,{}, {towerList:g.towers,pinned:true,craftable:g.availableRecipes().some(p=>p.id===r.id)});
    assert.match(html,/SECRET/);assert.match(html,/same current round/);assert.match(html,/Previously kept units cannot be used/);
    assert.match(html,/data-action="craft"/);assert.match(html,/other two candidates become walls/);
    g.select(g.towers[3].id);
    const blocked=championRecipeCard(r,data,{}, {towerList:g.towers,craftable:g.availableRecipes().some(p=>p.id===r.id)});
    assert.doesNotMatch(blocked,/COMBINATION AVAILABLE|data-action="craft"/);
  }
});

test('Lady Claire uses requested wiki values and explicit missing-parameter adaptations',()=>{
  const s=towerStats(unit('ladyclaire'),data);
  assert.deepEqual([s.damage,s.interval,s.range],[1225,.5,10]);
  assert.deepEqual([s.chainChance,s.chainDamage,s.chain,s.chainRange],[.2,150,5,10]);
  assert.deepEqual([s.forkedChance,s.forkedDamage,s.forkedTargets,s.forkedRange],[.5,2500,5,50]);
  assert.deepEqual([s.melancholyChance,s.melancholyDuration],[.03,5]);
  const lines=abilityLines(s).join(' ');assert.match(lines,/20%.*10 tiles per jump/);assert.match(lines,/50% forked lightning.*2,500/);assert.match(lines,/3% Melancholy.*5s/);
});

test('Lady lightning jumps five distinct enemies and forks independently to five targets',()=>{
  const {g,source}=arena('ladyclaire'),target=enemy(g,10),secondary=Array.from({length:6},(_,i)=>enemy(g,19+i*9)),chains=[];
  g.rng=()=>0;g.on((type,p)=>{if(type==='chain')chains.push(p);});
  g.combat.impact({source,target,stats:towerStats(source,data)});
  assert.equal(target.hp,1e6-1225-2500);
  for(const e of secondary.slice(0,4))assert.equal(e.hp,1e6-150-2500);
  assert.equal(secondary[4].hp,1e6-150);assert.equal(secondary[5].hp,1e6);
  const jumps=chains.slice(0,5);assert.deepEqual(jumps.map(p=>p.to.id),secondary.slice(0,5).map(e=>e.id));
  assert.deepEqual(jumps.map(p=>p.from.id),[target,...secondary.slice(0,4)].map(e=>e.id));
  assert.equal(chains.length,10);
});

test('Lady proc thresholds are 20% chain and 50% fork and blocked primary hits cannot trigger them',()=>{
  for(const [rolls,secondaryDamage] of [[[.199,.5],150],[[.2,.499],2500],[[.2,.5],0]]){
    const {g,source}=arena('ladyclaire'),target=enemy(g,11),second=enemy(g,12);let calls=0;
    g.rng=()=>rolls[calls++];g.combat.impact({source,target,stats:towerStats(source,data)});
    assert.equal(second.hp,1e6-secondaryDamage);assert.equal(calls,2);
  }
  const {g,source}=arena('ladyclaire'),target=enemy(g,11),second=enemy(g,12);target.magicImmune=true;let calls=0;g.rng=()=>{calls++;return 0;};
  g.combat.impact({source,target,stats:towerStats(source,data)});assert.equal(target.hp,1e6);assert.equal(second.hp,1e6);assert.equal(calls,0);
});

test('Melancholy cancels attack start, pauses for exactly five combat seconds and resumes immediately',()=>{
  const {g,source}=arena('ladyclaire');enemy(g,11);let shots=0,melancholy=0;
  g.on(type=>{if(type==='shot')shots++;if(type==='melancholy')melancholy++;});g.rng=()=>.02;
  g.tick(.01);assert.equal(shots,0);assert.equal(melancholy,1);assert.equal(source.disarmed,true);assert.equal(source.melancholy,5);
  const deadline=source.melancholyUntil;g.paused=true;g.tick(60);assert.equal(g.combat.elapsed,.01);assert.equal(source.melancholyUntil,deadline);
  g.paused=false;g.rng=()=>.99;g.tick(4.99);g.tick(.009);assert.equal(shots,0);assert.ok(source.melancholy>0);
  g.tick(.002);assert.equal(shots,1);assert.equal(source.melancholy,0);assert.equal(source.disarmed,false);
  assert.ok(g.combat.elapsed>=deadline&&g.combat.elapsed<deadline+.002);
});

test('Melancholy cannot fire additional attacks during frame overshoot and has a 3% boundary',()=>{
  const {g,source}=arena('ladyclaire');enemy(g,11);g.rng=()=>.02999;let shots=0;g.on(type=>{if(type==='shot')shots++;});
  g.tick(1.5);assert.equal(shots,0);assert.equal(source.melancholy,5);
  const clear=arena('ladyclaire');enemy(clear.g,11);clear.g.rng=()=>.03;let clearShots=0;clear.g.on(type=>{if(type==='shot')clearShots++;});
  clear.g.tick(.01);assert.equal(clearShots,1);assert.equal(clear.source.melancholy,0);
  source.melancholyUntil=99;g.phase='ready';g.startCombat();assert.equal(source.melancholy,0);assert.equal(source.melancholyUntil,0);
});

test('Lord Bernhard is single-target: Poison 5 is the ability grade, with 16 damage/s for five seconds',()=>{
  const {g,source}=arena('lordbernhard'),targets=Array.from({length:6},(_,i)=>enemy(g,11+i*.1));g.rng=()=>.99;
  const s=towerStats(source,data);assert.deepEqual([s.damage,s.interval,s.range],[3164,.5,13]);assert.equal(s.critChance,undefined);assert.equal(s.multishot,undefined);
  g.tick(.01);assert.equal(new Set(g.combat.projectiles.map(p=>p.target.id)).size,1);
  g.tick(.15);source.cooldown=999;
  const poisoned=targets[0];assert.equal(poisoned.hp,1e6-3164);assert.equal(poisoned.statuses.poison.dps,16);assert.equal(poisoned.statuses.poison.time,5);
  for(const e of targets.slice(1)){assert.equal(e.hp,1e6);assert.equal(e.statuses.poison,undefined);}
  g.tick(5.1);assert.equal(poisoned.hp,1e6-3164-80);assert.equal(poisoned.statuses.poison,undefined);
});

test('Melancholy uses combat seconds even at 3× speed and is not cured by an ally control-resistance aura',()=>{
  const {g,source}=arena('ladyclaire');enemy(g,11);
  const monk=unit('monk',2,11,10);monk.cooldown=999;g.towers.push(monk);g.rng=()=>.02;g.speed=3;
  g.tick(.01);const deadline=source.melancholyUntil;assert.equal(source.melancholy,5);
  assert.equal(supportBonuses(source,g.towers,data).controlResistance,1);
  g.rng=()=>.99;g.tick(1.66);assert.ok(source.melancholy>0);assert.equal(source.disarmed,true);
  let shots=0;g.on((type,p)=>{if(type==='shot'&&p.source===source)shots++;});g.tick(.01);
  assert.equal(source.melancholy,0);assert.equal(shots,1);assert.ok(g.combat.elapsed>=deadline&&g.combat.elapsed<deadline+.02);
});

test('Lord range and true-strike support work at the exact three-tile edge and stop beyond it or when consumed',()=>{
  const archer=unit('archer'),lord=unit('lordbernhard',2,13,10);
  assert.deepEqual(supportBonuses(archer,[archer,lord],data),{haste:1,damage:1,range:3,trueStrike:true});
  lord.x=13.001;assert.deepEqual(supportBonuses(archer,[archer,lord],data),{haste:1,damage:1,range:0});
  lord.x=13;lord.state='ruin';assert.deepEqual(supportBonuses(archer,[archer,lord],data),{haste:1,damage:1,range:0});
  for(const inAura of [true,false]){
    const {g,source}=arena('archer'),support=unit('lordbernhard',2,inAura?13:13.001,10);support.cooldown=999;g.towers.push(support);
    const s=towerStats(source,data),e=enemy(g,source.x+s.range+2);e.evasion=1;g.rng=()=>.99;
    g.tick(.01);assert.equal(g.combat.projectiles.length,inAura?1:0,'support extends actual target acquisition');
    if(inAura){assert.equal(g.combat.projectiles[0].stats.trueStrike,true);g.combat.impact(g.combat.projectiles[0]);}
    assert.equal(e.hp,inAura?1e6-s.damage:1e6,'support grants an unevadable physical hit');
  }
});
