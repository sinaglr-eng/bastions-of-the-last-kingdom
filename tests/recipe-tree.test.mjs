import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {recipeTreeProgress,expandedRecipeProgress,expandRecipeToBasics} from '../game/core/recipes.js';
import {recipeIngredientTree} from '../ui/grimoire.js';

const data=Object.fromEntries(['balance','towers','recipes'].map(key=>[key,JSON.parse(readFileSync(new URL(`../data/${key}.json`,import.meta.url)))]));
const recipe=data.recipes.find(r=>r.id==='highking');
const unit=(family,id,state='active',tier=1)=>({family,tier,id,state,placed:true});
const walk=nodes=>nodes.flatMap(node=>[node,...walk(node.children)]);
const leaves=nodes=>walk(nodes).filter(node=>!node.children.length);
const leafCounts=nodes=>{
  const totals=new Map();
  for(const leaf of leaves(nodes)){
    const key=`${leaf.family}:${leaf.tier}`,counts=totals.get(key)||{family:leaf.family,tier:leaf.tier,count:0,ownedCount:0,draftCount:0};
    counts.count++;
    const state=leaf.ownedCount?'active':leaf.draftCount?'draft':leaf.coveredBy?.state;
    if(state==='active')counts.ownedCount++;else if(state==='draft')counts.draftCount++;
    totals.set(key,counts);
  }
  return [...totals.values()];
};

test('Kingslayer shows three immediate champion branches with the exact nested eleven-recruit recipe',()=>{
  const tree=recipeTreeProgress(recipe,[],data);
  assert.deepEqual(tree.map(node=>({family:node.family,tier:node.tier})),recipe.ingredients);
  assert.deepEqual(tree.map(node=>data.towers[node.family].name),['Lionheart Champion','Knight','Frostbolt Watchmen']);
  assert.equal(tree.length,3);assert.equal(leaves(tree).length,11);
  assert.deepEqual(leafCounts(tree).map(({ownedCount,draftCount,...row})=>row),expandRecipeToBasics(recipe,data));
  const knight=tree.find(node=>node.family==='frostblade');
  assert.equal(knight.children.length,3);assert.equal(knight.children.filter(node=>node.children.length).length,1);
  assert.ok(leaves(tree).every(node=>node.count===1&&node.tier>=1&&node.tier<=6));
  const html=recipeIngredientTree(recipe,data,[]);
  assert.equal((html.match(/How to build this champion/g)||[]).length,3);
  assert.match(html,/1×F I/);assert.match(html,/1×S V/);assert.match(html,/recipe-tree-children/);
});

test('a retained champion owns only itself while explicitly covering its consumed ingredient subtree',()=>{
  const stock=[unit('frostblade',1),unit('rimewatch',2)],tree=recipeTreeProgress(recipe,stock,data);
  const matched=walk(tree).filter(node=>node.ownedCount);
  assert.equal(matched.length,2);assert.equal(new Set(matched.map(node=>node.inventoryIndex)).size,2);
  for(const node of matched){
    assert.equal(node.coveredBy,null);
    for(const child of walk(node.children)){
      assert.equal(child.ownedCount,0);assert.equal(child.draftCount,0);assert.equal(child.inventoryIndex,null);
      assert.deepEqual(child.coveredBy,{family:node.family,tier:1,state:'active'});
    }
  }
  assert.deepEqual(leafCounts(tree),expandedRecipeProgress(recipe,stock,data));
  assert.equal(leafCounts(tree).reduce((total,row)=>total+row.ownedCount,0),8);
  const html=recipeIngredientTree(recipe,data,stock);
  assert.match(html,/Included in built Knight/);assert.match(html,/1\/1 built/);
});

test('active leaves retain priority inside a provisional champion, with no duplicate inventory allocation',()=>{
  const stock=[unit('frostblade',1,'draft'),unit('frostwarden',2)],tree=recipeTreeProgress(recipe,stock,data);
  const actual=walk(tree).filter(node=>node.inventoryIndex!==null);
  assert.equal(actual.length,2);assert.equal(new Set(actual.map(node=>node.inventoryIndex)).size,2);
  const frost=actual.find(node=>node.family==='frostwarden');assert.equal(frost.ownedCount,1);assert.equal(frost.coveredBy,null);
  assert.deepEqual(leafCounts(tree),expandedRecipeProgress(recipe,stock,data));
  assert.equal(leafCounts(tree).reduce((sum,row)=>sum+row.draftCount,0),4);
  const html=recipeIngredientTree(recipe,data,stock);assert.match(html,/\+1 this round/);assert.match(html,/Included in this round’s Knight/);
});

test('duplicate ingredient branches conserve physical identities across active, draft, hidden and ruins',()=>{
  const repeated={...recipe,ingredients:Array.from({length:3},()=>({family:'rimewatch',tier:1}))};
  const champion=unit('rimewatch',1),recruit=unit('frostwarden',2,'draft');
  const stock=[champion,champion,{...champion},recruit,{...recruit},unit('frostwarden',3),
    {...unit('soldier',4,'draft'),placed:false},unit('stormcaller',5,'ruin'),unit('soldier',6,'active',2)];
  const before=JSON.stringify({stock,data});
  const tree=recipeTreeProgress(repeated,stock,data),actual=walk(tree).filter(node=>node.inventoryIndex!==null);
  assert.equal(actual.length,3);assert.deepEqual(actual.map(node=>node.towerId).sort(),[1,2,3]);
  assert.equal(tree.filter(node=>node.ownedCount).length,1);assert.equal(tree.filter(node=>node.draftCount).length,0);
  assert.deepEqual(leafCounts(tree),expandedRecipeProgress(repeated,stock,data));
  assert.equal(JSON.stringify({stock,data}),before);
});

test('every fixed recipe retains finite complete branches and tree totals agree with flat progress',()=>{
  const stock=Object.entries(data.towers).flatMap(([family,s],index)=>(s.advanced?[1]:[1,2,3,4,5,6]).map(tier=>unit(family,index*10+tier,index%2?'active':'draft',tier)));
  for(const r of data.recipes){
    const tree=recipeTreeProgress(r,stock,data),nodes=walk(tree),actual=nodes.filter(node=>node.inventoryIndex!==null);
    assert.equal(tree.length,3,r.id);assert.ok(nodes.length<100,r.id);
    assert.equal(new Set(actual.map(node=>node.inventoryIndex)).size,actual.length,r.id);
    assert.deepEqual(leafCounts(tree),expandedRecipeProgress(r,stock,data),r.id);
    assert.ok(nodes.every(node=>node.ownedCount+node.draftCount<=1));
  }
});

test('malformed chains reject cycles, missing recipes and excessive depth rather than hiding requirements',()=>{
  const cyclic=structuredClone(data);cyclic.recipes.find(r=>r.id==='rimewatch').ingredients[0]={family:'rimewatch',tier:1};
  assert.throws(()=>recipeTreeProgress(recipe,[],cyclic),/Cyclic champion recipe/);
  assert.throws(()=>recipeTreeProgress(recipe,[],{...data,recipes:data.recipes.filter(r=>r.id!=='rimewatch')}),/Missing fixed recipe/);
  const long={towers:{basic:{},end:{advanced:true}},recipes:[]};
  for(let i=0;i<18;i++){const family=`c${i}`;long.towers[family]={advanced:true};long.recipes.push({id:family,ingredients:[{family:i===17?'basic':`c${i+1}`,tier:1},{family:'basic',tier:1},{family:'basic',tier:1}]});}
  const top={id:'end',ingredients:[{family:'c0',tier:1},{family:'basic',tier:1},{family:'basic',tier:1}]};long.recipes.push(top);
  assert.throws(()=>recipeTreeProgress(top,[],long),/finite display limit/);
});
