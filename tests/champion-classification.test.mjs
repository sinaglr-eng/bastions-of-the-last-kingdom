import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CHAMPIONS} from '../game/render/champion-catalog.js';
import {allRecipes,recipeFamily,recipeTier} from '../game/core/recipes.js';
import {
  CHAMPION_CLASSIFICATIONS,
  CLASSIFICATION_LEVELS,
  championClassification,
  championAuraLevel
} from '../game/render/champion-classification.js';

const towers=JSON.parse(readFileSync(new URL('../data/towers.json',import.meta.url)));
const recipes=JSON.parse(readFileSync(new URL('../data/recipes.json',import.meta.url)));
const champions=Object.keys(towers).filter(family=>towers[family].advanced);
const basics=Object.keys(towers).filter(family=>!towers[family].advanced);

test('visual classifications cover exactly the 39 approved champion families',()=>{
  assert.deepEqual(Object.keys(CHAMPION_CLASSIFICATIONS).sort(),champions.sort());
  assert.deepEqual(Object.keys(CHAMPIONS).sort(),champions);
  const counts={Basic:0,Intermediate:0,Advanced:0,TOP:0,Secret:0};
  for(const family of champions){
    const classification=championClassification(family);
    assert.ok(Object.hasOwn(counts,classification),family);
    counts[classification]++;
  }
  assert.deepEqual(counts,{Basic:5,Intermediate:13,Advanced:11,TOP:8,Secret:2});
});

test('fixed recipe reference classifications agree with the verified wiki Towers table',()=>{
  assert.equal(recipes.length,39);
  assert.equal(new Set(recipes.filter(r=>!r.currentRoundOnly).map(recipe=>recipe.referenceTower)).size,37);
  assert.equal(new Set(recipes.map(recipe=>recipe.referenceTower)).size,38,'Lord Bernhard intentionally shares Diamond Cullinan with Nature Spirit');
  for(const recipe of recipes){
    assert.ok(recipe.referenceTower?.trim(),recipe.id+' needs its source tower');
    const expected=recipe.stage;
    assert.equal(championClassification(recipeFamily(recipe)),expected,recipe.referenceTower);
  }
  // These source distinctions are easy to confuse with champion names.
  assert.equal(championClassification('archangel'),'Advanced');
  assert.equal(championClassification('dawnspire'),'TOP');
  assert.equal(championClassification('royalarsenal'),'TOP');
  assert.equal(championClassification('roseguard'),'Intermediate');
  assert.equal(championAuraLevel('rimewatch'),0);
  assert.equal(championAuraLevel('frostblade'),1);
  assert.equal(championAuraLevel('highking'),2);
  assert.equal(championAuraLevel('mothernature'),3);
  assert.equal(championAuraLevel('ladyclaire'),4);
  assert.equal(championAuraLevel('lordbernhard'),4);
});

test('all basic defender ranks and unknown families receive no classification aura',()=>{
  assert.equal(basics.length,8);
  for(const family of basics){
    assert.equal(towers[family].levels.length,6);
    assert.equal(championClassification(family),null,family);
    assert.equal(championAuraLevel(family),0,family);
  }
  for(const family of ['unknown','toString','constructor','__proto__',undefined,null]){
    assert.equal(championClassification(family),null);
    assert.equal(championAuraLevel(family),0);
  }
});

test('all 38 available fixed outputs retain their family classification and produce rank I champions, with Bernhard archived',()=>{
  const fixed=allRecipes({towers,recipes});assert.equal(fixed.length,38);
  assert.deepEqual(fixed.map(recipeFamily).sort(),champions.filter(family=>!towers[family].hidden));
  assert.equal(towers.lordbernhard.hidden,true);assert.ok(recipes.some(recipe=>recipeFamily(recipe)==='lordbernhard'));
  for(const recipe of fixed){
    assert.equal(recipeTier(recipe),1);
    const family=recipeFamily(recipe),classification=championClassification(family);
    assert.equal(classification,recipe.stage);
    assert.equal(championAuraLevel(family),CLASSIFICATION_LEVELS[classification]);
  }
});
