import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../game/core/game.js';
import {currentFactionData} from '../game/core/current-data.js';
import {serializeRun,restoreRun} from '../game/core/run-state.js';
import {recipeFamily} from '../game/core/recipes.js';
import {achievementCatalog,BOSS_TYPES,championMedalReward,streakAchievement,canonicalAchievementId as exportedCanonical,isSharedAchievement as exportedShared} from '../game/core/achievements.js';
import {eligibleChampion,achievementXP,canonicalAchievementId,isSharedAchievement} from '../game/core/account-progression.js';

const factions=['crown','forge','grove'];
const classXP={basic:1,intermediate:2,advanced:3,top:5,secret:8};
function flawless(game,count,start=1){for(let i=0;i<count;i++){game.emit('wave',{});game.emit('wave-complete',{round:start+i});}}

test('every champion classification earns faction-specific first-craft rewards, including Basic; recruits do not',()=>{
 for(const faction of factions){
  const data=currentFactionData(faction),catalog=achievementCatalog(data),champions=Object.entries(data.towers).filter(([,unit])=>unit.advanced);
  assert.equal(champions.length,38);assert.equal(catalog.filter(row=>row.kind==='champion').length,38);
  for(const [family,unit]of Object.entries(data.towers)){
   const id=`champion:${faction}:${family}`,row=catalog.find(row=>row.id===id);
   assert.equal(eligibleChampion(unit),!!unit.advanced);
   if(!unit.advanced){assert.equal(row,undefined);assert.equal(achievementXP(data,id),0);continue;}
   assert.equal(row.factionId,faction);assert.equal(isSharedAchievement(id),false);
   assert.equal(row.reward,unit.classification.toLowerCase()==='top'?3:1);
   assert.equal(row.xp,classXP[unit.classification.toLowerCase()]);
  }
  assert.deepEqual(catalog.filter(row=>row.kind==='collection').map(({target,reward,xp})=>({target,reward,xp})),[{target:5,reward:2,xp:3},{target:15,reward:4,xp:8},{target:30,reward:8,xp:15}]);
 }
 assert.equal(eligibleChampion({advanced:true,classification:' Basic '}),true);
 assert.equal(achievementXP({towers:{unit:{advanced:true,classification:' BASIC '}}},'champion:crown:unit'),1);
});

test('successful actual Basic crafts grant one medal and one XP, survive saving and do not consume RNG',()=>{
 let crafts=0;
 for(const faction of factions){
  const data=currentFactionData(faction);
  for(const recipe of data.recipes.filter(recipe=>data.towers[recipeFamily(recipe)]?.classification?.toLowerCase()==='basic')){
   assert.equal(!!recipe.currentRoundOnly,false);
   const game=new Game(data,{seed:451}),family=recipeFamily(recipe);game.phase='ready';game.economy.xp=data.balance.xpPerLevel*100;
   const pieces=recipe.ingredients.map((piece,i)=>({id:game.nextId++,family:piece.family,tier:piece.tier,state:'active',x:10+i,z:10,kills:0,mvpLevel:0}));
   game.towers.push(...pieces);for(const tower of pieces)assert.equal(game.grid.occupy(tower.x,tower.z,tower.id).ok,true);
   game.select(pieces[0].id);const rng=game.rng.getState();
   assert.equal(game.craft(recipe.id),true,`${faction}/${recipe.id}`);
   assert.equal(game.rng.getState(),rng);assert.equal(game.progress.champions.has(family),true);
   const expected={id:`champion:${faction}:${family}`,reward:1,factionId:faction};
   assert.deepEqual(game.progress.grants().filter(row=>row.id.startsWith('champion:')),[expected]);
   assert.equal(championMedalReward(data.towers[family]),1);assert.equal(achievementXP(data,expected.id),1);
   assert.equal(game.craft(recipe.id),false);assert.equal(game.progress.grants().filter(row=>row.id===expected.id).length,1);
   const snapshot=JSON.parse(JSON.stringify(serializeRun(game))),restored=restoreRun(data,snapshot);
   assert.deepEqual(serializeRun(restored),snapshot);assert.deepEqual(restored.progress.grants(),game.progress.grants());
   crafts++;
  }
 }
 assert.equal(crafts,21);
});

test('canonical shared keys preserve legacy boss/streak/collection aliases without touching faction champion/campaign keys',()=>{
 assert.equal(exportedCanonical,canonicalAchievementId);assert.equal(exportedShared,isSharedAchievement);
 for(const faction of [...factions,'global']){
  for(const boss of BOSS_TYPES){assert.equal(canonicalAchievementId(`boss:${faction}:${boss}`),`boss:global:${boss}`);assert.equal(isSharedAchievement(`boss:${faction}:${boss}`),true);}
  for(const count of [10,20,70,1000,9007199254740990]){assert.equal(canonicalAchievementId(`streak:${faction}:${count}`),`streak:global:${count}`);assert.equal(isSharedAchievement(`streak:${faction}:${count}`),true);}
  assert.equal(canonicalAchievementId(`boss-collection:${faction}`),'boss-collection:global');assert.equal(isSharedAchievement(`boss-collection:${faction}`),true);
 }
 for(const id of ['champion:crown:archer','collection:forge:5','campaign:grove','mythic:crown','endless:60','boss:other:host_10','boss:global:host_11','boss:crown:host_10:extra','boss-collection:forge:extra','streak:crown:0','streak:crown:11','streak:crown:010','streak:crown:-10','streak:crown:1e2','streak:global:9007199254741000','streak:global:11','']){
  assert.equal(canonicalAchievementId(id),id);assert.equal(isSharedAchievement(id),false,id);
 }
 for(const value of [null,undefined,0,{}]){assert.equal(canonicalAchievementId(value),value);assert.equal(isSharedAchievement(value),false);}
});

test('all factions expose and earn the same boss and streak milestones, with factionId:null and stable rewards',()=>{
 let expected;
 for(const faction of factions){
  const data=currentFactionData(faction),catalog=achievementCatalog(data,{streakBest:70});
  const shared=catalog.filter(row=>isSharedAchievement(row.id));
  assert.equal(shared.length,5+1+8);for(const row of shared)assert.equal(row.factionId,null);
  const comparable=shared.map(({id,reward,xp,target})=>({id,reward,xp,target}));
  if(expected)assert.deepEqual(comparable,expected);else expected=comparable;
  const collection=catalog.find(row=>row.id==='boss-collection:global');assert.equal(collection.reward,5);assert.equal(collection.xp,10);assert.equal(collection.target,5);
  const game=new Game(data,{seed:53});for(const type of BOSS_TYPES)game.emit('death',{enemy:{boss:true,type}});flawless(game,20);
  const grants=game.progress.grants().filter(row=>isSharedAchievement(row.id));
  assert.deepEqual(grants,[...BOSS_TYPES.map(boss=>({id:`boss:global:${boss}`,reward:2,factionId:null})),{id:'streak:global:10',reward:1,factionId:null},{id:'streak:global:20',reward:2,factionId:null}]);
  assert.equal(game.progress.bossKills,5);assert.deepEqual([...game.progress.bosses],BOSS_TYPES);
  assert.equal(streakAchievement(faction,7).id,'streak:global:70');assert.equal(streakAchievement('global',7).xp,7);
 }
});

test('shared streak eligibility uses each run best, never sums runs/factions; health loss and restore retain the run boundary',()=>{
 const runs=factions.map(faction=>new Game(currentFactionData(faction),{seed:61}));
 for(const game of runs){flawless(game,5);assert.equal(game.progress.grants().some(row=>row.id.startsWith('streak:')),false);}
 const game=runs[0],rng=game.rng.getState();flawless(game,15,6);assert.equal(game.progress.streakBest,20);
 game.emit('wave',{});game.emit('leak',{healthLost:1});game.emit('recover',{amount:1});game.emit('wave-complete',{round:21});flawless(game,9,22);
 assert.equal(game.progress.streak,9);assert.equal(game.progress.streakBest,20);
 const expected=game.progress.grants().filter(row=>row.id.startsWith('streak:'));assert.deepEqual(expected.map(row=>row.id),['streak:global:10','streak:global:20']);
 const snapshot=JSON.parse(JSON.stringify(serializeRun(game))),restored=restoreRun(game.data,snapshot);
 assert.deepEqual(serializeRun(restored),snapshot);assert.equal(restored.progress.streak,9);assert.equal(restored.progress.streakBest,20);assert.deepEqual(restored.progress.grants().filter(row=>row.id.startsWith('streak:')),expected);
 assert.equal(game.rng.getState(),rng);assert.equal(restored.rng.getState(),rng);assert.equal(runs[1].progress.streakBest,5);assert.equal(runs[2].progress.streakBest,5);
});
