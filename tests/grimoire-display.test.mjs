import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {towerStats} from '../game/core/math.js';
import {championClassification} from '../game/render/champion-classification.js';
import {baseAttackDps,abilityLines,championRecipeCard,basicRecipeBreakdown,recipeProgressLegend,defenderGuide,BASE_DPS_NOTE} from '../ui/grimoire.js';

const data=Object.fromEntries(['balance','towers','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));

test('base DPS excludes criticals, multiple targets, damage over time and support bonuses',()=>{
  assert.equal(baseAttackDps({damage:100,interval:.5,critChance:1,critMultiplier:20,multishot:10,poisonDps:384,burnAura:7500,aura:{haste:5,damageBonus:.5}}),200);
  assert.equal(baseAttackDps(towerStats({family:'embercrown',tier:1},data)),0,'a fire aura does not become basic attack DPS');
  assert.equal(baseAttackDps(towerStats({family:'frostblade',tier:1},data)),525);
  assert.match(BASE_DPS_NOTE,/before armor or resistance/);
  assert.match(BASE_DPS_NOTE,/extra targets and ally bonuses/);
});

test('support descriptions explain numeric blessings and separate stacking chants',()=>{
  const priest=abilityLines(towerStats({family:'sunward',tier:1},data)).join(' ');
  assert.match(priest,/\+60% ally attack speed within 5 tiles/);
  assert.match(priest,/\+50% ally damage within 5 tiles/);
  const monk=abilityLines(towerStats({family:'monk',tier:1},data)).join(' ');
  assert.match(monk,/\+50% and \+60%/);assert.match(monk,/combine to \+110%/);
  assert.match(monk,/matching chants do not stack/);assert.doesNotMatch(monk,/Aura [45]/);
  const angel=abilityLines(towerStats({family:'archangel',tier:1},data)).join(' ');
  assert.match(angel,/180 damage each/);assert.match(angel,/allied magic hits within 6 tiles/);
  assert.match(angel,/own attacks do not trigger/);
});

test('each of 39 fixed champion cards uses classification, descriptions, damage and base DPS',()=>{
  const before=JSON.stringify(data);
  const cards=data.recipes.map(recipe=>championRecipeCard({...recipe,stage:'Mythic'},data,{}));
  assert.equal(cards.length,39);
  cards.forEach((html,index)=>{
    const family=data.recipes[index].resultFamily||data.recipes[index].id;
    assert.ok(html.includes(championClassification(family).toUpperCase()));
    assert.ok(html.includes(data.towers[family].description));
    assert.match(html,/Damage \/ hit/);assert.match(html,/Base DPS/);
    assert.match(html,/Combine these 3 defenders/);assert.doesNotMatch(html,/MYTHIC|Ascension|Aura [45]/);
  });
  assert.equal(JSON.stringify(data),before,'rendering does not modify balancing data');
  assert.doesNotMatch(defenderGuide(data,{}),/ascension|ascend/i);
});

test('pinned higher recipes show champion branches, aggregated basic totals and actual crafting ingredients',()=>{
  const recipe=data.recipes.find(r=>(r.resultFamily||r.id)==='highking');
  const knight={id:1,family:'frostblade',tier:1,state:'active'};
  const html=championRecipeCard(recipe,data,{}, {pinned:true,towerList:[knight]});
  assert.match(html,/Full crafting chain/);assert.match(html,/How to build this champion/);assert.match(html,/Basic recruit totals/);assert.match(html,/2×F I/);
  assert.match(html,/2×S I/);assert.match(html,/2×T I/);
  for(const ingredient of recipe.ingredients)assert.ok(html.includes(data.towers[ingredient.family].name));
  assert.match(html,/pinned-progress/);assert.doesNotMatch(html,/Existing ingredient champions cover their recruits/);
});

test('fully covered draft recipes show blue provisional counts and zero retained ownership',()=>{
  const recipe=data.recipes.find(r=>r.id==='highking');
  const candidates=recipe.ingredients.map((piece,index)=>({...piece,id:index+1,state:'draft',placed:true}));
  const html=recipeProgressLegend()+basicRecipeBreakdown(recipe,data,candidates);
  assert.match(html,/<span class="owned-progress">Built<\/span>/);
  assert.match(html,/<span class="draft-progress">This round<\/span>/);
  assert.equal((html.match(/class="draft-available"/g)||[]).length,8);
  assert.equal((html.match(/<b class="">0\//g)||[]).length,8);
  const counts=[...html.matchAll(/class="draft-progress">\+(\d+) this round/g)].map(match=>Number(match[1]));
  assert.equal(counts.reduce((sum,count)=>sum+count,0),11);
  assert.doesNotMatch(html,/<b class="owned-progress">/);
});

test('mixed recruit rows label retained counts separately from visible candidates',()=>{
  const recipe=data.recipes.find(r=>r.id==='highking');
  const stock=[{id:1,family:'frostwarden',tier:1,state:'active'},
    {id:2,family:'frostwarden',tier:1,state:'draft',placed:true},
    {id:3,family:'soldier',tier:1,state:'draft',placed:false}];
  const html=basicRecipeBreakdown(recipe,data,stock);
  assert.match(html,/<b class="owned-progress">1\/2<\/b><small class="draft-progress">\+1 this round<\/small>/);
  assert.equal((html.match(/this round/g)||[]).length,1,'an unplaced draw cannot show provisional progress');
});
