// The approved JSON files are the source of truth for balance and recipe topology.
// This tool validates them; it never regenerates them from an older reference roster.
// --refresh-presentation may update catalog labels and model categories only.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {CHAMPIONS,SIEGE_KINDS} from '../game/render/champion-catalog.js';
import {recipeFamily,recipeTier} from '../game/core/recipes.js';
import {championClassification} from '../game/render/champion-classification.js';

const args=process.argv.slice(2);
assert.ok(args.every(arg=>arg==='--refresh-presentation'),'Usage: node tools/author-roster.mjs [--refresh-presentation]');
const towerPath=new URL('../data/towers.json',import.meta.url);
const towers=JSON.parse(readFileSync(towerPath,'utf8'));
const recipes=JSON.parse(readFileSync(new URL('../data/recipes.json',import.meta.url),'utf8'));
const basic=Object.entries(towers).filter(([,unit])=>!unit.advanced);
const champions=Object.entries(towers).filter(([,unit])=>unit.advanced);
assert.equal(basic.length,8,'The approved roster has eight basic classes');
assert.equal(champions.length,39,'The approved roster has 37 ordinary and two secret champions');
assert.equal(recipes.length,39,'The approved roster has 39 fixed recipes');
assert.deepEqual(Object.keys(CHAMPIONS).sort(),champions.map(([family])=>family).sort(),'Catalog and champion IDs must match');
const codes=new Set();
for(const [family,unit] of basic){
  assert.match(unit.unitCode,/^[A-Z]$/,family+' needs a one-letter unit code');
  assert.ok(!codes.has(unit.unitCode),'Basic unit codes must be unique');codes.add(unit.unitCode);
  assert.equal(unit.levels.length,6,family+' needs six explicit ranks');
  for(const stats of unit.levels){assert.ok(Number.isFinite(stats.damage)&&stats.damage>=0);assert.ok(Number.isFinite(stats.interval)&&stats.interval>0);assert.ok(Number.isFinite(stats.range)&&stats.range>0);}
}
const byResult=new Map();
for(const recipe of recipes){
  const family=recipeFamily(recipe);
  assert.ok(towers[family]?.advanced,recipe.id+': invalid result family');
  assert.equal(recipeTier(recipe),1,recipe.id+': fixed recipes produce champion rank I');
  assert.ok(!byResult.has(family),family+': duplicate fixed recipe');byResult.set(family,recipe);
  assert.equal(recipe.ingredients.length,3,recipe.id+': exactly three ingredients are required');
  if(towers[family].secret){
    assert.equal(recipe.currentRoundOnly,true,recipe.id+': secret recipes require the current round');
    assert.equal(championClassification(family),'Secret');
    assert.ok(recipe.ingredients.every(i=>!towers[i.family]?.advanced),recipe.id+': secret ingredients are basic defenders');
  }else assert.ok(!recipe.currentRoundOnly,recipe.id+': ordinary recipes retain their existing inventory rules');
  for(const ingredient of recipe.ingredients){
    assert.ok(towers[ingredient.family],recipe.id+': unknown ingredient '+ingredient.family);
    assert.ok(Number.isInteger(ingredient.tier)&&ingredient.tier>=1&&ingredient.tier<=(towers[ingredient.family].advanced?1:6),recipe.id+': invalid ingredient rank');
  }
}
// A fixed recipe may require completed champions, but cannot depend on itself.
const reached=new Set();
while(reached.size<champions.length){
  const next=champions.filter(([family])=>!reached.has(family)&&byResult.get(family)?.ingredients.every(i=>!towers[i.family].advanced||reached.has(i.family)));
  assert.ok(next.length,'Champion recipes must be reachable without circular dependencies');
  for(const [family] of next)reached.add(family);
}
for(const [family] of basic)for(let tier=1;tier<=6;tier++)assert.ok(recipes.some(r=>r.ingredients.some(i=>i.family===family&&i.tier===tier)),family+' rank '+tier+' is missing from the approved recipe list');
for(const [family,unit] of champions){
  assert.ok(Number.isFinite(unit.damage)&&unit.damage>=0,family+': invalid damage');
  assert.ok(Number.isFinite(unit.interval)&&unit.interval>0,family+': invalid attack interval');
  assert.ok(Number.isFinite(unit.range)&&unit.range>0,family+': invalid range');
}
if(args.includes('--refresh-presentation')){
  for(const [family,unit] of champions){
    const spec=CHAMPIONS[family];
    Object.assign(unit,{name:spec.name,short:spec.name,description:spec.description,model:spec.kind,unitKind:SIEGE_KINDS.includes(spec.kind)?'siege':'champion'});
  }
  writeFileSync(towerPath,JSON.stringify(towers,null,2)+'\n');
  console.log('Refreshed champion presentation from the catalog; approved balance and recipes were preserved.');
}else for(const [family,unit] of champions){
  assert.equal(unit.name,CHAMPIONS[family].name,family+': catalog name differs; review or use --refresh-presentation');
  assert.equal(unit.model,CHAMPIONS[family].kind,family+': model category differs');
}
console.log('Validated eight basic classes × six ranks, 37 ordinary champions, two current-round secrets and 39 exact three-defender recipes. All 48 basic ranks are used.');
