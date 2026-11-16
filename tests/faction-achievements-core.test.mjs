import test from 'node:test';
import assert from 'node:assert/strict';
import {Game} from '../game/core/game.js';
import {currentFactionData} from '../game/core/current-data.js';
import {achievementCatalog,BOSS_TYPES} from '../game/core/achievements.js';
import {achievementXP,eligibleChampion,canonicalAchievementId,isSharedAchievement} from '../game/core/account-progression.js';
import {FACTION_ACHIEVEMENT_DEFINITIONS,factionCollectionAchievements} from '../game/core/faction-achievements.js';
import {recipeFamily} from '../game/core/recipes.js';
import {serializeRun,restoreRun} from '../game/core/run-state.js';

const factions=['crown','forge','grove'];

test('each faction keeps its existing wave-50 identity and payout with an explicit faction victory label',()=>{
 for(const faction of factions){const data=currentFactionData(faction),definition=FACTION_ACHIEVEMENT_DEFINITIONS[faction],catalog=achievementCatalog(data),campaign=catalog.filter(row=>row.kind==='campaign');
  assert.equal(campaign.length,1);assert.equal(campaign[0].id,`campaign:${faction}`);assert.equal(campaign[0].factionId,faction);assert.equal(campaign[0].name,`${definition.factionName} Wave 50 Victory`);assert.equal(campaign[0].reward,5);assert.equal(campaign[0].xp,8);assert.match(campaign[0].description,/Complete all of wave 50.*legal/);assert.match(campaign[0].description,/boss alone is not enough/);assert.equal(isSharedAchievement(campaign[0].id),false);
 }
});

for(const faction of factions)test(`${faction} wave-50 boss death alone never earns the faction victory; clearing remaining enemies does`,()=>{
 const data=currentFactionData(faction),g=new Game(data,{seed:97,mode:'campaign',waveLimit:50});g.round=50;g.phase='combat';g.combat.spawnQueue=[];
 const boss=g.combat.spawn('host_50'),ordinary=g.combat.spawn('host_01');boss.hp=1;ordinary.hp=1000;ordinary.maxHp=1000;ordinary.speed=0;ordinary.regen=0;
 g.combat.damage(boss,1e9,'holy');assert.equal(boss.dead,true);g.advanceTicks(1);assert.equal(g.phase,'combat');assert.equal(g.progress.campaign,false);assert.equal(g.progress.grants().some(row=>row.id===`campaign:${faction}`),false);assert.equal(g.progress.grants().some(row=>row.id==='boss:global:host_50'),true);
 g.combat.damage(ordinary,1e9,'holy');g.advanceTicks(1);assert.equal(g.phase,'won');assert.equal(g.progress.campaign,true);assert.deepEqual(g.progress.grants().filter(row=>row.id.startsWith('campaign:')),[{id:`campaign:${faction}`,reward:5,factionId:faction}]);
 const restored=restoreRun(data,JSON.parse(JSON.stringify(serializeRun(g))));assert.equal(restored.progress.campaign,true);assert.deepEqual(restored.progress.grants(),g.progress.grants());
});

test('complete roster achievements require all 38 actual champions, including Basic and Secret, with no draft families',()=>{
 const ids=new Set();
 for(const faction of factions){const data=currentFactionData(faction),catalog=achievementCatalog(data),all=catalog.find(row=>row.id===`collection:${faction}:all`),expected=Object.keys(data.towers).filter(id=>eligibleChampion(data.towers[id]));
  assert.equal(all.factionId,faction);assert.equal(all.target,38);assert.equal(all.reward,12);assert.equal(all.xp,20);assert.equal(achievementXP(data,all.id),20);assert.equal(new Set(all.requiredChampions).size,38);assert.deepEqual(all.requiredChampions,expected);assert.equal(isSharedAchievement(all.id),false);assert.equal(canonicalAchievementId(all.id),all.id);
  assert.ok(all.requiredChampions.some(id=>data.towers[id].classification.toLowerCase()==='basic'));assert.ok(all.requiredChampions.some(id=>data.towers[id].classification.toLowerCase()==='secret'));assert.ok(all.requiredChampions.every(id=>data.towers[id].advanced));
  for(const id of all.requiredChampions){const others=new Set(all.requiredChampions.filter(candidate=>candidate!==id));assert.equal(all.requiredChampions.every(candidate=>others.has(candidate)),false,`${faction}/${id} must not be optional`);}
  for(const row of catalog){assert.equal(ids.has(row.id)&&!isSharedAchievement(row.id)&&row.kind!=='endless',false,row.id);ids.add(row.id);}
 }
});

test('thematic faction achievements define three distinct current champions, preserve shared boss/streak rules and reject unknown XP IDs',()=>{
 for(const faction of factions){const data=currentFactionData(faction),definition=FACTION_ACHIEVEMENT_DEFINITIONS[faction],catalog=achievementCatalog(data),rows=factionCollectionAchievements(data),theme=catalog.find(row=>row.id===definition.thematic.id);
  assert.equal(rows.length,2);assert.equal(theme.kind,'faction-collection');assert.equal(theme.factionId,faction);assert.equal(theme.target,3);assert.equal(theme.reward,4);assert.equal(theme.xp,6);assert.equal(achievementXP(data,theme.id),6);assert.deepEqual(theme.requiredChampions,definition.thematic.champions);assert.equal(new Set(theme.requiredChampions).size,3);
  for(const id of theme.requiredChampions){assert.equal(eligibleChampion(data.towers[id]),true);assert.ok(data.recipes.some(recipe=>recipeFamily(recipe)===id));assert.ok(theme.description.includes(data.towers[id].name));}
  assert.equal(isSharedAchievement(theme.id),false);assert.equal(canonicalAchievementId(theme.id),theme.id);assert.equal(catalog.filter(row=>row.kind==='faction-collection').length,1);
  assert.deepEqual(catalog.filter(row=>row.id.startsWith('boss:')).map(row=>row.id),BOSS_TYPES.map(id=>`boss:global:${id}`));assert.ok(catalog.filter(row=>row.kind==='streak').every(row=>row.id.startsWith('streak:global:')&&row.factionId===null));
  for(const id of [`faction:${faction}:missing`,theme.id+':extra',`collection:${faction}:all:extra`])assert.equal(achievementXP(data,id),0,id);
 }
 assert.deepEqual(factionCollectionAchievements({factionId:'other',towers:{}}),[]);assert.equal(achievementXP(currentFactionData('crown'),'collection:other:all'),0);
});

test('thematic evidence comes from actual successful crafts across separate runs, with no award for a known starting discovery',()=>{
 let crafts=0;
 for(const faction of factions){const data=currentFactionData(faction),row=factionCollectionAchievements(data).find(row=>row.kind==='faction-collection'),earned=new Set();
  const known=new Game(data,{discoveries:row.requiredChampions});assert.equal(known.progress.champions.size,0);assert.equal(known.progress.grants().some(grant=>grant.id.startsWith('champion:')),false);
  for(const family of row.requiredChampions){const recipe=data.recipes.find(recipe=>recipeFamily(recipe)===family),g=new Game(data,{seed:103});g.phase='ready';g.economy.xp=data.balance.xpPerLevel*100;assert.equal(!!recipe.currentRoundOnly,false);
   const pieces=recipe.ingredients.map((piece,i)=>({id:g.nextId++,family:piece.family,tier:piece.tier,state:'active',x:10+i,z:10,kills:0,mvpLevel:0}));g.towers.push(...pieces);for(const tower of pieces)assert.equal(g.grid.occupy(tower.x,tower.z,tower.id).ok,true);g.select(pieces[0].id);const rng=g.rng.getState();assert.equal(g.craft(recipe.id),true,`${faction}/${family}`);assert.equal(g.rng.getState(),rng);assert.deepEqual([...g.progress.champions],[family]);earned.add(g.progress.grants().find(grant=>grant.id===`champion:${faction}:${family}`).id);crafts++;
  }
  assert.equal(row.requiredChampions.every(id=>earned.has(`champion:${faction}:${id}`)),true);assert.equal(row.requiredChampions.every(id=>earned.has(`champion:${faction==='crown'?'forge':'crown'}:${id}`)),false);
 }
 assert.equal(crafts,9);
});
