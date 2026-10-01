import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Game} from '../game/core/game.js';
import {expandRecipeToBasics,expandedRecipeProgress,recipeFamily,mergePartner} from '../game/core/recipes.js';

const data=Object.fromEntries(['balance','towers','enemies','waves','recipes'].map(key=>[
  key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))
]));
const kingslayer=data.recipes.find(recipe=>recipe.id==='highking');
const unit=(family,tier,id,state='active')=>({family,tier,id,state,kills:0,x:10+id,z:10});
const byKey=rows=>Object.fromEntries(rows.map(({family,tier,...counts})=>[`${family}:${tier}`,counts]));
const ownedTotal=rows=>rows.reduce((total,row)=>total+row.ownedCount,0);

test('Kingslayer recursively requires eleven recruits with repeated exact ranks aggregated',()=>{
  const before=JSON.stringify(data),rows=expandRecipeToBasics(kingslayer,data);
  assert.deepEqual(byKey(rows),{
    'soldier:5':{count:1},'soldier:3':{count:1},'stormcaller:3':{count:1},
    'frostwarden:1':{count:2},'soldier:1':{count:2},'stormcaller:1':{count:2},
    'archer:2':{count:1},'mage:3':{count:1}
  });
  assert.equal(rows.reduce((total,row)=>total+row.count,0),11);
  assert.equal(JSON.stringify(data),before,'The breakdown cannot alter approved recipes or stats');
});

test('all 37 fixed recipes resolve entirely to valid basic ranks',()=>{
  for(const recipe of data.recipes){
    const rows=expandRecipeToBasics(recipe,data);
    assert.ok(rows.length,recipeFamily(recipe));
    assert.equal(new Set(rows.map(row=>`${row.family}:${row.tier}`)).size,rows.length);
    for(const row of rows){
      assert.equal(data.towers[row.family].advanced,undefined,row.family);
      assert.ok(row.tier>=1&&row.tier<=6);assert.ok(Number.isInteger(row.count)&&row.count>0);
      assert.equal(Object.hasOwn(row,'ownedCount'),false);
    }
  }
});

test('ready ingredient champions satisfy only their allotted subtree without requiring consumed recruits again',()=>{
  const knight=unit('frostblade',1,1),watchman=unit('rimewatch',1,2),lionheart=unit('roseguard',1,3);
  const first=expandedRecipeProgress(kingslayer,[knight],data);
  assert.equal(ownedTotal(first),5);
  for(const key of ['frostwarden:1','soldier:1','stormcaller:1','archer:2','mage:3'])assert.equal(byKey(first)[key].ownedCount,1);
  const second=expandedRecipeProgress(kingslayer,[knight,watchman,unit('frostblade',1,4)],data);
  assert.equal(ownedTotal(second),8,'An extra Knight does not cover an unrelated recipe branch');
  const complete=expandedRecipeProgress(kingslayer,[knight,watchman,lionheart,unit('frostwarden',1,5)],data);
  assert.equal(ownedTotal(complete),11);
  assert.ok(complete.every(row=>row.ownedCount===row.count));
  assert.equal(ownedTotal(expandedRecipeProgress(kingslayer,[unit('highking',1,6)],data)),0,'Building another Kingslayer still requires ingredients');
});

test('basic inventory respects rank, state and physical identity and never exceeds requested amounts',()=>{
  const soldier=unit('soldier',1,1,'draft');
  const stock=[soldier,soldier,{...soldier},unit('soldier',2,2),unit('stormcaller',1,3,'ruin'),
    unit('frostwarden',1,4),unit('frostwarden',1,5),unit('frostwarden',1,6)];
  const progress=byKey(expandedRecipeProgress(kingslayer,stock,data));
  assert.equal(progress['soldier:1'].ownedCount,1);
  assert.equal(progress['stormcaller:1'].ownedCount,0);
  assert.equal(progress['frostwarden:1'].ownedCount,2);
  assert.equal(ownedTotal(Object.values(progress)),3);
});

test('a single owned champion cannot satisfy three repeated champion ingredient nodes',()=>{
  const recipe={...kingslayer,ingredients:Array.from({length:3},()=>({family:'rimewatch',tier:1}))};
  const stock=[unit('rimewatch',1,1),unit('frostwarden',1,2),unit('frostwarden',1,3)];
  const progress=byKey(expandedRecipeProgress(recipe,stock,data));
  assert.deepEqual(progress,{
    'frostwarden:1':{count:3,ownedCount:3},
    'soldier:1':{count:3,ownedCount:1},
    'stormcaller:1':{count:3,ownedCount:1}
  });
});

test('malformed recipe chains fail explicitly instead of recursing forever or dropping required ingredients',()=>{
  const cyclic=structuredClone(data),watchman=cyclic.recipes.find(recipe=>recipe.id==='rimewatch');
  watchman.ingredients[0]={family:'rimewatch',tier:1};
  assert.throws(()=>expandRecipeToBasics(kingslayer,cyclic),/Cyclic champion recipe/);
  const missing={...data,recipes:data.recipes.filter(recipe=>recipe.id!=='rimewatch')};
  assert.throws(()=>expandRecipeToBasics(kingslayer,missing),/Missing fixed recipe/);
  assert.throws(()=>expandRecipeToBasics({...kingslayer,resultTier:2},data),/Only fixed champion recipes/);
});

test('recruit merging still advances each matching draft pair from I through VI and stops at VI',()=>{
  for(const tier of [1,2,3,4,5,6]){
    const game=new Game(data,{seed:1});game.phase='select';
    game.towers=Array.from({length:5},(_,index)=>({...unit(index<2?'soldier':'archer',index<2?tier:1,index+1,'draft'),round:game.round}));
    game.draft.draws=game.towers.map(tower=>({placed:true,towerId:tower.id}));game.selected=1;
    assert.equal(!!mergePartner(game.selection,game.towers,data),tier<6);
    assert.equal(game.merge(),tier<6);
    assert.equal(game.selection.tier,tier<6?tier+1:6);
    if(tier<6){assert.equal(game.phase,'ready');assert.equal(game.towers.filter(tower=>tower.state==='active').length,1);}
  }
});
