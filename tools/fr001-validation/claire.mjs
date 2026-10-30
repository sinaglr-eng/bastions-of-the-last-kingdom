import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {Game} from '../../game/core/game.js';
import {DraftManager} from '../../game/core/draft.js';
import {seededRandom} from '../../game/core/math.js';
import {constructionMasteryForRound} from '../../game/core/progression.js';
import {createFactionData} from '../../game/core/factions.js';
import {campaignTowers,campaignRecipes,campaignEnemies,campaignWaves} from '../../game/core/campaign-roster.js';

const root=fileURLToPath(new URL('../../',import.meta.url));
const out=resolve(root,'output/releases/v0.6.2/fr001/claire');
const read=path=>JSON.parse(readFileSync(resolve(root,path),'utf8'));
const sha=path=>createHash('sha256').update(readFileSync(resolve(root,path))).digest('hex');
const registry=read('data/factions-v060.json');
const current={balance:read('data/balance.json'),towers:campaignTowers(read('data/towers.json')),recipes:campaignRecipes(read('data/recipes.json')),enemies:campaignEnemies(read('data/enemies.json')),waves:campaignWaves(read('data/waves.json'))};
const protectedFiles=['package.json','data/balance.json','data/factions-v060.json','data/recipes.json','data/towers.json','game/core/game.js','game/core/draft.js','game/core/recipes.js','game/core/factions.js','game/core/math.js','game/core/progression.js'];
const before=Object.fromEntries(protectedFiles.map(path=>[path,sha(path)]));
const expected={crown:['mage','druid','frostwarden'],forge:['dw_runesmith','dw_furnacetender','dw_engineer'],grove:['el_spark_adept','el_sealweaver','el_drow_cinder']};
const datasets=Object.fromEntries(['crown','forge','grove'].map(id=>{
 const data=createFactionData(current,registry,id);

 const recipe=data.recipes.find(r=>r.id==='ladyclaire');
 assert.deepEqual(recipe.ingredients,expected[id].map(family=>({family,tier:5})));
 assert.equal(recipe.currentRoundOnly,true);assert.equal(recipe.level,1);assert.equal(recipe.ingredients.length,3);
 assert.equal(new Set(recipe.ingredients.map(i=>i.family)).size,3);
 for(const ingredient of recipe.ingredients){assert.equal(data.towers[ingredient.family].advanced,false);assert.equal(data.towers[ingredient.family].weight,1);}
 return [id,data];
}));

function searchSeed(data){
 const recipe=data.recipes.find(r=>r.id==='ladyclaire'),mastery=constructionMasteryForRound(25,data.balance);
 for(let seed=1;seed<=200000;seed++){
  const draft=new DraftManager(data,seededRandom(seed));draft.roll(mastery);
  const draws=Array.from({length:5},(_,i)=>draft.reveal(i));
  if(recipe.ingredients.every(p=>draws.some(d=>d.family===p.family&&d.tier===p.tier)))return {seed,draws:draws.map(d=>({family:d.family,tier:d.tier}))};
 }
 throw Error('No natural positive seed found within search range');
}
const seeds=Object.fromEntries(Object.entries(datasets).map(([id,data])=>[id,searchSeed(data)]));
function naturalDraft(id){
 const data=datasets[id],g=new Game(data,{seed:seeds[id].seed});
 // This is a controlled round-25 state fixture, not a claim of playing to round 25.
 // Family/rank fields are never forced: the normal seeded DraftManager generates them.
 g.round=25;g.economy.setConstructionRound(25);g.draft.roll(g.economy.mastery);
 for(let i=0;i<5;i++)assert.equal(g.place(10+i,10),true);
 assert.equal(g.phase,'select');assert.equal(g.draft.forced,null);
 assert.deepEqual(g.draft.draws.map(d=>({family:d.family,tier:d.tier})),seeds[id].draws);
 const recipe=g.recipes.find(r=>r.id==='ladyclaire');
 const pieces=recipe.ingredients.map(p=>g.towers.find(t=>t.family===p.family&&t.tier===p.tier));
 assert.ok(pieces.every(Boolean));assert.equal(new Set(pieces.map(t=>t.id)).size,3);
 return {g,recipe,pieces,fillers:g.towers.filter(t=>!pieces.includes(t))};
}
function atomicState(g){return {towers:structuredClone(g.towers),occupied:[...g.grid.occupied],gold:g.economy.gold,phase:g.phase,discoveries:[...g.discoveries],resolved:g.draft.resolved};}
const cases=[];
function test(id,name,fn){fn();cases.push({factionId:id,name,passed:true});}
for(const id of Object.keys(datasets)){
 for(let anchor=0;anchor<3;anchor++)test(id,`Natural seeded draft crafts from ingredient anchor ${anchor+1}`,()=>{
  const {g,pieces,fillers}=naturalDraft(id),chosen=pieces[anchor],position=[chosen.x,chosen.z],gold=g.economy.gold,occupied=g.grid.occupied.size;
  let combine=0;g.on(type=>{if(type==='combine')combine++;});g.select(chosen.id);
  assert.ok(g.availableRecipes().some(r=>r.id==='ladyclaire'));
  assert.equal(g.previewRecipe('ladyclaire'),true);assert.equal(g.recipePreview.recipe.id,'ladyclaire');assert.equal(g.recipePreview.pieces.length,3);
  assert.equal(g.craft('ladyclaire'),true);assert.equal(chosen.family,'ladyclaire');assert.equal(chosen.tier,1);assert.equal(chosen.state,'active');assert.equal(g.phase,'ready');
  assert.deepEqual([chosen.x,chosen.z],position);assert.equal(g.economy.gold,gold);assert.equal(g.grid.occupied.size,occupied);
  assert.equal(g.towers.filter(t=>t.state==='active').length,1);assert.equal(g.towers.filter(t=>t.state==='ruin').length,4);assert.ok(fillers.every(t=>t.state==='ruin'));
  assert.equal(combine,1);assert.equal(g.draft.resolved,true);assert.equal(g.discoveries.has('ladyclaire'),true);
  assert.equal(g.craft('ladyclaire'),false);assert.equal(combine,1);
 });
 const negative=[
  ['Retained ingredient',({pieces})=>pieces[1].state='active'],
  ['Wrong rank',({pieces})=>pieces[1].tier=4],
  ['Stale round',({g,pieces})=>pieces[1].round=g.round-1],
  ['Incomplete placement',({g})=>g.draft.draws[4].placed=false],
  ['Foreign ingredient family',({pieces})=>pieces[1].family=id==='crown'?'dw_runesmith':'mage'],
  ['Forged draw identity',({g,pieces})=>g.draft.draws.find(d=>d.towerId===pieces[1].id).towerId=9999],
  ['Duplicate draw identity',({g})=>g.draft.draws[4].towerId=g.draft.draws[3].towerId],
  ['Noningredient anchor',({g,fillers})=>g.select(fillers[0].id)],
  ['Reserved required ingredient',({g,pieces})=>{g.select(pieces[1].id);assert.equal(g.reserve(),true);g.select(pieces[0].id);}]
 ];
 for(const [name,mutate]of negative)test(id,name,()=>{
  const fixture=naturalDraft(id);fixture.g.select(fixture.pieces[0].id);mutate(fixture);
  const state=atomicState(fixture.g);
  assert.equal(fixture.g.availableRecipes().some(r=>r.id==='ladyclaire'),false);assert.equal(fixture.g.craft('ladyclaire'),false);assert.deepEqual(atomicState(fixture.g),state);
 });
 for(const phase of ['build','ready','reward','combat','won','lost'])test(id,`Reject phase ${phase}`,()=>{
  const {g,pieces}=naturalDraft(id);g.select(pieces[0].id);g.phase=phase;const state=atomicState(g);
  assert.equal(g.craft('ladyclaire'),false);assert.deepEqual(atomicState(g),state);
 });
 test(id,'An unrelated reserved filler does not block the three unreserved ingredients',()=>{
  const {g,pieces,fillers}=naturalDraft(id);g.select(fillers[0].id);assert.equal(g.reserve(),true);g.select(pieces[0].id);assert.equal(g.craft('ladyclaire'),true);
  assert.equal(g.towers.filter(t=>t.state==='active').length,1);assert.equal(g.towers.filter(t=>t.state==='reserved').length,1);
 });
}

function returnedReserveDraft(id,seed){
 const data=datasets[id],g=new Game(data,{seed});
 g.round=25;g.economy.setConstructionRound(25);g.draft.roll(g.economy.mastery);
 for(let i=0;i<5;i++)assert.equal(g.place(10+i,10),true);
 const recipe=g.recipes.find(r=>r.id==='ladyclaire');
 const carried=g.roundCandidates.map(c=>c.tower).find(t=>recipe.ingredients.some(p=>p.family===t.family&&p.tier===t.tier));
 if(!carried)return null;
 const priorDraws=g.draft.draws.map(d=>({family:d.family,tier:d.tier,towerId:d.towerId,origin:d.origin}));
 const carriedId=carried.id,carriedPosition=[carried.x,carried.z],carriedFamily=carried.family;
 g.select(carriedId);assert.equal(g.reserve(),true);assert.equal(carried.state,'reserved');
 const keep=g.roundCandidates.map(c=>c.tower).find(t=>t.id!==carriedId);g.select(keep.id);assert.equal(g.keep(),true);assert.equal(g.phase,'ready');
 // Unit fixture at the wave-reward boundary: no combat, enemy clearing or
 // campaign victory is represented. The reserve and next-draft transitions
 // themselves use the real reserve(), keep() and nextRound() APIs.
 g.phase='reward';assert.equal(g.nextRound(),true);assert.equal(g.round,26);
 assert.equal(g.draft.draws[0].origin,'reserve');assert.equal(g.draft.draws[0].towerId,carriedId);assert.equal(g.draft.draws[0].placed,true);
 assert.equal(carried.state,'draft');assert.equal(carried.round,26);assert.deepEqual([carried.x,carried.z],carriedPosition);
 assert.equal(g.draft.draws[0].protectedFromReroll,true);assert.equal(g.draft.forced,null);
 for(let i=0;i<4;i++)assert.equal(g.place(15+i,10),true);
 assert.equal(g.phase,'select');assert.equal(g.draft.draws.length,5);
 const pool=g.roundCandidates.map(c=>c.tower),pieces=recipe.ingredients.map(p=>pool.find(t=>t.family===p.family&&t.tier===p.tier));
 if(!pieces.every(Boolean))return null;
 assert.ok(pieces.includes(carried));assert.equal(new Set(pieces.map(t=>t.id)).size,3);
 assert.equal(pieces.filter(t=>g.draft.draws.find(d=>d.towerId===t.id).origin==='random').length,2);
 return {g,pieces,carried,priorKeeper:keep,proof:{seed,priorRound:25,currentRound:26,priorDraws,carriedId,carriedFamily,carriedPosition,currentDraws:g.draft.draws.map(d=>({family:d.family,tier:d.tier,towerId:d.towerId,origin:d.origin,placed:d.placed})),transition:'Actual reserve(), keep(), then nextRound() at a controlled reward boundary; four remaining candidates are normal unforced RNG draws.'}};
}
const returnedReserveProofs=[];
for(const id of Object.keys(datasets)){
 let found=null;
 for(let seed=1;seed<=30000&&!found;seed++)found=returnedReserveDraft(id,seed);
 assert.ok(found,`No returned-reserve proof found for ${id}`);
 returnedReserveProofs.push({factionId:id,...found.proof});
 for(let anchor=0;anchor<3;anchor++)test(id,`Returned reserve from previous round crafts from ingredient anchor ${anchor+1}`,()=>{
  const {g,pieces,carried,priorKeeper}=returnedReserveDraft(id,found.proof.seed),chosen=pieces[anchor];
  assert.equal(priorKeeper.state,'active');assert.equal(priorKeeper.round,25);
  assert.ok(pieces.every(t=>t.round===26&&t.state==='draft'));assert.ok(pieces.includes(carried));
  g.select(chosen.id);assert.ok(g.availableRecipes().some(r=>r.id==='ladyclaire'));
  assert.equal(g.craft('ladyclaire'),true);assert.equal(chosen.family,'ladyclaire');assert.equal(chosen.state,'active');assert.equal(g.phase,'ready');assert.equal(g.draft.resolved,true);
  assert.equal(priorKeeper.state,'active');assert.notEqual(priorKeeper.family,'ladyclaire');assert.equal(g.draft.reservedDefender,null);
 });
}

const gcd=(a,b)=>b?gcd(b,a%b):a;
function probability(rankVWeight,totalWeight=100){
 const n=BigInt(rankVWeight),d=BigInt(totalWeight*8),power=x=>x**5n;
 const numerator=power(d)-3n*power(d-n)+3n*power(d-2n*n)-power(d-3n*n),denominator=power(d),g=gcd(numerator,denominator);
 // Independent exhaustive enumeration of four mutually exclusive draw categories.
 let enumerated=0n;
 for(let sequence=0;sequence<4**5;sequence++){
  let v=sequence,mult=1n,mask=0;
  for(let i=0;i<5;i++){const category=v%4;v=Math.floor(v/4);if(category<3){mask|=1<<category;mult*=n;}else mult*=d-3n*n;}
  if(mask===7)enumerated+=mult;
 }
 assert.equal(enumerated,numerator);
 return {rankVWeight,oneSpecificFamilyVProbability:rankVWeight/totalWeight/8,exactFraction:`${numerator/g}/${denominator/g}`,probability:Number(numerator)/Number(denominator),percent:100*Number(numerator)/Number(denominator)};
}
const schedule=current.balance.mastery.map((row,index)=>({masteryIndex:index,masteryLabel:row.level,...probability(row.weights[4],row.weights.reduce((sum,x)=>sum+x,0))}));
const rounds=Array.from({length:50},(_,i)=>({round:i+1,masteryIndex:constructionMasteryForRound(i+1,current.balance),...schedule[constructionMasteryForRound(i+1,current.balance)]}));
const reachedAll50Chance=1-rounds.reduce((p,r)=>p*(1-r.probability),1);
assert.deepEqual(before,Object.fromEntries(protectedFiles.map(path=>[path,sha(path)])),'Runtime files changed during the isolated audit');
const mappings=[
 {human:'Mage V',humanId:'mage',dwarves:'Runesmith V',dwarfId:'dw_runesmith',elves:'Stormspear V',elfId:'el_spark_adept',reason:'Spellcasting slot; exact rank and draft rarity retained. Abilities and damage need not be identical.'},
 {human:'Druid V',humanId:'druid',dwarves:'Blacksmith V',dwarfId:'dw_furnacetender',elves:'Nightweaver Spider V',elfId:'el_drow_cinder',reason:'Damage and debuff slot; exact rank and draft rarity retained. Burn, poison and armor reduction are different kits.'},
 {human:'Frost Warden V',humanId:'frostwarden',dwarves:'Dwarf Miner V',dwarfId:'dw_engineer',elves:'Lunar Spirit Shaman V',elfId:'el_sealweaver',reason:'Utility slot; exact rank and draft rarity retained. Slow, protection and immunity support are different kits.'}
];
const report={requirementId:'FR-001',date:'2026-10-30',status:'actual implemented 0.6.2 Game validation; no candidate recipe overlay',baselineVersion:read('package.json').version,rulesetRevision:registry.revision,
 findings:{allThreeRecipesAlreadyPresent:true,currentRecipesNeedNoIngredientChange:true,sameValueDefinition:'Three distinct basic family rank-V ingredients, each family weight 1 of 8, identical rank probability and recipe level. Rank-V abstract merge weight is 16 each, total 48. This is equal recruitment rarity and rank, not equal combat power.',secretName:'Lady Claire',canonicalResultId:'ladyclaire',currentRoundOnly:true,recipeLevel:1},mappings,
 recipes:Object.entries(datasets).map(([id,data])=>({factionId:id,factionName:data.factionName,recipe:data.recipes.find(r=>r.id==='ladyclaire'),ingredientNames:data.recipes.find(r=>r.id==='ladyclaire').ingredients.map(p=>`${data.towers[p.family].name} V`),seed:seeds[id].seed,naturalSeededDraws:seeds[id].draws})),
 tests:{cases:cases.length,passed:cases.length,failures:0,casesList:cases,returnedReserveProofs,fixture:'Controlled round-25 state, standard unforced seeded family/rank rolls, actual Game.place for route-valid foundations and actual Game.craft. Nine additional cases reserve an actual prior-round candidate, keep another, call nextRound() at a controlled reward boundary and roll four normal fresh candidates. No reserve origin is forged. These fixtures do not claim a complete played campaign or simulated wave survival.'},
 chance:{method:'Exact inclusion-exclusion for three distinct family-V categories among five draws, independently verified by exhaustive 4^5 category enumeration at all 16 mastery rows.',formula:'1 - 3*(1-q)^5 + 3*(1-2*q)^5 - (1-3*q)^5, q = rank-V draw probability / 8',assumptions:'Five fresh ordinary draws, eight equally weighted families, identical shared mastery rows; no reroll, reserve or previous inventory. All three factions therefore have the exact same chance. A rare Secret is possible, not guaranteed in each run.',firstPossibleRound:rounds.find(r=>r.probability>0).round,maximumMastery:schedule.at(-1),masterySchedule:schedule,roundSchedule:rounds,conditionalChanceIfEveryFreshDraftThroughRound50IsOffered:{probability:reachedAll50Chance,percent:100*reachedAll50Chance,qualification:'Conditional mathematical opportunity across 50 offered fresh drafts; excludes deaths, rerolls/reserves, merge choices and competing ordinary crafts, so it is not an observed acquisition or win rate.'}},
 preservation:{protectedFiles:before,verifiedUnchanged:true,approvedCandidateHashes:Object.fromEntries(['forge','grove'].map(id=>[id,sha(`output/releases/v0.6.2/fr001/inputs/${id}-recipes.json`)]))},
 notes:['The existing all-faction recipes already satisfy the requested local-faction rank equivalence. The implementation requirement should lock and regression-test them rather than arbitrarily replace an already correct triple.','A newly reserved required ingredient cannot be consumed; reserving an unrelated filler is legal and leaves the other three eligible ingredients.','The current secret contract requires membership in the current five-place draft, not the fresh-roll-only condition used for rank-VI merges. A returned reserve in the next draft is a current candidate under existing Human rules. No stricter fresh-only Claire rule was introduced.','A different-faction family or a retained battlefield defender cannot substitute for a current ingredient, even if it has rank V.']};
mkdirSync(out,{recursive:true});writeFileSync(resolve(out,'claire-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passedCases:cases.length,recipes:report.recipes.map(({factionName,ingredientNames,seed})=>({factionName,ingredientNames,seed})),returnedReserveSeeds:returnedReserveProofs.map(({factionId,seed})=>({factionId,seed})),maxMastery:schedule.at(-1),firstPossibleRound:report.chance.firstPossibleRound,conditionalAll50Chance:report.chance.conditionalChanceIfEveryFreshDraftThroughRound50IsOffered.percent,protectedFilesUnchanged:true},null,2));
